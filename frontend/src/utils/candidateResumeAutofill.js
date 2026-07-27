const MAX_EXTRACTED_TEXT_LENGTH = 30000;
const CURRENT_CALENDAR_YEAR = new Date().getFullYear();
const MIN_EXPERIENCE_YEAR = CURRENT_CALENDAR_YEAR - 50;

const ROLE_KEYWORDS = [
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

const COMPANY_KEYWORDS = [
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

const KNOWN_SKILLS = [
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

const SECTION_HEADINGS = [
  'about',
  'achievement',
  'education',
  'experience',
  'keahlian',
  'kemampuan',
  'kontak',
  'organisasi',
  'pendidikan',
  'pengalaman',
  'profile',
  'profil',
  'skill',
  'skills',
  'summary',
  'tentang',
  'work',
];

const cleanText = (value = '', maxLength = 255) =>
  String(value || '')
    .replace(/^[\s\-*•:|]+/u, '')
    .replace(/[\s\-:|]+$/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength);

const normalizeDocumentText = (value = '') =>
  String(value || '')
    .replace(/\r\n|\r|\f/g, '\n')
    .replace(/([A-Za-z])-\n([A-Za-z])/g, '$1$2')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const arrayBufferToBinaryString = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const chunks = [];
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
  }

  return chunks.join('');
};

const decodePdfLiteralString = (value = '') =>
  value
    .replace(/\\([nrtbf()\\])/g, (_, escaped) => {
      const map = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        '(': '(',
        ')': ')',
        '\\': '\\',
      };

      return map[escaped] || escaped;
    })
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\\r?\n/g, '');

const extractPdfTextTokens = (content = '') => {
  const tokens = [];
  const literalPattern = /\((?:\\.|[^\\)])*\)/gs;
  let match = literalPattern.exec(content);

  while (match) {
    const token = cleanText(decodePdfLiteralString(match[0].slice(1, -1)), 220);

    if (token && /[\p{L}\p{N}@]/u.test(token)) {
      tokens.push(token);
    }

    match = literalPattern.exec(content);
  }

  return tokens;
};

const extractTextFromPdfBinary = (binary = '') => {
  const chunks = [];
  const streamPattern = /stream(?:\r\n|\n|\r)(.*?)(?:\r\n|\n|\r)?endstream/gs;
  let streamMatch = streamPattern.exec(binary);

  while (streamMatch) {
    const tokens = extractPdfTextTokens(streamMatch[1]);

    if (tokens.length > 0) {
      chunks.push(tokens.join('\n'));
    }

    streamMatch = streamPattern.exec(binary);
  }

  if (chunks.length === 0) {
    const tokens = extractPdfTextTokens(binary);

    if (tokens.length > 0) {
      chunks.push(tokens.join('\n'));
    }
  }

  return normalizeDocumentText([...new Set(chunks)].join('\n')).slice(0, MAX_EXTRACTED_TEXT_LENGTH);
};

const readPdfTextFromBrowserFile = async (file) => {
  const buffer = await file.arrayBuffer();
  const binary = arrayBufferToBinaryString(buffer);

  return extractTextFromPdfBinary(binary);
};

