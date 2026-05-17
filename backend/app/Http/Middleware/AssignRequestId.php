<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AssignRequestId
{
    /**
     * Attach a stable request identifier for logs and client correlation.
     */
    public function handle(Request $request, Closure $next): mixed
    {
        $incomingRequestId = trim((string) $request->headers->get('X-Request-Id', ''));
        $requestId = $incomingRequestId !== '' ? $incomingRequestId : (string) Str::uuid();

        $request->attributes->set('request_id', $requestId);

        Log::withContext([
            'request_id' => $requestId,
            'method' => $request->method(),
            'path' => $request->path(),
            'ip' => $request->ip(),
        ]);

        $response = $next($request);
        $response->headers->set('X-Request-Id', $requestId);

        return $response;
    }
}
