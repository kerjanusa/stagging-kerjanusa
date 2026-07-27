<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Throwable;

class CandidateResumeAutofillService
{
    private const MAX_EXTRACTED_TEXT_LENGTH = 30000;
    private const MAX_SECTION_LINES = 18;
    private const MAX_EXPERIENCE_ITEMS = 3;
    private const MAX_ORGANIZATION_ITEMS = 3;
    private const MAX_SKILL_ITEMS = 6;

    private const ROLE_KEYWORDS = [
        'account executive',
        'accountant',
        'admin',
        'analyst',
        'assistant',
        'barista',
        'cashier',
        'consultant',
        'content creator',
        'customer service',
        'data analyst',
        'designer',
        'developer',
        'digital marketing',
        'driver',
        'engineer',
        'finance',
        'graphic designer',
        'hr',
        'human resource',
        'kasir',
        'koordinator',
        'leader',
        'manager',
        'marketing',
        'operator',
        'programmer',
        'project manager',
        'sales',
        'software engineer',
        'staff',
        'supervisor',
        'waiter',
        'warehouse',
    ];

    private const COMPANY_KEYWORDS = [
        'bank',
        'company',
        'corp',
        'cv ',
        'group',
        'hospital',
        'hotel',
        'inc',
        'ltd',
        'pt ',
        'restaurant',
        'rs ',
        'school',
        'sekolah',
        'tbk',
        'universitas',
    ];

    private const SECTION_STOP_KEYWORDS = [
        'about',
        'achievement',
        'activities',
        'aktivitas',
        'award',
        'certification',
        'contact',
        'education',
        'experience',
        'experiences',
        'keahlian',
        'kemampuan',
        'kontak',
        'organisasi',
        'pendidikan',
        'pengalaman',
        'profile',
        'profil',
        'project',
        'projects',
        'sertifikasi',
        'skill',
        'skills',
        'summary',
        'tentang',
        'work',
    ];

    private const KNOWN_SKILLS = [
        'Microsoft Excel',
        'Microsoft Word',
        'PowerPoint',
        'Google Workspace',
        'Data Entry',
        'Administration',
        'Customer Service',
        'Sales',
        'Negotiation',
        'Digital Marketing',
        'SEO',
        'Google Ads',
        'Meta Ads',
        'Copywriting',
        'Content Creator',
        'Accounting',
        'Finance',
        'Tax',
        'Inventory',
        'Warehouse',
        'Logistics',
        'Leadership',
        'Communication',
        'Public Speaking',
        'Project Management',
        'Scrum',
        'Git',
        'SQL',
        'MySQL',
        'PostgreSQL',
        'PHP',
        'Laravel',
        'JavaScript',
        'React',
        'Node.js',
        'Python',
        'Java',
        'HTML',
        'CSS',
        'Figma',
        'UI/UX',
        'Canva',
        'Adobe Photoshop',
        'Adobe Illustrator',
        'AutoCAD',
    ];

    /**
     * Build a candidate-profile-shaped autofill payload from one uploaded CV.
     */
    public function buildAutofillProfile(UploadedFile $file, User $candidate): array
    {
        $text = $this->extractTextFromPdf($file);
        $lines = $this->buildLines($text);
        $profile = $this->buildProfilePayload($text, $lines, $file, $candidate);
        $filledFields = $this->filledProfileFields($profile);

        return [
            'profile' => $profile,
            'filledFields' => $filledFields,
            'missingRequiredFields' => $this->missingRequiredFields($profile),
            'confidence' => $this->buildConfidenceMap($profile),
            'source' => [
                'fileName' => $file->getClientOriginalName(),
                'textLength' => mb_strlen($text),
                'parser' => 'local_pdf_text_best_effort',
            ],
            'needsReview' => true,
        ];
    }

    /**
     * Extract readable text from common text-based PDF content streams.
     */
    private function extractTextFromPdf(UploadedFile $file): string
    {
        $path = $file->getRealPath();

        if (is_string($path)) {
            $parserText = $this->extractTextWithPdfParser($path);

            if ($parserText !== '') {
                return mb_substr($parserText, 0, self::MAX_EXTRACTED_TEXT_LENGTH);
            }
        }

        $content = is_string($path) ? @file_get_contents($path) : false;

        if (!is_string($content) || $content === '') {
            return '';
        }

        $segments = [];

        foreach ($this->extractPdfStreams($content) as $stream) {
            foreach ($this->decodePdfStreamCandidates($stream) as $candidateStream) {
                $streamText = $this->extractTextFromPdfContent($candidateStream);

                if ($streamText !== '') {
                    $segments[] = $streamText;
                }
            }
        }

        if (empty($segments)) {
            $rawText = $this->extractTextFromPdfContent($content);

            if ($rawText !== '') {
                $segments[] = $rawText;
            }
        }

        return mb_substr(
            $this->normalizeDocumentText(implode("\n", array_unique($segments))),
            0,
            self::MAX_EXTRACTED_TEXT_LENGTH
        );
    }

    /**
     * Use the Composer PDF parser first because most real CV PDFs compress text streams.
     */
    private function extractTextWithPdfParser(string $path): string
    {
        if (!class_exists(\Smalot\PdfParser\Parser::class)) {
            return '';
        }

        try {
            $parser = new \Smalot\PdfParser\Parser();
            $pdf = $parser->parseFile($path);

            return $this->normalizeDocumentText($pdf->getText());
        } catch (Throwable) {
            return '';
        }
    }

    /**
     * Pull raw stream bodies from the PDF file.
     */
    private function extractPdfStreams(string $content): array
    {
        if (!preg_match_all('/stream(?:\r\n|\n|\r)(.*?)(?:\r\n|\n|\r)?endstream/s', $content, $matches)) {
            return [];
        }

        return array_map(
            fn (string $stream): string => trim($stream, "\r\n"),
            $matches[1]
        );
    }

    /**
     * Return raw and deflated versions of one stream because PDFs differ in compression metadata.
     */
    private function decodePdfStreamCandidates(string $stream): array
    {
        $candidates = [$stream];
        $attempts = [
            @gzuncompress($stream),
            @gzdecode($stream),
            @gzinflate($stream),
            strlen($stream) > 6 ? @gzinflate(substr($stream, 2, -4)) : false,
        ];

        foreach ($attempts as $decodedStream) {
            if (is_string($decodedStream) && $decodedStream !== '') {
                $candidates[] = $decodedStream;
            }
        }

        return array_values(array_unique($candidates));
    }

    /**
     * Extract text tokens from PDF text objects.
     */
    private function extractTextFromPdfContent(string $content): string
    {
        $blocks = [];

        if (preg_match_all('/\bBT\b(.*?)\bET\b/s', $content, $matches)) {
            $blocks = $matches[1];
        } elseif (str_contains($content, ' Tj') || str_contains($content, ' TJ')) {
            $blocks = [$content];
        }

        $textBlocks = [];

        foreach ($blocks as $block) {
            $tokens = $this->extractPdfTextTokens($block);

            if (empty($tokens)) {
                continue;
            }

            $shortTokenCount = count(array_filter(
                $tokens,
                fn (string $token): bool => mb_strlen($token) <= 2
            ));
            $joiner = count($tokens) > 0 && $shortTokenCount / count($tokens) > 0.65 ? '' : "\n";
            $textBlocks[] = implode($joiner, $tokens);
        }

        return $this->normalizeDocumentText(implode("\n", $textBlocks));
    }

