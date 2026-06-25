<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private function indexExists(string $table, string $indexName): bool
    {
        $databaseName = DB::getDatabaseName();

        if (!filled($databaseName)) {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', $databaseName)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->exists();
    }

    private function createIndexIfMissing(string $table, string $indexName, string $columns): void
    {
        if ($this->indexExists($table, $indexName)) {
            return;
        }

        DB::statement(sprintf('CREATE INDEX %s ON %s (%s)', $indexName, $table, $columns));
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (!$this->indexExists($table, $indexName)) {
            return;
        }

        DB::statement(sprintf('DROP INDEX %s ON %s', $indexName, $table));
    }

    public function up(): void
    {
        $this->createIndexIfMissing('users', 'users_role_created_at_index', 'role, created_at');
        $this->createIndexIfMissing(
            'users',
            'users_role_account_status_created_at_index',
            'role, account_status, created_at'
        );

        $this->createIndexIfMissing(
            'jobs',
            'jobs_recruiter_status_created_at_index',
            'recruiter_id, status, created_at'
        );
        $this->createIndexIfMissing(
            'jobs',
            'jobs_status_workflow_created_at_index',
            'status, workflow_status, created_at'
        );

        $this->createIndexIfMissing(
            'applications',
            'applications_candidate_applied_created_index',
            'candidate_id, applied_at, created_at'
        );
        $this->createIndexIfMissing(
            'applications',
            'applications_job_status_stage_index',
            'job_id, status, stage'
        );
        $this->createIndexIfMissing(
            'applications',
            'applications_stage_created_at_index',
            'stage, created_at'
        );
    }

    public function down(): void
    {
        $this->dropIndexIfExists('users', 'users_role_created_at_index');
        $this->dropIndexIfExists('users', 'users_role_account_status_created_at_index');

        $this->dropIndexIfExists('jobs', 'jobs_recruiter_status_created_at_index');
        $this->dropIndexIfExists('jobs', 'jobs_status_workflow_created_at_index');

        $this->dropIndexIfExists('applications', 'applications_candidate_applied_created_index');
        $this->dropIndexIfExists('applications', 'applications_job_status_stage_index');
        $this->dropIndexIfExists('applications', 'applications_stage_created_at_index');
    }
};
