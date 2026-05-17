<?php

namespace App\Requests\Auth;

use App\Requests\ApiFormRequest;
use Illuminate\Validation\Rules\Password as PasswordRule;

class ChangePasswordRequest extends ApiFormRequest
{
    /**
     * Define the payload required to replace the current user's password.
     */
    public function rules(): array
    {
        return [
            'old_password' => 'required|string',
            'new_password' => ['required', PasswordRule::min(8)->letters()->numbers()],
            'new_password_confirmation' => 'required|same:new_password',
        ];
    }
}
