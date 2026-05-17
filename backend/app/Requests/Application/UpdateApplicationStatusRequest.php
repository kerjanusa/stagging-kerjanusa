<?php

namespace App\Requests\Application;

use App\Models\Application;
use App\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

class UpdateApplicationStatusRequest extends ApiFormRequest
{
    /**
     * Define the allowed recruiter-facing status and stage transitions for an application.
     */
    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::in(Application::STATUSES)],
            'stage' => ['nullable', Rule::in(Application::STAGES)],
        ];
    }
}
