<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthService
{
    private const MAX_CANDIDATE_RESUME_FILES = 3;
    private const CANDIDATE_RESUME_STORAGE_DIRECTORY = 'candidate-resumes';

    private const RECRUITER_COMPANY_VERIFICATION_SENSITIVE_KEYS = [
        'recruiterName',
        'companyName',
        'legalCompanyName',
        'companyEmail',
        'phone',
        'companyAddress',
        'companyLocation',
        'industry',
        'employeeRange',
        'companyDescription',
        'companyLogoFileName',
        'companyLogoDataUrl',
        'website',
        'companyLegalDocumentName',
        'companyLegalDocumentPath',
        'companyLegalDocumentMimeType',
        'companyLegalDocumentSize',
    ];

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
     * Check whether the recruiter company profile already satisfies the verification baseline.
     */
    private function isRecruiterCompanyProfileReady(array $profile): bool
    {
        $requiredValues = [
            $this->trimToNull($profile['recruiterName'] ?? null),
            $this->trimToNull($profile['companyName'] ?? null),
            $this->trimToNull($profile['legalCompanyName'] ?? null),
            $this->trimToNull($profile['companyEmail'] ?? null),
            $this->trimToNull($profile['phone'] ?? null),
            $this->trimToNull($profile['companyAddress'] ?? null),
            $this->trimToNull($profile['industry'] ?? null),
            $this->trimToNull($profile['employeeRange'] ?? null),
            $this->trimToNull($profile['website'] ?? null),
        ];

        foreach ($requiredValues as $requiredValue) {
            if (!filled($requiredValue)) {
                return false;
            }
        }

        if (mb_strlen((string) $this->trimToNull($profile['companyDescription'] ?? null)) < 80) {
            return false;
        }

        if (!filled($this->trimToNull($profile['companyLogoDataUrl'] ?? null))
            && !filled($this->trimToNull($profile['companyLogoFileName'] ?? null))) {
            return false;
        }

        if (!filled($this->trimToNull($profile['companyLegalDocumentName'] ?? null))
            && !filled($this->trimToNull($profile['companyLegalDocumentPath'] ?? null))) {
            return false;
        }

        return true;
    }

    /**
     * Detect whether verification-sensitive recruiter fields changed since the last saved version.
     */
    private function recruiterVerificationSensitiveFieldsChanged(array $currentProfile, array $nextProfile): bool
    {
        foreach (self::RECRUITER_COMPANY_VERIFICATION_SENSITIVE_KEYS as $key) {
            $currentValue = $currentProfile[$key] ?? null;
            $nextValue = $nextProfile[$key] ?? null;

            if ($key === 'companyLegalDocumentSize') {
                if ((int) ($currentValue ?? 0) !== (int) ($nextValue ?? 0)) {
                    return true;
                }

                continue;
            }

            if (trim((string) ($currentValue ?? '')) !== trim((string) ($nextValue ?? ''))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Recalculate recruiter verification state after the profile data changes.
     */
    private function syncRecruiterCompanyVerification(array $currentProfile, array $nextProfile): array
    {
        $currentStatus = strtolower(trim((string) ($currentProfile['verificationStatus'] ?? 'draft')));
        $hasSensitiveChanges = $this->recruiterVerificationSensitiveFieldsChanged($currentProfile, $nextProfile);
        $submittedAt = $this->trimToNull($currentProfile['verificationSubmittedAt'] ?? null)
            ?? $this->trimToNull($nextProfile['verificationSubmittedAt'] ?? null);

        if (!$this->isRecruiterCompanyProfileReady($nextProfile)) {
            $nextProfile['verificationStatus'] = 'draft';
            $nextProfile['verificationSubmittedAt'] = null;
            $nextProfile['verifiedAt'] = null;

            return $nextProfile;
        }

        if ($currentStatus === 'verified' && !$hasSensitiveChanges) {
            $nextProfile['verificationStatus'] = 'verified';
            $nextProfile['verificationSubmittedAt'] = $submittedAt ?? now()->toIso8601String();
            $nextProfile['verifiedAt'] = $this->trimToNull($currentProfile['verifiedAt'] ?? null)
                ?? $this->trimToNull($nextProfile['verifiedAt'] ?? null);

            return $nextProfile;
        }

        $nextProfile['verificationStatus'] = 'pending';
        $nextProfile['verificationSubmittedAt'] = (
            $currentStatus === 'pending' && !$hasSensitiveChanges
                ? $submittedAt
                : null
        ) ?? now()->toIso8601String();
        $nextProfile['verifiedAt'] = null;

        return $nextProfile;
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

        $profilePictureWasProvided = array_key_exists('profile_picture', $data);
        $profilePictureValue = null;

        if ($profilePictureWasProvided) {
            $profilePictureValue = $data['profile_picture'] instanceof UploadedFile
                ? $this->storeProfilePicture($data['profile_picture'])
                : $this->trimToNull($data['profile_picture'] ?? null);
            $nextData['profile_picture'] = $profilePictureValue;
        }

        if ($user->hasRole(User::ROLE_CANDIDATE) && (
            array_key_exists('candidate_profile', $data) ||
            array_key_exists('candidate_resume_files', $data) ||
            $profilePictureWasProvided
        )) {
            $currentCandidateProfile = is_array($user->candidate_profile) ? $user->candidate_profile : [];
            $incomingCandidateProfile = is_array($data['candidate_profile'] ?? null)
                ? $data['candidate_profile']
                : [];
            $mergedCandidateProfile = [
                ...$currentCandidateProfile,
                ...$incomingCandidateProfile,
            ];

            if ($profilePictureWasProvided) {
                $mergedCandidateProfile['photoDataUrl'] = $profilePictureValue ?: '';

                if (!$profilePictureValue) {
                    $mergedCandidateProfile['photoFileName'] = '';
                }
            }

            if (array_key_exists('candidate_resume_files', $data)) {
                $storedResumeDetails = $this->storeCandidateResumeFiles($data['candidate_resume_files'] ?? []);
                $mergedCandidateProfile['resumeFiles'] = array_map(
                    fn (array $resumeFile) => $resumeFile['name'],
                    $storedResumeDetails
                );
                $mergedCandidateProfile['resumeFileDetails'] = $storedResumeDetails;
            } else {
                $mergedCandidateProfile = $this->preserveCandidateResumeMetadata(
                    $currentCandidateProfile,
                    $mergedCandidateProfile
                );
            }

            $nextData['candidate_profile'] = $this->normalizeCandidateProfilePayload($mergedCandidateProfile);
        }

        if ($user->hasRole(User::ROLE_RECRUITER) && (
            array_key_exists('recruiter_profile', $data) ||
            array_key_exists('company_legal_document', $data) ||
            $profilePictureWasProvided
        )) {
            $currentRecruiterProfile = is_array($user->recruiter_profile) ? $user->recruiter_profile : [];
            $mergedProfile = [
                ...$currentRecruiterProfile,
                ...(is_array($data['recruiter_profile'] ?? null) ? $data['recruiter_profile'] : []),
            ];

            if ($profilePictureWasProvided) {
                $mergedProfile['companyLogoDataUrl'] = $profilePictureValue ?: '';

                if (!$profilePictureValue) {
                    $mergedProfile['companyLogoFileName'] = '';
                }
            } else {
                $mergedProfile['companyLogoDataUrl'] = $this->normalizeStoredFileReference(
                    $mergedProfile['companyLogoDataUrl'] ?? null
                );
            }

            $mergedProfile['companyAddress'] = $this->trimToNull($mergedProfile['companyAddress'] ?? null)
                ?? $this->trimToNull($mergedProfile['companyLocation'] ?? null);
            $mergedProfile['companyLocation'] = $mergedProfile['companyAddress'];
            $mergedProfile['companyEmail'] = $this->trimToNull($mergedProfile['companyEmail'] ?? null);

            if (($data['company_legal_document'] ?? null) instanceof UploadedFile) {
                $storedPath = $this->storeCompanyLegalDocument($data['company_legal_document']);

                $mergedProfile['companyLegalDocumentName'] = $data['company_legal_document']->getClientOriginalName();
                $mergedProfile['companyLegalDocumentPath'] = $storedPath;
                $mergedProfile['companyLegalDocumentMimeType'] = $data['company_legal_document']->getClientMimeType();
                $mergedProfile['companyLegalDocumentSize'] = $data['company_legal_document']->getSize() ?: 0;
                $mergedProfile['companyLegalDocumentUploadedAt'] = now()->toIso8601String();
            }

            $mergedProfile = $this->syncRecruiterCompanyVerification($currentRecruiterProfile, $mergedProfile);

            $nextData['recruiter_profile'] = $this->recruiterPlanService->normalizeRecruiterProfile(
                $mergedProfile
            );
        } elseif ($user->hasRole(User::ROLE_RECRUITER)) {
            $nextData['recruiter_profile'] = $this->recruiterPlanService->normalizeRecruiterProfile(
                is_array($user->recruiter_profile) ? $user->recruiter_profile : []
            );
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
     * Store uploaded candidate resumes and return database-safe metadata only.
     */
    private function storeCandidateResumeFiles(array $files): array
    {
        $storedFiles = [];

        foreach (array_slice($files, 0, self::MAX_CANDIDATE_RESUME_FILES) as $file) {
            if (!$file instanceof UploadedFile) {
                continue;
            }

            $storedPath = $this->storeFileOnConfiguredDisk(
                $file,
                self::CANDIDATE_RESUME_STORAGE_DIRECTORY,
                'candidate_resume_files',
                'store_candidate_resume'
            );

            $storedFiles[] = [
                'name' => $file->getClientOriginalName(),
                'path' => $storedPath,
                'disk' => (string) config('filesystems.default', 'local'),
                'mimeType' => $file->getClientMimeType(),
                'size' => $file->getSize() ?: 0,
                'uploadedAt' => now()->toIso8601String(),
            ];
        }

        return $storedFiles;
    }

    /**
     * Keep previously generated resume paths while allowing the candidate to reorder/remove names.
     */
    private function preserveCandidateResumeMetadata(array $currentProfile, array $mergedProfile): array
    {
        $resumeNames = $this->normalizePdfFileNames($mergedProfile['resumeFiles'] ?? []);
        $currentDetails = $this->normalizeCandidateResumeFileDetails(
            $currentProfile['resumeFileDetails'] ?? [],
            $this->normalizePdfFileNames($currentProfile['resumeFiles'] ?? [])
        );
        $detailsByName = [];

        foreach ($currentDetails as $detail) {
            $detailsByName[$detail['name']] = $detail;
        }

        $mergedProfile['resumeFiles'] = $resumeNames;
        $mergedProfile['resumeFileDetails'] = array_values(array_filter(array_map(
            fn (string $resumeName) => $detailsByName[$resumeName] ?? null,
            $resumeNames
        )));

        return $mergedProfile;
    }

    /**
     * Normalize candidate profile JSON and strip browser-only payloads from database storage.
     */
    private function normalizeCandidateProfilePayload(array $profile): array
    {
        $profile['photoDataUrl'] = $this->normalizeStoredFileReference($profile['photoDataUrl'] ?? null);
        $profile['resumeFiles'] = $this->normalizePdfFileNames($profile['resumeFiles'] ?? []);
        $profile['resumeFileDetails'] = $this->normalizeCandidateResumeFileDetails(
            $profile['resumeFileDetails'] ?? [],
            $profile['resumeFiles']
        );

        return $profile;
    }

    /**
     * Normalize legacy resume name arrays while keeping only PDF-like names.
     */
    private function normalizePdfFileNames(mixed $fileNames): array
    {
        if (!is_array($fileNames)) {
            return [];
        }

        $normalizedNames = [];

        foreach ($fileNames as $fileName) {
            $normalizedName = $this->trimToNull(is_string($fileName) ? $fileName : null);

            if (!$normalizedName || strtolower(pathinfo($normalizedName, PATHINFO_EXTENSION)) !== 'pdf') {
                continue;
            }

            $normalizedNames[] = $normalizedName;
        }

        return array_slice(array_values(array_unique($normalizedNames)), 0, self::MAX_CANDIDATE_RESUME_FILES);
    }

    /**
     * Keep only server-generated candidate resume metadata that points to the resume directory.
     */
    private function normalizeCandidateResumeFileDetails(mixed $fileDetails, array $allowedNames): array
    {
        if (!is_array($fileDetails) || empty($allowedNames)) {
            return [];
        }

        $allowedLookup = array_flip($allowedNames);
        $normalizedDetails = [];

        foreach ($fileDetails as $detail) {
            if (!is_array($detail)) {
                continue;
            }

            $name = $this->trimToNull(is_string($detail['name'] ?? null) ? $detail['name'] : null);
            $path = $this->trimToNull(is_string($detail['path'] ?? null) ? $detail['path'] : null);

            if (!$name || !$path || !isset($allowedLookup[$name])) {
                continue;
            }

            if (!str_starts_with($path, self::CANDIDATE_RESUME_STORAGE_DIRECTORY . '/')) {
                continue;
            }

            $normalizedDetails[] = [
                'name' => $name,
                'path' => $path,
                'disk' => $this->trimToNull(is_string($detail['disk'] ?? null) ? $detail['disk'] : null)
                    ?: (string) config('filesystems.default', 'local'),
                'mimeType' => $this->trimToNull(is_string($detail['mimeType'] ?? null) ? $detail['mimeType'] : null)
                    ?: 'application/pdf',
                'size' => max(0, (int) ($detail['size'] ?? 0)),
                'uploadedAt' => $this->trimToNull(is_string($detail['uploadedAt'] ?? null) ? $detail['uploadedAt'] : null)
                    ?: null,
            ];
        }

        return array_slice($normalizedDetails, 0, self::MAX_CANDIDATE_RESUME_FILES);
    }

    /**
     * Strip large browser data URLs while preserving regular storage URLs/paths.
     */
    private function normalizeStoredFileReference(mixed $value): string
    {
        $normalizedValue = $this->trimToNull(is_string($value) ? $value : null);

        if (!$normalizedValue || str_starts_with($normalizedValue, 'data:')) {
            return '';
        }

        return $normalizedValue;
    }

    /**
     * Persist a profile picture to the configured disk and return the stored path.
     */
    private function storeProfilePicture(UploadedFile $file): string
    {
        $disk = (string) config('filesystems.default', 'local');
        $storedPath = $this->storeFileOnConfiguredDisk(
            $file,
            'profile-pictures',
            'profile_picture',
            'store_profile_picture'
        );
        $publicReference = $this->buildPublicFileReference($disk, $storedPath);

        $this->serviceActivityLogService->info($this, 'auth_service.profile_picture_stored', [
            'action' => 'store_profile_picture',
            'disk' => $disk,
            'stored_path' => $storedPath,
            'result' => 'success',
        ]);

        return $publicReference;
    }

    /**
     * Persist one recruiter legal company document and return the stored path.
     */
    private function storeCompanyLegalDocument(UploadedFile $file): string
    {
        $disk = (string) config('filesystems.default', 'local');
        $storedPath = $this->storeFileOnConfiguredDisk(
            $file,
            'company-legal-documents',
            'company_legal_document',
            'store_company_legal_document'
        );

        $this->serviceActivityLogService->info($this, 'auth_service.company_legal_document_stored', [
            'action' => 'store_company_legal_document',
            'disk' => $disk,
            'stored_path' => $storedPath,
            'result' => 'success',
        ]);

        return $storedPath;
    }

    /**
     * Persist one uploaded file to the configured durable disk.
     */
    private function storeFileOnConfiguredDisk(
        UploadedFile $file,
        string $directory,
        string $field,
        string $action
    ): string {
        $disk = (string) config('filesystems.default', 'local');
        $this->ensureProductionDiskIsDurable($disk, $field, $action);

        try {
            $storedPath = Storage::disk($disk)->putFile($directory, $file);
        } catch (Throwable $exception) {
            $this->serviceActivityLogService->error($this, 'auth_service.file_storage_failed', [
                'action' => $action,
                'disk' => $disk,
                'directory' => $directory,
                'exception_class' => $exception::class,
                'result' => 'exception',
            ]);

            throw ValidationException::withMessages([
                $field => [$this->uploadFailureMessage($field)],
            ]);
        }

        if (!is_string($storedPath) || $storedPath === '') {
            $this->serviceActivityLogService->error($this, 'auth_service.file_storage_failed', [
                'action' => $action,
                'disk' => $disk,
                'directory' => $directory,
                'result' => 'empty_path',
            ]);

            throw ValidationException::withMessages([
                $field => [$this->uploadFailureMessage($field)],
            ]);
        }

        return $storedPath;
    }

    /**
     * Block local filesystem uploads in production because serverless files are not durable.
     */
    private function ensureProductionDiskIsDurable(string $disk, string $field, string $action): void
    {
        $driver = config("filesystems.disks.{$disk}.driver");

        if (!app()->environment('production') || $driver !== 'local') {
            return;
        }

        $this->serviceActivityLogService->warning($this, 'auth_service.file_storage_rejected', [
            'action' => $action,
            'disk' => $disk,
            'driver' => $driver,
            'result' => 'local_disk_in_production',
        ]);

        throw ValidationException::withMessages([
            $field => [
                'Upload file memerlukan storage durable. Konfigurasikan FILESYSTEM_DISK=s3 atau disk non-local sebelum mengaktifkan upload di production.',
            ],
        ]);
    }

    /**
     * Convert a stored public file path into a URL when the disk can generate one.
     */
    private function buildPublicFileReference(string $disk, string $storedPath): string
    {
        try {
            $publicUrl = Storage::disk($disk)->url($storedPath);

            if (is_string($publicUrl) && $publicUrl !== '') {
                return $publicUrl;
            }
        } catch (Throwable) {
            // Some private disks intentionally do not expose public URLs.
        }

        return $storedPath;
    }

    /**
     * Return one user-facing upload failure message for a failed profile file field.
     */
    private function uploadFailureMessage(string $field): string
    {
        return match ($field) {
            'candidate_resume_files' => 'CV kandidat belum berhasil disimpan.',
            'company_legal_document' => 'Dokumen legal perusahaan belum berhasil disimpan.',
            'profile_picture' => 'Foto profil belum berhasil disimpan.',
            default => 'File belum berhasil disimpan.',
        };
    }
}
