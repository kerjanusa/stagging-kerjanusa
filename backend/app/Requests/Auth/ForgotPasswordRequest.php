<?php

namespace App\Requests\Auth;

use App\Models\User;
use App\Requests\ApiFormRequest;

class ForgotPasswordRequest extends ApiFormRequest
{
    /**
     * Normalize the email field before validation so downstream auth flow sees a stable format.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => User::normalizeEmail($this->input('email')),
        ]);
    }

    /**
     * Define the minimum payload required to request a password reset link.
     */
    public function rules(): array
    {
        return [
            'email' => 'required|email',
        ];
    }

    /**
     * Return human-readable validation messages for the forgot-password form.
     */
    public function messages(): array
    {
        return [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
        ];
    }
}
