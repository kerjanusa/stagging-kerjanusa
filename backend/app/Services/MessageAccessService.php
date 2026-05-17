<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Job;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class MessageAccessService
{
    public function assertCanCommunicate(User $sender, User $recipient): void
    {
        if ($sender->id === $recipient->id) {
            throw ValidationException::withMessages([
                'recipient_id' => ['Tidak bisa mengirim pesan ke akun sendiri.'],
            ]);
        }

        if (!$this->canCommunicate($sender, $recipient)) {
            throw ValidationException::withMessages([
                'recipient_id' => ['Anda belum memiliki akses percakapan dengan pengguna ini.'],
            ]);
        }
    }

    public function canReferenceJob(User $sender, User $recipient, Job $job): bool
    {
        if ($sender->hasRole(User::ROLE_SUPERADMIN) || $recipient->hasRole(User::ROLE_SUPERADMIN)) {
            return true;
        }

        if ($sender->hasRole(User::ROLE_RECRUITER)) {
            return $job->recruiter_id === $sender->id
                && Application::query()
                    ->where('job_id', $job->id)
                    ->where('candidate_id', $recipient->id)
                    ->exists();
        }

        if ($sender->hasRole(User::ROLE_CANDIDATE)) {
            return $job->recruiter_id === $recipient->id
                && Application::query()
                    ->where('job_id', $job->id)
                    ->where('candidate_id', $sender->id)
                    ->exists();
        }

        return false;
    }

    public function buildAvailableContactsQuery(User $user): Builder
    {
        $contactQuery = User::query()
            ->where('account_status', User::STATUS_ACTIVE)
            ->where('id', '!=', $user->id);

        if ($user->hasRole(User::ROLE_SUPERADMIN)) {
            return $contactQuery->whereIn('role', [User::ROLE_RECRUITER, User::ROLE_CANDIDATE]);
        }

        if ($user->hasRole(User::ROLE_RECRUITER)) {
            $candidateIds = Application::query()
                ->whereHas('job', fn (Builder $query) => $query->where('recruiter_id', $user->id))
                ->distinct()
                ->pluck('candidate_id')
                ->all();

            return $contactQuery->where(function (Builder $query) use ($candidateIds) {
                $query->where('role', User::ROLE_SUPERADMIN);

                if (!empty($candidateIds)) {
                    $query->orWhereIn('id', $candidateIds);
                }
            });
        }

        $recruiterIds = Job::query()
            ->whereIn('id', Application::query()
                ->where('candidate_id', $user->id)
                ->pluck('job_id')
                ->all()
            )
            ->distinct()
            ->pluck('recruiter_id')
            ->all();

        return $contactQuery->where(function (Builder $query) use ($recruiterIds) {
            $query->where('role', User::ROLE_SUPERADMIN);

            if (!empty($recruiterIds)) {
                $query->orWhereIn('id', $recruiterIds);
            }
        });
    }

    private function canCommunicate(User $sender, User $recipient): bool
    {
        if ($sender->hasRole(User::ROLE_SUPERADMIN) || $recipient->hasRole(User::ROLE_SUPERADMIN)) {
            return true;
        }

        if ($sender->hasRole(User::ROLE_RECRUITER) && $recipient->hasRole(User::ROLE_CANDIDATE)) {
            return Application::query()
                ->where('candidate_id', $recipient->id)
                ->whereHas('job', fn (Builder $query) => $query->where('recruiter_id', $sender->id))
                ->exists();
        }

        if ($sender->hasRole(User::ROLE_CANDIDATE) && $recipient->hasRole(User::ROLE_RECRUITER)) {
            return Application::query()
                ->where('candidate_id', $sender->id)
                ->whereHas('job', fn (Builder $query) => $query->where('recruiter_id', $recipient->id))
                ->exists();
        }

        return false;
    }
}
