<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Job;
use App\Models\User;

class ApplicationAuthorizationService
{
    public function canManageJobApplications(User $user, ?Job $job): bool
    {
        if (!$job) {
            return false;
        }

        return $user->hasRole(User::ROLE_SUPERADMIN)
            || ($user->hasRole(User::ROLE_RECRUITER) && $job->recruiter_id === $user->id);
    }

    public function canView(User $user, Application $application): bool
    {
        if ($user->hasRole(User::ROLE_SUPERADMIN)) {
            return true;
        }

        if ($user->hasRole(User::ROLE_CANDIDATE)) {
            return $application->candidate_id === $user->id;
        }

        return $user->hasRole(User::ROLE_RECRUITER)
            && $application->job?->recruiter_id === $user->id;
    }
}
