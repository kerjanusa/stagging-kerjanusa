<?php

namespace App\Services;

use App\Models\Job;
use App\Models\User;

class JobAuthorizationService
{
    public function canManage(User $user, Job $job): bool
    {
        return $user->hasRole(User::ROLE_SUPERADMIN)
            || ($user->hasRole(User::ROLE_RECRUITER) && $job->recruiter_id === $user->id);
    }
}
