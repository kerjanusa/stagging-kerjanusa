<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Job;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminService
{
    /**
     * Wire plan helpers and logging for superadmin dashboard aggregation.
     */
    public function __construct(
        private RecruiterPlanService $recruiterPlanService,
        private ServiceActivityLogService $serviceActivityLogService,
    )
    {
    }

    /**
     * Cache and resolve whether a schema column exists on the current database.
     */
    private function hasColumn(string $table, string $column): bool
    {
        static $columnCache = [];

        if (!array_key_exists($table, $columnCache)) {
            $columnCache[$table] = [];
        }

        if (!array_key_exists($column, $columnCache[$table])) {
            $columnCache[$table][$column] = Schema::hasColumn($table, $column);
        }

        return $columnCache[$table][$column];
    }

    /**
     * Convert optional scalar values into safe SQL literals for fallback expressions.
     */
    private function toSqlLiteral(string|int|null $value): string
    {
        if ($value === null) {
            return 'NULL';
        }

        if (is_int($value)) {
            return (string) $value;
        }

        return "'" . str_replace("'", "''", $value) . "'";
    }

    /**
     * Select a column when present, or fall back to a synthetic SQL value when absent.
     */
    private function selectOptionalColumn(string $table, string $column, string $alias, string|int|null $fallback = null)
    {
        if ($this->hasColumn($table, $column)) {
            return $alias === $column
                ? sprintf('%s.%s', $table, $column)
                : sprintf('%s.%s as %s', $table, $column, $alias);
        }

        return DB::raw(sprintf('%s as %s', $this->toSqlLiteral($fallback), $alias));
    }

    /**
     * Decode JSON-like payload columns into arrays without throwing on invalid data.
     */
    private function decodeArrayPayload(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (!is_string($value) || trim($value) === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Check whether a profile contains all fields needed to be considered "ready".
     */
    private function extractProfileReadiness(array $profile, array $requiredKeys): bool
    {
        foreach ($requiredKeys as $key) {
            $value = Arr::get($profile, $key);

            if (is_array($value)) {
                if (collect($value)->filter(fn ($item) => filled(is_string($item) ? trim($item) : $item))->isEmpty()) {
                    return false;
                }

                continue;
            }

            if (!filled($value)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Build the live superadmin dashboard payload from current users, jobs, and applications.
     */
    public function getDashboardData(): array
    {
        $sevenDaysAgo = now()->subDays(7);
        $hasUserCompanyName = $this->hasColumn('users', 'company_name');
        $hasUserAccountStatus = $this->hasColumn('users', 'account_status');
        $hasUserAccountStatusReason = $this->hasColumn('users', 'account_status_reason');
        $hasCandidateProfile = $this->hasColumn('users', 'candidate_profile');
        $hasRecruiterProfile = $this->hasColumn('users', 'recruiter_profile');
        $hasJobWorkflowStatus = $this->hasColumn('jobs', 'workflow_status');
        $hasJobVideoScreeningRequirement = $this->hasColumn('jobs', 'video_screening_requirement');
        $hasJobQuizScreeningQuestions = $this->hasColumn('jobs', 'quiz_screening_questions');
        $hasApplicationStage = $this->hasColumn('applications', 'stage');
        $hasApplicationScreeningAnswers = $this->hasColumn('applications', 'screening_answers');
        $hasApplicationVideoIntroUrl = $this->hasColumn('applications', 'video_intro_url');
        $hasApplicationAppliedAt = $this->hasColumn('applications', 'applied_at');

        $schemaWarnings = collect([
            !$hasUserCompanyName ? 'users.company_name' : null,
            !$hasUserAccountStatus ? 'users.account_status' : null,
            !$hasUserAccountStatusReason ? 'users.account_status_reason' : null,
            !$hasCandidateProfile ? 'users.candidate_profile' : null,
            !$hasRecruiterProfile ? 'users.recruiter_profile' : null,
            !$hasJobWorkflowStatus ? 'jobs.workflow_status' : null,
            !$hasJobVideoScreeningRequirement ? 'jobs.video_screening_requirement' : null,
            !$hasJobQuizScreeningQuestions ? 'jobs.quiz_screening_questions' : null,
            !$hasApplicationStage ? 'applications.stage' : null,
            !$hasApplicationScreeningAnswers ? 'applications.screening_answers' : null,
            !$hasApplicationVideoIntroUrl ? 'applications.video_intro_url' : null,
        ])->filter()->values()->all();

        if (!empty($schemaWarnings)) {
            $this->serviceActivityLogService->warning($this, 'admin_service.dashboard_schema_warnings_detected', [
                'action' => 'get_dashboard_data',
                'schema_warning_count' => count($schemaWarnings),
                'schema_warnings' => $schemaWarnings,
                'result' => 'partial_schema',
            ]);
        }

        $userAggregates = User::query()
            ->selectRaw('COUNT(*) as total_users')
            ->selectRaw(
                'SUM(CASE WHEN role = ? THEN 1 ELSE 0 END) as candidates',
                [User::ROLE_CANDIDATE]
            )
            ->selectRaw(
                'SUM(CASE WHEN role = ? THEN 1 ELSE 0 END) as recruiters',
                [User::ROLE_RECRUITER]
            )
            ->selectRaw(
                'SUM(CASE WHEN role = ? THEN 1 ELSE 0 END) as superadmins',
                [User::ROLE_SUPERADMIN]
            )
            ->selectRaw(
                'SUM(CASE WHEN role = ? AND created_at >= ? THEN 1 ELSE 0 END) as new_candidates_last_7_days',
                [User::ROLE_CANDIDATE, $sevenDaysAgo]
            )
            ->selectRaw(
                'SUM(CASE WHEN role = ? AND created_at >= ? THEN 1 ELSE 0 END) as new_recruiters_last_7_days',
                [User::ROLE_RECRUITER, $sevenDaysAgo]
            )
            ->first();

        $jobAggregates = Job::query()
            ->selectRaw('COUNT(*) as total_jobs')
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active_jobs',
                [Job::STATUS_ACTIVE]
            )
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as inactive_jobs',
                [Job::STATUS_INACTIVE]
            )
            ->selectRaw(
                'SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as new_jobs_last_7_days',
                [$sevenDaysAgo]
            )
            ->first();

        $applicationAggregates = Application::query()
            ->selectRaw('COUNT(*) as total_applications')
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending_applications',
                [Application::STATUS_PENDING]
            )
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as accepted_applications',
                [Application::STATUS_ACCEPTED]
            )
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as rejected_applications',
                [Application::STATUS_REJECTED]
            )
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as withdrawn_applications',
                [Application::STATUS_WITHDRAWN]
            )
            ->selectRaw(
                'SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as new_applications_last_7_days',
                [$sevenDaysAgo]
            )
            ->first();

        $totals = [
            'candidates' => (int) ($userAggregates->candidates ?? 0),
            'recruiters' => (int) ($userAggregates->recruiters ?? 0),
            'superadmins' => (int) ($userAggregates->superadmins ?? 0),
            'active_candidates' => (int) User::query()
                ->where('role', User::ROLE_CANDIDATE)
                ->when(
                    $hasUserAccountStatus,
                    fn ($query) => $query->where('account_status', User::STATUS_ACTIVE)
                )
                ->count(),
            'inactive_candidates' => $hasUserAccountStatus
                ? (int) User::query()
                    ->where('role', User::ROLE_CANDIDATE)
                    ->where('account_status', User::STATUS_SUSPENDED)
                    ->count()
                : 0,
            'active_recruiters' => (int) User::query()
                ->where('role', User::ROLE_RECRUITER)
                ->when(
                    $hasUserAccountStatus,
                    fn ($query) => $query->where('account_status', User::STATUS_ACTIVE)
                )
                ->count(),
            'inactive_recruiters' => $hasUserAccountStatus
                ? (int) User::query()
                    ->where('role', User::ROLE_RECRUITER)
                    ->where('account_status', User::STATUS_SUSPENDED)
                    ->count()
                : 0,
            'total_jobs' => (int) ($jobAggregates->total_jobs ?? 0),
            'active_jobs' => (int) ($jobAggregates->active_jobs ?? 0),
            'inactive_jobs' => (int) ($jobAggregates->inactive_jobs ?? 0),
            'total_applications' => (int) ($applicationAggregates->total_applications ?? 0),
            'pending_applications' => (int) ($applicationAggregates->pending_applications ?? 0),
            'accepted_applications' => (int) ($applicationAggregates->accepted_applications ?? 0),
            'rejected_applications' => (int) ($applicationAggregates->rejected_applications ?? 0),
            'withdrawn_applications' => (int) ($applicationAggregates->withdrawn_applications ?? 0),
        ];

        $growth = [
            'new_candidates_last_7_days' => (int) ($userAggregates->new_candidates_last_7_days ?? 0),
            'new_recruiters_last_7_days' => (int) ($userAggregates->new_recruiters_last_7_days ?? 0),
            'new_jobs_last_7_days' => (int) ($jobAggregates->new_jobs_last_7_days ?? 0),
            'new_applications_last_7_days' => (int) ($applicationAggregates->new_applications_last_7_days ?? 0),
        ];

        $latestCandidateApplicationQuery = Application::query()
            ->leftJoin('jobs as latest_jobs', 'latest_jobs.id', '=', 'applications.job_id')
            ->whereColumn('applications.candidate_id', 'users.id')
            ->when(
                $hasApplicationAppliedAt,
                fn ($query) => $query->orderByRaw('COALESCE(applications.applied_at, applications.created_at) DESC'),
                fn ($query) => $query->orderByDesc('applications.created_at')
            )
            ->orderByDesc('applications.id');

        $candidateTable = User::query()
            ->where('role', User::ROLE_CANDIDATE)
            ->select([
                'users.id',
                'users.name',
                'users.email',
                'users.phone',
                $this->selectOptionalColumn('users', 'account_status', 'account_status', User::STATUS_ACTIVE),
                $this->selectOptionalColumn('users', 'account_status_reason', 'account_status_reason'),
                $this->selectOptionalColumn('users', 'candidate_profile', 'candidate_profile'),
                'users.created_at',
            ])
            ->selectSub(
                Application::query()
                    ->selectRaw('COUNT(*)')
                    ->whereColumn('applications.candidate_id', 'users.id'),
                'applications_count'
            )
            ->selectSub(
                (clone $latestCandidateApplicationQuery)
                    ->select('applications.status')
                    ->limit(1),
                'latest_application_status'
            )
            ->selectSub(
                (clone $latestCandidateApplicationQuery)
                    ->when(
                        $hasApplicationStage,
                        fn ($query) => $query->select('applications.stage'),
                        fn ($query) => $query->selectRaw("'" . Application::STAGE_APPLIED . "'")
                    )
                    ->limit(1),
                'latest_application_stage'
            )
            ->selectSub(
                (clone $latestCandidateApplicationQuery)
                    ->select('latest_jobs.title')
                    ->limit(1),
                'latest_job_title'
            )
            ->selectSub(
                (clone $latestCandidateApplicationQuery)
                    ->when(
                        $hasApplicationAppliedAt,
                        fn ($query) => $query->selectRaw('COALESCE(applications.applied_at, applications.created_at)'),
                        fn ($query) => $query->select('applications.created_at')
                    )
                    ->limit(1),
                'latest_applied_at'
            )
            ->latest()
            ->get()
            ->map(function (User $candidate) {
                $candidateProfile = $this->decodeArrayPayload($candidate->candidate_profile);

                return [
                    'id' => $candidate->id,
                    'name' => $candidate->name,
                    'email' => $candidate->email,
                    'phone' => $candidate->phone,
                    'account_status' => $candidate->account_status ?? User::STATUS_ACTIVE,
                    'account_status_reason' => $candidate->account_status_reason,
                    'profile_ready' => $this->extractProfileReadiness($candidateProfile, [
                        'currentAddress',
                        'profileSummary',
                        'preferredRoles',
                        'preferredLocations',
                        'skills',
                        'resumeFiles',
                    ]),
                    'applications_count' => (int) ($candidate->applications_count ?? 0),
                    'latest_application_status' => $candidate->latest_application_status,
                    'latest_application_stage' => $candidate->latest_application_stage,
                    'latest_job_title' => $candidate->latest_job_title,
                    'profile_summary' => Arr::get($candidateProfile, 'profileSummary'),
                    'preferred_roles' => collect(Arr::get($candidateProfile, 'preferredRoles', []))
                        ->filter(fn ($role) => filled($role))
                        ->values()
                        ->all(),
                    'preferred_locations' => collect(Arr::get($candidateProfile, 'preferredLocations', []))
                        ->filter(fn ($location) => filled($location))
                        ->values()
                        ->all(),
                    'skills' => collect(Arr::get($candidateProfile, 'skills', []))
                        ->filter(fn ($skill) => filled($skill))
                        ->values()
                        ->all(),
                    'resume_files_count' => collect(Arr::get($candidateProfile, 'resumeFiles', []))
                        ->filter(fn ($file) => filled($file))
                        ->count(),
                    'created_at' => $candidate->created_at?->toIso8601String(),
                    'latest_applied_at' => $candidate->latest_applied_at,
                ];
            })
            ->values()
            ->all();

        $latestRecruiterJobQuery = Job::query()
            ->whereColumn('jobs.recruiter_id', 'users.id')
            ->orderByDesc('jobs.created_at')
            ->orderByDesc('jobs.id');

        $recruiterTable = User::query()
            ->where('role', User::ROLE_RECRUITER)
            ->select([
                'users.id',
                'users.name',
                $hasUserCompanyName ? 'users.company_name' : DB::raw('users.name as company_name'),
                'users.email',
                'users.phone',
                $this->selectOptionalColumn('users', 'account_status', 'account_status', User::STATUS_ACTIVE),
                $this->selectOptionalColumn('users', 'account_status_reason', 'account_status_reason'),
                $this->selectOptionalColumn('users', 'recruiter_profile', 'recruiter_profile'),
                'users.created_at',
            ])
            ->selectSub(
                Job::query()
                    ->selectRaw('COUNT(*)')
                    ->whereColumn('jobs.recruiter_id', 'users.id'),
                'jobs_count'
            )
            ->selectSub(
                Job::query()
                    ->selectRaw('COUNT(*)')
                    ->whereColumn('jobs.recruiter_id', 'users.id')
                    ->where('jobs.status', Job::STATUS_ACTIVE),
                'active_jobs_count'
            )
            ->selectSub(
                (clone $latestRecruiterJobQuery)
                    ->select('jobs.title')
                    ->limit(1),
                'latest_job_title'
            )
            ->selectSub(
                (clone $latestRecruiterJobQuery)
                    ->select('jobs.created_at')
                    ->limit(1),
                'latest_job_created_at'
            )
            ->latest()
            ->get()
            ->map(function (User $recruiter) {
                $recruiterProfile = $this->decodeArrayPayload($recruiter->recruiter_profile);
                $profileReady = $this->extractProfileReadiness($recruiterProfile, [
                    'recruiterName',
                    'companyName',
                    'legalCompanyName',
                    'companyEmail',
                    'phone',
                    'companyAddress',
                    'industry',
                    'employeeRange',
                    'website',
                    'companyDescription',
                ]) && mb_strlen(trim((string) Arr::get($recruiterProfile, 'companyDescription', ''))) >= 80
                    && filled(Arr::get($recruiterProfile, 'companyLogoDataUrl')
                        ?: Arr::get($recruiterProfile, 'companyLogoFileName'))
                    && filled(Arr::get($recruiterProfile, 'companyLegalDocumentPath')
                        ?: Arr::get($recruiterProfile, 'companyLegalDocumentName'));

                return [
                    ...$this->recruiterPlanService->getRecruiterPlanContext($recruiter),
                    'id' => $recruiter->id,
                    'name' => $recruiter->name,
                    'company_name' => $recruiter->company_name ?? $recruiter->name,
                    'company_location' => Arr::get($recruiterProfile, 'companyAddress')
                        ?: Arr::get($recruiterProfile, 'companyLocation')
                        ?: Arr::get($recruiterProfile, 'company_location'),
                    'company_address' => Arr::get($recruiterProfile, 'companyAddress')
                        ?: Arr::get($recruiterProfile, 'companyLocation')
                        ?: Arr::get($recruiterProfile, 'company_location'),
                    'email' => $recruiter->email,
                    'phone' => $recruiter->phone,
                    'account_status' => $recruiter->account_status ?? User::STATUS_ACTIVE,
                    'account_status_reason' => $recruiter->account_status_reason,
                    'profile_ready' => $profileReady,
                    'jobs_count' => (int) ($recruiter->jobs_count ?? 0),
                    'active_jobs_count' => (int) ($recruiter->active_jobs_count ?? 0),
                    'latest_job_title' => $recruiter->latest_job_title,
                    'verification_status' => Arr::get($recruiterProfile, 'verificationStatus')
                        ?? ($profileReady ? 'pending' : 'draft'),
                    'verification_notes' => Arr::get($recruiterProfile, 'verificationNotes'),
                    'verification_submitted_at' => Arr::get($recruiterProfile, 'verificationSubmittedAt'),
                    'verified_at' => Arr::get($recruiterProfile, 'verifiedAt'),
                    'recruiter_name' => Arr::get($recruiterProfile, 'recruiterName')
                        ?: $recruiter->name,
                    'contact_role' => Arr::get($recruiterProfile, 'contactRole')
                        ?? Arr::get($recruiterProfile, 'contact_role'),
                    'legal_company_name' => Arr::get($recruiterProfile, 'legalCompanyName'),
                    'industry' => Arr::get($recruiterProfile, 'industry'),
                    'employee_range' => Arr::get($recruiterProfile, 'employeeRange'),
                    'company_email' => Arr::get($recruiterProfile, 'companyEmail')
                        ?: $recruiter->email,
                    'company_link' => Arr::get($recruiterProfile, 'website'),
                    'company_description' => Arr::get($recruiterProfile, 'companyDescription')
                        ?? Arr::get($recruiterProfile, 'company_description'),
                    'company_legal_document_name' => Arr::get($recruiterProfile, 'companyLegalDocumentName'),
                    'company_legal_document_uploaded_at' => Arr::get($recruiterProfile, 'companyLegalDocumentUploadedAt'),
                    'hiring_focus' => collect(Arr::get($recruiterProfile, 'hiringFocus', []))
                        ->filter(fn ($focus) => filled($focus))
                        ->values()
                        ->all(),
                    'created_at' => $recruiter->created_at?->toIso8601String(),
                    'latest_job_created_at' => $recruiter->latest_job_created_at,
                ];
            })
            ->values()
            ->all();

        $jobApplicationCountsQuery = Application::query()
            ->selectRaw('job_id, COUNT(*) as applications_count')
            ->groupBy('job_id');

        $jobs = Job::query()
            ->leftJoin('users as recruiters', 'recruiters.id', '=', 'jobs.recruiter_id')
            ->leftJoinSub($jobApplicationCountsQuery, 'application_totals', function ($join) {
                $join->on('application_totals.job_id', '=', 'jobs.id');
            })
            ->select([
                'jobs.id',
                'jobs.title',
                'jobs.category',
                'jobs.location',
                'jobs.status',
                $this->selectOptionalColumn('jobs', 'workflow_status', 'workflow_status', Job::WORKFLOW_ACTIVE),
                'jobs.job_type',
                'jobs.experience_level',
                $this->selectOptionalColumn(
                    'jobs',
                    'video_screening_requirement',
                    'video_screening_requirement',
                    Job::VIDEO_SCREENING_OPTIONAL
                ),
                $this->selectOptionalColumn('jobs', 'quiz_screening_questions', 'quiz_screening_questions'),
                'jobs.created_at',
                DB::raw('COALESCE(application_totals.applications_count, 0) as applications_count'),
                'recruiters.id as recruiter_id',
                'recruiters.name as recruiter_name',
                'recruiters.email as recruiter_email',
                $hasUserCompanyName
                    ? 'recruiters.company_name as recruiter_company_name'
                    : 'recruiters.name as recruiter_company_name',
            ])
            ->latest()
            ->get()
            ->map(function ($job) {
                $screeningQuestions = $this->decodeArrayPayload($job->quiz_screening_questions);

                return [
                    'id' => $job->id,
                    'title' => $job->title,
                    'category' => $job->category,
                    'location' => $job->location,
                    'status' => $job->status,
                    'workflow_status' => $job->workflow_status ?? Job::WORKFLOW_ACTIVE,
                    'job_type' => $job->job_type,
                    'experience_level' => $job->experience_level,
                    'video_screening_requirement' => $job->video_screening_requirement ?? 'optional',
                    'screening_questions_count' => count(is_array($screeningQuestions) ? $screeningQuestions : []),
                    'applications_count' => (int) ($job->applications_count ?? 0),
                    'created_at' => optional($job->created_at)->toIso8601String(),
                    'recruiter' => [
                        'id' => $job->recruiter_id,
                        'name' => $job->recruiter_name,
                        'company_name' => $job->recruiter_company_name,
                        'email' => $job->recruiter_email,
                    ],
                ];
            })
            ->values()
            ->all();

        $applications = Application::query()
            ->leftJoin('users as candidates', 'candidates.id', '=', 'applications.candidate_id')
            ->leftJoin('jobs', 'jobs.id', '=', 'applications.job_id')
            ->leftJoin('users as recruiters', 'recruiters.id', '=', 'jobs.recruiter_id')
            ->select([
                'applications.id',
                'applications.status',
                $this->selectOptionalColumn('applications', 'stage', 'stage', Application::STAGE_APPLIED),
                $this->selectOptionalColumn('applications', 'video_intro_url', 'video_intro_url'),
                $this->selectOptionalColumn('applications', 'screening_answers', 'screening_answers'),
                $hasApplicationAppliedAt
                    ? DB::raw('COALESCE(applications.applied_at, applications.created_at) as applied_at')
                    : 'applications.created_at as applied_at',
                'candidates.id as candidate_id',
                'candidates.name as candidate_name',
                'candidates.email as candidate_email',
                'candidates.phone as candidate_phone',
                'jobs.id as job_id',
                'jobs.title as job_title',
                'jobs.location as job_location',
                'recruiters.id as recruiter_id',
                'recruiters.name as recruiter_name',
                $hasUserCompanyName
                    ? 'recruiters.company_name as recruiter_company_name'
                    : 'recruiters.name as recruiter_company_name',
                'recruiters.email as recruiter_email',
            ])
            ->when(
                $hasApplicationAppliedAt,
                fn ($query) => $query->orderByRaw('COALESCE(applications.applied_at, applications.created_at) DESC'),
                fn ($query) => $query->orderByDesc('applications.created_at')
            )
            ->orderByDesc('applications.id')
            ->get()
            ->map(function ($application) {
                $screeningAnswers = $this->decodeArrayPayload($application->screening_answers);

                return [
                    'id' => $application->id,
                    'status' => $application->status,
                    'stage' => $application->stage ?? Application::STAGE_APPLIED,
                    'applied_at' => $application->applied_at,
                    'has_video_intro' => filled($application->video_intro_url ?? null),
                    'screening_answers_count' => count(is_array($screeningAnswers) ? $screeningAnswers : []),
                    'candidate' => [
                        'id' => $application->candidate_id,
                        'name' => $application->candidate_name,
                        'email' => $application->candidate_email,
                        'phone' => $application->candidate_phone,
                    ],
                    'job' => [
                        'id' => $application->job_id,
                        'title' => $application->job_title,
                        'location' => $application->job_location,
                    ],
                    'recruiter' => [
                        'id' => $application->recruiter_id,
                        'name' => $application->recruiter_name,
                        'company_name' => $application->recruiter_company_name,
                        'email' => $application->recruiter_email,
                    ],
                ];
            })
            ->values()
            ->all();

        $screeningOverview = [
            'candidate_profiles_incomplete' => collect($candidateTable)
                ->where('profile_ready', false)
                ->count(),
            'applications_with_video_screening' => $hasApplicationVideoIntroUrl
                ? Application::query()->whereNotNull('video_intro_url')->count()
                : 0,
            'applications_with_screening_answers' => $hasApplicationScreeningAnswers
                ? Application::query()->whereNotNull('screening_answers')->count()
                : 0,
            'jobs_waiting_recruiter_notice' => Job::query()
                ->when(
                    $hasJobWorkflowStatus,
                    fn ($query) => $query->where('workflow_status', Job::WORKFLOW_ACTIVE),
                    fn ($query) => $query->where('status', Job::STATUS_ACTIVE)
                )
                ->where('created_at', '<=', now()->subDays(3))
                ->whereDoesntHave('applications')
                ->count(),
            'recruiter_plan_distribution' => collect($recruiterTable)
                ->groupBy('code')
                ->map(fn (Collection $items, string $planCode) => [
                    'plan_code' => $planCode,
                    'label' => $items->first()['label'] ?? strtoupper($planCode),
                    'total' => $items->count(),
                ])
                ->values()
                ->all(),
        ];

        $dashboardData = [
            'totals' => $totals,
            'growth' => $growth,
            'screening_overview' => $screeningOverview,
            'candidate_table' => $candidateTable,
            'recruiter_table' => $recruiterTable,
            'recruiter_options' => collect($recruiterTable)
                ->filter(fn (array $recruiter) => ($recruiter['account_status'] ?? null) === User::STATUS_ACTIVE)
                ->sortBy([
                    ['company_name', 'asc'],
                    ['name', 'asc'],
                ])
                ->map(fn (array $recruiter) => [
                    'id' => $recruiter['id'],
                    'name' => $recruiter['name'],
                    'company_name' => $recruiter['company_name'],
                    'email' => $recruiter['email'],
                ])
                ->values()
                ->all(),
            'jobs' => $jobs,
            'applications' => $applications,
            'meta' => [
                'schema_warnings' => $schemaWarnings,
            ],
        ];

        $this->serviceActivityLogService->info($this, 'admin_service.dashboard_loaded', [
            'action' => 'get_dashboard_data',
            'schema_warning_count' => count($schemaWarnings),
            'candidate_row_count' => count($candidateTable),
            'recruiter_row_count' => count($recruiterTable),
            'job_row_count' => count($jobs),
            'application_row_count' => count($applications),
            'total_users' => (int) ($userAggregates->total_users ?? 0),
            'total_jobs' => $totals['total_jobs'],
            'total_applications' => $totals['total_applications'],
            'result' => 'success',
        ]);

        return $dashboardData;
    }
}
