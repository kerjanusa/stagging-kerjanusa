<?php

namespace App\Requests\Application;

use App\Requests\ApiFormRequest;

class StoreApplicationRequest extends ApiFormRequest
{
    /**
     * Define the payload required when a candidate submits a new application.
     */
    public function rules(): array
    {
        return [
            'job_id' => 'required|integer|exists:jobs,id',
            'cover_letter' => 'nullable|string',
            'screening_answers' => 'nullable|array',
            'screening_answers.*.question_id' => 'nullable|string|max:100',
            'screening_answers.*.question' => 'required_with:screening_answers|string|max:500',
            'screening_answers.*.answer' => 'required_with:screening_answers|string|max:1000',
            'video_intro_url' => 'nullable|url|max:2048',
        ];
    }
}
