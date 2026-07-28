<?php

namespace App\Requests\Job;

use App\Models\Job;
use App\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

class UpdateJobRequest extends ApiFormRequest
{
    /**
     * Define the optional fields that may be updated on an existing job posting.
     */
    public function rules(): array
    {
        return [
            'title' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'category' => 'nullable|string',
            'salary_min' => 'nullable|numeric|min:0',
            'salary_max' => 'nullable|numeric',
            'location' => 'nullable|string',
            'job_type' => ['nullable', Rule::in(Job::JOB_TYPES)],
            'experience_level' => ['nullable', Rule::in(Job::EXPERIENCE_LEVELS)],
            'work_mode' => ['nullable', Rule::in(Job::WORK_MODES)],
            'openings_count' => 'nullable|integer|min:0',
            'interview_type' => ['nullable', Rule::in(Job::INTERVIEW_TYPES)],
            'interview_note' => 'nullable|string',
            'shift_night' => ['nullable', Rule::in(['yes', 'no'])],
            'expiry_date' => 'nullable|date',
            'candidate_gender' => 'nullable|string|max:32',
            'candidate_experience' => 'nullable|string|max:32',
            'candidate_education' => 'nullable|string|max:120',
            'candidate_age_min' => 'nullable|integer|min:17|max:80',
            'candidate_age_max' => 'nullable|integer|min:17|max:80|gte:candidate_age_min',
            'candidate_no_age_limit' => 'nullable|boolean',
            'candidate_photo_requirement' => 'nullable|string|max:32',
            'candidate_domicile' => 'nullable|string|max:120',
            'candidate_skills' => 'nullable|array|max:6',
            'candidate_skills.*' => 'nullable|string|max:120',
            'candidate_custom_skill' => 'nullable|string|max:500',
            'internal_recruiter_link' => 'nullable|url|max:2048',
            'video_screening_requirement' => ['nullable', Rule::in(Job::VIDEO_SCREENING_REQUIREMENTS)],
            'quiz_screening_questions' => 'nullable|array|max:8',
            'quiz_screening_questions.*.id' => 'nullable|string|max:100',
            'quiz_screening_questions.*.type' => ['required_with:quiz_screening_questions', Rule::in(['single-choice', 'text'])],
            'quiz_screening_questions.*.title' => 'required_with:quiz_screening_questions|string|max:255',
            'quiz_screening_questions.*.question' => 'required_with:quiz_screening_questions|string|max:500',
            'quiz_screening_questions.*.answers' => 'nullable|array|max:10',
            'quiz_screening_questions.*.answers.*' => 'nullable|string|max:100',
            'quiz_screening_questions.*.required' => 'nullable|boolean',
            'status' => ['nullable', Rule::in(Job::STATUSES)],
            'workflow_status' => ['nullable', Rule::in(Job::WORKFLOW_STATUSES)],
        ];
    }
}
