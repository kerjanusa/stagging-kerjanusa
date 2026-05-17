<?php

namespace App\Requests\Auth;

use App\Models\User;
use App\Requests\ApiFormRequest;
use Illuminate\Validation\Rules\Password as PasswordRule;

class ResetPasswordRequest extends ApiFormRequest
{
    /**
     * Normalize the reset email before password-broker validation runs.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => User::normalizeEmail($this->input('email')),
        ]);
    }

    /**
     * Define the payload required to complete a password reset.
     */
    public function rules(): array
    {
        return [
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => ['required', PasswordRule::min(8)->letters()->numbers()],
            'password_confirmation' => 'required|same:password',
        ];
    }

    /**
     * Return user-facing validation messages for reset-password payload errors.
     */
    public function messages(): array
    {
        return [
            'token.required' => 'Token reset password wajib ada.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Password baru wajib diisi.',
            'password_confirmation.required' => 'Konfirmasi password wajib diisi.',
            'password_confirmation.same' => 'Konfirmasi password harus sama dengan password baru.',
        ];
    }
}
