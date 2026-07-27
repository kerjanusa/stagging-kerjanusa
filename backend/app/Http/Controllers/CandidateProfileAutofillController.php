<?php

namespace App\Http\Controllers;

use App\Requests\Auth\CandidateResumeAutofillRequest;
use App\Services\CandidateResumeAutofillService;
use Illuminate\Http\JsonResponse;

class CandidateProfileAutofillController extends Controller
{
    /**
     * Parse one uploaded candidate CV and return profile fields for frontend autofill.
     */
    public function __invoke(
        CandidateResumeAutofillRequest $request,
        CandidateResumeAutofillService $candidateResumeAutofillService
    ): JsonResponse {
        $autofill = $candidateResumeAutofillService->buildAutofillProfile(
            $request->file('candidate_resume_file'),
            $request->user()
        );
        $hasReadableText = (int) ($autofill['source']['textLength'] ?? 0) > 0;
        $filledFieldCount = count($autofill['filledFields'] ?? []);

        return response()->json([
            'message' => $hasReadableText && $filledFieldCount > 0
                ? 'CV berhasil dibaca. Field profil yang masih kosong dapat diisi otomatis dari CV.'
                : 'CV diterima, tetapi isi teksnya belum bisa dibaca otomatis. Lengkapi profil secara manual jika masih kosong.',
            'autofill' => $autofill,
        ]);
    }
}
