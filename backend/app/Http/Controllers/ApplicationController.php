<?php

namespace App\Http\Controllers;

use App\Models\Application;
use App\Requests\Application\StoreApplicationRequest;
use App\Requests\Application\UpdateApplicationStatusRequest;
use App\Services\ApplicationAuthorizationService;
use App\Services\ApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationController extends Controller
{
    /**
     * Wire application orchestration and authorization helpers for API actions.
     */
    public function __construct(
        private ApplicationService $applicationService,
        private ApplicationAuthorizationService $applicationAuthorizationService,
    )
    {
    }

    /**
     * Apply for a job
     */
    public function store(StoreApplicationRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $application = $this->applicationService->applyForJob(
            $validated['job_id'],
            $request->user()->id,
            $validated
        );

        if (!$application) {
            return response()->json([
                'message' => 'Failed to apply for job or already applied',
            ], 400);
        }

        return response()->json([
            'message' => 'Application submitted successfully',
            'data' => $application,
        ], 201);
    }

    /**
     * Get candidate's applications
     */
    public function myCandidateApplications(Request $request): JsonResponse
    {
        $perPage = (int)$request->query('per_page', 15);
        $applications = $this->applicationService->getCandidateApplications(
            $request->user()->id,
            $perPage,
            $request->user()
        );

        return response()->json([
            'data' => $applications->items(),
            'pagination' => [
                'total' => $applications->total(),
                'per_page' => $applications->perPage(),
                'current_page' => $applications->currentPage(),
                'last_page' => $applications->lastPage(),
            ],
        ]);
    }

    /**
     * Get applications for a job
     */
    public function jobApplications(Request $request, int $jobId): JsonResponse
    {
        $job = Job::find($jobId);

        if (!$job) {
            return response()->json([
                'message' => 'Job not found',
            ], 404);
        }

        if (!$this->applicationAuthorizationService->canManageJobApplications($request->user(), $job)) {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        $perPage = (int)$request->query('per_page', 15);
        $applications = $this->applicationService->getJobApplications(
            $jobId,
            $perPage,
            $request->user()
        );

        return response()->json([
            'data' => $applications->items(),
            'pagination' => [
                'total' => $applications->total(),
                'per_page' => $applications->perPage(),
                'current_page' => $applications->currentPage(),
                'last_page' => $applications->lastPage(),
            ],
        ]);
    }

    /**
     * Update application status
     */
    public function updateStatus(UpdateApplicationStatusRequest $request, int $applicationId): JsonResponse
    {
        $validated = $request->validated();

        if (!filled($validated['status'] ?? null) && !filled($validated['stage'] ?? null)) {
            return response()->json([
                'message' => 'Status atau stage aplikasi wajib diisi.',
            ], 422);
        }

        $application = Application::with('job')->find($applicationId);

        if (!$application) {
            return response()->json([
                'message' => 'Application not found',
            ], 404);
        }

        if (!$this->applicationAuthorizationService->canManageJobApplications($request->user(), $application->job)) {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        $success = filled($validated['stage'] ?? null)
            ? $this->applicationService->updateApplicationStage($applicationId, $validated['stage'])
            : $this->applicationService->updateApplicationStatus($applicationId, $validated['status']);

        if (!$success) {
            return response()->json([
                'message' => 'Application not found',
            ], 404);
        }

        return response()->json([
            'message' => 'Application status updated successfully',
        ]);
    }

    /**
     * Allow a candidate to withdraw their own active application.
     */
    public function withdraw(Request $request, int $applicationId): JsonResponse
    {
        $success = $this->applicationService->withdrawCandidateApplication(
            $applicationId,
            $request->user()->id
        );

        if (!$success) {
            return response()->json([
                'message' => 'Lamaran tidak dapat dibatalkan.',
            ], 422);
        }

        return response()->json([
            'message' => 'Lamaran berhasil dibatalkan.',
        ]);
    }

    /**
     * Get application detail
     */
    public function show(Request $request, int $applicationId): JsonResponse
    {
        $application = $this->applicationService->getApplicationById($applicationId);

        if (!$application) {
            return response()->json([
                'message' => 'Application not found',
            ], 404);
        }

        if (!$this->applicationAuthorizationService->canView($request->user(), $application)) {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        return response()->json([
            'data' => $this->applicationService->presentApplication($application, $request->user()),
        ]);
    }
}
