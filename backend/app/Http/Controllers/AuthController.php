<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Requests\Auth\ChangePasswordRequest;
use App\Requests\Auth\ForgotPasswordRequest;
use App\Requests\Auth\LoginRequest;
use App\Requests\Auth\RegisterRequest;
use App\Requests\Auth\ResetPasswordRequest;
use App\Requests\Auth\UpdateProfileRequest;
use App\Services\AuditLogService;
use App\Services\AuthService;
use App\Services\SecurityEventService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    private const FORGOT_PASSWORD_SUCCESS_MESSAGE = 'Jika email terdaftar, link reset password telah dikirim ke email Anda.';
    private const RESET_PASSWORD_SUCCESS_MESSAGE = 'Password berhasil diubah. Silakan login dengan password baru Anda.';
    private const RESET_PASSWORD_INVALID_MESSAGE = 'Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link baru.';

    /**
     * Wire auth orchestration plus audit and security logging dependencies.
     */
    public function __construct(
        private AuthService $authService,
        private AuditLogService $auditLogService,
        private SecurityEventService $securityEventService,
    )
    {
    }

    /**
     * Register a new user
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = $this->authService->register($validated);
        $token = $this->authService->createToken($user);
        $this->auditLogService->record('auth.register_succeeded', [
            'action' => 'register',
            'step' => 'create_user',
            'result' => 'success',
        ], $user, AuthService::class);

        return response()->json([
            'message' => 'User registered successfully',
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    /**
     * Login user
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = $this->authService->getUserByEmail($validated['email']);
        $identifierHash = $this->hashIdentifier($validated['email']);

        if (!$user) {
            $this->securityEventService->record('auth.login_failed', [
                'action' => 'login',
                'step' => 'find_user',
                'identifier_hash' => $identifierHash,
                'result' => 'failed',
            ], null, 'warning', AuthService::class);

            return response()->json([
                'message' => 'Email tidak terdaftar.',
                'errors' => [
                    'email' => ['Email tidak terdaftar.'],
                ],
            ], 422);
        }

        if (!Hash::check($validated['password'], $user->password)) {
            $this->securityEventService->record('auth.login_failed', [
                'action' => 'login',
                'step' => 'verify_password',
                'identifier_hash' => $identifierHash,
                'target_user_id' => $user->id,
                'result' => 'failed',
            ], null, 'warning', AuthService::class);

            return response()->json([
                'message' => 'Password salah. Periksa kembali password Anda.',
                'errors' => [
                    'password' => ['Password salah. Periksa kembali password Anda.'],
                ],
            ], 422);
        }

        if (!$user->isActive()) {
            $this->securityEventService->record('auth.login_blocked_suspended', [
                'action' => 'login',
                'step' => 'ensure_user_active',
                'result' => 'denied',
            ], $user, 'warning', AuthService::class);

            return response()->json([
                'message' => 'Akun Anda sedang dinonaktifkan. Hubungi superadmin KerjaNusa untuk bantuan lebih lanjut.',
                'reason' => 'account_suspended',
            ], 403);
        }

        $token = $this->authService->createToken($user);
        $this->auditLogService->record('auth.login_succeeded', [
            'action' => 'login',
            'step' => 'create_token',
            'result' => 'success',
        ], $user, AuthService::class);

        return response()->json([
            'message' => 'Login successful',
            'user' => $user,
            'token' => $token,
        ]);
    }

    /**
     * Send forgot-password link
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $validated = $request->validated();

        PasswordBroker::sendResetLink([
            'email' => $validated['email'],
        ]);
        $this->auditLogService->record('auth.password_reset_requested', [
            'action' => 'forgot_password',
            'step' => 'send_reset_link',
            'identifier_hash' => $this->hashIdentifier($validated['email']),
            'result' => 'accepted',
        ], null, AuthService::class);

        return response()->json([
            'message' => self::FORGOT_PASSWORD_SUCCESS_MESSAGE,
        ]);
    }

    /**
     * Reset password using email token
     */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $status = PasswordBroker::reset(
            [
                'email' => $validated['email'],
                'password' => $validated['password'],
                'password_confirmation' => $validated['password_confirmation'],
                'token' => $validated['token'],
            ],
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status === PasswordBroker::PASSWORD_RESET) {
            $this->auditLogService->record('auth.password_reset_succeeded', [
                'action' => 'reset_password',
                'step' => 'reset_password',
                'identifier_hash' => $this->hashIdentifier($validated['email']),
                'result' => 'success',
            ], null, AuthService::class);

            return response()->json([
                'message' => self::RESET_PASSWORD_SUCCESS_MESSAGE,
            ]);
        }

        $this->securityEventService->record('auth.password_reset_failed', [
            'action' => 'reset_password',
            'step' => 'validate_reset_token',
            'identifier_hash' => $this->hashIdentifier($validated['email']),
            'result' => 'failed',
        ], null, 'warning', AuthService::class);

        return response()->json([
            'message' => self::RESET_PASSWORD_INVALID_MESSAGE,
            'errors' => [
                'token' => [self::RESET_PASSWORD_INVALID_MESSAGE],
            ],
        ], 422);
    }

    /**
     * Logout user
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $request->user()->currentAccessToken()->delete();
        $this->auditLogService->record('auth.logout_succeeded', [
            'action' => 'logout',
            'step' => 'delete_current_token',
            'result' => 'success',
        ], $user, AuthService::class);

        return response()->json([
            'message' => 'Logout successful',
        ]);
    }

    /**
     * Get current user
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }

    /**
     * Update user profile
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $success = $this->authService->updateProfile($request->user()->id, $validated);

        if (!$success) {
            return response()->json([
                'message' => 'Failed to update profile',
            ], 400);
        }

        $this->auditLogService->record('user.profile_updated', [
            'action' => 'update_profile',
            'step' => 'persist_profile',
            'changed_fields' => array_keys($validated),
            'result' => 'success',
        ], $request->user(), AuthService::class);

        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => $request->user()->fresh(),
        ]);
    }

    /**
     * Change password
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $success = $this->authService->changePassword(
            $request->user()->id,
            $validated['old_password'],
            $validated['new_password']
        );

        if (!$success) {
            $this->securityEventService->record('auth.password_change_failed', [
                'action' => 'change_password',
                'step' => 'verify_current_password',
                'result' => 'failed',
            ], $request->user(), 'warning', AuthService::class);

            return response()->json([
                'message' => 'Failed to change password',
            ], 400);
        }

        $this->auditLogService->record('auth.password_changed', [
            'action' => 'change_password',
            'step' => 'persist_new_password',
            'result' => 'success',
        ], $request->user(), AuthService::class);

        return response()->json([
            'message' => 'Password changed successfully',
        ]);
    }

    /**
     * Hash a user-supplied identifier so controllers can log it without exposing the raw value.
     */
    private function hashIdentifier(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalizedValue = trim(mb_strtolower($value));

        if ($normalizedValue === '') {
            return null;
        }

        return hash('sha256', $normalizedValue);
    }
}
