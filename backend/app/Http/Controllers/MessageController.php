<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Requests\Message\SendMessageRequest;
use App\Services\MessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    /**
     * Wire chat orchestration used by message, thread, and contact endpoints.
     */
    public function __construct(private MessageService $messageService)
    {
    }

    /**
     * Return the authenticated user's chat threads with unread and latest-message metadata.
     */
    public function threads(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->messageService->listThreads($request->user()),
        ]);
    }

    /**
     * Return the contacts the authenticated user is allowed to message.
     */
    public function contacts(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->messageService->getAvailableContacts(
                $request->user(),
                $request->query('search')
            ),
        ]);
    }

    /**
     * Return the full conversation history between the current user and one counterpart.
     */
    public function conversation(Request $request, int $userId): JsonResponse
    {
        $counterpart = User::find($userId);

        if (!$counterpart) {
            return response()->json([
                'message' => 'Kontak tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'data' => $this->messageService->getConversation($request->user(), $counterpart),
        ]);
    }

    /**
     * Validate and persist one outbound chat message from the authenticated user.
     */
    public function send(SendMessageRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $message = $this->messageService->sendMessage($request->user(), $validated);

        return response()->json([
            'message' => 'Pesan berhasil dikirim.',
            'data' => $this->messageService->presentMessage($message, $request->user()),
        ], 201);
    }
}
