<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\Job;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SuperadminDemoSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'password123';

    public function run(): void
    {
        DB::transaction(function (): void {
            $recruiters = $this->seedRecruiters();
            $candidates = $this->seedCandidates();
            $jobs = $this->seedJobs($recruiters);

            $this->seedApplications($candidates, $jobs);
        });
    }

    private function seedRecruiters(): array
    {
        $recruiterBlueprints = [
            [
                'email' => 'nabila.santoso@recruiter.demo.kerjanusa.test',
                'name' => 'Nabila Santoso',
                'phone' => '081700000101',
                'company_name' => 'PT Arunika Teknologi Nusantara',
                'contact_role' => 'Talent Acquisition Lead',
                'company_location' => 'Jakarta Selatan, DKI Jakarta',
                'company_description' => 'Perusahaan teknologi yang fokus pada platform operasional dan automasi bisnis.',
                'hiring_focus' => ['Backend Engineer', 'Frontend Engineer', 'Product Designer'],
                'account_status' => User::STATUS_ACTIVE,
                'account_status_reason' => null,
                'created_days_ago' => 18,
                'profile_variant' => 'complete',
            ],
            [
                'email' => 'dion.prakoso@recruiter.demo.kerjanusa.test',
                'name' => 'Dion Prakoso',
                'phone' => '081700000102',
                'company_name' => 'CV Lensa Kreatif Studio',
                'contact_role' => 'Recruitment Partner',
                'company_location' => 'Bandung, Jawa Barat',
                'company_description' => 'Studio kreatif digital yang rutin membuka peran desain, konten, dan marketing.',
                'hiring_focus' => ['UI Designer', 'Content Strategist', 'Marketing Executive'],
                'account_status' => User::STATUS_ACTIVE,
                'account_status_reason' => null,
                'created_days_ago' => 14,
                'profile_variant' => 'complete',
            ],
            [
                'email' => 'sari.kusuma@recruiter.demo.kerjanusa.test',
                'name' => 'Sari Kusuma',
                'phone' => '081700000103',
                'company_name' => 'PT Rantai Distribusi Prima',
                'contact_role' => 'Recruitment Manager',
                'company_location' => 'Surabaya, Jawa Timur',
                'company_description' => 'Perusahaan logistik nasional dengan kebutuhan hiring rutin di gudang dan distribusi.',
                'hiring_focus' => ['Warehouse Coordinator', 'Fleet Planner', 'Logistics Analyst'],
                'account_status' => User::STATUS_ACTIVE,
                'account_status_reason' => null,
                'created_days_ago' => 10,
                'profile_variant' => 'complete',
            ],
            [
                'email' => 'rio.wijaya@recruiter.demo.kerjanusa.test',
                'name' => 'Rio Wijaya',
                'phone' => '081700000104',
                'company_name' => 'PT Fintek Akselerasi Indonesia',
                'contact_role' => 'People Operations',
                'company_location' => 'Jakarta Pusat, DKI Jakarta',
                'company_description' => 'Tim finansial digital yang merekrut data, finance, dan compliance secara agresif.',
                'hiring_focus' => ['Finance Admin', 'Data Analyst', 'Compliance Officer'],
                'account_status' => User::STATUS_ACTIVE,
                'account_status_reason' => null,
                'created_days_ago' => 8,
                'profile_variant' => 'complete',
            ],
            [
                'email' => 'putri.mahesa@recruiter.demo.kerjanusa.test',
                'name' => 'Putri Mahesa',
                'phone' => '081700000105',
                'company_name' => 'PT Medika Satu Sehat',
                'contact_role' => 'HR Business Partner',
                'company_location' => 'Bogor, Jawa Barat',
                'company_description' => 'Jaringan layanan kesehatan yang membuka posisi administrasi, HR, dan support.',
                'hiring_focus' => ['HR Operations Specialist', 'Recruitment Associate', 'Clinic Admin'],
                'account_status' => User::STATUS_ACTIVE,
                'account_status_reason' => null,
                'created_days_ago' => 5,
                'profile_variant' => 'complete',
            ],
            [
                'email' => 'aldi.firmansyah@recruiter.demo.kerjanusa.test',
                'name' => 'Aldi Firmansyah',
                'phone' => '081700000106',
                'company_name' => 'PT Urban Niaga Retail',
                'contact_role' => 'Recruitment Specialist',
                'company_location' => 'Depok, Jawa Barat',
                'company_description' => null,
                'hiring_focus' => ['Sales Supervisor', 'Customer Experience Associate', 'Telemarketing Specialist'],
                'account_status' => User::STATUS_ACTIVE,
                'account_status_reason' => null,
                'created_days_ago' => 4,
                'profile_variant' => 'missing-description',
            ],
            [
                'email' => 'meli.puspita@recruiter.demo.kerjanusa.test',
                'name' => 'Meli Puspita',
                'phone' => '081700000107',
                'company_name' => 'PT Agro Pangan Mandiri',
                'contact_role' => 'Hiring Coordinator',
                'company_location' => 'Semarang, Jawa Tengah',
                'company_description' => 'Bisnis distribusi bahan pangan yang sedang menata ulang proses hiring area tengah.',
                'hiring_focus' => [],
                'account_status' => User::STATUS_ACTIVE,
                'account_status_reason' => null,
                'created_days_ago' => 2,
                'profile_variant' => 'missing-focus',
            ],
            [
                'email' => 'fajar.rahman@recruiter.demo.kerjanusa.test',
                'name' => 'Fajar Rahman',
                'phone' => '081700000108',
                'company_name' => 'PT Sagara Transport Solusi',
                'contact_role' => 'HR Supervisor',
                'company_location' => 'Bekasi, Jawa Barat',
                'company_description' => 'Perusahaan transportasi yang sedang dibatasi sementara untuk audit proses rekrutmen.',
                'hiring_focus' => ['Driver Coordinator', 'Transport Admin'],
                'account_status' => User::STATUS_SUSPENDED,
                'account_status_reason' => 'Dokumen kepatuhan perusahaan belum lengkap dan perlu audit lanjutan.',
                'created_days_ago' => 1,
                'profile_variant' => 'complete',
            ],
        ];

        $recruiters = [];

        foreach ($recruiterBlueprints as $blueprint) {
            $recruiter = User::firstOrNew([
                'email' => $blueprint['email'],
            ]);

            $recruiter->fill([
                'name' => $blueprint['name'],
                'company_name' => $blueprint['company_name'],
                'password' => Hash::make(self::DEMO_PASSWORD),
                'role' => User::ROLE_RECRUITER,
                'account_status' => $blueprint['account_status'],
                'account_status_reason' => $blueprint['account_status_reason'],
                'phone' => $blueprint['phone'],
                'recruiter_profile' => $this->buildRecruiterProfile($blueprint),
            ]);
            $recruiter->save();

            $createdAt = now()->subDays($blueprint['created_days_ago']);
            $this->syncTimestamps($recruiter, $createdAt, $createdAt->copy()->addHours(6));

            $recruiters[$blueprint['email']] = $recruiter->fresh();
        }

        return $recruiters;
    }

    private function seedCandidates(): array
    {
        $candidateNames = [
            'Andi Pratama',
            'Bunga Maharani',
            'Chandra Wijaya',
            'Dinda Larasati',
            'Eko Saputra',
            'Fitri Nurhaliza',
            'Galang Ramadhan',
            'Hana Putri',
            'Imam Fauzi',
            'Jesica Valencia',
            'Kiki Aulia',
            'Luthfi Hidayat',
            'Maya Rahma',
            'Naufal Akbar',
            'Ochi Permata',
            'Putra Mahendra',
            'Qonita Salsabila',
            'Raka Aditya',
            'Siti Amelia',
            'Tegar Prakoso',
            'Ulfa Khairani',
            'Vina Cahyani',
            'Wahyu Setiawan',
            'Yusuf Ramadhan',
        ];

        $preferredRoles = [
            'Senior Frontend Developer',
            'Backend Engineer',
            'UI/UX Designer',
            'Data Analyst',
            'HR Operations',
            'Marketing Executive',
            'Warehouse Coordinator',
            'Finance Admin',
        ];

        $preferredLocations = [
            'Jakarta Selatan',
            'Bandung',
            'Surabaya',
            'Bogor',
            'Depok',
            'Semarang',
            'Bekasi',
            'Jakarta Pusat',
        ];

        $skillSets = [
            ['React', 'TypeScript', 'Tailwind'],
            ['Laravel', 'PostgreSQL', 'REST API'],
            ['Figma', 'Design System', 'Research'],
            ['Excel', 'SQL', 'Dashboarding'],
            ['Recruitment', 'People Ops', 'Interviewing'],
            ['Meta Ads', 'Copywriting', 'CRM'],
            ['Inventory', 'WMS', 'Quality Control'],
            ['Reconciliation', 'Tax Admin', 'Spreadsheets'],
        ];

        $candidates = [];

        foreach ($candidateNames as $index => $name) {
            $email = Str::slug($name, '.') . '@candidate.demo.kerjanusa.test';
            $rolePreference = $preferredRoles[$index % count($preferredRoles)];
            $locationPreference = $preferredLocations[$index % count($preferredLocations)];
            $skills = $skillSets[$index % count($skillSets)];

            $accountStatus = $index >= 21 ? User::STATUS_SUSPENDED : User::STATUS_ACTIVE;
            $profileVariant = match (true) {
                $index < 16 => 'complete',
                $index < 21 => ['missing-resume', 'missing-summary', 'missing-skills', 'missing-location', 'missing-role'][$index - 16],
                $index === 21 => 'complete',
                $index === 22 => 'missing-resume',
                default => 'complete',
            };

            $candidate = User::firstOrNew([
                'email' => $email,
            ]);

            $candidate->fill([
                'name' => $name,
                'password' => Hash::make(self::DEMO_PASSWORD),
                'role' => User::ROLE_CANDIDATE,
                'account_status' => $accountStatus,
                'account_status_reason' => $accountStatus === User::STATUS_SUSPENDED
                    ? 'Akun dinonaktifkan sementara untuk peninjauan validitas data kandidat.'
                    : null,
                'phone' => '08210000' . str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT),
                'candidate_profile' => $this->buildCandidateProfile(
                    name: $name,
                    preferredRole: $rolePreference,
                    preferredLocation: $locationPreference,
                    skills: $skills,
                    variant: $profileVariant,
                ),
            ]);
            $candidate->save();

            $createdAt = $index < 8
                ? now()->subDays($index + 1)
                : now()->subDays(9 + (($index - 8) * 2));
            $this->syncTimestamps($candidate, $createdAt, $createdAt->copy()->addHours(4));

            $candidates[$email] = $candidate->fresh();
        }

        return $candidates;
    }

    private function seedJobs(array $recruiters): array
    {
        $jobBlueprints = [
            [
                'key' => 'senior-backend-engineer',
                'title' => 'Senior Backend Engineer',
                'recruiter_email' => 'nabila.santoso@recruiter.demo.kerjanusa.test',
                'category' => 'Technology',
                'location' => 'Jakarta Selatan',
                'salary_min' => 12000000,
                'salary_max' => 18000000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_SENIOR,
                'work_mode' => Job::WORK_MODE_HYBRID,
                'openings_count' => 2,
                'interview_type' => Job::INTERVIEW_TYPE_HYBRID,
                'video_screening_requirement' => Job::VIDEO_SCREENING_REQUIRED,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 6,
            ],
            [
                'key' => 'frontend-engineer',
                'title' => 'Frontend Engineer',
                'recruiter_email' => 'nabila.santoso@recruiter.demo.kerjanusa.test',
                'category' => 'Technology',
                'location' => 'Jakarta Selatan',
                'salary_min' => 9000000,
                'salary_max' => 14000000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_MID,
                'work_mode' => Job::WORK_MODE_HYBRID,
                'openings_count' => 2,
                'interview_type' => Job::INTERVIEW_TYPE_ONLINE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 5,
            ],
            [
                'key' => 'product-designer',
                'title' => 'Product Designer',
                'recruiter_email' => 'dion.prakoso@recruiter.demo.kerjanusa.test',
                'category' => 'Design',
                'location' => 'Bandung',
                'salary_min' => 8000000,
                'salary_max' => 13000000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_MID,
                'work_mode' => Job::WORK_MODE_HYBRID,
                'openings_count' => 1,
                'interview_type' => Job::INTERVIEW_TYPE_ONLINE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 4,
            ],
            [
                'key' => 'logistics-data-analyst',
                'title' => 'Logistics Data Analyst',
                'recruiter_email' => 'rio.wijaya@recruiter.demo.kerjanusa.test',
                'category' => 'Analytics',
                'location' => 'Jakarta Pusat',
                'salary_min' => 8500000,
                'salary_max' => 12500000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_MID,
                'work_mode' => Job::WORK_MODE_HYBRID,
                'openings_count' => 1,
                'interview_type' => Job::INTERVIEW_TYPE_HYBRID,
                'video_screening_requirement' => Job::VIDEO_SCREENING_REQUIRED,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 3,
            ],
            [
                'key' => 'hr-operations-specialist',
                'title' => 'HR Operations Specialist',
                'recruiter_email' => 'putri.mahesa@recruiter.demo.kerjanusa.test',
                'category' => 'Human Resources',
                'location' => 'Bogor',
                'salary_min' => 7000000,
                'salary_max' => 10000000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_MID,
                'work_mode' => Job::WORK_MODE_WFO,
                'openings_count' => 1,
                'interview_type' => Job::INTERVIEW_TYPE_ONSITE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 7,
            ],
            [
                'key' => 'sales-area-supervisor',
                'title' => 'Sales Area Supervisor',
                'recruiter_email' => 'aldi.firmansyah@recruiter.demo.kerjanusa.test',
                'category' => 'Sales',
                'location' => 'Depok',
                'salary_min' => 7500000,
                'salary_max' => 11500000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_SENIOR,
                'work_mode' => Job::WORK_MODE_WFO,
                'openings_count' => 3,
                'interview_type' => Job::INTERVIEW_TYPE_ONSITE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 9,
            ],
            [
                'key' => 'customer-experience-associate',
                'title' => 'Customer Experience Associate',
                'recruiter_email' => 'aldi.firmansyah@recruiter.demo.kerjanusa.test',
                'category' => 'Customer Service',
                'location' => 'Depok',
                'salary_min' => 5000000,
                'salary_max' => 7000000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_ENTRY,
                'work_mode' => Job::WORK_MODE_WFO,
                'openings_count' => 4,
                'interview_type' => Job::INTERVIEW_TYPE_PHONE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 11,
            ],
            [
                'key' => 'finance-admin',
                'title' => 'Finance Admin',
                'recruiter_email' => 'rio.wijaya@recruiter.demo.kerjanusa.test',
                'category' => 'Finance',
                'location' => 'Jakarta Pusat',
                'salary_min' => 6500000,
                'salary_max' => 9000000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_JUNIOR,
                'work_mode' => Job::WORK_MODE_HYBRID,
                'openings_count' => 2,
                'interview_type' => Job::INTERVIEW_TYPE_ONLINE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 12,
            ],
            [
                'key' => 'warehouse-coordinator',
                'title' => 'Warehouse Coordinator',
                'recruiter_email' => 'sari.kusuma@recruiter.demo.kerjanusa.test',
                'category' => 'Operations',
                'location' => 'Surabaya',
                'salary_min' => 6000000,
                'salary_max' => 8500000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_MID,
                'work_mode' => Job::WORK_MODE_WFO,
                'openings_count' => 2,
                'interview_type' => Job::INTERVIEW_TYPE_ONSITE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_REQUIRED,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 13,
            ],
            [
                'key' => 'marketing-campaign-executive',
                'title' => 'Marketing Campaign Executive',
                'recruiter_email' => 'dion.prakoso@recruiter.demo.kerjanusa.test',
                'category' => 'Marketing',
                'location' => 'Bandung',
                'salary_min' => 6500000,
                'salary_max' => 9500000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_MID,
                'work_mode' => Job::WORK_MODE_HYBRID,
                'openings_count' => 1,
                'interview_type' => Job::INTERVIEW_TYPE_ONLINE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 15,
            ],
            [
                'key' => 'recruitment-associate',
                'title' => 'Recruitment Associate',
                'recruiter_email' => 'putri.mahesa@recruiter.demo.kerjanusa.test',
                'category' => 'Human Resources',
                'location' => 'Bogor',
                'salary_min' => 5500000,
                'salary_max' => 8000000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_ENTRY,
                'work_mode' => Job::WORK_MODE_WFO,
                'openings_count' => 2,
                'interview_type' => Job::INTERVIEW_TYPE_PHONE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 16,
            ],
            [
                'key' => 'business-development-lead',
                'title' => 'Business Development Lead',
                'recruiter_email' => 'aldi.firmansyah@recruiter.demo.kerjanusa.test',
                'category' => 'Business Development',
                'location' => 'Depok',
                'salary_min' => 9000000,
                'salary_max' => 14000000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_SENIOR,
                'work_mode' => Job::WORK_MODE_WFO,
                'openings_count' => 1,
                'interview_type' => Job::INTERVIEW_TYPE_HYBRID,
                'video_screening_requirement' => Job::VIDEO_SCREENING_REQUIRED,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 18,
            ],
            [
                'key' => 'quality-control-staff',
                'title' => 'Quality Control Staff',
                'recruiter_email' => 'meli.puspita@recruiter.demo.kerjanusa.test',
                'category' => 'Operations',
                'location' => 'Semarang',
                'salary_min' => 5000000,
                'salary_max' => 7200000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_ENTRY,
                'work_mode' => Job::WORK_MODE_WFO,
                'openings_count' => 2,
                'interview_type' => Job::INTERVIEW_TYPE_ONSITE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 20,
            ],
            [
                'key' => 'inventory-planner',
                'title' => 'Inventory Planner',
                'recruiter_email' => 'sari.kusuma@recruiter.demo.kerjanusa.test',
                'category' => 'Logistics',
                'location' => 'Surabaya',
                'salary_min' => 6500000,
                'salary_max' => 8800000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_MID,
                'work_mode' => Job::WORK_MODE_WFO,
                'openings_count' => 1,
                'interview_type' => Job::INTERVIEW_TYPE_ONSITE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_REQUIRED,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 21,
            ],
            [
                'key' => 'procurement-officer',
                'title' => 'Procurement Officer',
                'recruiter_email' => 'meli.puspita@recruiter.demo.kerjanusa.test',
                'category' => 'Operations',
                'location' => 'Semarang',
                'salary_min' => 5800000,
                'salary_max' => 8400000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_MID,
                'work_mode' => Job::WORK_MODE_WFO,
                'openings_count' => 1,
                'interview_type' => Job::INTERVIEW_TYPE_ONSITE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 22,
            ],
            [
                'key' => 'telemarketing-specialist',
                'title' => 'Telemarketing Specialist',
                'recruiter_email' => 'aldi.firmansyah@recruiter.demo.kerjanusa.test',
                'category' => 'Sales',
                'location' => 'Depok',
                'salary_min' => 4800000,
                'salary_max' => 6800000,
                'job_type' => Job::JOB_TYPE_CONTRACT,
                'experience_level' => Job::EXPERIENCE_LEVEL_ENTRY,
                'work_mode' => Job::WORK_MODE_WFO,
                'openings_count' => 3,
                'interview_type' => Job::INTERVIEW_TYPE_PHONE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_OPTIONAL,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_ACTIVE,
                'created_days_ago' => 23,
            ],
            [
                'key' => 'crypto-affiliate-manager',
                'title' => 'Crypto Affiliate Manager',
                'recruiter_email' => 'fajar.rahman@recruiter.demo.kerjanusa.test',
                'category' => 'Marketing',
                'location' => 'Bekasi',
                'salary_min' => 9500000,
                'salary_max' => 14500000,
                'job_type' => Job::JOB_TYPE_FREELANCE,
                'experience_level' => Job::EXPERIENCE_LEVEL_SENIOR,
                'work_mode' => Job::WORK_MODE_WFH,
                'openings_count' => 1,
                'interview_type' => Job::INTERVIEW_TYPE_ONLINE,
                'video_screening_requirement' => Job::VIDEO_SCREENING_REQUIRED,
                'status' => Job::STATUS_ACTIVE,
                'workflow_status' => Job::WORKFLOW_PAUSED,
                'created_days_ago' => 3,
            ],
            [
                'key' => 'compliance-officer',
                'title' => 'Compliance Officer',
                'recruiter_email' => 'rio.wijaya@recruiter.demo.kerjanusa.test',
                'category' => 'Finance',
                'location' => 'Jakarta Pusat',
                'salary_min' => 10000000,
                'salary_max' => 15000000,
                'job_type' => Job::JOB_TYPE_FULL_TIME,
                'experience_level' => Job::EXPERIENCE_LEVEL_SENIOR,
                'work_mode' => Job::WORK_MODE_HYBRID,
                'openings_count' => 1,
                'interview_type' => Job::INTERVIEW_TYPE_HYBRID,
                'video_screening_requirement' => Job::VIDEO_SCREENING_REQUIRED,
                'status' => Job::STATUS_INACTIVE,
                'workflow_status' => Job::WORKFLOW_CLOSED,
                'created_days_ago' => 28,
            ],
        ];

        $jobs = [];

        foreach ($jobBlueprints as $blueprint) {
            $recruiter = $recruiters[$blueprint['recruiter_email']] ?? null;

            if (!$recruiter) {
                continue;
            }

            $job = Job::firstOrNew([
                'recruiter_id' => $recruiter->id,
                'title' => $blueprint['title'],
            ]);

            $job->fill([
                'description' => $this->buildJobDescription($blueprint['title'], $blueprint['company_name'] ?? $recruiter->company_name),
                'category' => $blueprint['category'],
                'salary_min' => $blueprint['salary_min'],
                'salary_max' => $blueprint['salary_max'],
                'location' => $blueprint['location'],
                'job_type' => $blueprint['job_type'],
                'experience_level' => $blueprint['experience_level'],
                'work_mode' => $blueprint['work_mode'],
                'openings_count' => $blueprint['openings_count'],
                'interview_type' => $blueprint['interview_type'],
                'interview_note' => 'Seleksi dilakukan bertahap oleh tim recruiter dan hiring manager terkait.',
                'video_screening_requirement' => $blueprint['video_screening_requirement'],
                'status' => $blueprint['status'],
                'workflow_status' => $blueprint['workflow_status'],
            ]);
            $job->save();

            $createdAt = now()->subDays($blueprint['created_days_ago']);
            $this->syncTimestamps($job, $createdAt, $createdAt->copy()->addHours(3));

            $jobs[$blueprint['key']] = $job->fresh();
        }

        return $jobs;
    }

    private function seedApplications(array $candidates, array $jobs): void
    {
        $candidateEmails = array_slice(array_keys($candidates), 0, 18);
        $weightedJobKeys = [
            'senior-backend-engineer',
            'frontend-engineer',
            'product-designer',
            'senior-backend-engineer',
            'logistics-data-analyst',
            'warehouse-coordinator',
            'senior-backend-engineer',
            'product-designer',
            'finance-admin',
            'hr-operations-specialist',
            'sales-area-supervisor',
            'customer-experience-associate',
            'recruitment-associate',
            'marketing-campaign-executive',
            'quality-control-staff',
            'crypto-affiliate-manager',
            'business-development-lead',
            'frontend-engineer',
            'product-designer',
        ];

        $stageCycle = [
            ['stage' => Application::STAGE_APPLIED, 'status' => Application::STATUS_PENDING],
            ['stage' => Application::STAGE_SCREENING, 'status' => Application::STATUS_PENDING],
            ['stage' => Application::STAGE_SHORTLISTED, 'status' => Application::STATUS_PENDING],
            ['stage' => Application::STAGE_INTERVIEW, 'status' => Application::STATUS_PENDING],
            ['stage' => Application::STAGE_OFFERING, 'status' => Application::STATUS_ACCEPTED],
            ['stage' => Application::STAGE_HIRED, 'status' => Application::STATUS_ACCEPTED],
            ['stage' => Application::STAGE_REJECTED, 'status' => Application::STATUS_REJECTED],
            ['stage' => Application::STAGE_WITHDRAWN, 'status' => Application::STATUS_WITHDRAWN],
        ];

        $applicationCounter = 0;

        foreach ($candidateEmails as $candidateIndex => $candidateEmail) {
            $candidate = $candidates[$candidateEmail] ?? null;

            if (!$candidate) {
                continue;
            }

            $applicationsToCreate = $candidateIndex < 12 ? 3 : 2;
            $usedJobKeys = [];

            for ($iteration = 0; $iteration < $applicationsToCreate; $iteration++) {
                $cursor = ($candidateIndex * 2 + ($iteration * 3)) % count($weightedJobKeys);
                $jobKey = $weightedJobKeys[$cursor];

                while (in_array($jobKey, $usedJobKeys, true)) {
                    $cursor = ($cursor + 1) % count($weightedJobKeys);
                    $jobKey = $weightedJobKeys[$cursor];
                }

                $job = $jobs[$jobKey] ?? null;

                if (!$job) {
                    continue;
                }

                $usedJobKeys[] = $jobKey;

                $stagePayload = $stageCycle[$applicationCounter % count($stageCycle)];
                $appliedAt = now()
                    ->subDays(($applicationCounter % 9) + 1)
                    ->setTime(9 + ($applicationCounter % 8), 15);

                $application = Application::firstOrNew([
                    'job_id' => $job->id,
                    'candidate_id' => $candidate->id,
                ]);

                $application->fill([
                    'status' => $stagePayload['status'],
                    'stage' => $stagePayload['stage'],
                    'cover_letter' => $this->buildCoverLetter($candidate->name, $job->title),
                    'applied_at' => $appliedAt,
                ]);
                $application->save();

                $this->syncTimestamps($application, $appliedAt, $appliedAt->copy()->addHours(2));
                $applicationCounter++;
            }
        }
    }

    private function buildRecruiterProfile(array $blueprint): array
    {
        $profile = [
            'companyName' => $blueprint['company_name'],
            'contactRole' => $blueprint['contact_role'],
            'companyLocation' => $blueprint['company_location'],
            'companyDescription' => $blueprint['company_description'],
            'hiringFocus' => $blueprint['hiring_focus'],
        ];

        if ($blueprint['profile_variant'] === 'missing-description') {
            $profile['companyDescription'] = '';
        }

        if ($blueprint['profile_variant'] === 'missing-focus') {
            $profile['hiringFocus'] = [];
        }

        return $profile;
    }

    private function buildCandidateProfile(
        string $name,
        string $preferredRole,
        string $preferredLocation,
        array $skills,
        string $variant,
    ): array {
        $slug = Str::slug($name, '-');
        $profile = [
            'currentAddress' => 'Jl. ' . $preferredLocation . ' No. ' . (Str::length($slug) % 17 + 3),
            'profileSummary' => $name . ' memiliki pengalaman relevan dan siap mengikuti proses rekrutmen dengan cepat.',
            'preferredRoles' => [$preferredRole, 'Operations Specialist'],
            'preferredLocations' => [$preferredLocation, 'Remote'],
            'skills' => $skills,
            'resumeFiles' => ['resume-' . $slug . '.pdf'],
        ];

        return match ($variant) {
            'missing-resume' => array_merge($profile, ['resumeFiles' => []]),
            'missing-summary' => array_merge($profile, ['profileSummary' => '']),
            'missing-skills' => array_merge($profile, ['skills' => []]),
            'missing-location' => array_merge($profile, ['preferredLocations' => []]),
            'missing-role' => array_merge($profile, ['preferredRoles' => []]),
            default => $profile,
        };
    }

    private function buildJobDescription(string $title, ?string $companyName): string
    {
        return $title . ' dibuka oleh ' . ($companyName ?: 'recruiter demo')
            . ' untuk mendukung kebutuhan operasional yang sedang tumbuh. Kandidat diharapkan siap berkolaborasi, menjaga kualitas eksekusi, dan menyesuaikan diri dengan ritme kerja tim.';
    }

    private function buildCoverLetter(string $candidateName, string $jobTitle): string
    {
        return $candidateName . ' tertarik pada posisi ' . $jobTitle
            . ' dan siap mengikuti seluruh tahapan seleksi secara disiplin serta bertanggung jawab.';
    }

    private function syncTimestamps(Model $model, $createdAt, $updatedAt): void
    {
        $model->timestamps = false;
        $model->forceFill([
            'created_at' => $createdAt,
            'updated_at' => $updatedAt,
        ])->save();
        $model->timestamps = true;
    }
}
