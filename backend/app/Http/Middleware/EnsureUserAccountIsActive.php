<?php

namespace App\Http\Middleware;

use App\Services\SecurityEventService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnsureUserAccountIsActive
{
    /**
     * Wire security logging used when suspended accounts try to access protected routes.
     */
    public function __construct(private SecurityEventService $securityEventService)
    {
    }

    /**
     * Block suspended accounts from using authenticated routes.
     */
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();

        if (!$user || $user->isActive()) {
            return $next($request);
        }

        $user->currentAccessToken()?->delete();
        $this->securityEventService->record('auth.suspended_access_blocked', [
            'action' => 'authorize_request',
            'step' => 'ensure_active_account',
            'result' => 'denied',
        ], $user);

        return response()->json([
            'message' => 'Akun Anda sedang dinonaktifkan. Hubungi superadmin KerjaNusa untuk bantuan lebih lanjut.',
            'reason' => 'account_suspended',
        ], JsonResponse::HTTP_FORBIDDEN);
    }
}
