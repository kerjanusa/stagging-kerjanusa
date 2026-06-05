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
        $experienceYearsTotal = $this->resolveExperienceYearsTotal($experienceEntries);
        $experienceLevel = $this->resolveExperienceLevel($experienceYearsTotal, $experienceEntries->count());
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
            'profile_photo_url' => Arr::get($profile, 'photoDataUrl'),
            'current_address' => Arr::get($profile, 'currentAddress'),
            'gender' => $this->normalizeGenderValue((string) Arr::get($profile, 'gender', '')),
            'age' => $this->resolveCandidateAge($profile),
            'education_label' => trim((string) (Arr::get($profile, 'education.degree') ?: Arr::get($profile, 'education.major') ?: '')) ?: 'Belum diisi',
            'preferred_roles' => collect(Arr::get($profile, 'preferredRoles', []))->filter()->values()->all(),
            'preferred_locations' => collect(Arr::get($profile, 'preferredLocations', []))->filter()->values()->all(),
            'skills' => collect(Arr::get($profile, 'skills', []))->filter()->values()->all(),
            'experience_type' => $experienceType,
            'experience_entries_count' => $experienceEntries->count(),
            'experience_years_total' => $experienceYearsTotal,
            'experience_level' => $experienceLevel,
            'latest_experience' => $this->resolveLatestExperience($experienceEntries),
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

    private function normalizeGenderValue(string $value): string
    {
        $normalizedValue = strtolower(trim($value));

        if (in_array($normalizedValue, ['male', 'pria', 'laki-laki', 'laki laki'], true)) {
            return 'male';
        }

        if (in_array($normalizedValue, ['female', 'wanita', 'perempuan'], true)) {
            return 'female';
        }

        return '';
    }

    private function resolveCandidateAge(array $profile): ?int
    {
        $explicitAge = (int) Arr::get($profile, 'age', 0);

        if ($explicitAge > 0) {
            return $explicitAge;
        }

        $dateOfBirth = Arr::get($profile, 'dateOfBirth');

        if (!is_string($dateOfBirth) || trim($dateOfBirth) === '') {
            return null;
        }

        try {
            $birthDate = new \DateTimeImmutable($dateOfBirth);
            $now = new \DateTimeImmutable();
            $age = (int) $now->diff($birthDate)->y;

            return $age > 0 ? $age : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseExperienceYearValue(mixed $value, bool $allowCurrent = false): int|string|null
    {
        $normalizedValue = strtolower(trim((string) $value));

        if ($allowCurrent && in_array($normalizedValue, ['current', 'now', 'present', 'sekarang', 'saat ini', 'masih bekerja'], true)) {
            return 'current';
        }

        if (!preg_match('/\b(19|20)\d{2}\b/', $normalizedValue, $matches)) {
            return null;
        }

        return (int) $matches[0];
    }

    private function resolveExperienceYearsTotal($experienceEntries): int
    {
        if ($experienceEntries->isEmpty()) {
            return 0;
        }

        return (int) $experienceEntries->reduce(function (int $sum, array $experience): int {
            $startYear = $this->parseExperienceYearValue($experience['startYear'] ?? $experience['year'] ?? null);
            $endYear = $this->parseExperienceYearValue($experience['endYear'] ?? $experience['year'] ?? null, true);

            if (!is_int($startYear)) {
                return $sum + 1;
            }

            $effectiveEndYear = $endYear === 'current'
                ? (int) now()->format('Y')
                : (is_int($endYear) ? $endYear : $startYear);

            if ($effectiveEndYear < $startYear) {
                return $sum + 1;
            }

            return $sum + max(1, $effectiveEndYear - $startYear + 1);
        }, 0);
    }

    private function resolveExperienceLevel(int $experienceYearsTotal, int $experienceEntriesCount): string
    {
        if ($experienceEntriesCount === 0) {
            return 'entry';
        }

        if ($experienceYearsTotal >= 5) {
            return 'senior';
        }

        if ($experienceYearsTotal >= 3) {
            return 'mid';
        }

        return 'junior';
    }

    private function formatExperienceDurationLabel(array $experience): string
    {
        $startYear = $this->parseExperienceYearValue($experience['startYear'] ?? $experience['year'] ?? null);
        $endYear = $this->parseExperienceYearValue($experience['endYear'] ?? $experience['year'] ?? null, true);

        if (!is_int($startYear) && !is_int($endYear) && $endYear !== 'current') {
            return '';
        }

        if (is_int($startYear) && $endYear === 'current') {
            return sprintf('%d - Sekarang', $startYear);
        }

        if (is_int($startYear) && is_int($endYear)) {
            return sprintf('%d - %d', $startYear, $endYear);
        }

        return (string) ($startYear ?: $endYear ?: '');
    }

    private function resolveLatestExperience($experienceEntries): ?array
    {
        $latestExperience = $experienceEntries->first();

        if (!$latestExperience) {
            return null;
        }

        return [
            'company' => (string) ($latestExperience['company'] ?? ''),
            'position' => (string) ($latestExperience['position'] ?? ''),
            'duration_label' => $this->formatExperienceDurationLabel($latestExperience),
        ];
    }
}