    /**
     * Scan one PDF text block for literal and hex string operands.
     */
    private function extractPdfTextTokens(string $block): array
    {
        $tokens = [];
        $length = strlen($block);
        $index = 0;

        while ($index < $length) {
            $character = $block[$index];

            if ($character === '(') {
                [$literal, $nextIndex] = $this->readPdfLiteralString($block, $index);
                $index = $nextIndex;
                $token = $this->cleanPdfTextToken($literal);

                if ($token !== '') {
                    $tokens[] = $token;
                }

                continue;
            }

            if ($character === '<' && ($block[$index + 1] ?? '') !== '<') {
                $nextIndex = strpos($block, '>', $index + 1);

                if ($nextIndex === false) {
                    break;
                }

                $token = $this->cleanPdfTextToken(
                    $this->decodePdfHexString(substr($block, $index + 1, $nextIndex - $index - 1))
                );

                if ($token !== '') {
                    $tokens[] = $token;
                }

                $index = $nextIndex + 1;
                continue;
            }

            $index++;
        }

        return $tokens;
    }

    /**
     * Read a parenthesized PDF literal string with escaped characters.
     */
    private function readPdfLiteralString(string $block, int $startIndex): array
    {
        $result = '';
        $depth = 1;
        $length = strlen($block);
        $index = $startIndex + 1;

        while ($index < $length && $depth > 0) {
            $character = $block[$index];

            if ($character === '\\') {
                [$escapedCharacter, $index] = $this->readPdfEscapedCharacter($block, $index);
                $result .= $escapedCharacter;
                continue;
            }

            if ($character === '(') {
                $depth++;
                $result .= $character;
                $index++;
                continue;
            }

            if ($character === ')') {
                $depth--;

                if ($depth > 0) {
                    $result .= $character;
                }

                $index++;
                continue;
            }

            $result .= $character;
            $index++;
        }

        return [$this->decodePdfStringBytes($result), $index];
    }

    /**
     * Decode one escaped character sequence from a PDF literal string.
     */
    private function readPdfEscapedCharacter(string $block, int $slashIndex): array
    {
        $nextIndex = $slashIndex + 1;
        $character = $block[$nextIndex] ?? '';

        if ($character === '') {
            return ['', $nextIndex];
        }

        if ($character === "\r" || $character === "\n") {
            while (isset($block[$nextIndex]) && ($block[$nextIndex] === "\r" || $block[$nextIndex] === "\n")) {
                $nextIndex++;
            }

            return ['', $nextIndex];
        }

        $escapeMap = [
            'n' => "\n",
            'r' => "\r",
            't' => "\t",
            'b' => "\b",
            'f' => "\f",
            '(' => '(',
            ')' => ')',
            '\\' => '\\',
        ];

        if (isset($escapeMap[$character])) {
            return [$escapeMap[$character], $nextIndex + 1];
        }

        if (preg_match('/[0-7]/', $character)) {
            $octal = $character;
            $cursor = $nextIndex + 1;

            while (strlen($octal) < 3 && isset($block[$cursor]) && preg_match('/[0-7]/', $block[$cursor])) {
                $octal .= $block[$cursor];
                $cursor++;
            }

            return [chr(octdec($octal)), $cursor];
        }

        return [$character, $nextIndex + 1];
    }

    /**
     * Decode a PDF hex string operand.
     */
    private function decodePdfHexString(string $hex): string
    {
        $normalizedHex = preg_replace('/[^0-9a-f]/i', '', $hex) ?? '';

        if ($normalizedHex === '') {
            return '';
        }

        if (strlen($normalizedHex) % 2 === 1) {
            $normalizedHex .= '0';
        }

        $bytes = @hex2bin($normalizedHex);

        return is_string($bytes) ? $this->decodePdfStringBytes($bytes) : '';
    }

    /**
     * Convert common PDF string encodings into UTF-8.
     */
    private function decodePdfStringBytes(string $bytes): string
    {
        if ($bytes === '') {
            return '';
        }

        if (str_starts_with($bytes, "\xFE\xFF")) {
            $converted = @mb_convert_encoding(substr($bytes, 2), 'UTF-8', 'UTF-16BE');

            return is_string($converted) ? $converted : '';
        }

        if (substr_count($bytes, "\0") > max(1, strlen($bytes) / 5)) {
            $converted = @mb_convert_encoding($bytes, 'UTF-8', 'UTF-16BE');

            if (is_string($converted) && $converted !== '') {
                return $converted;
            }
        }

        if (mb_check_encoding($bytes, 'UTF-8')) {
            return $bytes;
        }

        $converted = @mb_convert_encoding($bytes, 'UTF-8', 'Windows-1252, ISO-8859-1');

        return is_string($converted) ? $converted : '';
    }

    /**
     * Clean a raw token emitted from one PDF text object.
     */
    private function cleanPdfTextToken(string $token): string
    {
        $token = str_replace("\0", '', $token);
        $token = preg_replace('/[^\P{C}\n\t]+/u', '', $token) ?? $token;
        $token = preg_replace('/[ \t]+/u', ' ', $token) ?? $token;
        $token = trim($token);

        if ($token === '' || !preg_match('/[\pL\pN@]/u', $token)) {
            return '';
        }

        return $token;
    }

    /**
     * Normalize extracted document text without storing it.
     */
    private function normalizeDocumentText(string $text): string
    {
        $text = str_replace(["\r\n", "\r", "\f"], "\n", $text);
        $text = preg_replace('/([A-Za-z])-\n([A-Za-z])/u', '$1$2', $text) ?? $text;
        $text = preg_replace('/[ \t\x{00A0}]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/ *\n */u', "\n", $text) ?? $text;
        $text = preg_replace('/\n{3,}/u', "\n\n", $text) ?? $text;

        return trim($text);
    }

    /**
     * Build clean, non-empty lines from extracted text.
     */
    private function buildLines(string $text): array
    {
        return array_values(array_filter(array_map(
            fn (string $line): string => $this->cleanHumanText($line, 180),
            preg_split('/\n+/', $text) ?: []
        )));
    }

    /**
     * Build the frontend candidate profile shape.
     */
    private function buildProfilePayload(
        string $text,
        array $lines,
        UploadedFile $file,
        User $candidate
    ): array {
        $email = $this->extractEmail($text) ?: (string) ($candidate->email ?? '');
        $phone = $this->extractPhone($text) ?: (string) ($candidate->phone ?? '');
        $experiences = $this->extractExperiences($text, $lines);
        $education = $this->extractEducation($text, $lines);
        $role = $this->extractPreferredRole($text, $lines, $experiences);
        $skills = $this->extractSkills($text, $lines);
        $targetIndustry = $this->extractTargetIndustry($text, $role, $skills);
        $employmentType = $this->extractEmploymentType($text, !empty($experiences));
        $summary = $this->extractSummary($lines, $role, $experiences, $skills);
        $achievement = $this->extractAchievement($lines);

        return [
            'fullName' => $this->extractName($lines, $file) ?: (string) ($candidate->name ?? ''),
            'email' => $email,
            'phone' => $phone,
            'activeContactName' => '',
            'placeOfBirth' => $this->extractPlaceOfBirth($lines),
            'dateOfBirth' => $this->extractDateOfBirth($text),
            'currentAddress' => $this->extractAddress($lines),
            'gender' => $this->extractGender($lines),
            'age' => $this->extractAge($text),
            'profileSummary' => $summary,
            'employmentType' => $employmentType,
            'targetIndustry' => $targetIndustry,
            'linkedin' => $this->extractUrl($text, 'linkedin.com'),
            'instagram' => $this->extractUrl($text, 'instagram.com'),
            'tiktok' => $this->extractUrl($text, 'tiktok.com'),
            'otherSocial' => $this->extractOtherUrl($text),
            'education' => $education,
            'organizationActivities' => $this->extractOrganizationActivities($text, $lines),
            'experiences' => $this->padExperienceItems($experiences),
            'strengths' => $this->padStringList($summary ? [$summary] : [], 3),
            'achievements' => $this->padStringList($achievement ? [$achievement] : [], 3),
            'skills' => $this->padStringList($skills, self::MAX_SKILL_ITEMS),
            'preferredLocations' => $this->padStringList([], 5),
            'preferredRoles' => $this->padStringList($role ? [$role] : [], 5),
            'salaryMin' => $this->extractSalary($text),
            'salaryMax' => $this->extractSalary($text),
            'salaryPeriod' => 'bulan',
        ];
    }

