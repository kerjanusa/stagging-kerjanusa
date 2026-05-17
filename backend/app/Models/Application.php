<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_WITHDRAWN = 'withdrawn';
    public const STAGE_APPLIED = 'applied';
    public const STAGE_SCREENING = 'screening';
    public const STAGE_SHORTLISTED = 'shortlisted';
    public const STAGE_INTERVIEW = 'interview';
    public const STAGE_OFFERING = 'offering';
    public const STAGE_HIRED = 'hired';
    public const STAGE_REJECTED = 'rejected';
    public const STAGE_WITHDRAWN = 'withdrawn';
    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_ACCEPTED,
        self::STATUS_REJECTED,
        self::STATUS_WITHDRAWN,
    ];
    public const STAGES = [
        self::STAGE_APPLIED,
        self::STAGE_SCREENING,
        self::STAGE_SHORTLISTED,
        self::STAGE_INTERVIEW,
        self::STAGE_OFFERING,
        self::STAGE_HIRED,
        self::STAGE_REJECTED,
        self::STAGE_WITHDRAWN,
    ];

    protected $fillable = [
        'job_id',
        'candidate_id',
        'status',
        'stage',
        'cover_letter',
        'screening_answers',
        'video_intro_url',
        'applied_at',
    ];

    protected $casts = [
        'applied_at' => 'datetime',
        'screening_answers' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Return the job this application belongs to.
     */
    public function job()
    {
        return $this->belongsTo(Job::class);
    }

    /**
     * Return the candidate that submitted this application.
     */
    public function candidate()
    {
        return $this->belongsTo(User::class, 'candidate_id');
    }
}
