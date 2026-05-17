<?php

namespace App\Support;

use Illuminate\Support\Str;

class LogContextSanitizer
{
    private const REDACTED_PLACEHOLDER = '[REDACTED]';
    private const PRESENT_PLACEHOLDER = '[PRESENT]';

    /**
     * Sanitize a full log context payload before it is written to any channel.
     */
    public function sanitize(array $context): array
    {
        return $this->sanitizeArray($context);
    }

    /**
     * Walk nested arrays recursively so child keys are sanitized with the same rules.
     */
    private function sanitizeArray(array $context): array
    {
        $sanitized = [];

        foreach ($context as $key => $value) {
            if (is_string($key)) {
                $sanitized[$key] = $this->sanitizeNamedValue($key, $value);
                continue;
            }

            $sanitized[$key] = $this->sanitizeValue($value);
        }

        return $sanitized;
    }

    /**
     * Apply key-based masking, hashing, or summarization rules to one named value.
     */
    private function sanitizeNamedValue(string $key, mixed $value): mixed
    {
        $normalizedKey = Str::snake($key);

        if ($this->shouldRedact($normalizedKey)) {
            return self::REDACTED_PLACEHOLDER;
        }

        if ($this->shouldHash($normalizedKey)) {
            return $this->hashScalar($value);
        }

        if ($this->shouldMaskPhone($normalizedKey)) {
            return $this->maskPhone($value);
        }

        if ($this->shouldSummarizePresence($normalizedKey)) {
            return filled($value) ? self::PRESENT_PLACEHOLDER : null;
        }

        if ($this->shouldSummarizeCollection($normalizedKey)) {
            return $this->summarizeCollection($value);
        }

        if ($this->shouldSummarizeText($normalizedKey)) {
            return $this->summarizeText($value);
        }

        return $this->sanitizeValue($value);
    }

    /**
     * Sanitize anonymous values that do not carry a meaningful field name.
     */
    private function sanitizeValue(mixed $value): mixed
    {
        if (is_array($value)) {
            return $this->sanitizeArray($value);
        }

        return $value;
    }

    /**
     * Flag credentials or secrets that must never appear in plaintext logs.
     */
    private function shouldRedact(string $key): bool
    {
        foreach ([
            'password',
            'password_confirmation',
            'old_password',
            'new_password',
            'token',
            'remember_token',
            'secret',
            'authorization',
            'cookie',
            'api_key',
            'access_token',
            'refresh_token',
        ] as $needle) {
            if ($key === $needle || str_contains($key, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Flag identifiers that are safer to compare by hash than by raw value.
     */
    private function shouldHash(string $key): bool
    {
        return $key === 'email' || str_ends_with($key, '_email');
    }

    /**
     * Flag phone fields so the log keeps only a tiny visible suffix.
     */
    private function shouldMaskPhone(string $key): bool
    {
        return $key === 'phone' || str_ends_with($key, '_phone');
    }

    /**
     * Flag file or URL fields where "exists or not" is enough for debugging.
     */
    private function shouldSummarizePresence(string $key): bool
    {
        return in_array($key, [
            'video_intro_url',
            'profile_picture',
            'stored_path',
        ], true);
    }

    /**
     * Flag large collections that should be reduced to counts in logs.
     */
    private function shouldSummarizeCollection(string $key): bool
    {
        return in_array($key, [
            'screening_answers',
            'resume_files',
            'certificate_files',
        ], true);
    }

    /**
     * Flag free-text fields so logs keep metadata instead of the raw content.
     */
    private function shouldSummarizeText(string $key): bool
    {
        return in_array($key, [
            'cover_letter',
            'profile_summary',
        ], true);
    }

    /**
     * Convert a scalar identifier into a stable hash for troubleshooting.
     */
    private function hashScalar(mixed $value): ?string
    {
        if (!is_scalar($value)) {
            return null;
        }

        $normalizedValue = strtolower(trim((string) $value));

        if ($normalizedValue === '') {
            return null;
        }

        return 'sha256:' . hash('sha256', $normalizedValue);
    }

    /**
     * Keep only the last visible digits of a phone-like value.
     */
    private function maskPhone(mixed $value): ?string
    {
        if (!is_scalar($value)) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', (string) $value) ?? '';

        if ($digits === '') {
            return null;
        }

        $visibleDigits = strlen($digits) <= 2
            ? $digits
            : substr($digits, -2);

        return '***' . $visibleDigits;
    }

    /**
     * Replace a collection payload with a simple count summary.
     */
    private function summarizeCollection(mixed $value): array
    {
        if (is_array($value)) {
            return ['count' => count($value)];
        }

        if (!filled($value)) {
            return ['count' => 0];
        }

        return ['count' => 1];
    }

    /**
     * Replace arbitrary text with presence and length metadata only.
     */
    private function summarizeText(mixed $value): array
    {
        if (!is_scalar($value)) {
            return [
                'present' => false,
                'length' => 0,
            ];
        }

        $normalizedValue = trim((string) $value);

        return [
            'present' => $normalizedValue !== '',
            'length' => mb_strlen($normalizedValue),
        ];
    }
}
