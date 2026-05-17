<?php

namespace App\Services;

use App\Models\User;
use App\Support\RequestLogContext;

class ServiceActivityLogService
{
    /**
     * Wire shared logging dependencies for service-level activity logs.
     */
    public function __construct(
        private RequestLogContext $requestLogContext,
        private ServiceLogManager $serviceLogManager,
    )
    {
    }

    /**
     * Write a low-severity service activity log entry.
     */
    public function debug(
        object|string $service,
        string $eventName,
        array $context = [],
        ?User $actor = null
    ): void
    {
        $this->log($service, 'debug', $eventName, $context, $actor);
    }

    /**
     * Write a normal informational service activity log entry.
     */
    public function info(
        object|string $service,
        string $eventName,
        array $context = [],
        ?User $actor = null
    ): void
    {
        $this->log($service, 'info', $eventName, $context, $actor);
    }

    /**
     * Write a warning-level service activity log entry.
     */
    public function warning(
        object|string $service,
        string $eventName,
        array $context = [],
        ?User $actor = null
    ): void
    {
        $this->log($service, 'warning', $eventName, $context, $actor);
    }

    /**
     * Write an error-level service activity log entry.
     */
    public function error(
        object|string $service,
        string $eventName,
        array $context = [],
        ?User $actor = null
    ): void
    {
        $this->log($service, 'error', $eventName, $context, $actor);
    }

    /**
     * Build sanitized request-aware payloads and send them to the target service log.
     */
    public function log(
        object|string $service,
        string $level,
        string $eventName,
        array $context = [],
        ?User $actor = null
    ): void
    {
        $payload = $this->requestLogContext->build(
            ['event_name' => $eventName, ...$context],
            $actor
        );

        $this->serviceLogManager->for($service)->log($level, $eventName, $payload);
    }
}
