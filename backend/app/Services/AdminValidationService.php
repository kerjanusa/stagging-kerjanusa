<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AdminValidationService
{
    public function __construct(private RecruiterPlanService $recruiterPlanService)
    {
    }

    public function validateUpdateUser(Request $request, User $user): array
    {
        return Validator::make(
            $request->all(),
            [
                'name' => 'nullable|string|max:255',
                'email' => ['nullable', 'email', Rule::unique('users', 'email')->ignore($user->id)],
                'phone' => ['nullable', 'string', 'max:32', Rule::unique('users', 'phone')->ignore($user->id)],
                'company_name' => 'nullable|string|max:255',
                'account_status' => ['nullable', Rule::in(User::ACCOUNT_STATUSES)],
                'account_status_reason' => 'nullable|string|max:1000',
                'verification_status' => ['nullable', Rule::in(['pending', 'verified'])],
                'verification_notes' => 'nullable|string|max:1000',
                'plan_code' => ['nullable', Rule::in(collect($this->recruiterPlanService->getPlanCatalog())->pluck('code')->all())],
                'kn_credit' => 'nullable|integer|min:0',
            ]
        )->validate();
    }

    public function validateReassignJob(Request $request): array
    {
        return Validator::make(
            $request->all(),
            [
                'recruiter_id' => [
                    'required',
                    'integer',
                    Rule::exists('users', 'id')->where(function ($query) {
                        $query->where('role', User::ROLE_RECRUITER)
                            ->where('account_status', User::STATUS_ACTIVE);
                    }),
                ],
            ]
        )->validate();
    }
}
