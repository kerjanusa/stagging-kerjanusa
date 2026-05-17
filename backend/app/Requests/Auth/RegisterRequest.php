<?php

namespace App\Requests\Auth;

use App\Models\User;
use App\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;

class RegisterRequest extends ApiFormRequest
{
    /**
     * Normalize email and phone fields before the registration rules are evaluated.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => User::normalizeEmail($this->input('email')),
            'phone' => User::normalizePhone($this->input('phone')),
        ]);
    }

    /**
     * Define the public registration payload accepted by the auth endpoint.
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => ['required', PasswordRule::min(8)->letters()->numbers()],
            'password_confirmation' => 'required|same:password',
            'role' => ['required', Rule::in(User::PUBLIC_REGISTRATION_ROLES)],
            'phone' => ['required', 'string', 'max:32', Rule::unique('users', 'phone')],
        ];
    }

    /**
     * Return user-facing validation messages for registration errors.
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah digunakan. Gunakan email lain.',
            'password.required' => 'Password wajib diisi.',
            'password_confirmation.required' => 'Konfirmasi password wajib diisi.',
            'password_confirmation.same' => 'Konfirmasi password harus sama dengan password.',
            'phone.required' => 'Nomor telepon wajib diisi.',
            'phone.unique' => 'Nomor telepon sudah digunakan. Gunakan nomor telepon lain.',
        ];
    }
}
