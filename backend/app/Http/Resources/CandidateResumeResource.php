<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CandidateResumeResource extends JsonResource
{
    public function __construct(
        mixed $resource,
        private int $candidateId,
        private int $resumeIndex
    ) {
        parent::__construct($resource);
    }

    /**
     * Transform one stored resume metadata payload into the existing API shape.
     */
    public function toArray(Request $request): array
    {
        return [
            'name' => trim((string) ($this->resource['name'] ?? 'cv-kandidat.pdf')),
            'mimeType' => trim((string) ($this->resource['mimeType'] ?? 'application/pdf')),
            'size' => max(0, (int) ($this->resource['size'] ?? 0)),
            'uploadedAt' => $this->resource['uploadedAt'] ?? null,
            'downloadUrl' => "/candidate-documents/{$this->candidateId}/resumes/{$this->resumeIndex}",
        ];
    }

    /**
     * Build a plain array collection without changing current JSON wrapping.
     */
    public static function collectionForCandidate(mixed $resumeFileDetails, int $candidateId): array
    {
        if (!is_array($resumeFileDetails)) {
            return [];
        }

        return collect($resumeFileDetails)
            ->filter(fn ($detail) => is_array($detail) && filled($detail['path'] ?? null))
            ->values()
            ->map(fn (array $detail, int $index) => (new self($detail, $candidateId, $index))->resolve())
            ->all();
    }
}
