<?php

namespace App\Notifications;

use Carbon\CarbonImmutable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    /**
     * Menyimpan token reset password yang akan dibawa ke link frontend.
     */
    public function __construct(
        private readonly string $token,
        private readonly CarbonImmutable $requestedAt = new CarbonImmutable(),
    )
    {
    }

    /**
     * Menentukan channel notifikasi reset password yang dipakai aplikasi.
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Build the frontend reset URL used by mail, API, and fallback delivery.
     */
    public function resetUrl(object $notifiable): string
    {
        $frontendUrl = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        return sprintf(
            '%s/reset-password?token=%s&email=%s&role=%s&requested_at=%s',
            $frontendUrl,
            urlencode($this->token),
            urlencode((string) $notifiable->email),
            urlencode((string) $notifiable->role),
            urlencode($this->requestTimestamp())
        );
    }

    /**
     * Return the standard reset-password subject line.
     */
    public function subjectLine(): string
    {
        return 'Reset Password KerjaNusa - ' . $this->requestLabel();
    }

    /**
     * Return the configured reset-token expiry duration.
     */
    public function expireMinutes(): int
    {
        return (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire');
    }

    /**
     * Return a stable machine-readable timestamp for the reset request.
     */
    public function requestTimestamp(): string
    {
        return $this->requestedAt
            ->setTimezone(config('app.timezone', 'Asia/Jakarta'))
            ->toIso8601String();
    }

    /**
     * Return a human-readable request timestamp for email subject and body copy.
     */
    public function requestLabel(): string
    {
        return $this->requestedAt
            ->setTimezone(config('app.timezone', 'Asia/Jakarta'))
            ->format('d/m/Y H:i') . ' WIB';
    }

    /**
     * Build a plain-text body that can be reused by API-based delivery.
     */
    public function textContent(object $notifiable): string
    {
        $resetUrl = $this->resetUrl($notifiable);
        $expireMinutes = $this->expireMinutes();
        $requestLabel = $this->requestLabel();

        return implode("\n\n", [
            'Halo ' . $notifiable->name . ',',
            'Kami menerima permintaan untuk mengatur ulang password akun KerjaNusa Anda.',
            "Email ini dibuat pada {$requestLabel}.",
            'Buka link berikut untuk reset password Anda:',
            $resetUrl,
            "Link ini berlaku selama {$expireMinutes} menit dan hanya dapat digunakan satu kali.",
            'Jika Anda meminta reset lebih dari sekali, gunakan email dengan waktu permintaan paling baru.',
            'Jika Anda tidak meminta reset password, abaikan email ini dan password Anda akan tetap aman.',
        ]);
    }

    /**
     * Build a minimal HTML body for API-based delivery paths.
     */
    public function htmlContent(object $notifiable): string
    {
        $resetUrl = e($this->resetUrl($notifiable));
        $expireMinutes = $this->expireMinutes();
        $name = e((string) $notifiable->name);
        $requestLabel = e($this->requestLabel());

        return <<<HTML
<html>
  <body>
    <p>Halo {$name},</p>
    <p>Kami menerima permintaan untuk mengatur ulang password akun KerjaNusa Anda.</p>
    <p>Email ini dibuat pada <strong>{$requestLabel}</strong>.</p>
    <p><a href="{$resetUrl}">Reset password</a></p>
    <p>Link ini berlaku selama {$expireMinutes} menit dan hanya dapat digunakan satu kali.</p>
    <p>Jika Anda meminta reset lebih dari sekali, gunakan email dengan waktu permintaan paling baru.</p>
    <p>Jika Anda tidak meminta reset password, abaikan email ini dan password Anda akan tetap aman.</p>
  </body>
</html>
HTML;
    }

    /**
     * Build a Brevo transactional-email payload when HTTP delivery is enabled.
     */
    public function toBrevoPayload(object $notifiable): array
    {
        return [
            'sender' => [
                'name' => (string) config('mail.from.name', config('app.name')),
                'email' => (string) config('mail.from.address'),
            ],
            'to' => [[
                'email' => (string) $notifiable->email,
                'name' => (string) $notifiable->name,
            ]],
            'subject' => $this->subjectLine(),
            'htmlContent' => $this->htmlContent($notifiable),
            'textContent' => $this->textContent($notifiable),
        ];
    }

    /**
     * Menyusun email reset password lengkap dengan link frontend dan masa berlaku token.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $resetUrl = $this->resetUrl($notifiable);
        $expireMinutes = $this->expireMinutes();

        return (new MailMessage)
            ->subject($this->subjectLine())
            ->greeting('Halo '.$notifiable->name.',')
            ->line('Kami menerima permintaan untuk mengatur ulang password akun KerjaNusa Anda.')
            ->line('Email ini dibuat pada '.$this->requestLabel().'.')
            ->action('Reset password', $resetUrl)
            ->line("Link ini berlaku selama {$expireMinutes} menit dan hanya dapat digunakan satu kali.")
            ->line('Jika Anda meminta reset lebih dari sekali, gunakan email dengan waktu permintaan paling baru.')
            ->line('Jika Anda tidak meminta reset password, abaikan email ini dan password Anda akan tetap aman.');
    }
}
