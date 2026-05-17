<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Requests\Recruiter\UpdateRecruiterPackageRequest;
use App\Services\RecruiterPlanService;
use App\Services\TalentSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecruiterWorkspaceController extends Controller
{
    /**
     * Wire recruiter workspace services for plan and talent-search endpoints.
     */
    public function __construct(
        private RecruiterPlanService $recruiterPlanService,
        private TalentSearchService $talentSearchService,
    )
    {
    }

    /**
     * Return the current recruiter package plus the full selectable catalog.
     */
    public function package(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'current' => $this->recruiterPlanService->getRecruiterPlanContext($request->user()),
                'catalog' => $this->recruiterPlanService->getPlanCatalog(),
            ],
        ]);
    }

    /**
     * Persist a recruiter package change and return the refreshed package payload.
     */
    public function updatePackage(UpdateRecruiterPackageRequest $request): JsonResponse
    {
        $validated = $request->validated();

        /** @var User $user */
        $user = $request->user();
        $profile = is_array($user->recruiter_profile) ? $user->recruiter_profile : [];
        $profile['plan_code'] = $validated['plan_code'];
        $user->recruiter_profile = $this->recruiterPlanService->normalizeRecruiterProfile($profile);
        $user->save();

        return response()->json([
            'message' => 'Paket recruiter berhasil diperbarui.',
            'data' => [
                'current' => $this->recruiterPlanService->getRecruiterPlanContext($user->fresh()),
                'catalog' => $this->recruiterPlanService->getPlanCatalog(),
                'user' => $user->fresh(),
            ],
        ]);
    }

    /**
     * Run recruiter talent search with filters and package-aware pagination limits.
     */
    public function talentSearch(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 12);
        $results = $this->talentSearchService->search($request->user(), $request->query(), $perPage);

        return response()->json([
            'data' => $results->items(),
            'pagination' => [
                'total' => $results->total(),
                'per_page' => $results->perPage(),
                'current_page' => $results->currentPage(),
                'last_page' => $results->lastPage(),
            ],
        ]);
    }
}