const buildLines = (text = '') =>
  normalizeDocumentText(text)
    .split(/\n+/)
    .map((line) => cleanText(line, 180))
    .filter(Boolean);

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const textContainsWholeTerm = (text = '', term = '') =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}([^\\p{L}\\p{N}]|$)`, 'iu').test(text);

const looksLikeRole = (line = '') => {
  const normalizedLine = cleanText(line, 120).toLowerCase();

  if (!normalizedLine || /@|\b(email|phone|alamat|address|education|pendidikan)\b/i.test(normalizedLine)) {
    return false;
  }

  return ROLE_KEYWORDS.some((keyword) => normalizedLine.includes(keyword));
};

const looksLikeCompany = (line = '') => {
  const normalizedLine = cleanText(line, 140).toLowerCase();

  if (!normalizedLine || /@|\b(email|phone|alamat|address)\b/i.test(normalizedLine)) {
    return false;
  }

  return COMPANY_KEYWORDS.some((keyword) => normalizedLine.includes(keyword));
};

const dateTokenPattern =
  '(?:(?:jan(?:uari|uary)?|feb(?:ruari|ruary)?|mar(?:et|ch)?|apr(?:il)?|mei|may|jun(?:i|e)?|jul(?:i|y)?|agu(?:stus)?|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?)\\s+)?(?:(?:19|20)\\d{2}|present|current|now|sekarang|saat ini|masih bekerja|masih aktif)';

const isCurrentDateToken = (token = '') =>
  /\b(present|current|now|sekarang|saat ini|masih bekerja|masih aktif)\b/i.test(token);

const extractYearFromDateToken = (token = '') => {
  const match = String(token).match(/\b(19|20)\d{2}\b/);

  if (!match) {
    return '';
  }

  const year = Number.parseInt(match[0], 10);

  return year >= MIN_EXPERIENCE_YEAR && year <= CURRENT_CALENDAR_YEAR ? String(year) : '';
};

const extractYearRange = (text = '') => {
  const rangePattern = new RegExp(
    `(${dateTokenPattern})\\s*(?:-|–|—|to|sampai|hingga|s\\/d|sd)\\s*(${dateTokenPattern})`,
    'iu'
  );
  const rangeMatch = String(text).match(rangePattern);

  if (rangeMatch) {
    const startYear = extractYearFromDateToken(rangeMatch[1]);
    const endYear = isCurrentDateToken(rangeMatch[2])
      ? 'current'
      : extractYearFromDateToken(rangeMatch[2]);

    if (startYear || endYear) {
      return [startYear, endYear];
    }
  }

  const years = [...new Set(String(text).match(/\b(19|20)\d{2}\b/g) || [])]
    .map((year) => Number.parseInt(year, 10))
    .filter((year) => year >= MIN_EXPERIENCE_YEAR && year <= CURRENT_CALENDAR_YEAR)
    .sort((firstYear, secondYear) => firstYear - secondYear);

  if (years.length >= 2) {
    return [String(years[0]), String(years[1])];
  }

  if (years.length === 1) {
    return [String(years[0]), /\b(current|present|now|sekarang|saat ini|masih)\b/i.test(text) ? 'current' : ''];
  }

  return ['', ''];
};

const stripDateRanges = (line = '') =>
  cleanText(
    String(line)
      .replace(
        new RegExp(
          `\\(?\\b${dateTokenPattern}\\s*(?:-|–|—|to|sampai|hingga|s\\/d|sd)\\s*${dateTokenPattern}\\b\\)?`,
          'giu'
        ),
        ' '
      )
      .replace(/\(?\b(?:19|20)\d{2}\b\)?/gu, ' '),
    140
  );

const cleanRoleLine = (line = '') =>
  cleanText(stripDateRanges(line).replace(/\b(position|jabatan|role|posisi)\b\s*[:\-]?/gi, ''), 90);

const cleanCompanyLine = (line = '') => cleanText(stripDateRanges(line), 90);

const buildYearRangeLabel = (startYear = '', endYear = '') => {
  if (!startYear && !endYear) {
    return '';
  }

  if (startYear && !endYear) {
    return startYear;
  }

  return `${startYear || '-'} - ${endYear === 'current' ? 'Masih bekerja' : endYear}`;
};

const emptyExperienceItem = () => ({
  company: '',
  position: '',
  year: '',
  startYear: '',
  endYear: '',
  responsibilities: '',
  achievement: '',
  reasonForLeaving: '',
  referenceName: '',
  referencePosition: '',
  referencePhone: '',
});

const parseRoleCompanyPair = (line = '') => {
  const normalizedLine = stripDateRanges(line);
  const atMatch = normalizedLine.match(/^(.{3,70}?)\s+(?:at|di|@)\s+(.{3,90})$/i);

  if (atMatch) {
    return {
      position: cleanRoleLine(atMatch[1]),
      company: cleanCompanyLine(atMatch[2]),
    };
  }

  const parts = normalizedLine
    .split(/\s+(?:[|]|-{1,2}|–|—)\s+/u)
    .map((part) => cleanText(part, 90))
    .filter(Boolean);

  if (parts.length >= 2) {
    const role = parts.find(looksLikeRole) || parts[0];
    const company = parts.find((part) => part !== role && looksLikeCompany(part)) || parts.find((part) => part !== role) || '';

    return {
      position: cleanRoleLine(role),
      company: cleanCompanyLine(company),
    };
  }

  if (looksLikeRole(normalizedLine) && looksLikeCompany(normalizedLine)) {
    const companyMatch = normalizedLine.match(/\b((?:pt\.?|cv\.?|bank|rs|rumah sakit|hotel|universitas|sekolah|group)\s+[\p{L}\p{N}&.,' -]{3,})$/iu);

    if (companyMatch) {
      return {
        position: cleanRoleLine(normalizedLine.slice(0, normalizedLine.lastIndexOf(companyMatch[1]))),
        company: cleanCompanyLine(companyMatch[1]),
      };
    }
  }

  return null;
};

const looksLikeSectionHeading = (line = '') => {
  const normalizedLine = cleanText(line, 42).toLowerCase();

  return SECTION_HEADINGS.some(
    (heading) =>
      normalizedLine === heading ||
      normalizedLine.startsWith(`${heading}:`) ||
      normalizedLine.startsWith(`${heading} -`)
  );
};

const extractSectionLines = (lines = [], headings = [], maxLines = 18) => {
  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = lines[index].toLowerCase();
    const heading = headings.find((item) => normalizedLine.includes(item.toLowerCase()));

    if (!heading) {
      continue;
    }

    const afterHeading = cleanText(lines[index].replace(new RegExp(`^.*?${escapeRegExp(heading)}\\s*[:\\-]?\\s*`, 'i'), ''), 180);
    const sectionLines = afterHeading && afterHeading.toLowerCase() !== normalizedLine ? [afterHeading] : [];

    for (let cursor = index + 1; cursor < lines.length && sectionLines.length < maxLines; cursor += 1) {
      if (looksLikeSectionHeading(lines[cursor])) {
        break;
      }

      sectionLines.push(lines[cursor]);
    }

    return sectionLines.filter(Boolean);
  }

  return [];
};

const lineHasYearRange = (line = '') => /\b(19|20)\d{2}\b/.test(line) || /\b(current|present|sekarang|saat ini|masih)\b/i.test(line);

const splitExperienceChunks = (lines = []) => {
  const chunks = [];
  let currentChunk = [];

  lines.forEach((line) => {
    const currentChunkHasDate = currentChunk.some(lineHasYearRange);
    const startsNewEntry =
      currentChunk.length > 0 &&
      ((lineHasYearRange(line) && currentChunkHasDate) ||
        (looksLikeRole(line) && currentChunkHasDate && currentChunk.length >= 2));

    if (startsNewEntry) {
      chunks.push(currentChunk);
      currentChunk = [];
    }

    currentChunk.push(line);
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
};

const buildExperienceFromLines = (lines = []) => {
  const experience = emptyExperienceItem();
  const text = lines.join('\n');
  const [startYear, endYear] = extractYearRange(text);
  experience.startYear = startYear;
  experience.endYear = endYear;
  experience.year = buildYearRangeLabel(startYear, endYear);

  lines.forEach((line) => {
    const pair = parseRoleCompanyPair(line);

    if (pair) {
      experience.position = experience.position || pair.position;
      experience.company = experience.company || pair.company;
      return;
    }

    if (!experience.company && looksLikeCompany(line)) {
      experience.company = cleanCompanyLine(line);
    }

    if (!experience.position && looksLikeRole(line)) {
      experience.position = cleanRoleLine(line);
    }
  });

  experience.responsibilities = cleanText(
    lines
      .filter((line) => !lineHasYearRange(line) && !looksLikeSectionHeading(line) && !looksLikeCompany(line) && !looksLikeRole(line))
      .slice(0, 3)
      .join(' '),
    700
  );

  return experience;
};

const extractExperiences = (text = '', lines = []) => {
  const experienceLines =
    extractSectionLines(lines, [
      'pengalaman kerja',
      'riwayat pekerjaan',
      'work experience',
      'professional experience',
      'employment history',
      'experience',
      'pengalaman',
    ], 46) ||
    [];
  const candidateLines =
    experienceLines.length > 0
      ? experienceLines
      : lines.filter((line) => looksLikeRole(line) || looksLikeCompany(line) || lineHasYearRange(line));
  const experiences = splitExperienceChunks(candidateLines)
    .map(buildExperienceFromLines)
    .filter((item) => item.position || item.company)
    .slice(0, 3);

  while (experiences.length < 3) {
    experiences.push(emptyExperienceItem());
  }

  return experiences;
};

const extractEmail = (text = '') => cleanText((text.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i) || [])[0] || '', 255);

const extractPhone = (text = '') => {
  const matches = text.match(/(?:\+?62|0)\s*(?:[\d][\d\s().-]{7,18}\d)/g) || [];

  for (const phone of matches) {
    const normalizedPhone = phone.trim().replace(/[^\d+]/g, '');
    const digits = normalizedPhone.replace(/\D/g, '');

    if (digits.length >= 9 && digits.length <= 15) {
      return normalizedPhone;
    }
  }

  return '';
};

const extractName = (lines = [], fileName = '') => {
  const labeledLine = lines.find((line) => /\b(nama lengkap|nama|full name|name)\b\s*[:\-]/i.test(line));

  if (labeledLine) {
    const value = cleanText(labeledLine.replace(/^.*?\b(nama lengkap|nama|full name|name)\b\s*[:\-]\s*/i, ''), 80);

    if (value) {
      return value;
    }
  }

  const headerName = lines.slice(0, 12).find((line) =>
    /^[\p{L} .'-]{3,80}$/u.test(line) &&
    !/\b(cv|resume|portfolio|profil|profile|alamat|address|phone|email|linkedin|skills?|education|experience)\b/i.test(line)
  );

  if (headerName) {
    return cleanText(headerName, 80);
  }

  return cleanText(
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/\b(cv|resume|curriculum|vitae|lamaran|kerja)\b/gi, ' ')
      .replace(/[_-]+/g, ' '),
    80
  );
};

const extractAddress = (lines = []) => {
  const addressLine = lines.find((line) =>
    /\b(alamat domisili|domisili|alamat|address|current address|location|lokasi)\b\s*[:\-]/i.test(line)
  );

  if (addressLine) {
    return cleanText(addressLine.replace(/^.*?\b(alamat domisili|domisili|alamat|address|current address|location|lokasi)\b\s*[:\-]\s*/i, ''), 160);
  }

  return cleanText(
    lines.find((line) =>
      /\b(kota|kabupaten|jakarta|bandung|surabaya|tangerang|bekasi|bogor|depok|semarang|yogyakarta|medan|makassar|denpasar|malang)\b/i.test(line)
    ) || '',
    160
  );
};

const extractSkills = (text = '', lines = []) => {
  const skillLines = extractSectionLines(lines, ['keahlian', 'kemampuan', 'skills', 'technical skills', 'kompetensi'], 20);
  const skills = [];

  skillLines
    .join('\n')
    .split(/[,;|/]|\s+-\s+|\n/u)
    .map((part) => cleanText(part.replace(/\b(skills?|keahlian|kemampuan|kompetensi|technical)\b\s*[:\-]?/gi, ''), 48))
    .filter((part) => part && part.split(/\s+/).length <= 5)
    .forEach((skill) => {
      if (!skills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
        skills.push(skill);
      }
    });

  KNOWN_SKILLS.forEach((skill) => {
    if (skills.length < 6 && textContainsWholeTerm(text, skill) && !skills.includes(skill)) {
      skills.push(skill);
    }
  });

  return [...skills.slice(0, 6), '', '', '', '', '', ''].slice(0, 6);
};

const extractEducation = (text = '', lines = []) => {
  const educationLines = extractSectionLines(lines, ['pendidikan', 'riwayat pendidikan', 'education', 'academic background'], 22);
  const educationText = educationLines.join('\n') || text;
  const degree = /\b(s3|doktor|doctor|ph\.?d)\b/i.test(educationText)
    ? 'S3 - Doktor'
    : /\b(s2|magister|master)\b/i.test(educationText)
      ? 'S2 - Magister'
      : /\b(s1|sarjana|bachelor)\b/i.test(educationText)
        ? 'S1 - Sarjana'
        : /\b(d3|diploma 3)\b/i.test(educationText)
          ? 'D3'
          : /\b(d1|d2|diploma 1|diploma 2)\b/i.test(educationText)
            ? 'D1 / D2'
            : /\b(sma|smk|slta|high school|vocational school)\b/i.test(educationText)
              ? 'SMA / SMK'
              : '';
  const institution = cleanText(
    educationLines.find((line) => /\b(universitas|university|institut|institute|politeknik|academy|akademi|sekolah|sma|smk)\b/i.test(line)) || '',
    120
  );
  const majorMatch =
    educationText.match(/(?:jurusan|program studi|prodi|major|field of study)\s*[:\-]?\s*([^\n,;|]+)/i) ||
    educationText.match(/\b(?:s1|s2|s3|d3)\s*[- ]\s*([^\n,;|]+)/i);
  const [startYear, endYear] = extractYearRange(educationText);

  return {
    degree,
    institution,
    major: cleanText(majorMatch?.[1] || '', 80),
    startYear,
    endYear,
  };
};

const firstFilledExperiencePosition = (experiences = []) =>
  experiences.find((item) => item.position)?.position || '';

const extractPreferredRole = (text = '', lines = [], experiences = []) => {
  const roleLine = lines.find((line) =>
    /\b(posisi yang diminati|posisi dilamar|desired position|target position)\b\s*[:\-]/i.test(line)
  );

  if (roleLine) {
    return cleanRoleLine(roleLine.replace(/^.*?\b(posisi yang diminati|posisi dilamar|desired position|target position)\b\s*[:\-]\s*/i, ''));
  }

  return firstFilledExperiencePosition(experiences) ||
    ROLE_KEYWORDS.find((keyword) => text.toLowerCase().includes(keyword)) ||
    '';
};

const extractTargetIndustry = (text = '', role = '', skills = []) => {
  const haystack = [text, role, ...skills].join(' ').toLowerCase();

  if (/(software|developer|programmer|data analyst|sql|php|laravel|react|javascript|it support|network)/i.test(haystack)) {
    return 'Teknologi Informasi';
  }

  if (/(accounting|finance|tax|akuntansi|keuangan|auditor)/i.test(haystack)) {
    return 'Keuangan';
  }

  if (/(sales|marketing|seo|google ads|meta ads|brand|account executive)/i.test(haystack)) {
    return 'Sales & Marketing';
  }

  if (/(operational|operasional|warehouse|gudang|inventory|logistic|logistik|supply chain)/i.test(haystack)) {
    return 'Operasional / Logistik';
  }

  return '';
};

const filledProfileFields = (profile = {}) =>
  Object.entries(profile)
    .filter(([key]) => key !== 'salaryPeriod')
    .filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.some((item) => Object.values(item || {}).some((nestedValue) => cleanText(nestedValue)));
      }

      if (value && typeof value === 'object') {
        return Object.values(value).some((nestedValue) => cleanText(nestedValue));
      }

      return cleanText(value);
    })
    .map(([key]) => key);

export const buildCandidateResumeAutofillFromBrowserFile = async (file) => {
  const text = await readPdfTextFromBrowserFile(file);
  const lines = buildLines(text);
  const experiences = extractExperiences(text, lines);
  const skills = extractSkills(text, lines);
  const role = extractPreferredRole(text, lines, experiences);
  const targetIndustry = extractTargetIndustry(text, role, skills);
  const summaryParts = [
    role ? `Kandidat dengan fokus pada ${role}` : '',
    experiences[0]?.company ? `berpengalaman di ${experiences[0].company}` : '',
    skills.filter(Boolean).length > 0 ? `memiliki kemampuan ${skills.filter(Boolean).slice(0, 3).join(', ')}` : '',
  ].filter(Boolean);
  const profile = {
    fullName: extractName(lines, file.name),
    email: extractEmail(text),
    phone: extractPhone(text),
    currentAddress: extractAddress(lines),
    profileSummary: summaryParts.length > 0 ? `${summaryParts.join(' dan ')}.` : '',
    employmentType: experiences.some((item) => item.position || item.company) ? 'Full-time / Tetap' : '',
    targetIndustry,
    education: extractEducation(text, lines),
    experiences,
    strengths: [summaryParts.length > 0 ? `${summaryParts.join(' dan ')}.` : '', '', ''],
    skills,
    preferredRoles: [role, '', '', '', ''],
    preferredLocations: ['', '', '', '', ''],
    salaryPeriod: 'bulan',
  };

  return {
    message:
      text.length > 0
        ? 'CV berhasil dibaca dari browser. Field profil yang masih kosong dapat diisi otomatis dari CV.'
        : 'CV diterima, tetapi teks PDF belum bisa dibaca otomatis. Coba gunakan CV PDF berbasis teks.',
    autofill: {
      profile,
      filledFields: filledProfileFields(profile),
      missingRequiredFields: [],
      confidence: {},
      source: {
        fileName: file.name || 'cv-kandidat.pdf',
        textLength: text.length,
        parser: 'browser_pdf_text_best_effort',
      },
      needsReview: true,
    },
  };
};
