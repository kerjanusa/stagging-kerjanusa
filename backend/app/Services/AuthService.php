<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthService
{
    /**
     * Wire auth dependencies for user lifecycle and profile updates.
     */
    public function __construct(
        private RecruiterPlanService $recruiterPlanService,
        private ServiceActivityLogService $serviceActivityLogService,
    )
    {
    }

    /**
     * Normalize optional string input so empty values are stored as null.
     */
    private function trimToNull(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmedValue = trim($value);

        return $trimmedValue === '' ? null : $trimmedValue;
    }

    /**
     * Hash user-provided identifiers before they are emitted to logs.
     */
    private function hashIdentifier(string $value): string
    {
        return hash('sha256', strtolower(trim($value)));
    }

    /**
     * Register new user
     */
    public function register(array $data): User
    {
        $role = $data['role'] ?? User::ROLE_CANDIDATE;

        $user = User::create([
            'name' => $data['name'],
            'company_name' => $this->trimToNull($data['company_name'] ?? null),
            'email' => User::normalizeEmail($data['email']),
            'password' => Hash::make($data['password']),
            'role' => $role,
            'account_status' => User::STATUS_ACTIVE,
            'phone' => User::normalizePhone($data['phone'] ?? null),
            'recruiter_profile' => $role === User::ROLE_RECRUITER
                ? $this->recruiterPlanService->normalizeRecruiterProfile(
                    is_array($data['recruiter_profile'] ?? null) ? $data['recruiter_profile'] : []
                )
                : null,
        ]);

        $this->serviceActivityLogService->info($this, 'auth_service.user_registered', [
            'action' => 'register',
            'target_user_id' => $user->id,
            'target_role' => $role,
            'has_recruiter_profile' => $role === User::ROLE_RECRUITER,
            'result' => 'success',
        ], $user);

        return $user;
    }

    /**
     * Login user
     */
    public function login(string $email, string $password): User|false
    {
        $user = User::where('email', User::normalizeEmail($email))->first();

        if (!$user || !Hash::check($password, $user->password)) {
            $this->serviceActivityLogService->warning($this, 'auth_service.login_rejected', [
                'action' => 'login',
                'identifier_hash' => $this->hashIdentifier($email),
                'result' => 'failed',
            ]);

            return false;
        }

        $this->serviceActivityLogService->info($this, 'auth_service.login_authenticated', [
            'action' => 'login',
            'target_user_id' => $user->id,
            'result' => 'success',
        ], $user);

        return $user;
    }

    /**
     * Create user token
     */
    public function createToken(User $user): string
    {
        $token = $user->createToken('auth-token')->plainTextToken;

        $this->serviceActivityLogService->info($this, 'auth_service.token_created', [
            'action' => 'create_token',
            'target_user_id' => $user->id,
            'result' => 'success',
        ], $user);

        return $token;
    }

    /**
     * Get user by email
     */
    public function getUserByEmail(string $email): ?User
    {
        $user = User::where('email', User::normalizeEmail($email))->first();

        $this->serviceActivityLogService->debug($this, 'auth_service.user_lookup_by_email', [
            'action' => 'get_user_by_email',
            'identifier_hash' => $this->hashIdentifier($email),
            'target_user_id' => $user?->id,
            'result' => $user ? 'found' : 'not_found',
        ], $user);

        return $user;
    }

    /**
     * Update user profile
     */
    public function updateProfile(int $userId, array $data): bool
    {
        $user = User::find($userId);

        if (!$user) {
            $this->serviceActivityLogService->warning($this, 'auth_service.profile_update_rejected', [
                'action' => 'update_profile',
                'target_user_id' => $userId,
                'result' => 'user_not_found',
            ]);

            return false;
        }

        $nextData = [];

        if (array_key_exists('name', $data)) {
            $nextData['name'] = $this->trimToNull($data['name']) ?? $user->name;
        }

        if (array_key_exists('phone', $data)) {
            $nextData['phone'] = User::normalizePhone($data['phone']);
        }

        if (array_key_exists('company_name', $data)) {
            $nextData['company_name'] = $this->trimToNull($data['company_name']);
        }

        if (array_key_exists('candidate_profile', $data)) {
            $nextData['candidate_profile'] = is_array($data['candidate_profile'])
                ? $data['candidate_profile']
                : null;
        }

        if (array_key_exists('recruiter_profile', $data)) {
            $mergedProfile = [
                ...(is_array($user->recruiter_profile) ? $user->recruiter_profile : []),
                ...(is_array($data['recruiter_profile']) ? $data['recruiter_profile'] : []),
            ];

            $nextData['recruiter_profile'] = $this->recruiterPlanService->normalizeRecruiterProfile(
                $mergedProfile
            );
        } elseif ($user->hasRole(User::ROLE_RECRUITER)) {
            $nextData['recruiter_profile'] = $this->recruiterPlanService->normalizeRecruiterProfile(
                is_array($user->recruiter_profile) ? $user->recruiter_profile : []
            );
        }

        if (array_key_exists('profile_picture', $data)) {
            $nextData['profile_picture'] = $data['profile_picture'] instanceof UploadedFile
                ? $this->storeProfilePicture($data['profile_picture'])
                : $data['profile_picture'];
        }

        $updated = $user->update($nextData);

        $this->serviceActivityLogService->log(
            $this,
            $updated ? 'info' : 'warning',
            $updated ? 'auth_service.profile_updated' : 'auth_service.profile_update_failed',
            [
                'action' => 'update_profile',
                'target_user_id' => $user->id,
                'changed_fields' => array_keys($nextData),
                'profile_picture_updated' => array_key_exists('profile_picture', $nextData),
                'result' => $updated ? 'success' : 'failed',
            ],
            $user
        );

        return $updated;
    }

    /**
     * Change password
     */
    public function changePassword(int $userId, string $oldPassword, string $newPassword): bool
    {
        $user = User::find($userId);

        if (!$user) {
            $this->serviceActivityLogService->warning($this, 'auth_service.password_change_rejected', [
                'action' => 'change_password',
                'target_user_id' => $userId,
                'result' => 'user_not_found',
            ]);

            return false;
        }

        if (!Hash::check($oldPassword, $user->password)) {
            $this->serviceActivityLogService->warning($this, 'auth_service.password_change_rejected', [
                'action' => 'change_password',
                'target_user_id' => $user->id,
                'result' => 'invalid_old_password',
            ], $user);

            return false;
        }

        $updated = $user->update(['password' => Hash::make($newPassword)]);

        $this->serviceActivityLogService->log(
            $this,
            $updated ? 'info' : 'warning',
            $updated ? 'auth_service.password_changed' : 'auth_service.password_change_failed',
            [
                'action' => 'change_password',
                'target_user_id' => $user->id,
                'result' => $updated ? 'success' : 'failed',
            ],
            $user
        );

        return $updated;
    }

    /**
     * Persist a profile picture to the configured disk and return the stored path.
     */
    private function storeProfilePicture(UploadedFile $file): string
    {
        $disk = (string) config('filesystems.default', 'local');

        if (app()->environment('production') && $disk === 'local') {
            $this->serviceActivityLogService->warning($this, 'auth_service.profile_picture_storage_rejected', [
                'action' => 'store_profile_picture',
                'disk' => $disk,
                'result' => 'local_disk_in_production',
            ]);

            throw ValidationException::withMessages([
                'profile_picture' => [
                    'Upload foto profil memerlukan storage durable. Konfigurasikan disk non-local sebelum mengaktifkan fitur ini di production.',
                ],
            ]);
        }

        $storedPath = Storage::disk($disk)->putFile('profile-pictures', $file);

        if (!is_string($storedPath) || $storedPath === '') {
            $this->serviceActivityLogService->error($this, 'auth_service.profile_picture_storage_failed', [
                'action' => 'store_profile_picture',
                'disk' => $disk,
                'result' => 'empty_path',
            ]);

            throw ValidationException::withMessages([
                'profile_picture' => [
                    'Foto profil belum berhasil disimpan.',
                ],
            ]);
        }

        $this->serviceActivityLogService->info($this, 'auth_service.profile_picture_stored', [
            'action' => 'store_profile_picture',
            'disk' => $disk,
            'stored_path' => $storedPath,
            'result' => 'success',
        ]);

        return $storedPath;
    }
}
