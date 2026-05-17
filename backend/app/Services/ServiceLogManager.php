<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Psr\Log\LoggerInterface;

class ServiceLogManager
{
    /**
     * @var array<string, LoggerInterface>
     */
    private array $loggers = [];

    /**
     * Resolve or lazily build a dedicated daily logger for one service class.
     */
    public function for(object|string $service): LoggerInterface
    {
        $serviceClass = is_object($service) ? $service::class : $service;
        $serviceName = class_basename($serviceClass);
        $loggerKey = Str::snake($serviceName);

        if (isset($this->loggers[$loggerKey])) {
            return $this->loggers[$loggerKey];
        }

        $servicesLogPath = storage_path('logs/services');

        if (!is_dir($servicesLogPath)) {
            mkdir($servicesLogPath, 0777, true);
        }

        $this->loggers[$loggerKey] = Log::build([
            'driver' => 'daily',
            'path' => $servicesLogPath . '/' . $loggerKey . '.log',
            'level' => env('LOG_SERVICE_LEVEL', env('LOG_LEVEL', 'debug')),
            'days' => env('LOG_SERVICE_DAYS', 14),
            'replace_placeholders' => true,
        ]);

        return $this->loggers[$loggerKey];
    }
}
