<?php

namespace App\Policies;

use App\Models\User;
use App\Services\RecruiterPlanService;

class CandidateDocumentPolicy
{
    public function __construct(private RecruiterPlanService $recruiterPlanService)
    {
    }

    /**
     * Decide whether the viewer can download one candidate resume index.
     */
    public function downloadResume(User $viewer, User $candidate, int $resumeIndex): bool
    {
        if (!$candidate->hasRole(User::ROLE_CANDIDATE) || $resumeIndex < 0) {
            return false;
        }

        if ($viewer->hasRole(User::ROLE_CANDIDATE)) {
            return $viewer->id === $candidate->id;
        }

        if ($viewer->hasRole(User::ROLE_SUPERADMIN)) {
            return true;
        }

        if ($viewer->hasRole(User::ROLE_RECRUITER)) {
            $limits = $this->recruiterPlanService->getVisibleDocumentLimits($viewer);

            return $resumeIndex < (int) $limits['resume_files'];
        }

        return false;
    }
}
