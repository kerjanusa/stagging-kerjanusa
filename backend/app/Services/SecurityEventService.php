<?php

namespace App\Services;

use App\Models\User;
use App\Support\RequestLogContext;
use Illuminate\Support\Facades\Log;

class SecurityEventService
{
    /**
     * Wire shared dependencies for centralized security-event logging.
     */
    public function __construct(
        private RequestLogContext $requestLogContext,
        private ServiceLogManager $serviceLogManager,
    )
    {
    }

    /**
     * Record a security-relevant event to the shared security channel and service log.
     */
    public function record(
        string $eventName,
        array $context = [],
        ?User $actor = null,
        string $level = 'warning',
        object|string|null $sourceService = null
    ): void
    {
        $payload = $this->requestLogContext->build(
            ['event_name' => $eventName, ...$context],
            $actor
        );

        Log::channel('security')->log(
            $level,
            $eventName,
            $payload
        );

        $this->serviceLogManager
            ->for($sourceService ?? self::class)
            ->log($level, $eventName, $payload);
    }
}
