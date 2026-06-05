<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

class TalentSearchService
{
    /**
     * Wire dependencies for recruiter-facing talent search and result formatting.
     */
    public function __construct(
        private RecruiterPlanService $recruiterPlanService,
        private TalentSearchCandidatePresenter $talentSearchCandidatePresenter,
        private ServiceActivityLogService $serviceActivityLogService,
    )
    {
    }

    /**
     * Search visible candidates, apply recruiter filters, and paginate within plan limits.
     */
    public function search(User $recruiter, array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $plan = $this->recruiterPlanService->getRecruiterPlanContext($recruiter);
        $currentPage = max(1, (int) ($filters['page'] ?? 1));
        $normalizedQuery = strtolower(trim((string) ($filters['query'] ?? '')));
        $normalizedLocation = strtolower(trim((string) ($filters['location'] ?? '')));
        $normalizedGrade = strtoupper(trim((string) ($filters['grade'] ?? '')));
        $normalizedExperienceType = strtolower(trim((string) ($filters['experience_type'] ?? '')));
        $normalizedSkill = strtolower(trim((string) ($filters['skill'] ?? '')));
        $normalizedExperienceLevel = strtolower(trim((string) ($filters['experience_level'] ?? '')));
        $normalizedGender = strtolower(trim((string) ($filters['gender'] ?? '')));
        $minimumAge = (int) ($filters['age_min'] ?? 0);
        $maximumAge = (int) ($filters['age_max'] ?? 0);

        $candidates = User::query()
            ->where('role', User::ROLE_CANDIDATE)
            ->where('account_status', User::STATUS_ACTIVE)
            ->withCount('applications')
            ->latest()
            ->get()
            ->map(fn (User $candidate) => $this->talentSearchCandidatePresenter->present($candidate, $recruiter))
            ->filter(function (array $candidate) use (
                $normalizedQuery,
                $normalizedLocation,
                $normalizedGrade,
                $normalizedExperienceType,
                $normalizedSkill,
                $normalizedExperienceLevel,
                $normalizedGender,
                $minimumAge,
                $maximumAge
            ) {
                $haystack = strtolower(implode(' ', array_filter([
                    $candidate['name'] ?? null,
                    $candidate['profile_summary'] ?? null,
                    $candidate['current_address'] ?? null,
                    implode(' ', $candidate['preferred_roles'] ?? []),
                    implode(' ', $candidate['preferred_locations'] ?? []),
                    implode(' ', $candidate['skills'] ?? []),
                ])));

                $matchesQuery = $normalizedQuery === '' || str_contains($haystack, $normalizedQuery);
                $matchesLocation = $normalizedLocation === ''
                    || collect([
                        $candidate['current_address'] ?? null,
                        ...($candidate['preferred_locations'] ?? []),
                    ])
                        ->filter()
                        ->contains(fn ($location) => str_contains(strtolower((string) $location), $normalizedLocation));
                $matchesGrade = $normalizedGrade === '' || strtoupper((string) $candidate['grade']) === $normalizedGrade;
                $matchesExperienceType = $normalizedExperienceType === ''
                    || strtolower((string) $candidate['experience_type']) === $normalizedExperienceType;
                $matchesSkill = $normalizedSkill === ''
                    || collect($candidate['skills'] ?? [])
                        ->contains(fn ($skill) => str_contains(strtolower((string) $skill), $normalizedSkill));
                $matchesExperienceLevel = $normalizedExperienceLevel === ''
                    || strtolower((string) ($candidate['experience_level'] ?? '')) === $normalizedExperienceLevel;
                $matchesGender = $normalizedGender === ''
                    || strtolower((string) ($candidate['gender'] ?? '')) === $normalizedGender;
                $candidateAge = (int) ($candidate['age'] ?? 0);
                $matchesMinimumAge = $minimumAge <= 0 || $candidateAge >= $minimumAge;
                $matchesMaximumAge = $maximumAge <= 0 || ($candidateAge > 0 && $candidateAge <= $maximumAge);

                return $matchesQuery
                    && $matchesLocation
                    && $matchesGrade
                    && $matchesExperienceType
                    && $matchesSkill
                    && $matchesExperienceLevel
                    && $matchesGender
                    && $matchesMinimumAge
                    && $matchesMaximumAge;
            })
            ->sortByDesc(
                fn (array $candidate) =>
                    ((int) $candidate['profile_readiness_percent'] * 1000)
                    + ((int) ($candidate['experience_years_total'] ?? 0) * 100)
                    + ((int) $candidate['applications_count'] * 10)
                    + (int) $candidate['experience_entries_count']
            )
            ->values();

        $limitedCandidates = $candidates->take((int) $plan['talent_result_limit'])->values();
        $items = $limitedCandidates
            ->forPage($currentPage, $perPage)
            ->values();

        $this->serviceActivityLogService->info($this, 'talent_search_service.search_executed', [
            'action' => 'talent_search',
            'target_user_id' => $recruiter->id,
            'plan_code' => $plan['code'] ?? null,
            'query_present' => $normalizedQuery !== '',
            'location_present' => $normalizedLocation !== '',
            'grade_filter' => $normalizedGrade !== '' ? $normalizedGrade : null,
            'experience_type_filter' => $normalizedExperienceType !== '' ? $normalizedExperienceType : null,
            'experience_level_filter' => $normalizedExperienceLevel !== '' ? $normalizedExperienceLevel : null,
            'gender_filter' => $normalizedGender !== '' ? $normalizedGender : null,
            'minimum_age_filter' => $minimumAge > 0 ? $minimumAge : null,
            'maximum_age_filter' => $maximumAge > 0 ? $maximumAge : null,
            'skill_present' => $normalizedSkill !== '',
            'filtered_candidate_count' => $candidates->count(),
            'result_limit' => (int) $plan['talent_result_limit'],
            'returned_total' => $limitedCandidates->count(),
            'page' => $currentPage,
            'per_page' => $perPage,
            'result' => 'success',
        ], $recruiter);

        return new LengthAwarePaginator(
            $items,
            $limitedCandidates->count(),
            $perPage,
            $currentPage,
            ['path' => request()->url()]
        );
    }
}
