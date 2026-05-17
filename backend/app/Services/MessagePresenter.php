<?php

namespace App\Services;

use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Collection;

class MessagePresenter
{
    public function presentThread(Collection $threadMessages, User $viewer): array
    {
        /** @var Message $latestMessage */
        $latestMessage = $threadMessages->first();
        $counterpart = $latestMessage->sender_id === $viewer->id
            ? $latestMessage->recipient
            : $latestMessage->sender;

        return [
            'contact' => $this->presentUser($counterpart),
            'job' => $latestMessage->job ? [
                'id' => $latestMessage->job->id,
                'title' => $latestMessage->job->title,
            ] : null,
            'last_message' => $latestMessage->body,
            'updated_at' => optional($latestMessage->created_at)->toIso8601String(),
            'unread_count' => $threadMessages
                ->where('recipient_id', $viewer->id)
                ->whereNull('read_at')
                ->count(),
            'message_count' => $threadMessages->count(),
        ];
    }

    public function presentMessage(Message $message, User $viewer): array
    {
        return [
            'id' => $message->id,
            'body' => $message->body,
            'created_at' => optional($message->created_at)->toIso8601String(),
            'read_at' => optional($message->read_at)->toIso8601String(),
            'is_mine' => $message->sender_id === $viewer->id,
            'sender' => $this->presentUser($message->sender),
            'recipient' => $this->presentUser($message->recipient),
            'job' => $message->job ? [
                'id' => $message->job->id,
                'title' => $message->job->title,
            ] : null,
        ];
    }

    public function presentUser(?User $user): ?array
    {
        if (!$user) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'role' => $user->role,
            'email' => $user->email,
            'company_name' => $user->company_name,
        ];
    }
}
