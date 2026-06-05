<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to the "home" route for your application.
     *
     * @var string
     */
    public const HOME = '/';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        // Apply a generic API rate limit keyed by user id when authenticated, otherwise by IP.
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // Apply a tighter login limiter keyed by normalized email plus IP for brute-force protection.
        RateLimiter::for('login', function (Request $request) {
            $normalizedEmail = mb_strtolower(trim((string) $request->input('email', '')));

            return Limit::perMinute(5)
                ->by($normalizedEmail . '|' . $request->ip())
                ->response(function (Request $request, array $headers) use ($normalizedEmail) {
                    Log::channel('security')->warning('auth.login_throttled', [
                        'event_name' => 'auth.login_throttled',
                        'action' => 'login',
                        'step' => 'rate_limit',
                        'identifier_hash' => $normalizedEmail !== ''
                            ? hash('sha256', $normalizedEmail)
                            : null,
                        'request_id' => $request->attributes->get('request_id'),
                        'ip' => $request->ip(),
                        'result' => 'throttled',
                    ]);

                    return response()->json([
                        'message' => 'Terlalu banyak percobaan login. Coba lagi sebentar lagi.',
                    ], 429, $headers);
                });
        });

        $this->routes(function () {
            Route::prefix('api')
                ->middleware('api')
                ->group(base_path('routes/api.php'));

            // Some deployment entrypoints arrive at Laravel with PATH_INFO stripped of the
            // public /api prefix (for example /api/login can reach Laravel as /login).
            // Registering a second, unprefixed copy keeps those routes resolvable while the
            // explicit /api-prefixed group continues to serve exact wrapper routes.
            Route::middleware('api')
                ->group(base_path('routes/api.php'));
        });
    }
}
