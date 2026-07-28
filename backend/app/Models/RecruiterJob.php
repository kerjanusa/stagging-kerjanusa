<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RecruiterJob extends Model
{
    use HasFactory;

    protected $fillable = [
        'job_id',
        'recruiter_id',
        'title',
        'description',
        'category',
        'salary_min',
        'salary_max',
        'location',
        'job_type',
        'experience_level',
        'work_mode',
        'openings_count',
        'interview_type',
        'interview_note',
        'shift_night',
        'expiry_date',
        'candidate_gender',
        'candidate_experience',
        'candidate_education',
        'candidate_age_min',
        'candidate_age_max',
        'candidate_no_age_limit',
        'candidate_photo_requirement',
        'candidate_domicile',
        'candidate_skills',
        'candidate_custom_skill',
        'internal_recruiter_link',
        'video_screening_requirement',
        'status',
        'workflow_status',
        'quiz_screening_questions',
    ];

    protected $casts = [
        'salary_min' => 'integer',
        'salary_max' => 'integer',
        'openings_count' => 'integer',
        'candidate_age_min' => 'integer',
        'candidate_age_max' => 'integer',
        'candidate_no_age_limit' => 'boolean',
        'candidate_skills' => 'array',
        'quiz_screening_questions' => 'array',
        'expiry_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Return the public job posting linked to this recruiter-owned record.
     */
    public function job()
    {
        return $this->belongsTo(Job::class);
    }

    /**
     * Return the recruiter account that submitted this job.
     */
    public function recruiter()
    {
        return $this->belongsTo(User::class, 'recruiter_id');
    }
}
