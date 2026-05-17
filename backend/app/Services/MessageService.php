<?php

namespace App\Services;

use App\Models\Job;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;

class MessageService
{
    /**
     * Wire chat access, presentation, and logging dependencies.
     */
    public function __construct(
        private MessageAccessService $messageAccessService,
        private MessagePresenter $messagePresenter,
        private ServiceActivityLogService $serviceActivityLogService,
    )
    {
    }

    /**
     * Fail fast when the messages table is missing instead of mutating schema at runtime.
     */
    private function ensureMessagesTableExists(): void
    {
        static $schemaReady = false;

        if ($schemaReady) {
            return;
        }

        if (Schema::hasTable('messages')) {
            $schemaReady = true;
            return;
        }

        $context = [
            'action' => 'chat',
            'step' => 'ensure_messages_table_exists',
            'request_id' => request()->attributes->get('request_id'),
        ];

        Log::error('Chat message storage is unavailable because the messages table is missing.', $context);
        $this->serviceActivityLogService->error(
            $this,
            'message_service.storage_unavailable',
            $context
        );

        throw new ServiceUnavailableHttpException(
            null,
            'Layanan chat belum aktif karena storage pesan belum siap. Sinkronkan migrasi production untuk tabel messages.'
        );
    }

    /**
     * Return grouped conversation threads for the authenticated chat user.
     */
    public function listThreads(User $user): array
    {
        $this->ensureMessagesTableExists();

        $messages = Message::query()
            ->with(['sender', 'recipient', 'job'])
            ->where(function (Builder $query) use ($user) {
                $query->where('sender_id', $user->id)
                    ->orWhere('recipient_id', $user->id);
            })
            ->orderByDesc('created_at')
            ->get();

        return $messages
            ->groupBy(function (Message $message) use ($user) {
                return $message->sender_id === $user->id
                    ? (string) $message->recipient_id
                    : (string) $message->sender_id;
            })
            ->map(fn ($threadMessages) => $this->messagePresenter->presentThread($threadMessages, $user))
            ->sortByDesc('updated_at')
            ->values()
            ->all();
    }

    /**
     * Load the full conversation between two users and mark inbound messages as read.
     */
    public function getConversation(User $user, User $counterpart): array
    {
        $this->ensureMessagesTableExists();
        $this->messageAccessService->assertCanCommunicate($user, $counterpart);

        Message::query()
            ->where('sender_id', $counterpart->id)
            ->where('recipient_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return Message::query()
            ->with(['sender', 'recipient', 'job'])
            ->where(function (Builder $query) use ($user, $counterpart) {
                $query->where(function (Builder $nestedQuery) use ($user, $counterpart) {
                    $nestedQuery->where('sender_id', $user->id)
                        ->where('recipient_id', $counterpart->id);
                })->orWhere(function (Builder $nestedQuery) use ($user, $counterpart) {
                    $nestedQuery->where('sender_id', $counterpart->id)
                        ->where('recipient_id', $user->id);
                });
            })
            ->orderBy('created_at')
            ->get()
            ->map(fn (Message $message) => $this->messagePresenter->presentMessage($message, $user))
            ->values()
            ->all();
    }

    /**
     * Return the contacts this user is allowed to chat with, optionally filtered by search.
     */
    public function getAvailableContacts(User $user, ?string $search = null): array
    {
        $normalizedSearch = strtolower(trim((string) $search));
        $contactQuery = $this->messageAccessService->buildAvailableContactsQuery($user);

        return $contactQuery
            ->orderBy('role')
            ->orderBy('company_name')
            ->orderBy('name')
            ->get()
            ->filter(function (User $contact) use ($normalizedSearch) {
                if ($normalizedSearch === '') {
                    return true;
                }

                $haystack = strtolower(implode(' ', array_filter([
                    $contact->name,
                    $contact->company_name,
                    $contact->email,
                ])));

                return str_contains($haystack, $normalizedSearch);
            })
            ->map(fn (User $contact) => $this->messagePresenter->presentUser($contact))
            ->values()
            ->all();
    }

    /**
     * Persist a new chat message after validating recipient and optional job context.
     */
    public function sendMessage(User $sender, array $payload): Message
    {
        $this->ensureMessagesTableExists();

        $recipient = User::findOrFail($payload['recipient_id']);
        $this->messageAccessService->assertCanCommunicate($sender, $recipient);

        $messageBody = trim((string) $payload['body']);

        if ($messageBody === '') {
            throw ValidationException::withMessages([
                'body' => ['Pesan tidak boleh kosong.'],
            ]);
        }

        $job = null;

        if (!empty($payload['job_id'])) {
            $job = Job::find($payload['job_id']);

            if (!$job) {
                throw ValidationException::withMessages([
                    'job_id' => ['Lowongan percakapan tidak ditemukan.'],
                ]);
            }

            if (!$this->messageAccessService->canReferenceJob($sender, $recipient, $job)) {
                throw ValidationException::withMessages([
                    'job_id' => ['Anda tidak bisa memakai lowongan ini sebagai konteks percakapan.'],
                ]);
            }
        }

        return Message::create([
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'job_id' => $job?->id,
            'body' => $messageBody,
        ])->load(['sender', 'recipient', 'job']);
    }

    /**
     * Delegate one message payload to the presenter used by chat responses.
     */
    public function presentMessage(Message $message, User $viewer): array
    {
        return $this->messagePresenter->presentMessage($message, $viewer);
    }
}
