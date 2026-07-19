<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\RecruiterPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Throwable;

class CandidateDocumentController extends Controller
{
    private const RESUME_STORAGE_DIRECTORY = 'candidate-resumes';

    public function __construct(private RecruiterPlanService $recruiterPlanService)
    {
    }

    /**
     * Download one stored candidate resume with role-aware access control.
     */
    public function downloadResume(Request $request, int $candidateId, int $resumeIndex)
    {
        $candidate = User::query()
            ->where('role', User::ROLE_CANDIDATE)
            ->find($candidateId);

        if (!$candidate) {
            return $this->notFoundResponse();
        }

        if (!$this->canDownloadResume($request->user(), $candidate, $resumeIndex)) {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        $profile = is_array($candidate->candidate_profile) ? $candidate->candidate_profile : [];
        $resumeDetails = $this->normalizeResumeDetails($profile['resumeFileDetails'] ?? []);
        $resumeDetail = $resumeDetails[$resumeIndex] ?? null;

        if (!$resumeDetail) {
            return $this->notFoundResponse();
        }

        $disk = $resumeDetail['disk'] ?: (string) config('filesystems.default', 'local');
        $path = $resumeDetail['path'];

        try {
            if (!Storage::disk($disk)->exists($path)) {
                return $this->notFoundResponse();
            }

            return Storage::disk($disk)->download(
                $path,
                $resumeDetail['name'] ?: 'cv-kandidat.pdf',
                ['Content-Type' => $resumeDetail['mimeType'] ?: 'application/pdf']
            );
        } catch (Throwable) {
            return $this->notFoundResponse();
        }
    }

    private function canDownloadResume(User $viewer, User $candidate, int $resumeIndex): bool
    {
        if ($viewer->hasRole(User::ROLE_CANDIDATE)) {
            return $viewer->id === $candidate->id;
        }

        if ($viewer->hasRole(User::ROLE_SUPERADMIN)) {
            return true;
        }

        if ($viewer->hasRole(User::ROLE_RECRUITER)) {
            $limits = $this->recruiterPlanService->getVisibleDocumentLimits($viewer);

            return $resumeIndex >= 0 && $resumeIndex < (int) $limits['resume_files'];
        }

        return false;
    }

    private function normalizeResumeDetails(mixed $resumeDetails): array
    {
        if (!is_array($resumeDetails)) {
            return [];
        }

        $normalizedDetails = [];

        foreach ($resumeDetails as $detail) {
            if (!is_array($detail)) {
                continue;
            }

            $path = trim((string) ($detail['path'] ?? ''));

            if ($path === '' || !str_starts_with($path, self::RESUME_STORAGE_DIRECTORY . '/')) {
                continue;
            }

            $normalizedDetails[] = [
                'name' => trim((string) ($detail['name'] ?? 'cv-kandidat.pdf')),
                'path' => $path,
                'disk' => trim((string) ($detail['disk'] ?? config('filesystems.default', 'local'))),
                'mimeType' => trim((string) ($detail['mimeType'] ?? 'application/pdf')),
            ];
        }

        return $normalizedDetails;
    }

    private function notFoundResponse(): JsonResponse
    {
        return response()->json([
            'message' => 'Dokumen kandidat tidak ditemukan.',
        ], 404);
    }
}
