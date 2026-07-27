<?php

namespace App\Requests\Auth;

use App\Requests\ApiFormRequest;

class CandidateResumeAutofillRequest extends ApiFormRequest
{
    /**
     * Validate the uploaded resume used only for candidate profile autofill.
     */
    public function rules(): array
    {
        return [
            'candidate_resume_file' => 'required|file|mimes:pdf|max:2048',
        ];
    }

    /**
     * Return candidate-facing validation messages for resume autofill failures.
     */
    public function messages(): array
    {
        return [
            'candidate_resume_file.required' => 'Pilih file CV terlebih dahulu.',
            'candidate_resume_file.file' => 'CV belum terbaca sebagai file yang valid.',
            'candidate_resume_file.mimes' => 'Autofill CV saat ini hanya mendukung file PDF.',
            'candidate_resume_file.max' => 'Ukuran CV maksimal 2 MB.',
        ];
    }
}
