<?php

namespace App\Requests;

use Illuminate\Foundation\Http\FormRequest;

abstract class ApiFormRequest extends FormRequest
{
    /**
     * Allow request authorization to be handled by route middleware and controllers by default.
     */
    public function authorize(): bool
    {
        return true;
    }
}
