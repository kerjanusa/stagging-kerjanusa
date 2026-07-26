<?php

namespace App\Http\Controllers;

use App\Http\Resources\CandidateResumeResource;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
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
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Support\Str;
use Throwable;

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

        [$user, $token] = DB::transaction(function () use ($validated): array {
            $user = $this->authService->register($validated);
            $token = $this->authService->createToken($user);

            return [$user, $token];
        });

        $this->auditLogService->record('auth.register_succeeded', [
            'action' => 'register',
            'step' => 'create_user_and_token',
            'result' => 'success',
        ], $user, AuthService::class);

        return response()->json([
            'message' => 'User registered successfully',
            'user' => $this->presentAuthenticatedUser($user),
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
            'user' => $this->presentAuthenticatedUser($user),
            'token' => $token,
        ]);
    }

    /**
     * Redirect a public login request to one supported OAuth provider.
     */
    public function redirectToOAuthProvider(Request $request, string $provider): RedirectResponse
    {
        $provider = $this->normalizeOAuthProvider($provider);

        if (!$provider) {
            return $this->redirectOAuthFailure('Provider login tidak didukung.');
        }

        try {
            $role = $this->normalizeOAuthRole($request->query('role'));
            $config = $this->oauthProviderConfig($request, $provider);
            $state = $this->buildOAuthState($provider, $role);
            $redirectUrl = $this->buildProviderAuthorizationUrl($provider, $config, $state);

            return redirect()->away($redirectUrl);
        } catch (Throwable $exception) {
            Log::warning('auth.oauth_redirect_failed', [
                'event_name' => 'auth.oauth_redirect_failed',
                'action' => 'oauth_redirect',
                'provider' => $provider,
                'exception_class' => $exception::class,
                'result' => 'failed',
            ]);

            return $this->redirectOAuthFailure(
                sprintf('Login %s belum dikonfigurasi.', $this->oauthProviderLabel($provider))
            );
        }
    }

    /**
     * Complete OAuth login and hand the created Sanctum token back to the frontend callback page.
     */
    public function handleOAuthProviderCallback(Request $request, string $provider): RedirectResponse
    {
        $provider = $this->normalizeOAuthProvider($provider);

        if (!$provider) {
            return $this->redirectOAuthFailure('Provider login tidak didukung.');
        }

        if ($request->filled('error')) {
            return $this->redirectOAuthFailure(
                sprintf('Login %s dibatalkan.', $this->oauthProviderLabel($provider))
            );
        }

        $state = $this->parseOAuthState($request->query('state'));

        if (!$state || ($state['provider'] ?? null) !== $provider) {
            return $this->redirectOAuthFailure('Sesi login sudah kedaluwarsa. Silakan coba lagi.');
        }

        $code = trim((string) $request->query('code', ''));

        if ($code === '') {
            return $this->redirectOAuthFailure('Kode login tidak diterima. Silakan coba lagi.');
        }

        try {
            $config = $this->oauthProviderConfig($request, $provider);
            $profile = $this->fetchOAuthProfile($provider, $config, $code);
            $requestedRole = $this->normalizeOAuthRole($state['role'] ?? null);

            [$user, $token] = DB::transaction(function () use ($profile, $provider, $requestedRole): array {
                $user = $this->findOrCreateOAuthUser($profile, $provider, $requestedRole);

                if (!$user->isActive()) {
                    throw new \RuntimeException('oauth_account_suspended');
                }

                return [$user, $this->authService->createToken($user)];
            });

            $this->auditLogService->record('auth.oauth_login_succeeded', [
                'action' => 'oauth_login',
                'provider' => $provider,
                'step' => 'create_token',
                'result' => 'success',
            ], $user, AuthService::class);

            return $this->redirectOAuthSuccess($token);
        } catch (Throwable $exception) {
            Log::warning('auth.oauth_callback_failed', [
                'event_name' => 'auth.oauth_callback_failed',
                'action' => 'oauth_callback',
                'provider' => $provider,
                'exception_class' => $exception::class,
                'exception_message' => $exception->getMessage(),
                'result' => 'failed',
            ]);

            return $this->redirectOAuthFailure(
                $this->oauthFailureMessage($provider, $exception->getMessage())
            );
        }
    }

    /**
     * Send forgot-password link
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $debugResetUser = null;
        $debugResetToken = null;

        try {
            $validated = $request->validated();
            $identifierHash = $this->hashIdentifier($validated['email']);
            $broker = PasswordBroker::broker();
            $candidateUser = $broker->getUser([
                'email' => $validated['email'],
            ]);

            if (is_object($candidateUser)) {
                $debugResetUser = $candidateUser;
                $debugResetToken = $broker->createToken($candidateUser);

                try {
                    if (method_exists($candidateUser, 'sendPasswordResetNotification')) {
                        $candidateUser->sendPasswordResetNotification($debugResetToken);
                    }
                } catch (Throwable $exception) {
                    $this->securityEventService->record('auth.password_reset_delivery_failed', [
                        'action' => 'forgot_password',
                        'step' => 'send_reset_link',
                        'identifier_hash' => $identifierHash,
                        'result' => 'degraded',
                        'exception_class' => $exception::class,
                        'exception_message' => $exception->getMessage(),
                    ], null, 'error', AuthService::class);

                    return response()->json([
                        'message' => self::FORGOT_PASSWORD_SUCCESS_MESSAGE,
                    ] + $this->passwordResetDebugPayload($debugResetUser, $debugResetToken));
                }
            }

            $this->auditLogService->record('auth.password_reset_requested', [
                'action' => 'forgot_password',
                'step' => 'send_reset_link',
                'identifier_hash' => $identifierHash,
                'result' => 'accepted',
            ], null, AuthService::class);

            error_log(sprintf(
                'forgot_password_state user=%s token=%s expose=%s',
                is_object($debugResetUser) ? get_class($debugResetUser) : 'null',
                $debugResetToken ? 'yes' : 'no',
                $this->shouldExposePasswordResetLink() ? 'yes' : 'no'
            ));

            return response()->json([
                'message' => self::FORGOT_PASSWORD_SUCCESS_MESSAGE,
            ] + $this->passwordResetDebugPayload($debugResetUser, $debugResetToken));
        } catch (Throwable $exception) {
            error_log(sprintf(
                'forgot_password_unhandled %s: %s',
                $exception::class,
                $exception->getMessage()
            ));

            return response()->json([
                'message' => self::FORGOT_PASSWORD_SUCCESS_MESSAGE,
            ] + $this->passwordResetDebugPayload($debugResetUser, $debugResetToken));
        }
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
            'user' => $this->presentAuthenticatedUser($request->user()),
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
            'user' => $this->presentAuthenticatedUser($request->user()),
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
     * Normalize OAuth provider names to the small set supported by this application.
     */
    private function normalizeOAuthProvider(?string $provider): ?string
    {
        $normalizedProvider = mb_strtolower(trim((string) $provider));

        return in_array($normalizedProvider, ['google', 'facebook'], true) ? $normalizedProvider : null;
    }

    /**
     * Restrict OAuth self-registration to public account roles.
     */
    private function normalizeOAuthRole(mixed $role): string
    {
        $normalizedRole = mb_strtolower(trim((string) $role));

        return in_array($normalizedRole, User::PUBLIC_REGISTRATION_ROLES, true)
            ? $normalizedRole
            : User::ROLE_CANDIDATE;
    }

    /**
     * Build provider config from environment-backed config and the current backend host.
     */
    private function oauthProviderConfig(Request $request, string $provider): array
    {
        $clientId = trim((string) config("oauth.{$provider}.client_id", ''));
        $clientSecret = trim((string) config("oauth.{$provider}.client_secret", ''));
        $redirectUri = trim((string) config("oauth.{$provider}.redirect_uri", ''));

        if ($redirectUri === '') {
            $redirectUri = $this->defaultOAuthRedirectUri($request, $provider);
        }

        if ($clientId === '' || $clientSecret === '') {
            throw new \RuntimeException('oauth_config_missing');
        }

        return [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri' => $redirectUri,
        ];
    }

    /**
     * Provide the backend callback URL used when no explicit provider redirect URI is configured.
     */
    private function defaultOAuthRedirectUri(Request $request, string $provider): string
    {
        return rtrim($request->getSchemeAndHttpHost(), '/') . "/api/oauth/{$provider}/callback";
    }

    /**
     * Build one provider authorization URL.
     */
    private function buildProviderAuthorizationUrl(string $provider, array $config, string $state): string
    {
        $commonQuery = [
            'client_id' => $config['client_id'],
            'redirect_uri' => $config['redirect_uri'],
            'response_type' => 'code',
            'state' => $state,
        ];

        if ($provider === 'google') {
            return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
                ...$commonQuery,
                'scope' => 'openid email profile',
                'prompt' => 'select_account',
            ], '', '&', PHP_QUERY_RFC3986);
        }

        return 'https://www.facebook.com/dialog/oauth?' . http_build_query([
            ...$commonQuery,
            'scope' => 'email,public_profile',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * Create a tamper-resistant state payload without relying on PHP sessions.
     */
    private function buildOAuthState(string $provider, string $role): string
    {
        $payload = [
            'provider' => $provider,
            'role' => $role,
            'nonce' => Str::random(32),
            'issued_at' => now()->timestamp,
        ];
        $encodedPayload = $this->base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));
        $signature = hash_hmac('sha256', $encodedPayload, $this->oauthStateSigningKey());

        return "{$encodedPayload}.{$signature}";
    }

    /**
     * Read and validate the OAuth state payload produced by buildOAuthState().
     */
    private function parseOAuthState(mixed $state): ?array
    {
        $state = trim((string) $state);

        if ($state === '' || !str_contains($state, '.')) {
            return null;
        }

        [$encodedPayload, $signature] = explode('.', $state, 2);
        $expectedSignature = hash_hmac('sha256', $encodedPayload, $this->oauthStateSigningKey());

        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $decodedPayload = $this->base64UrlDecode($encodedPayload);

        if ($decodedPayload === null) {
            return null;
        }

        $payload = json_decode($decodedPayload, true);

        if (!is_array($payload)) {
            return null;
        }

        $issuedAt = (int) ($payload['issued_at'] ?? 0);
        $stateTtlSeconds = max(60, (int) config('oauth.state_ttl_seconds', 600));

        if ($issuedAt <= 0 || now()->timestamp - $issuedAt > $stateTtlSeconds) {
            return null;
        }

        return $payload;
    }

    /**
     * Fetch one normalized OAuth profile after receiving the provider auth code.
     */
    private function fetchOAuthProfile(string $provider, array $config, string $code): array
    {
        if ($provider === 'google') {
            return $this->fetchGoogleOAuthProfile($config, $code);
        }

        return $this->fetchFacebookOAuthProfile($config, $code);
    }

    /**
     * Exchange a Google OAuth code and read the verified user profile.
     */
    private function fetchGoogleOAuthProfile(array $config, string $code): array
    {
        $tokenResponse = Http::asForm()
            ->timeout(10)
            ->post('https://oauth2.googleapis.com/token', [
                'client_id' => $config['client_id'],
                'client_secret' => $config['client_secret'],
                'redirect_uri' => $config['redirect_uri'],
                'grant_type' => 'authorization_code',
                'code' => $code,
            ])
            ->throw()
            ->json();

        $accessToken = (string) ($tokenResponse['access_token'] ?? '');

        if ($accessToken === '') {
            throw new \RuntimeException('oauth_access_token_missing');
        }

        $profile = Http::withToken($accessToken)
            ->acceptJson()
            ->timeout(10)
            ->get('https://www.googleapis.com/oauth2/v3/userinfo')
            ->throw()
            ->json();

        if (
            array_key_exists('email_verified', $profile) &&
            !filter_var($profile['email_verified'], FILTER_VALIDATE_BOOLEAN)
        ) {
            throw new \RuntimeException('oauth_email_unverified');
        }

        return [
            'provider_id' => (string) ($profile['sub'] ?? ''),
            'email' => $profile['email'] ?? null,
            'name' => $profile['name'] ?? null,
            'avatar' => $profile['picture'] ?? null,
        ];
    }

    /**
     * Exchange a Facebook OAuth code and read the user profile.
     */
    private function fetchFacebookOAuthProfile(array $config, string $code): array
    {
        $tokenResponse = Http::acceptJson()
            ->timeout(10)
            ->get('https://graph.facebook.com/oauth/access_token', [
                'client_id' => $config['client_id'],
                'client_secret' => $config['client_secret'],
                'redirect_uri' => $config['redirect_uri'],
                'code' => $code,
            ])
            ->throw()
            ->json();

        $accessToken = (string) ($tokenResponse['access_token'] ?? '');

        if ($accessToken === '') {
            throw new \RuntimeException('oauth_access_token_missing');
        }

        $profile = Http::acceptJson()
            ->timeout(10)
            ->get('https://graph.facebook.com/me', [
                'access_token' => $accessToken,
                'fields' => 'id,name,email,picture.type(large)',
            ])
            ->throw()
            ->json();

        return [
            'provider_id' => (string) ($profile['id'] ?? ''),
            'email' => $profile['email'] ?? null,
            'name' => $profile['name'] ?? null,
            'avatar' => data_get($profile, 'picture.data.url'),
        ];
    }

    /**
     * Find an existing account by email or self-register a public role for new OAuth users.
     */
    private function findOrCreateOAuthUser(array $profile, string $provider, string $requestedRole): User
    {
        $email = User::normalizeEmail($profile['email'] ?? null);

        if (!$email) {
            throw new \RuntimeException('oauth_email_missing');
        }

        $user = $this->authService->getUserByEmail($email);
        $name = $this->trimOAuthText($profile['name'] ?? null, 255) ?: Str::before($email, '@');
        $avatarUrl = $this->trimOAuthText($profile['avatar'] ?? null, 255);

        if ($user) {
            if ($user->hasRole(User::ROLE_SUPERADMIN)) {
                throw new \RuntimeException('oauth_superadmin_not_allowed');
            }

            $updates = [];

            if (!$user->email_verified_at) {
                $updates['email_verified_at'] = now();
            }

            if (!$user->profile_picture && $avatarUrl) {
                $updates['profile_picture'] = $avatarUrl;
            }

            if ($updates) {
                $user->forceFill($updates)->save();
            }

            return $user->fresh() ?? $user;
        }

        $user = $this->authService->register([
            'name' => $name,
            'email' => $email,
            'password' => Str::random(48),
            'role' => $requestedRole,
            'phone' => null,
            'company_name' => null,
            'recruiter_profile' => [],
        ]);

        $user->forceFill([
            'email_verified_at' => now(),
            'profile_picture' => $avatarUrl,
        ])->save();

        return $user->fresh() ?? $user;
    }

    /**
     * Produce one final frontend URL for successful OAuth completion.
     */
    private function redirectOAuthSuccess(string $token): RedirectResponse
    {
        return redirect()->away($this->frontendOAuthCallbackUrl([
            'token' => $token,
        ]));
    }

    /**
     * Produce one final frontend URL for OAuth failures.
     */
    private function redirectOAuthFailure(string $message): RedirectResponse
    {
        return redirect()->away($this->frontendOAuthCallbackUrl([
            'error' => $message,
        ]));
    }

    /**
     * Build the frontend callback URL using a hash fragment so tokens are not sent to the frontend server.
     */
    private function frontendOAuthCallbackUrl(array $params): string
    {
        $frontendUrl = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return $frontendUrl . '/oauth/callback#' . http_build_query(
            $params,
            '',
            '&',
            PHP_QUERY_RFC3986
        );
    }

    /**
     * Map machine-readable OAuth failures to user-facing Indonesian messages.
     */
    private function oauthFailureMessage(string $provider, string $reason): string
    {
        return match ($reason) {
            'oauth_account_suspended' => 'Akun Anda sedang dinonaktifkan. Hubungi superadmin KerjaNusa.',
            'oauth_email_missing' => sprintf(
                'Akun %s tidak mengirim email. Gunakan akun lain atau login dengan email.',
                $this->oauthProviderLabel($provider)
            ),
            'oauth_email_unverified' => sprintf(
                'Email akun %s belum terverifikasi. Gunakan akun lain atau login dengan email.',
                $this->oauthProviderLabel($provider)
            ),
            'oauth_superadmin_not_allowed' => 'Login superadmin tetap menggunakan email dan password.',
            default => sprintf('Login %s belum berhasil. Silakan coba lagi.', $this->oauthProviderLabel($provider)),
        };
    }

    /**
     * Return a display label for one OAuth provider.
     */
    private function oauthProviderLabel(string $provider): string
    {
        return $provider === 'google' ? 'Google' : 'Facebook';
    }

    /**
     * Trim external OAuth text values to fit existing varchar fields.
     */
    private function trimOAuthText(mixed $value, int $maxLength): ?string
    {
        $trimmedValue = trim((string) $value);

        if ($trimmedValue === '') {
            return null;
        }

        return mb_substr($trimmedValue, 0, $maxLength);
    }

    /**
     * Encode a value using URL-safe base64 without padding.
     */
    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    /**
     * Decode a URL-safe base64 value.
     */
    private function base64UrlDecode(string $value): ?string
    {
        $paddingLength = strlen($value) % 4;

        if ($paddingLength > 0) {
            $value .= str_repeat('=', 4 - $paddingLength);
        }

        $decodedValue = base64_decode(strtr($value, '-_', '+/'), true);

        return $decodedValue === false ? null : $decodedValue;
    }

    /**
     * Use APP_KEY for OAuth state signing, falling back only for local skeleton environments.
     */
    private function oauthStateSigningKey(): string
    {
        $appKey = trim((string) config('app.key', ''));

        return $appKey !== '' ? $appKey : (string) config('app.url', 'kerjanusa-oauth');
    }

    /**
     * Present the authenticated user with browser-safe candidate document URLs.
     */
    private function presentAuthenticatedUser(User $user): array
    {
        $freshUser = $user->fresh() ?? $user;
        $payload = $freshUser->toArray();

        if ($freshUser->hasRole(User::ROLE_CANDIDATE)) {
            $profile = is_array($freshUser->candidate_profile) ? $freshUser->candidate_profile : [];
            $profile['resumeFileDetails'] = CandidateResumeResource::collectionForCandidate(
                $profile['resumeFileDetails'] ?? [],
                $freshUser->id
            );
            $payload['candidate_profile'] = $profile;
        }

        return $payload;
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

    /**
     * Expose a staging-only reset URL when email delivery is not dependable.
     */
    private function passwordResetDebugPayload(mixed $user, ?string $token): array
    {
        try {
            if (
                !$user ||
                !is_object($user) ||
                !$token ||
                !$this->shouldExposePasswordResetLink()
            ) {
                return [];
            }

            $notification = new ResetPasswordNotification($token);

            error_log(sprintf(
                'forgot_password_debug_payload_emit email=%s',
                (string) ($user->email ?? 'unknown')
            ));

            return [
                'debug_reset_url' => $notification->resetUrl($user),
                'debug_reset_expires_minutes' => $notification->expireMinutes(),
            ];
        } catch (Throwable $exception) {
            error_log(sprintf(
                'forgot_password_debug_payload_failed %s: %s',
                $exception::class,
                $exception->getMessage()
            ));

            return [];
        }
    }

    /**
     * Limit debug reset-link exposure to explicitly enabled environments such as staging.
     */
    private function shouldExposePasswordResetLink(): bool
    {
        return (bool) config('mail.password_reset_expose_link', false);
    }
}
