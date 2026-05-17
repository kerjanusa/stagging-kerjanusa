<?php

namespace App\Http\Controllers;

use App\Models\Job;
use App\Requests\Job\StoreJobRequest;
use App\Requests\Job\UpdateJobRequest;
use App\Services\JobAuthorizationService;
use App\Services\JobService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobController extends Controller
{
    /**
     * Wire job orchestration and authorization helpers for recruiter and public endpoints.
     */
    public function __construct(
        private JobService $jobService,
        private JobAuthorizationService $jobAuthorizationService,
    )
    {
    }

    /**
     * Mengambil daftar lowongan publik beserta pagination berdasarkan filter dari query string.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->query();
        $perPage = (int)$request->query('per_page', 15);

        $jobs = $this->jobService->getAllJobs($filters, $perPage);

        return response()->json([
            'data' => $jobs->items(),
            'pagination' => [
                'total' => $jobs->total(),
                'per_page' => $jobs->perPage(),
                'current_page' => $jobs->currentPage(),
                'last_page' => $jobs->lastPage(),
            ],
        ]);
    }

    /**
     * Mengambil detail satu lowongan untuk halaman detail atau modal frontend.
     */
    public function show(int $id): JsonResponse
    {
        $job = $this->jobService->getJobById($id);

        if (!$job) {
            return response()->json([
                'message' => 'Job not found',
            ], 404);
        }

        return response()->json([
            'data' => $job,
        ]);
    }

    /**
     * Memvalidasi input recruiter lalu membuat lowongan baru dengan status aktif.
     */
    public function store(StoreJobRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $job = $this->jobService->createJob($request->user()->id, $validated);

        return response()->json([
            'message' => 'Job created successfully',
            'data' => $job,
        ], 201);
    }

    /**
     * Memvalidasi field yang boleh diubah lalu memperbarui lowongan yang dipilih.
     */
    public function update(UpdateJobRequest $request, int $id): JsonResponse
    {
        $validated = $request->validated();

        $job = Job::find($id);

        if (!$job) {
            return response()->json([
                'message' => 'Job not found',
            ], 404);
        }

        if (!$this->jobAuthorizationService->canManage($request->user(), $job)) {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        $success = $this->jobService->updateJob($id, $validated);

        if (!$success) {
            return response()->json([
                'message' => 'Job not found',
            ], 404);
        }

        return response()->json([
            'message' => 'Job updated successfully',
        ]);
    }

    /**
     * Menghapus lowongan dan mengembalikan 404 bila data tidak ditemukan.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $job = Job::find($id);

        if (!$job) {
            return response()->json([
                'message' => 'Job not found',
            ], 404);
        }

        if (!$this->jobAuthorizationService->canManage($request->user(), $job)) {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        $success = $this->jobService->deleteJob($id);

        if (!$success) {
            return response()->json([
                'message' => 'Job not found',
            ], 404);
        }

        return response()->json([
            'message' => 'Job deleted successfully',
        ]);
    }

    /**
     * Mengambil daftar lowongan milik recruiter yang sedang login untuk dashboard mereka.
     */
    public function myJobs(Request $request): JsonResponse
    {
        $perPage = (int)$request->query('per_page', 15);
        $jobs = $this->jobService->getRecruiterJobs($request->user()->id, $perPage);

        return response()->json([
            'data' => $jobs->items(),
            'pagination' => [
                'total' => $jobs->total(),
                'per_page' => $jobs->perPage(),
                'current_page' => $jobs->currentPage(),
                'last_page' => $jobs->lastPage(),
            ],
        ]);
    }

    /**
     * Mengembalikan daftar lokasi unik dari lowongan aktif untuk dropdown filter frontend.
     */
    public function locations(): JsonResponse
    {
        return response()->json([
            'data' => $this->jobService->getAvailableLocations(),
        ]);
    }

    /**
     * Mengembalikan ringkasan statistik lamaran untuk lowongan tertentu.
     */
    public function statistics(Request $request, int $id): JsonResponse
    {
        $job = Job::find($id);

        if (!$job) {
            return response()->json([
                'message' => 'Job not found',
            ], 404);
        }

        if (!$this->jobAuthorizationService->canManage($request->user(), $job)) {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        $stats = $this->jobService->getJobStatistics($id);

        return response()->json([
            'data' => $stats,
        ]);
    }
}
