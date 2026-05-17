<?php

namespace App\Requests\Recruiter;

use App\Requests\ApiFormRequest;
use App\Services\RecruiterPlanService;
use Illuminate\Validation\Rule;

class UpdateRecruiterPackageRequest extends ApiFormRequest
{
    /**
     * Define the allowed recruiter package codes accepted by the workspace endpoint.
     */
    public function rules(): array
    {
        $planCodes = collect(app(RecruiterPlanService::class)->getPlanCatalog())
            ->pluck('code')
            ->all();

        return [
            'plan_code' => ['required', Rule::in($planCodes)],
        ];
    }
}
