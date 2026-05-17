<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;

class RequestLogContext
{
    /**
     * Wire the sanitizer used by all structured logging helpers.
     */
    public function __construct(private LogContextSanitizer $logContextSanitizer)
    {
    }

    /**
     * Build a consistent log context for application, audit, and security events.
     */
    public function build(array $context = [], ?User $actor = null, ?Request $request = null): array
    {
        $request ??= request();
        $actor ??= $request?->user();

        $baseContext = [
            'request_id' => $request?->attributes->get('request_id'),
            'actor_id' => $actor?->id,
            'actor_role' => $actor?->role,
            'ip' => $request?->ip(),
            'method' => $request?->method(),
            'path' => $request?->path(),
            'user_agent' => $request?->userAgent(),
        ];

        return array_filter(
            $this->logContextSanitizer->sanitize([...$baseContext, ...$context]),
            fn ($value) => $value !== null && $value !== ''
        );
    }
}
