<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Job;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class ApplicationService
{
    /**
     * Wire helpers for application presentation and service-level logging.
     */
    public function __construct(
        private CandidateDocumentAccessService $candidateDocumentAccessService,
        private ServiceActivityLogService $serviceActivityLogService,
    )
    {
    }

    /**
     * Convert a recruiter-facing stage into the portable backend status.
     */
    public function mapStageToStatus(string $stage): string
    {
        return match ($stage) {
            Application::STAGE_REJECTED => Application::STATUS_REJECTED,
            Application::STAGE_WITHDRAWN => Application::STATUS_WITHDRAWN,
            Application::STAGE_SHORTLISTED,
            Application::STAGE_INTERVIEW,
            Application::STAGE_OFFERING,
            Application::STAGE_HIRED => Application::STATUS_ACCEPTED,
            Application::STAGE_APPLIED,
            Application::STAGE_SCREENING => Application::STATUS_PENDING,
            default => Application::STATUS_PENDING,
        };
    }

    /**
     * Convert a legacy backend status into the richer stage used by the UI.
     */
    public function mapStatusToStage(string $status): string
    {
        return match ($status) {
            Application::STATUS_ACCEPTED => Application::STAGE_SHORTLISTED,
            Application::STATUS_REJECTED => Application::STAGE_REJECTED,
            Application::STATUS_WITHDRAWN => Application::STAGE_WITHDRAWN,
            default => Application::STAGE_APPLIED,
        };
    }

    /**
     * Apply for a job
     */
    public function applyForJob(int $jobId, int $candidateId, array $data): Application|false
    {
        $job = Job::find($jobId);
        if (!$job || $job->status !== Job::STATUS_ACTIVE) {
            $this->serviceActivityLogService->warning($this, 'application_service.apply_rejected', [
                'action' => 'apply_for_job',
                'job_id' => $jobId,
                'candidate_id' => $candidateId,
                'job_found' => (bool) $job,
                'job_status' => $job?->status,
                'result' => 'job_unavailable',
            ]);

            return false;
        }

        $existingApplication = Application::where('job_id', $jobId)
            ->where('candidate_id', $candidateId)
            ->exists();

        if ($existingApplication) {
            $this->serviceActivityLogService->warning($this, 'application_service.apply_rejected', [
                'action' => 'apply_for_job',
                'job_id' => $jobId,
                'candidate_id' => $candidateId,
                'result' => 'already_applied',
            ]);

            return false;
        }

        $screeningAnswers = $this->sanitizeScreeningAnswers($data['screening_answers'] ?? []);
        $this->validateScreeningSubmission($job, $screeningAnswers, $data['video_intro_url'] ?? null);

        $application = Application::create([
            'job_id' => $jobId,
            'candidate_id' => $candidateId,
            'cover_letter' => $data['cover_letter'] ?? null,
            'screening_answers' => $screeningAnswers,
            'video_intro_url' => $data['video_intro_url'] ?? null,
            'status' => Application::STATUS_PENDING,
            'stage' => Application::STAGE_APPLIED,
            'applied_at' => now(),
        ]);

        $this->serviceActivityLogService->info($this, 'application_service.application_created', [
            'action' => 'apply_for_job',
            'application_id' => $application->id,
            'job_id' => $jobId,
            'candidate_id' => $candidateId,
            'screening_answer_count' => count($screeningAnswers),
            'has_video_intro_url' => filled($data['video_intro_url'] ?? null),
            'result' => 'success',
        ]);

        return $application;
    }

    /**
     * Get candidate's applications
     */
    public function getCandidateApplications(
        int $candidateId,
        int $perPage = 15,
        ?User $viewer = null
    ): LengthAwarePaginator
    {
        $applications = Application::with(['job.recruiter'])
            ->where('candidate_id', $candidateId)
            ->orderByDesc('applied_at')
            ->orderByDesc('created_at')
            ->paginate($perPage);

        $this->serviceActivityLogService->debug($this, 'application_service.candidate_applications_loaded', [
            'action' => 'get_candidate_applications',
            'candidate_id' => $candidateId,
            'per_page' => $perPage,
            'total' => $applications->total(),
            'page' => $applications->currentPage(),
            'result' => 'success',
        ], $viewer);

        return $this->transformApplicationPaginator($applications, $viewer);
    }

    /**
     * Get job applications
     */
    public function getJobApplications(
        int $jobId,
        int $perPage = 15,
        ?User $viewer = null
    ): LengthAwarePaginator
    {
        $applications = Application::with(['candidate', 'job.recruiter'])
            ->where('job_id', $jobId)
            ->latest()
            ->paginate($perPage);

        $this->serviceActivityLogService->debug($this, 'application_service.job_applications_loaded', [
            'action' => 'get_job_applications',
            'job_id' => $jobId,
            'per_page' => $perPage,
            'total' => $applications->total(),
            'page' => $applications->currentPage(),
            'result' => 'success',
        ], $viewer);

        return $this->transformApplicationPaginator($applications, $viewer);
    }

    /**
     * Update application status
     */
    public function updateApplicationStatus(int $applicationId, string $status): bool
    {
        $application = Application::find($applicationId);

        if (!$application) {
            $this->serviceActivityLogService->warning($this, 'application_service.status_update_rejected', [
                'action' => 'update_application_status',
                'application_id' => $applicationId,
                'target_status' => $status,
                'result' => 'application_not_found',
            ]);

            return false;
        }

        $updated = $application->update([
            'status' => $status,
            'stage' => $this->mapStatusToStage($status),
        ]);

        $this->serviceActivityLogService->log(
            $this,
            $updated ? 'info' : 'warning',
            $updated
                ? 'application_service.status_updated'
                : 'application_service.status_update_failed',
            [
                'action' => 'update_application_status',
                'application_id' => $application->id,
                'previous_status' => $application->getOriginal('status'),
                'target_status' => $status,
                'target_stage' => $this->mapStatusToStage($status),
                'result' => $updated ? 'success' : 'failed',
            ]
        );

        return $updated;
    }

    /**
     * Persist the recruiter-facing stage and keep the legacy status in sync.
     */
    public function updateApplicationStage(int $applicationId, string $stage): bool
    {
        $application = Application::find($applicationId);

        if (!$application) {
            $this->serviceActivityLogService->warning($this, 'application_service.stage_update_rejected', [
                'action' => 'update_application_stage',
                'application_id' => $applicationId,
                'target_stage' => $stage,
                'result' => 'application_not_found',
            ]);

            return false;
        }

        $updated = $application->update([
            'stage' => $stage,
            'status' => $this->mapStageToStatus($stage),
        ]);

        $this->serviceActivityLogService->log(
            $this,
            $updated ? 'info' : 'warning',
            $updated
                ? 'application_service.stage_updated'
                : 'application_service.stage_update_failed',
            [
                'action' => 'update_application_stage',
                'application_id' => $application->id,
                'previous_stage' => $application->getOriginal('stage'),
                'target_stage' => $stage,
                'target_status' => $this->mapStageToStatus($stage),
                'result' => $updated ? 'success' : 'failed',
            ]
        );

        return $updated;
    }

    /**
     * Allow the owning candidate to withdraw an active application.
     */
    public function withdrawCandidateApplication(int $applicationId, int $candidateId): bool
    {
        $application = Application::where('id', $applicationId)
            ->where('candidate_id', $candidateId)
            ->first();

        if (!$application) {
            $this->serviceActivityLogService->warning($this, 'application_service.withdraw_rejected', [
                'action' => 'withdraw_candidate_application',
                'application_id' => $applicationId,
                'candidate_id' => $candidateId,
                'result' => 'application_not_found',
            ]);

            return false;
        }

        if (in_array($application->stage, [
            Application::STAGE_HIRED,
            Application::STAGE_REJECTED,
            Application::STAGE_WITHDRAWN,
        ], true)) {
            $this->serviceActivityLogService->warning($this, 'application_service.withdraw_rejected', [
                'action' => 'withdraw_candidate_application',
                'application_id' => $application->id,
                'candidate_id' => $candidateId,
                'current_stage' => $application->stage,
                'result' => 'stage_not_withdrawable',
            ]);

            return false;
        }

        $updated = $application->update([
            'stage' => Application::STAGE_WITHDRAWN,
            'status' => Application::STATUS_WITHDRAWN,
        ]);

        $this->serviceActivityLogService->log(
            $this,
            $updated ? 'info' : 'warning',
            $updated
                ? 'application_service.withdrawn'
                : 'application_service.withdraw_failed',
            [
                'action' => 'withdraw_candidate_application',
                'application_id' => $application->id,
                'candidate_id' => $candidateId,
                'result' => $updated ? 'success' : 'failed',
            ]
        );

        return $updated;
    }

    /**
     * Get application by ID
     */
    public function getApplicationById(int $applicationId): ?Application
    {
        $application = Application::with(['job.recruiter', 'candidate'])->find($applicationId);

        $this->serviceActivityLogService->debug($this, 'application_service.application_loaded', [
            'action' => 'get_application_by_id',
            'application_id' => $applicationId,
            'result' => $application ? 'found' : 'not_found',
        ]);

        return $application;
    }

    /**
     * Convert one application model into the API payload expected by the frontend.
     */
    public function presentApplication(Application $application, ?User $viewer = null): array
    {
        $job = $application->job;
        $candidate = $application->candidate;
        $screeningAnswers = collect($application->screening_answers ?? [])
            ->map(function ($answer) {
                return [
                    'question_id' => $answer['question_id'] ?? null,
                    'question' => trim((string) ($answer['question'] ?? '')),
                    'answer' => trim((string) ($answer['answer'] ?? '')),
                ];
            })
            ->filter(fn ($answer) => filled($answer['question']) && filled($answer['answer']))
            ->values()
            ->all();

        $screeningSummary = $this->buildScreeningSummary($job, $screeningAnswers);

        return [
            'id' => $application->id,
            'job_id' => $application->job_id,
            'candidate_id' => $application->candidate_id,
            'status' => $application->status,
            'stage' => $application->stage,
            'cover_letter' => $application->cover_letter,
            'screening_answers' => $screeningAnswers,
            'screening_summary' => $screeningSummary,
            'video_intro_url' => $application->video_intro_url,
            'applied_at' => optional($application->applied_at)->toIso8601String(),
            'created_at' => optional($application->created_at)->toIso8601String(),
            'job' => $job ? [
                'id' => $job->id,
                'title' => $job->title,
                'category' => $job->category,
                'location' => $job->location,
                'experience_level' => $job->experience_level,
                'video_screening_requirement' => $job->video_screening_requirement,
                'quiz_screening_questions' => $job->quiz_screening_questions ?? [],
                'recruiter' => $job->recruiter ? [
                    'id' => $job->recruiter->id,
                    'name' => $job->recruiter->name,
                    'role' => $job->recruiter->role,
                    'email' => $job->recruiter->email,
                    'company_name' => $job->recruiter->company_name,
                ] : null,
            ] : null,
            'candidate' => $candidate
                ? $this->candidateDocumentAccessService->presentCandidateForViewer($candidate, $viewer)
                : null,
        ];
    }

    /**
     * Replace paginator items with fully presented application payloads.
     */
    private function transformApplicationPaginator(
        LengthAwarePaginator $applications,
        ?User $viewer = null
    ): LengthAwarePaginator
    {
        $applications->setCollection(
            $applications->getCollection()->map(
                fn (Application $application) => $this->presentApplication($application, $viewer)
            )
        );

        return $applications;
    }

    /**
     * Enforce required screening answers and video requirements before submission.
     */
    private function validateScreeningSubmission(
        Job $job,
        array $screeningAnswers,
        ?string $videoIntroUrl
    ): void
    {
        $questions = collect($job->quiz_screening_questions ?? []);
        $requiredQuestions = $questions->filter(
            fn ($question) => (bool) ($question['required'] ?? true)
        );
        $answersByQuestionId = collect($screeningAnswers)->keyBy(
            fn ($answer) => (string) ($answer['question_id'] ?? '')
        );

        $missingQuestions = $requiredQuestions
            ->filter(function ($question) use ($answersByQuestionId) {
                $questionId = (string) ($question['id'] ?? '');
                $submittedAnswer = $answersByQuestionId->get($questionId);

                return !filled($submittedAnswer['answer'] ?? null);
            })
            ->map(fn ($question) => $question['title'] ?? $question['question'] ?? 'Pertanyaan screening')
            ->values()
            ->all();

        if (!empty($missingQuestions)) {
            throw ValidationException::withMessages([
                'screening_answers' => [
                    'Jawaban screening wajib diisi untuk: ' . implode(', ', $missingQuestions) . '.',
                ],
            ]);
        }

        if ($job->video_screening_requirement === Job::VIDEO_SCREENING_REQUIRED && !filled($videoIntroUrl)) {
            throw ValidationException::withMessages([
                'video_intro_url' => [
                    'Link video screening wajib diisi untuk lowongan ini.',
                ],
            ]);
        }
    }

    /**
     * Normalize screening answers so only usable question/answer pairs are stored.
     */
    private function sanitizeScreeningAnswers(array $answers): array
    {
        return collect($answers)
            ->filter(fn ($answer) => is_array($answer) && filled($answer['question'] ?? null))
            ->map(function (array $answer) {
                return [
                    'question_id' => filled($answer['question_id'] ?? null)
                        ? (string) $answer['question_id']
                        : null,
                    'question' => trim((string) ($answer['question'] ?? '')),
                    'answer' => trim((string) ($answer['answer'] ?? '')),
                ];
            })
            ->filter(fn ($answer) => filled($answer['question']) && filled($answer['answer']))
            ->values()
            ->all();
    }

    /**
     * Build a lightweight screening completion summary for recruiter-facing views.
     */
    private function buildScreeningSummary(?Job $job, array $screeningAnswers): array
    {
        $questions = collect($job?->quiz_screening_questions ?? []);
        $totalQuestions = $questions->count();
        $answeredQuestions = count($screeningAnswers);
        $positiveAnswers = collect($screeningAnswers)
            ->filter(fn ($answer) => strtolower(trim((string) ($answer['answer'] ?? ''))) === 'ya')
            ->count();
        $completionRate = $totalQuestions > 0
            ? (int) round(($answeredQuestions / $totalQuestions) * 100)
            : 0;

        return [
            'total_questions' => $totalQuestions,
            'answered_questions' => $answeredQuestions,
            'positive_answers' => $positiveAnswers,
            'completion_rate' => $completionRate,
        ];
    }
}
