<?php

namespace App\Http\Controllers;

use App\Models\Job;
use App\Models\User;
use App\Services\AdminService;
use App\Services\AuditLogService;
use App\Services\AdminValidationService;
use App\Services\JobService;
use App\Services\RecruiterPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password as PasswordBroker;

class AdminController extends Controller
{
    /**
     * Wire admin-facing services used by the superadmin panel endpoints.
     */
    public function __construct(
        private AdminService $adminService,
        private AuditLogService $auditLogService,
        private AdminValidationService $adminValidationService,
        private JobService $jobService,
        private RecruiterPlanService $recruiterPlanService,
    )
    {
    }

    /**
     * Return the live dashboard payload for the authenticated superadmin.
     */
    public function dashboard(): JsonResponse
    {
        return response()->json([
            'data' => $this->adminService->getDashboardData(),
        ]);
    }

    /**
     * Update basic account controls for candidate or recruiter users.
     */
    public function updateUser(Request $request, int $userId): JsonResponse
    {
        $user = User::find($userId);

        if (!$user || $user->hasRole(User::ROLE_SUPERADMIN)) {
            return response()->json([
                'message' => 'User tidak ditemukan atau tidak dapat diubah.',
            ], 404);
        }

        $validated = $this->adminValidationService->validateUpdateUser($request, $user);

        $nextAccountStatus = $validated['account_status'] ?? $user->account_status;
        $nextAccountStatusReason = array_key_exists('account_status_reason', $validated)
            ? (filled($validated['account_status_reason']) ? trim($validated['account_status_reason']) : null)
            : $user->account_status_reason;

        if ($nextAccountStatus === User::STATUS_ACTIVE) {
            $nextAccountStatusReason = null;
        }

        $user->fill([
            'name' => array_key_exists('name', $validated) ? $validated['name'] : $user->name,
            'email' => array_key_exists('email', $validated) ? User::normalizeEmail($validated['email']) : $user->email,
            'phone' => array_key_exists('phone', $validated) ? User::normalizePhone($validated['phone']) : $user->phone,
            'company_name' => array_key_exists('company_name', $validated)
                ? filled($validated['company_name']) ? trim($validated['company_name']) : null
                : $user->company_name,
            'account_status' => $nextAccountStatus,
            'account_status_reason' => $nextAccountStatusReason,
        ]);

        if ($user->hasRole(User::ROLE_RECRUITER) && (
            array_key_exists('verification_status', $validated) ||
            array_key_exists('verification_notes', $validated)
        )) {
            $recruiterProfile = is_array($user->recruiter_profile) ? $user->recruiter_profile : [];

            if (array_key_exists('verification_status', $validated)) {
                $recruiterProfile['verificationStatus'] = $validated['verification_status'];
                $recruiterProfile['verifiedAt'] = $validated['verification_status'] === 'verified'
                    ? now()->toIso8601String()
                    : null;
            }

            if (array_key_exists('verification_notes', $validated)) {
                $recruiterProfile['verificationNotes'] = filled($validated['verification_notes'])
                    ? trim($validated['verification_notes'])
                    : null;
            }

            if (array_key_exists('plan_code', $validated) && filled($validated['plan_code'])) {
                $recruiterProfile['plan_code'] = $validated['plan_code'];
            }

            if (array_key_exists('kn_credit', $validated)) {
                $recruiterProfile['kn_credit'] = max(0, (int) ($validated['kn_credit'] ?? 0));
            }

            $user->recruiter_profile = $this->recruiterPlanService->normalizeRecruiterProfile(
                $recruiterProfile
            );
        }

        $user->save();
        $this->auditLogService->record('admin.user_updated', [
            'action' => 'admin_update_user',
            'step' => 'persist_user_changes',
            'target_type' => 'user',
            'target_id' => $user->id,
            'changed_fields' => array_keys($validated),
            'result' => 'success',
        ], $request->user(), AdminService::class);

        return response()->json([
            'message' => 'Akun user berhasil diperbarui.',
            'data' => $user->fresh(),
        ]);
    }

    /**
     * Send a reset-password email to the selected user.
     */
    public function sendResetLink(Request $request, int $userId): JsonResponse
    {
        $user = User::find($userId);

        if (!$user || $user->hasRole(User::ROLE_SUPERADMIN)) {
            return response()->json([
                'message' => 'User tidak ditemukan atau tidak dapat diproses.',
            ], 404);
        }

        $status = PasswordBroker::sendResetLink([
            'email' => $user->email,
        ]);

        if ($status !== PasswordBroker::RESET_LINK_SENT) {
            return response()->json([
                'message' => 'Link reset password belum berhasil dikirim.',
            ], 422);
        }

        $this->auditLogService->record('admin.user_reset_link_sent', [
            'action' => 'admin_send_reset_link',
            'step' => 'send_reset_link',
            'target_type' => 'user',
            'target_id' => $user->id,
            'result' => 'success',
        ], $request->user(), AdminService::class);

        return response()->json([
            'message' => 'Link reset password berhasil dikirim.',
        ]);
    }

    /**
     * Reassign a job to another active recruiter.
     */
    public function reassignJob(Request $request, int $jobId): JsonResponse
    {
        $job = Job::find($jobId);

        if (!$job) {
            return response()->json([
                'message' => 'Lowongan tidak ditemukan.',
            ], 404);
        }

        $validated = $this->adminValidationService->validateReassignJob($request);

        $success = $this->jobService->reassignJob($jobId, $validated['recruiter_id']);

        if (!$success) {
            return response()->json([
                'message' => 'Lowongan belum berhasil dipindahkan.',
            ], 422);
        }

        $this->auditLogService->record('admin.job_reassigned', [
            'action' => 'admin_reassign_job',
            'step' => 'persist_job_reassignment',
            'target_type' => 'job',
            'target_id' => $jobId,
            'new_recruiter_id' => $validated['recruiter_id'],
            'result' => 'success',
        ], $request->user(), JobService::class);

        return response()->json([
            'message' => 'Lowongan berhasil dipindahkan ke recruiter baru.',
        ]);
    }
}
