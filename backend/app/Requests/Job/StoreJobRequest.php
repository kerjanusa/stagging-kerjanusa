<?php

namespace App\Requests\Job;

use App\Models\Job;
use App\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

class StoreJobRequest extends ApiFormRequest
{
    /**
     * Define the payload required to create a recruiter job posting.
     */
    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'required|string',
            'salary_min' => 'required|numeric|min:0',
            'salary_max' => 'required|numeric|gte:salary_min',
            'location' => 'required|string',
            'job_type' => ['required', Rule::in(Job::JOB_TYPES)],
            'experience_level' => ['required', Rule::in(Job::EXPERIENCE_LEVELS)],
            'work_mode' => ['nullable', Rule::in(Job::WORK_MODES)],
            'openings_count' => 'nullable|integer|min:0',
            'interview_type' => ['nullable', Rule::in(Job::INTERVIEW_TYPES)],
            'interview_note' => 'nullable|string',
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
