<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use RuntimeException;
use Throwable;

class PasswordResetNotificationService
{
    /**
     * Wire shared logging dependencies for reset delivery tracing.
     */
    public function __construct(
        private AuditLogService $auditLogService,
    )
    {
    }

    /**
     * Send one password reset notification through the configured transport.
     */
    public function send(User $user, string $token): void
    {
        $notification = new ResetPasswordNotification($token);

        try {
            if ($this->shouldUseBrevoApi()) {
                $this->sendViaBrevoApi($notification, $user);
                $this->recordDeliverySucceeded($user, 'brevo_api');
                return;
            }

            $user->notify($notification);
            $this->recordDeliverySucceeded($user, 'mail');
        } catch (Throwable $exception) {
            if (!$this->shouldFallbackToLog()) {
                throw $exception;
            }

            $this->logResetUrlFallback($notification, $user, $exception);
        }
    }

    /**
     * Check whether the app should send resets through Brevo's HTTP API.
     */
    private function shouldUseBrevoApi(): bool
    {
        return config('mail.password_reset_transport') === 'brevo_api'
            && filled(config('mail.brevo.api_key'));
    }

    /**
     * Check whether a failed delivery should degrade to a logged reset URL.
     */
    private function shouldFallbackToLog(): bool
    {
        return (bool) config('mail.password_reset_log_fallback');
    }

    /**
     * Send the reset email using Brevo's transactional email endpoint.
     */
    private function sendViaBrevoApi(ResetPasswordNotification $notification, User $user): void
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('PHP curl extension is not available for Brevo API delivery.');
        }

        $ch = curl_init((string) config('mail.brevo.endpoint'));

        if ($ch === false) {
            throw new RuntimeException('Unable to initialize curl for Brevo API delivery.');
        }

        $payload = json_encode($notification->toBrevoPayload($user), JSON_THROW_ON_ERROR);

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Content-Type: application/json',
                'api-key: ' . (string) config('mail.brevo.api_key'),
            ],
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_TIMEOUT => (int) config('mail.brevo.timeout', 15),
        ]);

        $responseBody = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($responseBody === false) {
            throw new RuntimeException('Brevo API request failed: ' . $curlError);
        }

        if ($statusCode < 200 || $statusCode >= 300) {
            throw new RuntimeException(sprintf(
                'Brevo API rejected the request with status %d: %s',
                $statusCode,
                $responseBody
            ));
        }
    }

    /**
     * Log a reset URL fallback so staging remains usable when delivery fails.
     */
    private function logResetUrlFallback(
        ResetPasswordNotification $notification,
        User $user,
        Throwable $exception
    ): void
    {
        $this->auditLogService->record('auth.password_reset_delivery_fallback', [
            'target_user_id' => $user->id,
            'target_role' => $user->role,
            'transport' => config('mail.password_reset_transport'),
            'mail_mailer' => config('mail.default'),
            'exception_class' => $exception::class,
            'exception_message' => $exception->getMessage(),
            'fallback_used' => true,
            'reset_url_present' => filled($notification->resetUrl($user)),
        ], $user, self::class);
    }

    /**
     * Record that one reset password delivery was accepted by the active transport.
     */
    private function recordDeliverySucceeded(User $user, string $deliveryMethod): void
    {
        $this->auditLogService->record('auth.password_reset_delivery_succeeded', [
            'target_user_id' => $user->id,
            'target_role' => $user->role,
            'transport' => config('mail.password_reset_transport'),
            'mail_mailer' => config('mail.default'),
            'delivery_method' => $deliveryMethod,
            'fallback_used' => false,
        ], $user, self::class);
    }
}
