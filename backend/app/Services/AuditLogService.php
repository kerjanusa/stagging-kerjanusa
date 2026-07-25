<?php

namespace App\Services;

use App\Models\User;
use App\Support\RequestLogContext;
use Illuminate\Support\Facades\Log;
use Throwable;

class AuditLogService
{
    /**
     * Wire shared dependencies for centralized audit logging.
     */
    public function __construct(
        private RequestLogContext $requestLogContext,
        private ServiceLogManager $serviceLogManager,
    )
    {
    }

    /**
     * Record an auditable action to the audit channel and the source service log.
     */
    public function record(
        string $eventName,
        array $context = [],
        ?User $actor = null,
        object|string|null $sourceService = null
    ): void
    {
        try {
            $payload = $this->requestLogContext->build(
                ['event_name' => $eventName, ...$context],
                $actor
            );

            Log::channel('audit')->info(
                $eventName,
                $payload
            );

            $this->serviceLogManager
                ->for($sourceService ?? self::class)
                ->info($eventName, $payload);
        } catch (Throwable $exception) {
            error_log(sprintf(
                'audit_log_failed event=%s exception=%s message=%s',
                $eventName,
                $exception::class,
                $exception->getMessage()
            ));
        }
    }
}