    /**
     * Extract the first email address found in the CV.
     */
    private function extractEmail(string $text): string
    {
        return preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $text, $match)
            ? $this->cleanHumanText($match[0], 255)
            : '';
    }

    /**
     * Extract and normalize one Indonesian phone-like value.
     */
    private function extractPhone(string $text): string
    {
        if (!preg_match_all('/(?:\+?62|0)\s*(?:[\d][\d\s().-]{7,18}\d)/', $text, $matches)) {
            return '';
        }

        foreach ($matches[0] as $candidatePhone) {
            $normalizedPhone = User::normalizePhone($candidatePhone);
            $digits = preg_replace('/\D/', '', $normalizedPhone ?? '') ?? '';

            if (strlen($digits) >= 9 && strlen($digits) <= 15) {
                return $normalizedPhone ?? '';
            }
        }

        return '';
    }

    /**
     * Extract a likely candidate name from labels, header lines, or the file name.
     */
    private function extractName(array $lines, UploadedFile $file): string
    {
        $labeledName = $this->extractLabeledValue($lines, [
            'nama lengkap',
            'nama',
            'full name',
            'name',
        ]);

        if ($this->looksLikePersonName($labeledName)) {
            return $this->normalizeName($labeledName);
        }

        foreach (array_slice($lines, 0, 14) as $line) {
            if ($this->looksLikePersonName($line)) {
                return $this->normalizeName($line);
            }
        }

        $fileName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $fileName = preg_replace('/\b(cv|resume|curriculum|vitae|lamaran|kerja)\b/i', ' ', $fileName) ?? '';
        $fileName = preg_replace('/[_-]+/', ' ', $fileName) ?? $fileName;

        return $this->looksLikePersonName($fileName) ? $this->normalizeName($fileName) : '';
    }

    /**
     * Decide whether one line is plausible as a human name.
     */
    private function looksLikePersonName(?string $value): bool
    {
        $value = $this->cleanHumanText((string) $value, 80);

        if ($value === '') {
            return false;
        }

        if (
            preg_match('/[@\d]/', $value) ||
            preg_match('/\b(cv|resume|curriculum|vitae|portfolio|profil|profile|alamat|address|phone|email|linkedin|skills?|education|experience)\b/i', $value)
        ) {
            return false;
        }

        $wordCount = count(preg_split('/\s+/', $value) ?: []);

        return $wordCount >= 1 &&
            $wordCount <= 5 &&
            preg_match('/^[\pL .\'-]+$/u', $value) === 1 &&
            mb_strlen($value) >= 3;
    }

    /**
     * Normalize a detected person name into readable casing.
     */
    private function normalizeName(string $value): string
    {
        $value = preg_replace('/\s+/', ' ', trim($value)) ?? trim($value);

        if ($value === mb_strtoupper($value)) {
            return mb_convert_case(mb_strtolower($value), MB_CASE_TITLE, 'UTF-8');
        }

        return $value;
    }

    /**
     * Extract a labeled place of birth value when present.
     */
    private function extractPlaceOfBirth(array $lines): string
    {
        return $this->extractLabeledValue($lines, [
            'tempat lahir',
            'birth place',
            'place of birth',
        ], 80);
    }

    /**
     * Extract a birth date and convert it into HTML date-input format where possible.
     */
    private function extractDateOfBirth(string $text): string
    {
        $datePattern = '/(?:tanggal lahir|date of birth|birth date|ttl)\s*[:\-]?\s*(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ]((?:19|20)\d{2})/i';

        if (!preg_match($datePattern, $text, $match)) {
            return '';
        }

        $day = (int) $match[1];
        $month = (int) $match[2];
        $year = (int) $match[3];

        return checkdate($month, $day, $year)
            ? sprintf('%04d-%02d-%02d', $year, $month, $day)
            : '';
    }

    /**
     * Extract age from explicit age labels.
     */
    private function extractAge(string $text): string
    {
        if (!preg_match('/(?:usia|umur|age)\s*[:\-]?\s*(\d{1,3})\s*(?:tahun|years?|yo)?/i', $text, $match)) {
            return '';
        }

        $age = (int) $match[1];

        return $age >= 15 && $age <= 80 ? (string) $age : '';
    }

    /**
     * Extract gender only from explicit labels.
     */
    private function extractGender(array $lines): string
    {
        $gender = mb_strtolower($this->extractLabeledValue($lines, [
            'jenis kelamin',
            'gender',
            'sex',
        ], 60));

        if ($gender === '') {
            return '';
        }

        if (preg_match('/\b(laki|pria|male|man)\b/i', $gender)) {
            return 'male';
        }

        if (preg_match('/\b(perempuan|wanita|female|woman)\b/i', $gender)) {
            return 'female';
        }

        return '';
    }

    /**
     * Extract a likely address or domicile line.
     */
    private function extractAddress(array $lines): string
    {
        $labeledAddress = $this->extractLabeledValue($lines, [
            'alamat domisili',
            'domisili',
            'alamat',
            'address',
            'current address',
            'location',
            'lokasi',
        ], 160);

        if ($this->looksLikeAddress($labeledAddress)) {
            return $labeledAddress;
        }

        foreach (array_slice($lines, 0, 24) as $line) {
            if ($this->looksLikeAddress($line)) {
                return $line;
            }
        }

        return '';
    }

    /**
     * Check whether one line looks like an address or city/domicile.
     */
    private function looksLikeAddress(?string $line): bool
    {
        $line = $this->cleanHumanText((string) $line, 180);

        if ($line === '' || preg_match('/[@]|https?:\/\//i', $line)) {
            return false;
        }

        return preg_match(
            '/\b(alamat|domisili|jalan|jl\.?|kota|kabupaten|jakarta|bandung|surabaya|tangerang|bekasi|bogor|depok|semarang|yogyakarta|medan|makassar|denpasar|malang|batam|palembang|pekanbaru|balikpapan|samarinda|pontianak|padang|cirebon|surakarta|solo)\b/i',
            $line
        ) === 1;
    }

    /**
     * Extract desired or latest role.
     */
    private function extractPreferredRole(string $text, array $lines, array $experiences): string
    {
        $labeledRole = $this->extractLabeledValue($lines, [
            'posisi yang diminati',
            'posisi dilamar',
            'desired position',
            'target position',
            'objective',
            'career objective',
        ], 90);

        if ($this->looksLikeRole($labeledRole)) {
            return $labeledRole;
        }

        foreach (array_slice($lines, 0, 18) as $line) {
            if ($this->looksLikeRole($line) && !$this->looksLikeCompany($line)) {
                return $this->cleanRoleLine($line);
            }
        }

        $latestPosition = $experiences[0]['position'] ?? '';

        if ($latestPosition !== '') {
            return $latestPosition;
        }

        foreach (self::ROLE_KEYWORDS as $keyword) {
            if (preg_match('/\b' . preg_quote($keyword, '/') . '\b/i', $text)) {
                return mb_convert_case($keyword, MB_CASE_TITLE, 'UTF-8');
            }
        }

        return '';
    }

    /**
     * Extract preferred employment type, using full-time as a low-risk default for work CVs.
     */
    private function extractEmploymentType(string $text, bool $hasExperience): string
    {
        $normalizedText = mb_strtolower($text);

        if (preg_match('/\b(part[- ]?time|paruh waktu)\b/i', $normalizedText)) {
            return 'Part-time';
        }

        if (preg_match('/\b(freelance|freelancer|lepas)\b/i', $normalizedText)) {
            return 'Freelance';
        }

        if (preg_match('/\b(magang|internship|intern)\b/i', $normalizedText)) {
            return 'Magang';
        }

        if (preg_match('/\b(contract|kontrak|pkwt)\b/i', $normalizedText)) {
            return 'Kontrak';
        }

        if (preg_match('/\b(full[- ]?time|tetap|permanent)\b/i', $normalizedText) || $hasExperience) {
            return 'Full-time / Tetap';
        }

        return '';
    }

    /**
     * Infer a broad target industry from explicit role and skill keywords.
     */
    private function extractTargetIndustry(string $text, string $role, array $skills): string
    {
        $haystack = mb_strtolower(implode(' ', [$text, $role, ...$skills]));
        $industryRules = [
            'Teknologi Informasi' => ['software', 'developer', 'programmer', 'data analyst', 'sql', 'php', 'laravel', 'react', 'javascript', 'it support', 'network'],
            'Keuangan' => ['accounting', 'finance', 'tax', 'akuntansi', 'keuangan', 'auditor'],
            'Sales & Marketing' => ['sales', 'marketing', 'seo', 'google ads', 'meta ads', 'brand', 'account executive'],
            'Human Resources' => ['human resource', 'hr ', 'recruitment', 'talent acquisition'],
            'Operasional / Logistik' => ['operational', 'operasional', 'warehouse', 'gudang', 'inventory', 'logistic', 'logistik', 'supply chain'],
            'Kreatif / Desain' => ['designer', 'design', 'ui/ux', 'figma', 'photoshop', 'illustrator', 'content creator'],
            'Pendidikan' => ['teacher', 'guru', 'teaching', 'pendidikan', 'sekolah'],
            'Kesehatan' => ['nurse', 'perawat', 'dokter', 'hospital', 'rumah sakit', 'klinik'],
            'F&B / Hospitality' => ['barista', 'waiter', 'restaurant', 'hotel', 'hospitality', 'kitchen', 'chef'],
            'Retail' => ['retail', 'store', 'cashier', 'kasir', 'merchandiser'],
        ];

        foreach ($industryRules as $industry => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($haystack, mb_strtolower($keyword))) {
                    return $industry;
                }
            }
        }

        return '';
    }

    /**
     * Extract education details from education sections and degree keywords.
     */
    private function extractEducation(string $text, array $lines): array
    {
        $educationLines = $this->extractSectionLines($lines, [
            'pendidikan',
            'riwayat pendidikan',
            'education',
            'academic background',
        ], 22);
        $educationText = implode("\n", $educationLines) ?: $text;
        $degree = $this->extractDegree($educationText);
        $institution = '';
        $major = '';

        foreach ($educationLines as $line) {
            if ($institution === '' && preg_match('/\b(universitas|university|institut|institute|politeknik|polytechnic|akademi|academy|sekolah|sma|smk)\b/i', $line)) {
                $institution = $this->cleanHumanText($line, 120);
            }

            if ($major === '') {
                $major = $this->extractMajorFromLine($line);
            }
        }

        if ($major === '') {
            $major = $this->extractMajorFromLine($educationText);
        }

        [$startYear, $endYear] = $this->extractYearRange($educationText);

        return [
            'degree' => $degree,
            'institution' => $institution,
            'major' => $major,
            'startYear' => $startYear,
            'endYear' => $endYear,
        ];
    }

    /**
     * Map common degree labels into the frontend option set.
     */
    private function extractDegree(string $text): string
    {
        if (preg_match('/\b(s3|doktor|doctor|ph\.?d)\b/i', $text)) {
            return 'S3 - Doktor';
        }

        if (preg_match('/\b(s2|magister|master)\b/i', $text)) {
            return 'S2 - Magister';
        }

        if (preg_match('/\b(s1|sarjana|bachelor)\b/i', $text)) {
            return 'S1 - Sarjana';
        }

        if (preg_match('/\b(d3|diploma 3)\b/i', $text)) {
            return 'D3';
        }

        if (preg_match('/\b(d1|d2|diploma 1|diploma 2)\b/i', $text)) {
            return 'D1 / D2';
        }

        if (preg_match('/\b(sma|smk|slta|high school|vocational school)\b/i', $text)) {
            return 'SMA / SMK';
        }

        return '';
    }

    /**
     * Extract a major or study program from one line.
     */
    private function extractMajorFromLine(string $line): string
    {
        $patterns = [
            '/(?:jurusan|program studi|prodi|major|field of study)\s*[:\-]?\s*([^\n,;|]+)/i',
            '/\b(?:s1|s2|s3|d3)\s*[- ]\s*([^\n,;|]+)/i',
            '/\b(?:sarjana|magister|bachelor|master)\s+(?:of|in)?\s*([^\n,;|]+)/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $line, $match)) {
                return $this->cleanHumanText($match[1], 80);
            }
        }

        return '';
    }

    /**
     * Extract up to three work experience entries.
     */
    private function extractExperiences(string $text, array $lines): array
    {
        $experienceLines = $this->extractSectionLines($lines, [
            'pengalaman kerja',
            'riwayat pekerjaan',
            'work experience',
            'professional experience',
            'employment history',
            'experience',
            'pengalaman',
        ], 46);

        if (empty($experienceLines)) {
            $experienceLines = array_values(array_filter(
                $lines,
                fn (string $line): bool => $this->looksLikeRole($line) || $this->looksLikeCompany($line)
            ));
        }

        $experienceText = implode("\n", $experienceLines) ?: $text;
        $chunks = $this->splitExperienceChunks($experienceLines);
        $experiences = [];

        foreach ($chunks as $chunkLines) {
            $experience = $this->buildExperienceFromLines($chunkLines);

            if ($experience['position'] !== '' || $experience['company'] !== '') {
                $experiences[] = $experience;
            }

            if (count($experiences) >= self::MAX_EXPERIENCE_ITEMS) {
                break;
            }
        }

        if (empty($experiences)) {
            $fallbackExperience = $this->buildExperienceFromLines($experienceLines);

            if ($fallbackExperience['position'] !== '' || $fallbackExperience['company'] !== '') {
                $experiences[] = $fallbackExperience;
            }
        }

        if (!empty($experiences) && $experiences[0]['startYear'] === '' && $experiences[0]['endYear'] === '') {
            [$startYear, $endYear] = $this->extractYearRange($experienceText);
            $experiences[0]['startYear'] = $startYear;
            $experiences[0]['endYear'] = $endYear;
            $experiences[0]['year'] = $this->buildYearRangeLabel($startYear, $endYear);
        }

        return $experiences;
    }

    /**
     * Split experience section lines into rough entries.
     */
    private function splitExperienceChunks(array $lines): array
    {
        $chunks = [];
        $currentChunk = [];

        foreach ($lines as $line) {
            $currentChunkHasDate = $this->chunkHasYearRange($currentChunk);
            $isNewEntry = !empty($currentChunk) && (
                ($this->lineHasYearRange($line) && $currentChunkHasDate) ||
                ($this->looksLikeRole($line) && $currentChunkHasDate && count($currentChunk) >= 2)
            );

            if ($isNewEntry) {
                $chunks[] = $currentChunk;
                $currentChunk = [];
            }

            $currentChunk[] = $line;
        }

        if (!empty($currentChunk)) {
            $chunks[] = $currentChunk;
        }

        return $chunks;
    }

    /**
     * Check whether any line in one chunk already contains a date or year range.
     */
    private function chunkHasYearRange(array $lines): bool
    {
        foreach ($lines as $line) {
            if ($this->lineHasYearRange($line)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build one experience object from nearby lines.
     */
    private function buildExperienceFromLines(array $lines): array
    {
        $experience = $this->emptyExperienceItem();
        $text = implode("\n", $lines);
        [$startYear, $endYear] = $this->extractYearRange($text);
        $experience['startYear'] = $startYear;
        $experience['endYear'] = $endYear;
        $experience['year'] = $this->buildYearRangeLabel($startYear, $endYear);

        foreach ($lines as $line) {
            $parsedPair = $this->parseRoleCompanyPair($line);

            if ($parsedPair) {
                $experience['position'] = $experience['position'] ?: $parsedPair['position'];
                $experience['company'] = $experience['company'] ?: $parsedPair['company'];
                continue;
            }

            if ($experience['company'] === '' && $this->looksLikeCompany($line)) {
                $experience['company'] = $this->cleanCompanyLine($line);
                continue;
            }

            if ($experience['position'] === '' && $this->looksLikeRole($line)) {
                $experience['position'] = $this->cleanRoleLine($line);
            }
        }

        $descriptionLines = array_values(array_filter($lines, function (string $line) use ($experience): bool {
            if ($this->lineHasYearRange($line) || $line === $experience['position'] || $line === $experience['company']) {
                return false;
            }

            return mb_strlen($line) >= 18 &&
                !$this->looksLikeSectionHeading($line) &&
                !$this->looksLikeCompany($line);
        }));
        $experience['responsibilities'] = $this->cleanHumanText(implode(' ', array_slice($descriptionLines, 0, 3)), 700);

        return $experience;
    }

    /**
     * Parse common "Role at Company" or "Company - Role" lines.
     */
    private function parseRoleCompanyPair(string $line): ?array
    {
        $line = $this->cleanHumanText($line, 140);

        if ($line === '') {
            return null;
        }

        $lineWithoutDates = $this->cleanHumanText($this->stripDateRanges($line), 140);
        $separatorParts = array_values(array_filter(array_map(
            fn (string $part): string => $this->cleanHumanText($part, 90),
            preg_split('/\s+(?:[|]|-{1,2}|–|—)\s+/', $lineWithoutDates) ?: []
        )));

        if (count($separatorParts) >= 2) {
            $pair = $this->buildRoleCompanyPairFromParts($separatorParts);

            if ($pair) {
                return $pair;
            }
        }

        $patterns = [
            '/^(.{3,70}?)\s+(?:at|di|@)\s+(.{3,90})$/i',
            '/^(.{3,90}?)\s*,\s+(.{3,90})$/i',
        ];

        foreach ($patterns as $pattern) {
            if (!preg_match($pattern, $lineWithoutDates, $match)) {
                continue;
            }

            $first = $this->cleanHumanText($match[1], 90);
            $second = $this->cleanHumanText($match[2], 90);
            $firstIsRole = $this->looksLikeRole($first);
            $secondIsRole = $this->looksLikeRole($second);
            $firstIsCompany = $this->looksLikeCompany($first);
            $secondIsCompany = $this->looksLikeCompany($second);

            if ($firstIsRole || $secondIsCompany) {
                return [
                    'position' => $this->cleanRoleLine($first),
                    'company' => $this->cleanCompanyLine($second),
                ];
            }

            if ($secondIsRole || $firstIsCompany) {
                return [
                    'position' => $this->cleanRoleLine($second),
                    'company' => $this->cleanCompanyLine($first),
                ];
            }
        }

        return $this->parseMixedRoleCompanyLine($lineWithoutDates);
    }

    /**
     * Parse lines where a role and company appear together without a clean separator.
     */
    private function parseMixedRoleCompanyLine(string $line): ?array
    {
        if (!$this->looksLikeRole($line) || !$this->looksLikeCompany($line)) {
            return null;
        }

        $companyPattern = '/\b((?:pt\.?|cv\.?|bank|rs|rumah sakit|hotel|universitas|sekolah|group)\s+[\pL\pN&.,\' -]{3,})$/iu';

        if (preg_match($companyPattern, $line, $match, PREG_OFFSET_CAPTURE)) {
            $company = $this->cleanCompanyLine($match[1][0]);
            $role = $this->cleanRoleLine(substr($line, 0, $match[1][1]));

            if ($role !== '' || $company !== '') {
                return [
                    'position' => $role,
                    'company' => $company,
                ];
            }
        }

        foreach (self::ROLE_KEYWORDS as $roleKeyword) {
            if (!preg_match('/\b' . preg_quote($roleKeyword, '/') . '\b/i', $line, $match, PREG_OFFSET_CAPTURE)) {
                continue;
            }

            $roleStart = $match[0][1];
            $role = $this->cleanRoleLine(substr($line, $roleStart, strlen($match[0][0])));
            $beforeRole = $this->cleanCompanyLine(substr($line, 0, $roleStart));
            $afterRole = $this->cleanCompanyLine(substr($line, $roleStart + strlen($match[0][0])));
            $company = $this->looksLikeCompany($beforeRole) ? $beforeRole : $afterRole;

            if ($role !== '' && $company !== '') {
                return [
                    'position' => $role,
                    'company' => $company,
                ];
            }
        }

        return null;
    }

    /**
     * Build role/company values from separator-delimited experience parts.
     */
    private function buildRoleCompanyPairFromParts(array $parts): ?array
    {
        $role = '';
        $company = '';

        foreach ($parts as $part) {
            if ($role === '' && $this->looksLikeRole($part)) {
                $role = $this->cleanRoleLine($part);
                continue;
            }

            if ($company === '' && $this->looksLikeCompany($part)) {
                $company = $this->cleanCompanyLine($part);
            }
        }

        if ($role === '' && $company !== '') {
            foreach ($parts as $part) {
                if ($this->cleanHumanText($part, 90) !== $company) {
                    $role = $this->cleanRoleLine($part);
                    break;
                }
            }
        }

        if ($company === '' && $role !== '') {
            foreach ($parts as $part) {
                if ($this->cleanHumanText($part, 90) !== $role) {
                    $company = $this->cleanCompanyLine($part);
                    break;
                }
            }
        }

        if ($role === '' && $company === '' && count($parts) >= 2) {
            $role = $this->cleanRoleLine($parts[0]);
            $company = $this->cleanCompanyLine($parts[1]);
        }

        return $role !== '' || $company !== ''
            ? [
                'position' => $role,
                'company' => $company,
            ]
            : null;
    }

    /**
     * Extract organization or volunteer activities.
     */
    private function extractOrganizationActivities(string $text, array $lines): array
    {
        $organizationLines = $this->extractSectionLines($lines, [
            'organisasi',
            'organizational experience',
            'organization',
            'volunteer',
            'relawan',
            'activities',
            'aktivitas',
        ], 26);
        $activities = [];

        if (!empty($organizationLines)) {
            $activity = [
                'organizationName' => '',
                'role' => '',
                'startYear' => '',
                'endYear' => '',
                'description' => '',
            ];
            [$activity['startYear'], $activity['endYear']] = $this->extractYearRange(implode("\n", $organizationLines));

            foreach ($organizationLines as $line) {
                if ($activity['organizationName'] === '' && !$this->looksLikeRole($line) && !$this->lineHasYearRange($line)) {
                    $activity['organizationName'] = $this->cleanHumanText($line, 90);
                    continue;
                }

                if ($activity['role'] === '' && $this->looksLikeRole($line)) {
                    $activity['role'] = $this->cleanRoleLine($line);
                }
            }

            $activity['description'] = $this->cleanHumanText(implode(' ', array_slice($organizationLines, 1, 3)), 500);

            if ($activity['organizationName'] !== '' || $activity['role'] !== '') {
                $activities[] = $activity;
            }
        }

        return $this->padOrganizationItems($activities);
    }

    /**
     * Extract skill names from explicit skill sections or known keyword matches.
     */
    private function extractSkills(string $text, array $lines): array
    {
        $skills = [];
        $skillLines = $this->extractSectionLines($lines, [
            'keahlian',
            'kemampuan',
            'skills',
            'technical skills',
            'core skills',
            'kompetensi',
        ], 20);

        if (!empty($skillLines)) {
            $parts = preg_split('/[,;|\/]|(?:\s+-\s+)|(?:\n+)/u', implode("\n", $skillLines)) ?: [];

            foreach ($parts as $part) {
                $skill = $this->cleanSkill($part);

                if ($skill !== '' && !in_array(mb_strtolower($skill), array_map('mb_strtolower', $skills), true)) {
                    $skills[] = $skill;
                }

                if (count($skills) >= self::MAX_SKILL_ITEMS) {
                    break;
                }
            }
        }

        if (count($skills) < self::MAX_SKILL_ITEMS) {
            $normalizedText = mb_strtolower($text);

            foreach (self::KNOWN_SKILLS as $knownSkill) {
                if ($this->textContainsKnownSkill($normalizedText, $knownSkill)) {
                    $skills[] = $knownSkill;
                }

                $skills = array_values(array_unique($skills));

                if (count($skills) >= self::MAX_SKILL_ITEMS) {
                    break;
                }
            }
        }

        return array_slice($skills, 0, self::MAX_SKILL_ITEMS);
    }

    /**
     * Match known skills as whole terms so "Digital" does not produce "Git".
     */
    private function textContainsKnownSkill(string $normalizedText, string $knownSkill): bool
    {
        $normalizedSkill = mb_strtolower($knownSkill);
        $pattern = '/(?<![\pL\pN])' . preg_quote($normalizedSkill, '/') . '(?![\pL\pN])/iu';

        return preg_match($pattern, $normalizedText) === 1;
    }

    /**
     * Clean one potential skill token.
     */
    private function cleanSkill(string $value): string
    {
        $value = preg_replace('/^[\s\-*•]+/u', '', $value) ?? $value;
        $value = preg_replace('/\b(skills?|keahlian|kemampuan|kompetensi|technical)\b\s*[:\-]?/i', '', $value) ?? $value;
        $value = $this->cleanHumanText($value, 48);

        if (
            $value === '' ||
            preg_match('/[@]|\b(education|experience|pengalaman|pendidikan|contact|kontak)\b/i', $value) ||
            count(preg_split('/\s+/', $value) ?: []) > 5
        ) {
            return '';
        }

        return $value;
    }

    /**
     * Extract a compact profile summary.
     */
    private function extractSummary(array $lines, string $role, array $experiences, array $skills): string
    {
        $summaryLines = $this->extractSectionLines($lines, [
            'ringkasan',
            'summary',
            'profile',
            'profil',
            'tentang saya',
            'about me',
            'objective',
        ], 8);
        $summary = $this->cleanHumanText(implode(' ', $summaryLines), 800);

        if ($summary !== '') {
            return $summary;
        }

        $latestCompany = $experiences[0]['company'] ?? '';
        $skillText = implode(', ', array_slice($skills, 0, 3));
        $parts = [];

        if ($role !== '') {
            $parts[] = "Kandidat dengan fokus pada {$role}";
        }

        if ($latestCompany !== '') {
            $parts[] = "berpengalaman di {$latestCompany}";
        }

        if ($skillText !== '') {
            $parts[] = "memiliki kemampuan {$skillText}";
        }

        return $parts ? $this->cleanHumanText(implode(' dan ', $parts) . '.', 800) : '';
    }

    /**
     * Extract one notable achievement or award section.
     */
    private function extractAchievement(array $lines): string
    {
        $achievementLines = $this->extractSectionLines($lines, [
            'pencapaian',
            'penghargaan',
            'achievement',
            'achievements',
            'award',
            'awards',
        ], 8);

        return $this->cleanHumanText(implode(' ', $achievementLines), 500);
    }

    /**
     * Extract expected salary when explicitly written in the resume.
     */
    private function extractSalary(string $text): string
    {
        if (!preg_match('/(?:ekspektasi gaji|expected salary|salary expectation|gaji)\s*[:\-]?\s*(?:rp\.?\s*)?([0-9][0-9., ]{5,})/i', $text, $match)) {
            return '';
        }

        $digits = preg_replace('/\D/', '', $match[1]) ?? '';

        return strlen($digits) >= 6 ? substr($digits, 0, 12) : '';
    }

    /**
     * Extract a social/profile URL for a specific domain.
     */
    private function extractUrl(string $text, string $domain): string
    {
        $pattern = '/(?:https?:\/\/)?(?:www\.)?' . preg_quote($domain, '/') . '\/[^\s,;)]+/i';

        return preg_match($pattern, $text, $match)
            ? $this->normalizeUrl($match[0])
            : '';
    }

    /**
     * Extract another portfolio URL while avoiding already mapped social domains.
     */
    private function extractOtherUrl(string $text): string
    {
        if (!preg_match_all('/(?:https?:\/\/)?(?:www\.)?(?:github\.com|behance\.net|dribbble\.com|medium\.com|[a-z0-9.-]+\.[a-z]{2,})\/[^\s,;)]+/i', $text, $matches)) {
            return '';
        }

        foreach ($matches[0] as $url) {
            if (!preg_match('/(linkedin|instagram|tiktok)\.com/i', $url)) {
                return $this->normalizeUrl($url);
            }
        }

        return '';
    }

    /**
     * Normalize URL by adding a scheme and stripping trailing punctuation.
     */
    private function normalizeUrl(string $url): string
    {
        $url = rtrim($this->cleanHumanText($url, 255), '.,;:)');

        if ($url !== '' && !preg_match('/^https?:\/\//i', $url)) {
            $url = 'https://' . $url;
        }

        return $url;
    }

    /**
     * Extract section lines after matching a heading until another likely heading appears.
     */
    private function extractSectionLines(array $lines, array $headings, int $maxLines = self::MAX_SECTION_LINES): array
    {
        foreach ($lines as $index => $line) {
            $matchedHeading = $this->matchedHeading($line, $headings);

            if ($matchedHeading === '') {
                continue;
            }

            $sectionLines = [];
            $afterHeading = trim((string) preg_replace('/^.*?' . preg_quote($matchedHeading, '/') . '\s*[:\-]?\s*/i', '', $line));

            if ($afterHeading !== '' && mb_strtolower($afterHeading) !== mb_strtolower($line)) {
                $sectionLines[] = $this->cleanHumanText($afterHeading);
            }

            for ($cursor = $index + 1; $cursor < count($lines) && count($sectionLines) < $maxLines; $cursor++) {
                $nextLine = $lines[$cursor];

                if ($this->looksLikeSectionHeading($nextLine)) {
                    break;
                }

                $sectionLines[] = $nextLine;
            }

            return array_values(array_filter($sectionLines));
        }

        return [];
    }

    /**
     * Return the heading text found in one line.
     */
    private function matchedHeading(string $line, array $headings): string
    {
        $normalizedLine = mb_strtolower($line);

        foreach ($headings as $heading) {
            $normalizedHeading = mb_strtolower($heading);

            if (
                $normalizedLine === $normalizedHeading ||
                str_starts_with($normalizedLine, $normalizedHeading . ':') ||
                str_starts_with($normalizedLine, $normalizedHeading . ' -') ||
                preg_match('/\b' . preg_quote($normalizedHeading, '/') . '\b/i', $normalizedLine)
            ) {
                return $heading;
            }
        }

        return '';
    }

    /**
     * Detect common CV section headings.
     */
    private function looksLikeSectionHeading(string $line): bool
    {
        $normalizedLine = mb_strtolower(trim($line));

        if ($normalizedLine === '' || mb_strlen($normalizedLine) > 42) {
            return false;
        }

        foreach (self::SECTION_STOP_KEYWORDS as $keyword) {
            if (
                $normalizedLine === $keyword ||
                str_starts_with($normalizedLine, $keyword . ':') ||
                str_starts_with($normalizedLine, $keyword . ' -')
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extract a labeled value from nearby lines.
     */
    private function extractLabeledValue(array $lines, array $labels, int $maxLength = 120): string
    {
        foreach ($lines as $index => $line) {
            foreach ($labels as $label) {
                if (preg_match('/\b' . preg_quote($label, '/') . '\b\s*[:\-]?\s*(.+)$/i', $line, $match)) {
                    $value = $this->cleanHumanText($match[1], $maxLength);

                    if ($value !== '' && mb_strtolower($value) !== mb_strtolower($line)) {
                        return $value;
                    }
                }

                if (preg_match('/^\s*' . preg_quote($label, '/') . '\s*$/i', $line)) {
                    $nextLine = $lines[$index + 1] ?? '';
                    $value = $this->cleanHumanText($nextLine, $maxLength);

                    if ($value !== '' && !$this->looksLikeSectionHeading($value)) {
                        return $value;
                    }
                }
            }
        }

        return '';
    }

    /**
     * Determine whether one line includes a work role keyword.
     */
    private function looksLikeRole(?string $line): bool
    {
        $line = mb_strtolower($this->cleanHumanText((string) $line, 120));

        if ($line === '' || preg_match('/[@]|\b(email|phone|alamat|address|education|pendidikan)\b/i', $line)) {
            return false;
        }

        foreach (self::ROLE_KEYWORDS as $keyword) {
            if (str_contains($line, $keyword)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determine whether one line includes a company or institution signal.
     */
    private function looksLikeCompany(?string $line): bool
    {
        $line = mb_strtolower($this->cleanHumanText((string) $line, 140));

        if ($line === '' || preg_match('/[@]|\b(email|phone|alamat|address)\b/i', $line)) {
            return false;
        }

        foreach (self::COMPANY_KEYWORDS as $keyword) {
            if (str_contains($line, $keyword)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Clean role lines from bullets, years, and section words.
     */
    private function cleanRoleLine(string $line): string
    {
        $line = $this->stripDateRanges($line);
        $line = preg_replace('/\b(position|jabatan|role|posisi)\b\s*[:\-]?/i', '', $line) ?? $line;

        return $this->cleanHumanText($line, 90);
    }

    /**
     * Clean company lines from bullets and year ranges.
     */
    private function cleanCompanyLine(string $line): string
    {
        $line = $this->stripDateRanges($line);

        return $this->cleanHumanText($line, 90);
    }

    /**
     * Extract one valid year range, preserving "current" work status.
     */
    private function extractYearRange(string $text): array
    {
        $currentYear = (int) date('Y');
        $minimumYear = $currentYear - 50;

        $dateTokenPattern = $this->dateTokenPattern();
        $rangePattern = '/(' . $dateTokenPattern . ')\s*(?:-|–|—|to|sampai|hingga|s\/d|sd)\s*(' . $dateTokenPattern . ')/iu';

        if (preg_match($rangePattern, $text, $rangeMatch)) {
            $startYear = $this->extractYearFromDateToken($rangeMatch[1], $minimumYear, $currentYear);
            $endYear = $this->isCurrentDateToken($rangeMatch[2])
                ? 'current'
                : $this->extractYearFromDateToken($rangeMatch[2], $minimumYear, $currentYear);

            if ($startYear !== '' || $endYear !== '') {
                return [$startYear, $endYear];
            }
        }

        preg_match_all('/\b(19|20)\d{2}\b/', $text, $matches);
        $years = array_values(array_unique(array_filter(
            array_map('intval', $matches[0] ?? []),
            fn (int $year): bool => $year >= $minimumYear && $year <= $currentYear
        )));

        if (count($years) >= 2) {
            sort($years);

            return [(string) $years[0], (string) $years[1]];
        }

        if (count($years) === 1) {
            $hasCurrent = preg_match('/\b(current|present|now|sekarang|saat ini|masih bekerja|masih aktif)\b/i', $text);

            return [(string) $years[0], $hasCurrent ? 'current' : ''];
        }

        return ['', ''];
    }

    /**
     * Build a reusable token pattern for year-only and month-year ranges.
     */
    private function dateTokenPattern(): string
    {
        $monthPattern = 'jan(?:uari|uary)?|feb(?:ruari|ruary)?|mar(?:et|ch)?|apr(?:il)?|mei|may|jun(?:i|e)?|jul(?:i|y)?|agu(?:stus)?|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?';

        return '(?:(?:' . $monthPattern . ')\s+)?(?:(?:19|20)\d{2}|present|current|now|sekarang|saat ini|masih bekerja|masih aktif)';
    }

    /**
     * Extract a normalized year from a date token.
     */
    private function extractYearFromDateToken(string $token, int $minimumYear, int $currentYear): string
    {
        if (!preg_match('/\b(19|20)\d{2}\b/', $token, $match)) {
            return '';
        }

        $year = (int) $match[0];

        return $year >= $minimumYear && $year <= $currentYear ? (string) $year : '';
    }

    /**
     * Detect current-work/ongoing date tokens.
     */
    private function isCurrentDateToken(string $token): bool
    {
        return preg_match('/\b(present|current|now|sekarang|saat ini|masih bekerja|masih aktif)\b/i', $token) === 1;
    }

    /**
     * Remove common date ranges from one line before role/company parsing.
     */
    private function stripDateRanges(string $line): string
    {
        $dateTokenPattern = $this->dateTokenPattern();
        $line = preg_replace(
            '/\(?\b' . $dateTokenPattern . '\s*(?:-|–|—|to|sampai|hingga|s\/d|sd)\s*' . $dateTokenPattern . '\b\)?/iu',
            ' ',
            $line
        ) ?? $line;
        $line = preg_replace('/\(?\b(?:19|20)\d{2}\b\)?/u', ' ', $line) ?? $line;

        return $line;
    }

    /**
     * Check if a line includes a year range signal.
     */
    private function lineHasYearRange(string $line): bool
    {
        return preg_match('/\b(19|20)\d{2}\b/', $line) === 1 ||
            preg_match('/\b(current|present|sekarang|saat ini|masih)\b/i', $line) === 1;
    }

    /**
     * Build the legacy display year range.
     */
    private function buildYearRangeLabel(string $startYear, string $endYear): string
    {
        if ($startYear === '' && $endYear === '') {
            return '';
        }

        if ($startYear !== '' && $endYear === '') {
            return $startYear;
        }

        return ($startYear ?: '-') . ' - ' . ($endYear === 'current' ? 'Masih bekerja' : $endYear);
    }

    /**
     * Make one fixed-size string list expected by the frontend.
     */
    private function padStringList(array $items, int $length): array
    {
        $items = array_values(array_filter(array_map(
            fn (mixed $item): string => $this->cleanHumanText((string) $item),
            $items
        )));

        return array_pad(array_slice($items, 0, $length), $length, '');
    }

    /**
     * Make one fixed-size experience list expected by the frontend.
     */
    private function padExperienceItems(array $items): array
    {
        $normalizedItems = array_map(function (array $item): array {
            return [
                ...$this->emptyExperienceItem(),
                ...$item,
            ];
        }, array_slice($items, 0, self::MAX_EXPERIENCE_ITEMS));

        while (count($normalizedItems) < self::MAX_EXPERIENCE_ITEMS) {
            $normalizedItems[] = $this->emptyExperienceItem();
        }

        return $normalizedItems;
    }

    /**
     * Make one fixed-size organization list expected by the frontend.
     */
    private function padOrganizationItems(array $items): array
    {
        $emptyItem = [
            'organizationName' => '',
            'role' => '',
            'startYear' => '',
            'endYear' => '',
            'description' => '',
        ];
        $normalizedItems = array_map(
            fn (array $item): array => [...$emptyItem, ...$item],
            array_slice($items, 0, self::MAX_ORGANIZATION_ITEMS)
        );

        while (count($normalizedItems) < self::MAX_ORGANIZATION_ITEMS) {
            $normalizedItems[] = $emptyItem;
        }

        return $normalizedItems;
    }

    /**
     * Return the blank experience structure used by candidate profiles.
     */
    private function emptyExperienceItem(): array
    {
        return [
            'company' => '',
            'position' => '',
            'year' => '',
            'startYear' => '',
            'endYear' => '',
            'responsibilities' => '',
            'achievement' => '',
            'reasonForLeaving' => '',
            'referenceName' => '',
            'referencePosition' => '',
            'referencePhone' => '',
        ];
    }

    /**
     * Clean human-readable field values.
     */
    private function cleanHumanText(string $value, int $maxLength = 255): string
    {
        $value = preg_replace('/^[\s\-*•:|]+/u', '', $value) ?? $value;
        $value = preg_replace('/[\s\-:|]+$/u', '', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
        $value = trim($value);

        return mb_substr($value, 0, $maxLength);
    }

    /**
     * Return top-level profile fields that have a useful value.
     */
    private function filledProfileFields(array $profile): array
    {
        $fields = [];

        foreach ($profile as $key => $value) {
            if ($key === 'salaryPeriod') {
                continue;
            }

            if ($this->hasFilledValue($value)) {
                $fields[] = $key;
            }
        }

        return $fields;
    }

    /**
     * Recursively check whether one profile value is filled.
     */
    private function hasFilledValue(mixed $value): bool
    {
        if (is_string($value)) {
            return trim($value) !== '';
        }

        if (is_array($value)) {
            foreach ($value as $item) {
                if ($this->hasFilledValue($item)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Summarize required fields still absent from the parsed profile.
     */
    private function missingRequiredFields(array $profile): array
    {
        $missing = [];

        if (!$this->hasFilledValue($profile['fullName'] ?? '')) {
            $missing[] = 'Nama lengkap';
        }

        if (!$this->hasFilledValue($profile['phone'] ?? '')) {
            $missing[] = 'Nomor telepon aktif';
        }

        if (!$this->hasFilledValue($profile['email'] ?? '')) {
            $missing[] = 'Email akun';
        }

        if (!$this->hasFilledValue($profile['currentAddress'] ?? '')) {
            $missing[] = 'Domisili / alamat saat ini';
        }

        if (!$this->hasFilledValue($profile['preferredRoles'] ?? [])) {
            $missing[] = 'Posisi yang diminati';
        }

        if (!$this->hasFilledValue($profile['employmentType'] ?? '')) {
            $missing[] = 'Tipe pekerjaan';
        }

        if (!$this->hasFilledValue($profile['targetIndustry'] ?? '')) {
            $missing[] = 'Industri target';
        }

        if (
            !$this->hasFilledValue($profile['education'] ?? []) &&
            !$this->hasFilledValue($profile['experiences'] ?? [])
        ) {
            $missing[] = 'Pendidikan atau pengalaman terbaru';
        }

        return $missing;
    }

    /**
     * Return simple confidence categories per field family.
     */
    private function buildConfidenceMap(array $profile): array
    {
        return [
            'email' => $this->hasFilledValue($profile['email'] ?? '') ? 'high' : 'missing',
            'phone' => $this->hasFilledValue($profile['phone'] ?? '') ? 'high' : 'missing',
            'fullName' => $this->hasFilledValue($profile['fullName'] ?? '') ? 'medium' : 'missing',
            'currentAddress' => $this->hasFilledValue($profile['currentAddress'] ?? '') ? 'medium' : 'missing',
            'preferredRoles' => $this->hasFilledValue($profile['preferredRoles'] ?? []) ? 'medium' : 'missing',
            'education' => $this->hasFilledValue($profile['education'] ?? []) ? 'medium' : 'missing',
            'experiences' => $this->hasFilledValue($profile['experiences'] ?? []) ? 'medium' : 'missing',
            'skills' => $this->hasFilledValue($profile['skills'] ?? []) ? 'medium' : 'missing',
            'employmentType' => $this->hasFilledValue($profile['employmentType'] ?? '') ? 'low' : 'missing',
            'targetIndustry' => $this->hasFilledValue($profile['targetIndustry'] ?? '') ? 'low' : 'missing',
        ];
    }
}
