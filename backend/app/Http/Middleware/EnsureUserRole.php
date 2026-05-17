<?php

namespace App\Http\Middleware;

use App\Services\SecurityEventService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnsureUserRole
{
    /**
     * Wire security logging used when role-based access is denied.
     */
    public function __construct(private SecurityEventService $securityEventService)
    {
    }

    /**
     * Ensure the authenticated user has at least one of the allowed roles.
     */
    public function handle(Request $request, Closure $next, string ...$roles): mixed
    {
        $user = $request->user();

        if (!$user || !$user->hasAnyRole($roles)) {
            $this->securityEventService->record('auth.role_denied', [
                'action' => 'authorize_request',
                'step' => 'ensure_user_role',
                'allowed_roles' => $roles,
                'result' => 'denied',
            ], $user);

            return response()->json([
                'message' => 'Forbidden',
            ], JsonResponse::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
