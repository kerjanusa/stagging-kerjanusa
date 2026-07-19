<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Arr;

class CandidateDocumentAccessService
{
    public function __construct(private RecruiterPlanService $recruiterPlanService)
    {
    }

    public function presentCandidateForViewer(User $candidate, ?User $viewer = null): array
    {
        $profile = is_array($candidate->candidate_profile) ? $candidate->candidate_profile : [];
        $documentAccess = $this->buildDefaultDocumentAccess($profile);

        if ($viewer?->hasRole(User::ROLE_RECRUITER)) {
            [$profile, $documentAccess] = $this->buildRecruiterScopedCandidateProfile($profile, $viewer);
        }

        $profile['resumeFileDetails'] = $this->presentResumeFileDetails(
            $profile['resumeFileDetails'] ?? [],
            $candidate->id
        );

        return [
            'id' => $candidate->id,
            'name' => $candidate->name,
            'role' => $candidate->role,
            'email' => $candidate->email,
            'phone' => $candidate->phone,
            'profile_picture' => $candidate->profile_picture,
            'candidate_profile' => $profile,
            'document_access' => $documentAccess,
        ];
    }

    private function buildDefaultDocumentAccess(array $profile): array
    {
        $resumeFileDetails = Arr::get($profile, 'resumeFileDetails', []);

        return [
            'resume_files_visible' => count($resumeFileDetails),
            'resume_files_total' => count($resumeFileDetails),
            'certificate_files_visible' => count(Arr::get($profile, 'certificateFiles', [])),
            'certificate_files_total' => count(Arr::get($profile, 'certificateFiles', [])),
            'upgrade_required' => false,
            'notice' => null,
        ];
    }

    private function buildRecruiterScopedCandidateProfile(array $profile, User $viewer): array
    {
        $limits = $this->recruiterPlanService->getVisibleDocumentLimits($viewer);
        $resumeFileDetails = Arr::get($profile, 'resumeFileDetails', []);
        $totalResumeFiles = count($resumeFileDetails);
        $totalCertificateFiles = count(Arr::get($profile, 'certificateFiles', []));
        $visibleResumeFileDetails = array_slice(
            $resumeFileDetails,
            0,
            $limits['resume_files']
        );
        $visibleResumeFiles = array_values(array_filter(array_map(
            fn ($detail) => is_array($detail) ? (string) ($detail['name'] ?? '') : '',
            $visibleResumeFileDetails
        )));
        $visibleCertificateFiles = array_slice(
            Arr::get($profile, 'certificateFiles', []),
            0,
            $limits['certificate_files']
        );

        $profile['resumeFiles'] = $visibleResumeFiles;
        $profile['resumeFileDetails'] = $visibleResumeFileDetails;
        $profile['certificateFiles'] = $visibleCertificateFiles;

        $documentAccess = [
            'resume_files_visible' => count($visibleResumeFiles),
            'resume_files_total' => $totalResumeFiles,
            'certificate_files_visible' => count($visibleCertificateFiles),
            'certificate_files_total' => $totalCertificateFiles,
            'upgrade_required' => count($visibleResumeFiles) < $totalResumeFiles
                || count($visibleCertificateFiles) < $totalCertificateFiles,
            'notice' => count($visibleResumeFiles) < $totalResumeFiles
                || count($visibleCertificateFiles) < $totalCertificateFiles
                ? 'Sebagian berkas kandidat disembunyikan sesuai paket recruiter aktif.'
                : null,
        ];

        return [$profile, $documentAccess];
    }

    private function presentResumeFileDetails(mixed $resumeFileDetails, int $candidateId): array
    {
        if (!is_array($resumeFileDetails)) {
            return [];
        }

        return collect($resumeFileDetails)
            ->filter(fn ($detail) => is_array($detail) && filled($detail['path'] ?? null))
            ->values()
            ->map(fn (array $detail, int $index) => [
                'name' => trim((string) ($detail['name'] ?? 'cv-kandidat.pdf')),
                'mimeType' => trim((string) ($detail['mimeType'] ?? 'application/pdf')),
                'size' => max(0, (int) ($detail['size'] ?? 0)),
                'uploadedAt' => $detail['uploadedAt'] ?? null,
                'downloadUrl' => "/candidate-documents/{$candidateId}/resumes/{$index}",
            ])
            ->all();
    }
}
