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
        $employeeRanges = [
            '1 - 50 Tenaga Kerja',
            '51 - 255 Tenaga Kerja',
            '256 - 650 Tenaga Kerja',
            '650 - 3.000 Tenaga Kerja',
            'Lebih dari 3000 Tenaga Kerja',
        ];

        return [
            'name' => 'nullable|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'phone' => ['nullable', 'string', 'max:32', Rule::unique('users', 'phone')->ignore($this->user()?->id)],
            'profile_picture' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
            'company_legal_document' => 'nullable|file|mimes:pdf,png,jpg,jpeg|max:2048',
            'candidate_profile' => 'nullable|array',
            'recruiter_profile' => 'nullable|array',
            'recruiter_profile.recruiterName' => 'nullable|string|max:255',
            'recruiter_profile.companyName' => 'nullable|string|max:255',
            'recruiter_profile.legalCompanyName' => 'nullable|string|max:255',
            'recruiter_profile.companyEmail' => 'nullable|email|max:255',
            'recruiter_profile.companyAddress' => 'nullable|string|max:2000',
            'recruiter_profile.companyLocation' => 'nullable|string|max:2000',
            'recruiter_profile.industry' => 'nullable|string|max:255',
            'recruiter_profile.employeeRange' => ['nullable', 'string', Rule::in($employeeRanges)],
            'recruiter_profile.companyDescription' => 'nullable|string|min:80|max:5000',
            'recruiter_profile.companyLogoFileName' => 'nullable|string|max:255',
            'recruiter_profile.companyLogoDataUrl' => 'nullable|string|max:1000000',
            'recruiter_profile.website' => 'nullable|url|max:255',
            'recruiter_profile.companyLegalDocumentName' => 'nullable|string|max:255',
            'recruiter_profile.companyLegalDocumentPath' => 'nullable|string|max:1000',
            'recruiter_profile.companyLegalDocumentMimeType' => 'nullable|string|max:100',
            'recruiter_profile.companyLegalDocumentSize' => 'nullable|integer|min:0|max:2097152',
            'recruiter_profile.companyLegalDocumentUploadedAt' => 'nullable|date',
            'recruiter_profile.verificationStatus' => ['nullable', Rule::in(['draft', 'pending', 'verified'])],
            'recruiter_profile.verificationNotes' => 'nullable|string|max:2000',
            'recruiter_profile.verificationSubmittedAt' => 'nullable|date',
            'recruiter_profile.verifiedAt' => 'nullable|date',
        ];
    }

    /**
     * Return user-facing validation messages for profile update failures.
     */
    public function messages(): array
    {
        return [
            'phone.unique' => 'Nomor telepon sudah digunakan. Gunakan nomor telepon lain.',
            'company_legal_document.mimes' => 'Dokumen legal perusahaan wajib berupa PDF, PNG, JPG, atau JPEG.',
            'company_legal_document.max' => 'Dokumen legal perusahaan maksimal 2 MB.',
            'recruiter_profile.companyEmail.email' => 'Email perusahaan / PIC wajib menggunakan format email yang valid.',
            'recruiter_profile.employeeRange.in' => 'Jumlah tenaga kerja perusahaan belum sesuai pilihan yang tersedia.',
            'recruiter_profile.companyDescription.min' => 'Deskripsi perusahaan minimal 80 karakter.',
            'recruiter_profile.website.url' => 'Link website / sosial media wajib menggunakan URL yang valid.',
        ];
    }
}
