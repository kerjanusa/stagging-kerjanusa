<?php

namespace App\Services;

use App\Models\User;

class RecruiterPlanService
{
    public const PLAN_STARTER = 'starter';
    public const PLAN_GROWTH = 'growth';
    public const PLAN_SCALE = 'scale';

    private const DEFAULT_KN_CREDIT = 0;

    private const PLAN_CATALOG = [
        self::PLAN_STARTER => [
            'code' => self::PLAN_STARTER,
            'label' => 'Starter',
            'description' => 'Untuk recruiter yang baru mulai membangun pipeline kandidat.',
            'job_limit' => 3,
            'talent_result_limit' => 15,
            'visible_resume_files' => 1,
            'visible_certificate_files' => 0,
            'chat_with_candidates' => true,
            'chat_with_superadmin' => true,
        ],
        self::PLAN_GROWTH => [
            'code' => self::PLAN_GROWTH,
            'label' => 'Growth',
            'description' => 'Untuk tim hiring yang butuh pencarian kandidat dan screening lebih luas.',
            'job_limit' => 10,
            'talent_result_limit' => 60,
            'visible_resume_files' => 3,
            'visible_certificate_files' => 2,
            'chat_with_candidates' => true,
            'chat_with_superadmin' => true,
        ],
        self::PLAN_SCALE => [
            'code' => self::PLAN_SCALE,
            'label' => 'Scale',
            'description' => 'Untuk recruiter dengan volume hiring tinggi dan kebutuhan akses penuh.',
            'job_limit' => null,
            'talent_result_limit' => 200,
            'visible_resume_files' => 10,
            'visible_certificate_files' => 10,
            'chat_with_candidates' => true,
            'chat_with_superadmin' => true,
        ],
    ];

    /**
     * Wire logging used by plan resolution and enforcement helpers.
     */
    public function __construct(private ServiceActivityLogService $serviceActivityLogService)
    {
    }

    /**
     * Return the public recruiter package catalog in a frontend-friendly format.
     */
    public function getPlanCatalog(): array
    {
        $this->serviceActivityLogService->debug($this, 'recruiter_plan_service.catalog_requested', [
            'action' => 'get_plan_catalog',
            'catalog_size' => count(self::PLAN_CATALOG),
            'result' => 'success',
        ]);

        return array_values(self::PLAN_CATALOG);
    }

    /**
     * Normalize arbitrary plan input to one known internal plan code.
     */
    public function normalizePlanCode(?string $planCode): string
    {
        $normalizedPlanCode = strtolower(trim((string) $planCode));

        return array_key_exists($normalizedPlanCode, self::PLAN_CATALOG)
            ? $normalizedPlanCode
            : self::PLAN_STARTER;
    }

    /**
     * Resolve the immutable configuration for a normalized plan code.
     */
    public function getPlanConfig(?string $planCode): array
    {
        return self::PLAN_CATALOG[$this->normalizePlanCode($planCode)];
    }

    /**
     * Merge recruiter profile data with the active plan configuration and credits.
     */
    public function getRecruiterPlanContext(User $recruiter): array
    {
        $profile = is_array($recruiter->recruiter_profile) ? $recruiter->recruiter_profile : [];
        $planCode = $this->normalizePlanCode($profile['plan_code'] ?? null);
        $planConfig = $this->getPlanConfig($planCode);

        $this->serviceActivityLogService->debug($this, 'recruiter_plan_service.context_resolved', [
            'action' => 'get_recruiter_plan_context',
            'target_user_id' => $recruiter->id,
            'plan_code' => $planCode,
            'kn_credit' => max(0, (int) ($profile['kn_credit'] ?? self::DEFAULT_KN_CREDIT)),
            'result' => 'success',
        ], $recruiter);

        return [
            ...$planConfig,
            'kn_credit' => max(0, (int) ($profile['kn_credit'] ?? self::DEFAULT_KN_CREDIT)),
        ];
    }

    /**
     * Ensure recruiter profile data always carries normalized plan and credit fields.
     */
    public function normalizeRecruiterProfile(?array $profile): array
    {
        $currentProfile = is_array($profile) ? $profile : [];
        $planCode = $this->normalizePlanCode($currentProfile['plan_code'] ?? null);

        unset($currentProfile['plan']);

        return [
            ...$currentProfile,
            'plan_code' => $planCode,
            'kn_credit' => max(0, (int) ($currentProfile['kn_credit'] ?? self::DEFAULT_KN_CREDIT)),
        ];
    }

    /**
     * Expose the document visibility quota that applies to a recruiter package.
     */
    public function getVisibleDocumentLimits(User $recruiter): array
    {
        $plan = $this->getRecruiterPlanContext($recruiter);

        return [
            'resume_files' => $plan['visible_resume_files'],
            'certificate_files' => $plan['visible_certificate_files'],
        ];
    }

    /**
     * Decide whether a recruiter may activate one more job under the current package.
     */
    public function canPublishAdditionalJob(User $recruiter, int $currentActiveJobs): bool
    {
        $plan = $this->getRecruiterPlanContext($recruiter);

        if ($plan['job_limit'] === null) {
            $this->serviceActivityLogService->debug($this, 'recruiter_plan_service.job_limit_not_enforced', [
                'action' => 'can_publish_additional_job',
                'target_user_id' => $recruiter->id,
                'plan_code' => $plan['code'] ?? null,
                'current_active_jobs' => $currentActiveJobs,
                'result' => 'allowed',
            ], $recruiter);

            return true;
        }

        $canPublish = $currentActiveJobs < (int) $plan['job_limit'];

        $this->serviceActivityLogService->log(
            $this,
            $canPublish ? 'debug' : 'warning',
            $canPublish
                ? 'recruiter_plan_service.additional_job_allowed'
                : 'recruiter_plan_service.additional_job_denied',
            [
                'action' => 'can_publish_additional_job',
                'target_user_id' => $recruiter->id,
                'plan_code' => $plan['code'] ?? null,
                'current_active_jobs' => $currentActiveJobs,
                'job_limit' => (int) $plan['job_limit'],
                'result' => $canPublish ? 'allowed' : 'denied',
            ],
            $recruiter
        );

        return $canPublish;
    }
}
