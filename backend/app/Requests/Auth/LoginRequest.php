<?php

namespace App\Requests\Auth;

use App\Models\User;
use App\Requests\ApiFormRequest;

class LoginRequest extends ApiFormRequest
{
    /**
     * Normalize the submitted email before validation and authentication checks.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => User::normalizeEmail($this->input('email')),
        ]);
    }

    /**
     * Define the credentials required by the login endpoint.
     */
    public function rules(): array
    {
        return [
            'email' => 'required|email',
            'password' => 'required|string',
        ];
    }

    /**
     * Return human-readable validation messages for failed login payload checks.
     */
    public function messages(): array
    {
        return [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Password wajib diisi.',
        ];
    }
}
