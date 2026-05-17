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

        return [
            'id' => $candidate->id,
            'name' => $candidate->name,
            'role' => $candidate->role,
            'email' => $candidate->email,
            'phone' => $candidate->phone,
            'candidate_profile' => $profile,
            'document_access' => $documentAccess,
        ];
    }

    private function buildDefaultDocumentAccess(array $profile): array
    {
        return [
            'resume_files_visible' => count(Arr::get($profile, 'resumeFiles', [])),
            'resume_files_total' => count(Arr::get($profile, 'resumeFiles', [])),
            'certificate_files_visible' => count(Arr::get($profile, 'certificateFiles', [])),
            'certificate_files_total' => count(Arr::get($profile, 'certificateFiles', [])),
            'upgrade_required' => false,
            'notice' => null,
        ];
    }

    private function buildRecruiterScopedCandidateProfile(array $profile, User $viewer): array
    {
        $limits = $this->recruiterPlanService->getVisibleDocumentLimits($viewer);
        $totalResumeFiles = count(Arr::get($profile, 'resumeFiles', []));
        $totalCertificateFiles = count(Arr::get($profile, 'certificateFiles', []));
        $visibleResumeFiles = array_slice(Arr::get($profile, 'resumeFiles', []), 0, $limits['resume_files']);
        $visibleCertificateFiles = array_slice(
            Arr::get($profile, 'certificateFiles', []),
            0,
            $limits['certificate_files']
        );

        $profile['resumeFiles'] = $visibleResumeFiles;
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
}
