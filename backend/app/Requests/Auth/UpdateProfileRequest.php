<?php

namespace App\Requests\Auth;

use App\Models\User;
use App\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends ApiFormRequest
{
    /**
     * Normalize mutable profile fields before applying uniqueness and shape rules.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'phone' => User::normalizePhone($this->input('phone')),
        ]);
    }

    /**
     * Define the optional fields a logged-in user may change on their profile.
     */
    public function rules(): array
    {
        return [
            'name' => 'nullable|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'phone' => ['nullable', 'string', 'max:32', Rule::unique('users', 'phone')->ignore($this->user()?->id)],
            'profile_picture' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
            'candidate_profile' => 'nullable|array',
            'recruiter_profile' => 'nullable|array',
        ];
    }

    /**
     * Return user-facing validation messages for profile update failures.
     */
    public function messages(): array
    {
        return [
            'phone.unique' => 'Nomor telepon sudah digunakan. Gunakan nomor telepon lain.',
        ];
    }
}
