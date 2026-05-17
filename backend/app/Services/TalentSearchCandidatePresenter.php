<?php

namespace App\Services;

use App\Models\Application;
use App\Models\User;
use Illuminate\Support\Arr;

class TalentSearchCandidatePresenter
{
    public function __construct(private RecruiterPlanService $recruiterPlanService)
    {
    }

    public function present(User $candidate, User $recruiter): array
    {
        $profile = is_array($candidate->candidate_profile) ? $candidate->candidate_profile : [];
        $resumeFiles = Arr::get($profile, 'resumeFiles', []);
        $certificateFiles = Arr::get($profile, 'certificateFiles', []);
        $experienceEntries = collect(Arr::get($profile, 'experiences', []))
            ->filter(fn ($experience) => filled($experience['company'] ?? null) || filled($experience['position'] ?? null))
            ->values();
        $requiredChecks = [
            filled(Arr::get($profile, 'currentAddress')),
            filled(Arr::get($profile, 'profileSummary')),
            collect(Arr::get($profile, 'preferredRoles', []))->filter()->isNotEmpty(),
            collect(Arr::get($profile, 'preferredLocations', []))->filter()->isNotEmpty(),
            collect(Arr::get($profile, 'skills', []))->filter()->isNotEmpty(),
            collect($resumeFiles)->filter()->isNotEmpty(),
        ];
        $profileReadinessPercent = (int) round((collect($requiredChecks)->filter()->count() / count($requiredChecks)) * 100);
        $experienceType = $experienceEntries->isEmpty() ? 'fresh-graduate' : 'experienced';
        $grade = $this->resolveCandidateGrade(
            $profileReadinessPercent,
            $experienceEntries->count(),
            count(array_filter(Arr::get($profile, 'skills', [])))
        );
        $limits = $this->recruiterPlanService->getVisibleDocumentLimits($recruiter);
        $visibleResumeFiles = array_slice($resumeFiles, 0, $limits['resume_files']);
        $visibleCertificateFiles = array_slice($certificateFiles, 0, $limits['certificate_files']);
        $latestApplication = Application::query()
            ->where('candidate_id', $candidate->id)
            ->with('job')
            ->latest('applied_at')
            ->latest('created_at')
            ->first();

        return [
            'id' => $candidate->id,
            'name' => $candidate->name,
            'email' => $candidate->email,
            'phone' => $candidate->phone,
            'profile_summary' => Arr::get($profile, 'profileSummary'),
            'preferred_roles' => collect(Arr::get($profile, 'preferredRoles', []))->filter()->values()->all(),
            'preferred_locations' => collect(Arr::get($profile, 'preferredLocations', []))->filter()->values()->all(),
            'skills' => collect(Arr::get($profile, 'skills', []))->filter()->values()->all(),
            'experience_type' => $experienceType,
            'experience_entries_count' => $experienceEntries->count(),
            'applications_count' => (int) ($candidate->applications_count ?? 0),
            'grade' => $grade,
            'profile_readiness_percent' => $profileReadinessPercent,
            'resume_files' => $visibleResumeFiles,
            'certificate_files' => $visibleCertificateFiles,
            'document_access' => [
                'resume_files_visible' => count($visibleResumeFiles),
                'resume_files_total' => count($resumeFiles),
                'certificate_files_visible' => count($visibleCertificateFiles),
                'certificate_files_total' => count($certificateFiles),
                'upgrade_required' => count($visibleResumeFiles) < count($resumeFiles)
                    || count($visibleCertificateFiles) < count($certificateFiles),
            ],
            'latest_application' => $latestApplication ? [
                'job_id' => $latestApplication->job_id,
                'job_title' => $latestApplication->job?->title,
                'stage' => $latestApplication->stage,
                'applied_at' => optional($latestApplication->applied_at)->toIso8601String(),
            ] : null,
        ];
    }

    private function resolveCandidateGrade(
        int $profileReadinessPercent,
        int $experienceEntriesCount,
        int $skillsCount
    ): string {
        if ($profileReadinessPercent >= 90 && $experienceEntriesCount >= 2 && $skillsCount >= 3) {
            return 'A';
        }

        if ($profileReadinessPercent >= 70 && $skillsCount >= 2) {
            return 'B';
        }

        return 'C';
    }
}
