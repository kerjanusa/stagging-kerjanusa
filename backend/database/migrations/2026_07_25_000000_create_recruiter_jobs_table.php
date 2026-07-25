<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create a dedicated table for job postings submitted from recruiter accounts.
     */
    public function up(): void
    {
        if (Schema::hasTable('recruiter_jobs')) {
            return;
        }

        Schema::create('recruiter_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_id')->constrained('jobs')->cascadeOnDelete();
            $table->foreignId('recruiter_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('description');
            $table->string('category');
            $table->unsignedInteger('salary_min');
            $table->unsignedInteger('salary_max');
            $table->string('location');
            $table->string('job_type', 32);
            $table->string('experience_level', 32);
            $table->string('work_mode', 32)->nullable();
            $table->unsignedInteger('openings_count')->default(0);
            $table->string('interview_type', 32)->nullable();
            $table->text('interview_note')->nullable();
            $table->string('video_screening_requirement', 32)->default('optional');
            $table->string('status', 32)->default('active');
            $table->string('workflow_status', 32)->default('active');
            $table->json('quiz_screening_questions')->nullable();
            $table->timestamps();

            $table->unique('job_id');
            $table->index(['recruiter_id', 'workflow_status']);
            $table->index(['status', 'created_at']);
            $table->index(['location', 'category']);
        });
    }

    /**
     * Drop the recruiter-owned job mirror table.
     */
    public function down(): void
    {
        Schema::dropIfExists('recruiter_jobs');
    }
};
