<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Persist recruiter-side candidate criteria that the frontend job form already collects.
     */
    public function up(): void
    {
        $this->addColumnsToTable('jobs');

        if (Schema::hasTable('recruiter_jobs')) {
            $this->addColumnsToTable('recruiter_jobs');
        }
    }

    /**
     * Remove the candidate criteria columns from both public and recruiter-owned job tables.
     */
    public function down(): void
    {
        if (Schema::hasTable('recruiter_jobs')) {
            $this->dropColumnsFromTable('recruiter_jobs');
        }

        $this->dropColumnsFromTable('jobs');
    }

    private function addColumnsToTable(string $tableName): void
    {
        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            if (!Schema::hasColumn($tableName, 'shift_night')) {
                $table->string('shift_night', 16)->default('no')->after('interview_note');
            }

            if (!Schema::hasColumn($tableName, 'expiry_date')) {
                $table->date('expiry_date')->nullable()->after('shift_night');
            }

            if (!Schema::hasColumn($tableName, 'candidate_gender')) {
                $table->string('candidate_gender', 32)->nullable()->after('expiry_date');
            }

            if (!Schema::hasColumn($tableName, 'candidate_experience')) {
                $table->string('candidate_experience', 32)->nullable()->after('candidate_gender');
            }

            if (!Schema::hasColumn($tableName, 'candidate_education')) {
                $table->string('candidate_education', 120)->nullable()->after('candidate_experience');
            }

            if (!Schema::hasColumn($tableName, 'candidate_age_min')) {
                $table->unsignedTinyInteger('candidate_age_min')->nullable()->after('candidate_education');
            }

            if (!Schema::hasColumn($tableName, 'candidate_age_max')) {
                $table->unsignedTinyInteger('candidate_age_max')->nullable()->after('candidate_age_min');
            }

            if (!Schema::hasColumn($tableName, 'candidate_no_age_limit')) {
                $table->boolean('candidate_no_age_limit')->default(false)->after('candidate_age_max');
            }

            if (!Schema::hasColumn($tableName, 'candidate_photo_requirement')) {
                $table->string('candidate_photo_requirement', 32)->nullable()->after('candidate_no_age_limit');
            }

            if (!Schema::hasColumn($tableName, 'candidate_domicile')) {
                $table->string('candidate_domicile', 120)->nullable()->after('candidate_photo_requirement');
            }

            if (!Schema::hasColumn($tableName, 'candidate_skills')) {
                $table->json('candidate_skills')->nullable()->after('candidate_domicile');
            }

            if (!Schema::hasColumn($tableName, 'candidate_custom_skill')) {
                $table->text('candidate_custom_skill')->nullable()->after('candidate_skills');
            }

            if (!Schema::hasColumn($tableName, 'internal_recruiter_link')) {
                $table->string('internal_recruiter_link', 2048)->nullable()->after('candidate_custom_skill');
            }
        });
    }

    private function dropColumnsFromTable(string $tableName): void
    {
        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            $columns = [
                'internal_recruiter_link',
                'candidate_custom_skill',
                'candidate_skills',
                'candidate_domicile',
                'candidate_photo_requirement',
                'candidate_no_age_limit',
                'candidate_age_max',
                'candidate_age_min',
                'candidate_education',
                'candidate_experience',
                'candidate_gender',
                'expiry_date',
                'shift_night',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn($tableName, $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
