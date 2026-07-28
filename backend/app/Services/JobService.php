<?php

namespace App\Services;

use App\Models\Job;
use App\Models\Application;
use App\Models\RecruiterJob;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class JobService
{
    /**
     * Wire plan enforcement and logging for job lifecycle operations.
     */
    public function __construct(
        private RecruiterPlanService $recruiterPlanService,
        private ServiceActivityLogService $serviceActivityLogService,
    )
    {
    }

    /**
     * Keep the public active/inactive status in sync with the richer recruiter workflow status.
     */
    public function mapWorkflowToStatus(string $workflowStatus): string
    {
        return $workflowStatus === Job::WORKFLOW_ACTIVE
            ? Job::STATUS_ACTIVE
            : Job::STATUS_INACTIVE;
    }

    /**
     * Derive a sensible workflow label when only the old status is available.
     */
    public function mapStatusToWorkflow(string $status): string
    {
        return $status === Job::STATUS_ACTIVE
            ? Job::WORKFLOW_ACTIVE
            : Job::WORKFLOW_DRAFT;
    }

    /**
     * Build the duplicated payload kept in the recruiter-owned jobs table.
     */
    private function buildRecruiterJobPayload(Job $job): array
    {
        return [
            'recruiter_id' => $job->recruiter_id,
            'title' => $job->title,
            'description' => $job->description,
            'category' => $job->category,
            'salary_min' => $job->salary_min,
            'salary_max' => $job->salary_max,
            'location' => $job->location,
            'job_type' => $job->job_type,
            'experience_level' => $job->experience_level,
            'work_mode' => $job->work_mode,
            'openings_count' => $job->openings_count,
            'interview_type' => $job->interview_type,
            'interview_note' => $job->interview_note,
            'shift_night' => $job->shift_night,
            'expiry_date' => $job->expiry_date,
            'candidate_gender' => $job->candidate_gender,
            'candidate_experience' => $job->candidate_experience,
            'candidate_education' => $job->candidate_education,
            'candidate_age_min' => $job->candidate_age_min,
            'candidate_age_max' => $job->candidate_age_max,
            'candidate_no_age_limit' => $job->candidate_no_age_limit,
            'candidate_photo_requirement' => $job->candidate_photo_requirement,
            'candidate_domicile' => $job->candidate_domicile,
            'candidate_skills' => $job->candidate_skills,
            'candidate_custom_skill' => $job->candidate_custom_skill,
            'internal_recruiter_link' => $job->internal_recruiter_link,
            'video_screening_requirement' => $job->video_screening_requirement,
            'status' => $job->status,
            'workflow_status' => $job->workflow_status,
            'quiz_screening_questions' => $job->quiz_screening_questions,
        ];
    }

    /**
     * Keep recruiter-submitted jobs in a separate table without breaking public job flows.
     */
    private function syncRecruiterJobRecord(Job $job, bool $createIfMissing = true): void
    {
        if (!Schema::hasTable('recruiter_jobs')) {
            return;
        }

        if (!$createIfMissing && !RecruiterJob::where('job_id', $job->id)->exists()) {
            return;
        }

        RecruiterJob::updateOrCreate(
            ['job_id' => $job->id],
            $this->buildRecruiterJobPayload($job)
        );
    }

    /**
     * Count only jobs submitted through recruiter accounts so seeded public jobs do not consume quota.
     */
    private function countRecruiterActiveJobsForPlan(int $recruiterId): int
    {
        if (Schema::hasTable('recruiter_jobs')) {
            return RecruiterJob::query()
                ->where('recruiter_id', $recruiterId)
                ->where('workflow_status', Job::WORKFLOW_ACTIVE)
                ->count();
        }

        return Job::query()
            ->where('recruiter_id', $recruiterId)
            ->where('workflow_status', Job::WORKFLOW_ACTIVE)
            ->count();
    }

    /**
     * Mengambil daftar lowongan aktif lalu menerapkan seluruh filter pencarian dari frontend.
     */
    public function getAllJobs(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = Job::with('recruiter')
            ->where('status', Job::STATUS_ACTIVE);

        $jobs = $this->applyFilters($query, $filters)
            ->latest()
            ->paginate($perPage);

        $this->serviceActivityLogService->debug($this, 'job_service.jobs_loaded', [
            'action' => 'get_all_jobs',
            'filters' => array_keys(array_filter($filters, fn ($value) => filled($value))),
            'per_page' => $perPage,
            'total' => $jobs->total(),
            'page' => $jobs->currentPage(),
            'result' => 'success',
        ]);

        return $jobs;
    }

    /**
     * Mengambil detail lowongan lengkap beserta recruiter dan lamaran yang terkait.
     */
    public function getJobById(int $jobId): ?Job
    {
        $job = Job::with('recruiter')->find($jobId);

        $this->serviceActivityLogService->debug($this, 'job_service.job_loaded', [
            'action' => 'get_job_by_id',
            'job_id' => $jobId,
            'result' => $job ? 'found' : 'not_found',
        ]);

        return $job;
    }

    /**
     * Membuat lowongan baru dan memastikan recruiter pemilik serta status awalnya konsisten.
     */
    public function createJob(int $recruiterId, array $data): Job
    {
        $recruiter = User::findOrFail($recruiterId);
        $data['recruiter_id'] = $recruiterId;
        $data['workflow_status'] = $data['workflow_status'] ?? $this->mapStatusToWorkflow(
            $data['status'] ?? Job::STATUS_ACTIVE
        );
        $data['status'] = $data['status'] ?? Job::STATUS_ACTIVE;

        if (array_key_exists('workflow_status', $data)) {
            $data['status'] = $this->mapWorkflowToStatus($data['workflow_status']);
        }

        $data['quiz_screening_questions'] = $this->sanitizeScreeningQuestions(
            $data['quiz_screening_questions'] ?? []
        );
        $data = $this->normalizeCandidateCriteria($data);

        if (($data['workflow_status'] ?? Job::WORKFLOW_ACTIVE) === Job::WORKFLOW_ACTIVE) {
            $currentActiveJobs = $this->countRecruiterActiveJobsForPlan($recruiterId);

            if (!$this->recruiterPlanService->canPublishAdditionalJob($recruiter, $currentActiveJobs)) {
                $plan = $this->recruiterPlanService->getRecruiterPlanContext($recruiter);

                $this->serviceActivityLogService->warning($this, 'job_service.job_creation_rejected', [
                    'action' => 'create_job',
                    'target_user_id' => $recruiterId,
                    'workflow_status' => $data['workflow_status'] ?? null,
                    'current_active_jobs' => $currentActiveJobs,
                    'plan_code' => $plan['code'] ?? null,
                    'job_limit' => $plan['job_limit'],
                    'result' => 'plan_limit_reached',
                ], $recruiter);

                throw ValidationException::withMessages([
                    'workflow_status' => [
                        sprintf(
                            'Paket %s hanya mengizinkan %d lowongan aktif. Upgrade paket atau nonaktifkan lowongan lama.',
                            $plan['label'],
                            $plan['job_limit']
                        ),
                    ],
                ]);
            }
        }

        $job = DB::transaction(function () use ($data): Job {
            $job = Job::create($data);
            $this->syncRecruiterJobRecord($job);

            return $job;
        });

        $this->serviceActivityLogService->info($this, 'job_service.job_created', [
            'action' => 'create_job',
            'job_id' => $job->id,
            'target_user_id' => $recruiterId,
            'workflow_status' => $job->workflow_status,
            'status' => $job->status,
            'result' => 'success',
        ], $recruiter);

        return $job;
    }

    /**
     * Mengubah data lowongan jika record ditemukan.
     */
    public function updateJob(int $jobId, array $data): bool
    {
        $job = Job::find($jobId);

        if (!$job) {
            $this->serviceActivityLogService->warning($this, 'job_service.job_update_rejected', [
                'action' => 'update_job',
                'job_id' => $jobId,
                'result' => 'job_not_found',
            ]);

            return false;
        }

        if (array_key_exists('workflow_status', $data)) {
            $data['status'] = $this->mapWorkflowToStatus($data['workflow_status']);
        } elseif (array_key_exists('status', $data)) {
            $data['workflow_status'] = $this->mapStatusToWorkflow($data['status']);
        }

        if (array_key_exists('quiz_screening_questions', $data)) {
            $data['quiz_screening_questions'] = $this->sanitizeScreeningQuestions(
                $data['quiz_screening_questions'] ?? []
            );
        }
        $data = $this->normalizeCandidateCriteria($data);

        $nextWorkflowStatus = $data['workflow_status'] ?? $job->workflow_status;

        if ($nextWorkflowStatus === Job::WORKFLOW_ACTIVE && $job->workflow_status !== Job::WORKFLOW_ACTIVE) {
            $recruiter = User::find($job->recruiter_id);

            if ($recruiter) {
                $currentActiveJobs = $this->countRecruiterActiveJobsForPlan($job->recruiter_id);

                if (!$this->recruiterPlanService->canPublishAdditionalJob($recruiter, $currentActiveJobs)) {
                    $plan = $this->recruiterPlanService->getRecruiterPlanContext($recruiter);

                    $this->serviceActivityLogService->warning($this, 'job_service.job_update_rejected', [
                        'action' => 'update_job',
                        'job_id' => $job->id,
                        'target_user_id' => $job->recruiter_id,
                        'workflow_status' => $nextWorkflowStatus,
                        'current_active_jobs' => $currentActiveJobs,
                        'plan_code' => $plan['code'] ?? null,
                        'job_limit' => $plan['job_limit'],
                        'result' => 'plan_limit_reached',
                    ], $recruiter);

                    throw ValidationException::withMessages([
                        'workflow_status' => [
                            sprintf(
                                'Paket %s hanya mengizinkan %d lowongan aktif. Upgrade paket atau nonaktifkan lowongan lama.',
                                $plan['label'],
                                $plan['job_limit']
                            ),
                        ],
                    ]);
                }
            }
        }

        $updated = DB::transaction(function () use ($job, $data): bool {
            $updated = $job->update($data);

            if ($updated) {
                $job->refresh();
                $this->syncRecruiterJobRecord($job, false);
            }

            return $updated;
        });

        $this->serviceActivityLogService->log(
            $this,
            $updated ? 'info' : 'warning',
            $updated ? 'job_service.job_updated' : 'job_service.job_update_failed',
            [
                'action' => 'update_job',
                'job_id' => $job->id,
                'target_user_id' => $job->recruiter_id,
                'changed_fields' => array_keys($data),
                'result' => $updated ? 'success' : 'failed',
            ]
        );

        return $updated;
    }

    /**
     * Reassign a job to another recruiter while preserving its current workflow.
     */
    public function reassignJob(int $jobId, int $recruiterId): bool
    {
        $job = Job::find($jobId);

        if (!$job) {
            $this->serviceActivityLogService->warning($this, 'job_service.job_reassignment_rejected', [
                'action' => 'reassign_job',
                'job_id' => $jobId,
                'target_user_id' => $recruiterId,
                'result' => 'job_not_found',
            ]);

            return false;
        }

        $updated = DB::transaction(function () use ($job, $recruiterId): bool {
            $updated = $job->update([
                'recruiter_id' => $recruiterId,
            ]);

            if ($updated) {
                $job->refresh();
                $this->syncRecruiterJobRecord($job, false);
            }

            return $updated;
        });

        $this->serviceActivityLogService->log(
            $this,
            $updated ? 'info' : 'warning',
            $updated
                ? 'job_service.job_reassigned'
                : 'job_service.job_reassignment_failed',
            [
                'action' => 'reassign_job',
                'job_id' => $job->id,
                'previous_recruiter_id' => $job->getOriginal('recruiter_id'),
                'target_user_id' => $recruiterId,
                'result' => $updated ? 'success' : 'failed',
            ]
        );

        return $updated;
    }

    /**
     * Menghapus lowongan jika record masih ada.
     */
    public function deleteJob(int $jobId): bool
    {
        $job = Job::find($jobId);

        if (!$job) {
            $this->serviceActivityLogService->warning($this, 'job_service.job_delete_rejected', [
                'action' => 'delete_job',
                'job_id' => $jobId,
                'result' => 'job_not_found',
            ]);

            return false;
        }

        $deleted = $job->delete();

        $this->serviceActivityLogService->log(
            $this,
            $deleted ? 'info' : 'warning',
            $deleted ? 'job_service.job_deleted' : 'job_service.job_delete_failed',
            [
                'action' => 'delete_job',
                'job_id' => $jobId,
                'target_user_id' => $job->recruiter_id,
                'result' => $deleted ? 'success' : 'failed',
            ]
        );

        return $deleted;
    }

    /**
     * Mengambil daftar lowongan milik recruiter tertentu untuk dashboard internal.
     */
    public function getRecruiterJobs(int $recruiterId, int $perPage = 15): LengthAwarePaginator
    {
        $query = Job::where('recruiter_id', $recruiterId);

        if (Schema::hasTable('recruiter_jobs')) {
            $query->whereHas('recruiterJob');
        }

        $jobs = $query->latest()->paginate($perPage);

        $this->serviceActivityLogService->debug($this, 'job_service.recruiter_jobs_loaded', [
            'action' => 'get_recruiter_jobs',
            'target_user_id' => $recruiterId,
            'per_page' => $perPage,
            'total' => $jobs->total(),
            'page' => $jobs->currentPage(),
            'result' => 'success',
        ]);

        return $jobs;
    }

    /**
     * Mengambil daftar lokasi unik dari lowongan aktif agar dropdown frontend selalu sinkron.
     */
    public function getAvailableLocations(): array
    {
        $locations = Job::query()
            ->where('status', Job::STATUS_ACTIVE)
            ->whereNotNull('location')
            ->select('location')
            ->distinct()
            ->orderBy('location')
            ->pluck('location')
            ->values()
            ->all();

        $this->serviceActivityLogService->debug($this, 'job_service.available_locations_loaded', [
            'action' => 'get_available_locations',
            'location_count' => count($locations),
            'result' => 'success',
        ]);

        return $locations;
    }

    /**
     * Menghitung ringkasan jumlah lamaran per status untuk satu lowongan.
     */
    public function getJobStatistics(int $jobId): array
    {
        $job = Job::find($jobId);

        if (!$job) {
            $this->serviceActivityLogService->warning($this, 'job_service.statistics_rejected', [
                'action' => 'get_job_statistics',
                'job_id' => $jobId,
                'result' => 'job_not_found',
            ]);

            return [];
        }

        $statistics = [
            'total_applications' => $job->applications()->count(),
            'pending_applications' => $this->countApplicationsByStatus($job, Application::STATUS_PENDING),
            'accepted_applications' => $this->countApplicationsByStatus($job, Application::STATUS_ACCEPTED),
            'rejected_applications' => $this->countApplicationsByStatus($job, Application::STATUS_REJECTED),
        ];

        $this->serviceActivityLogService->debug($this, 'job_service.statistics_loaded', [
            'action' => 'get_job_statistics',
            'job_id' => $jobId,
            ...$statistics,
            'result' => 'success',
        ]);

        return $statistics;
    }

    /**
     * Menerapkan filter kategori, lokasi, tipe kerja, level, dan kata kunci ke query lowongan.
     */
    private function applyFilters(Builder $query, array $filters): Builder
    {
        if (!empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        if (!empty($filters['location'])) {
            $query->where('location', 'like', '%' . $filters['location'] . '%');
        }

        if (!empty($filters['job_type'])) {
            $query->where('job_type', $filters['job_type']);
        }

        if (!empty($filters['experience_level'])) {
            $query->where('experience_level', $filters['experience_level']);
        }

        if (!empty($filters['search'])) {
            $this->applySearchFilter($query, $filters['search']);
        }

        return $query;
    }

    /**
     * Memperluas pencarian kata kunci ke judul dan deskripsi lowongan sekaligus.
     */
    private function applySearchFilter(Builder $query, string $search): void
    {
        $query->where(function (Builder $builder) use ($search) {
            $builder->where('title', 'like', '%' . $search . '%')
                ->orWhere('description', 'like', '%' . $search . '%');
        });
    }

    /**
     * Menghitung jumlah lamaran untuk satu status tertentu agar statistik tidak duplikatif.
     */
    private function countApplicationsByStatus(Job $job, string $status): int
    {
        return $job->applications()->where('status', $status)->count();
    }

    /**
     * Normalize screening question payloads before they are persisted on the job.
     */
    private function sanitizeScreeningQuestions(array $questions): array
    {
        $seenIds = [];

        return collect($questions)
            ->filter(fn ($question) => is_array($question) && filled($question['question'] ?? null))
            ->map(function (array $question, int $index) use (&$seenIds) {
                $rawId = filled($question['id'] ?? null) ? (string) $question['id'] : '';
                $questionId = $rawId && !in_array($rawId, $seenIds, true)
                    ? $rawId
                    : sprintf('question-%d', $index + 1);
                $suffix = 2;

                while (in_array($questionId, $seenIds, true)) {
                    $questionId = sprintf('question-%d-%d', $index + 1, $suffix);
                    $suffix++;
                }

                $seenIds[] = $questionId;

                return [
                    'id' => $questionId,
                    'type' => $question['type'] ?? 'text',
                    'title' => trim((string) ($question['title'] ?? $question['question'] ?? 'Pertanyaan screening')),
                    'question' => trim((string) ($question['question'] ?? '')),
                    'answers' => collect($question['answers'] ?? [])
                        ->map(fn ($answer) => trim((string) $answer))
                        ->filter()
                        ->values()
                        ->all(),
                    'required' => (bool) ($question['required'] ?? true),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Keep optional candidate criteria clean before create/update.
     */
    private function normalizeCandidateCriteria(array $data): array
    {
        if (array_key_exists('candidate_skills', $data)) {
            $data['candidate_skills'] = collect($data['candidate_skills'] ?? [])
                ->map(fn ($skill) => trim((string) $skill))
                ->filter()
                ->unique()
                ->take(6)
                ->values()
                ->all();
        }

        if ((bool) ($data['candidate_no_age_limit'] ?? false)) {
            $data['candidate_age_min'] = null;
            $data['candidate_age_max'] = null;
        }

        return $data;
    }
}
