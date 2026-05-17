<?php

namespace App\Console\Commands;

use Database\Seeders\SuperadminDemoSeeder;
use Illuminate\Console\Command;

class SeedSuperadminDemoCommand extends Command
{
    protected $signature = 'demo:seed-superadmin';

    protected $description = 'Seed realistic recruiter, candidate, job, and application demo data for the superadmin dashboard without creating a new superadmin.';

    /**
     * Menjalankan seeder demo dashboard superadmin tanpa menyentuh akun superadmin utama.
     */
    public function handle(): int
    {
        $this->info('Menjalankan realistic demo seeder untuk superadmin...');

        $this->call('db:seed', [
            '--class' => SuperadminDemoSeeder::class,
            '--force' => true,
        ]);

        $this->newLine();
        $this->info('Seeder selesai. Akun demo yang dibuat / diperbarui:');
        $this->line('- Recruiter demo: *.recruiter.demo.kerjanusa.test / password123');
        $this->line('- Candidate demo: *.candidate.demo.kerjanusa.test / password123');
        $this->line('- Superadmin utama tetap memakai akun yang sudah ada di database.');

        return self::SUCCESS;
    }
}
