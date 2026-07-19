<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProfileFileStorageService
{
    public const MAX_CANDIDATE_RESUME_FILES = 3;
    public const CANDIDATE_RESUME_STORAGE_DIRECTORY = 'candidate-resumes';

    /**
     * Wire logging for storage failures and accepted uploads.
     */
    public function __construct(private ServiceActivityLogService $serviceActivityLogService)
    {
    }

    /**
     * Store uploaded candidate resumes and return database-safe metadata only.
     */
    public function storeCandidateResumeFiles(array $files): array
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
     * Persist a profile picture to the configured disk and return a browser-safe reference.
     */
    public function storeProfilePicture(UploadedFile $file): string
    {
        $disk = (string) config('filesystems.default', 'local');
        $storedPath = $this->storeFileOnConfiguredDisk(
            $file,
            'profile-pictures',
            'profile_picture',
            'store_profile_picture'
        );
        $publicReference = $this->buildPublicFileReference($disk, $storedPath);

        $this->serviceActivityLogService->info($this, 'profile_file_storage.profile_picture_stored', [
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
    public function storeCompanyLegalDocument(UploadedFile $file): string
    {
        $disk = (string) config('filesystems.default', 'local');
        $storedPath = $this->storeFileOnConfiguredDisk(
            $file,
            'company-legal-documents',
            'company_legal_document',
            'store_company_legal_document'
        );

        $this->serviceActivityLogService->info($this, 'profile_file_storage.company_legal_document_stored', [
            'action' => 'store_company_legal_document',
            'disk' => $disk,
            'stored_path' => $storedPath,
            'result' => 'success',
        ]);

        return $storedPath;
    }

    /**
     * Normalize legacy resume name arrays while keeping only PDF-like names.
     */
    public function normalizePdfFileNames(mixed $fileNames): array
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
    public function normalizeCandidateResumeFileDetails(mixed $fileDetails, array $allowedNames): array
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
    public function normalizeStoredFileReference(mixed $value): string
    {
        $normalizedValue = $this->trimToNull(is_string($value) ? $value : null);

        if (!$normalizedValue || str_starts_with($normalizedValue, 'data:')) {
            return '';
        }

        return $normalizedValue;
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
            $this->serviceActivityLogService->error($this, 'profile_file_storage.file_storage_failed', [
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
            $this->serviceActivityLogService->error($this, 'profile_file_storage.file_storage_failed', [
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

        $this->serviceActivityLogService->warning($this, 'profile_file_storage.file_storage_rejected', [
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
}
