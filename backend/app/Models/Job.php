<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Job extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const WORKFLOW_DRAFT = 'draft';
    public const WORKFLOW_ACTIVE = 'active';
    public const WORKFLOW_PAUSED = 'paused';
    public const WORKFLOW_CLOSED = 'closed';
    public const WORKFLOW_FILLED = 'filled';
    public const STATUSES = [
        self::STATUS_ACTIVE,
        self::STATUS_INACTIVE,
    ];
    public const WORKFLOW_STATUSES = [
        self::WORKFLOW_DRAFT,
        self::WORKFLOW_ACTIVE,
        self::WORKFLOW_PAUSED,
        self::WORKFLOW_CLOSED,
        self::WORKFLOW_FILLED,
    ];

    public const JOB_TYPE_FULL_TIME = 'full-time';
    public const JOB_TYPE_PART_TIME = 'part-time';
    public const JOB_TYPE_CONTRACT = 'contract';
    public const JOB_TYPE_FREELANCE = 'freelance';
    public const JOB_TYPES = [
        self::JOB_TYPE_FULL_TIME,
        self::JOB_TYPE_PART_TIME,
        self::JOB_TYPE_CONTRACT,
        self::JOB_TYPE_FREELANCE,
    ];

    public const EXPERIENCE_LEVEL_ENTRY = 'entry';
    public const EXPERIENCE_LEVEL_JUNIOR = 'junior';
    public const EXPERIENCE_LEVEL_MID = 'mid';
    public const EXPERIENCE_LEVEL_SENIOR = 'senior';
    public const EXPERIENCE_LEVELS = [
        self::EXPERIENCE_LEVEL_ENTRY,
        self::EXPERIENCE_LEVEL_JUNIOR,
        self::EXPERIENCE_LEVEL_MID,
        self::EXPERIENCE_LEVEL_SENIOR,
    ];

    public const WORK_MODE_WFO = 'wfo';
    public const WORK_MODE_HYBRID = 'hybrid';
    public const WORK_MODE_WFH = 'wfh';
    public const WORK_MODES = [
        self::WORK_MODE_WFO,
        self::WORK_MODE_HYBRID,
        self::WORK_MODE_WFH,
    ];

    public const INTERVIEW_TYPE_ONSITE = 'onsite';
    public const INTERVIEW_TYPE_ONLINE = 'online';
    public const INTERVIEW_TYPE_PHONE = 'phone';
    public const INTERVIEW_TYPE_HYBRID = 'hybrid';
    public const INTERVIEW_TYPES = [
        self::INTERVIEW_TYPE_ONSITE,
        self::INTERVIEW_TYPE_ONLINE,
        self::INTERVIEW_TYPE_PHONE,
        self::INTERVIEW_TYPE_HYBRID,
    ];

    public const VIDEO_SCREENING_REQUIRED = 'required';
    public const VIDEO_SCREENING_OPTIONAL = 'optional';
    public const VIDEO_SCREENING_REQUIREMENTS = [
        self::VIDEO_SCREENING_REQUIRED,
        self::VIDEO_SCREENING_OPTIONAL,
    ];

    protected $fillable = [
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
        'video_screening_requirement',
        'quiz_screening_questions',
        'status',
        'workflow_status',
    ];

    protected $casts = [
        'salary_min' => 'integer',
        'salary_max' => 'integer',
        'openings_count' => 'integer',
        'quiz_screening_questions' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Return the recruiter that owns this job posting.
     */
    public function recruiter()
    {
        return $this->belongsTo(User::class, 'recruiter_id');
    }

    /**
     * Return all applications submitted against this job posting.
     */
    public function applications()
    {
        return $this->hasMany(Application::class);
    }
}
