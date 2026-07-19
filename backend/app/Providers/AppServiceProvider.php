<?php

namespace App\Providers;

use App\Models\User;
use App\Policies\CandidateDocumentPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define(
            'download-candidate-resume',
            fn (User $viewer, User $candidate, int $resumeIndex): bool => app(CandidateDocumentPolicy::class)
                ->downloadResume($viewer, $candidate, $resumeIndex)
        );
    }
}
