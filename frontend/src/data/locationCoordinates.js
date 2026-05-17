const locationCoordinates = {
  'jakarta barat': { latitude: -6.1674, longitude: 106.7637 },
  'jakarta pusat': { latitude: -6.1862, longitude: 106.8341 },
  'jakarta selatan': { latitude: -6.2615, longitude: 106.8106 },
  'jakarta timur': { latitude: -6.225, longitude: 106.9004 },
  'jakarta utara': { latitude: -6.1389, longitude: 106.8636 },
  bandung: { latitude: -6.9175, longitude: 107.6191 },
  'bandung barat': { latitude: -6.865, longitude: 107.491 },
  surabaya: { latitude: -7.2575, longitude: 112.7521 },
  'bogor kota': { latitude: -6.595, longitude: 106.8166 },
  'kabupaten bogor': { latitude: -6.4796, longitude: 106.8347 },
  'kemang kabupaten bogor': { latitude: -6.5571, longitude: 106.7305 },
  'parung kabupaten bogor': { latitude: -6.4229, longitude: 106.7334 },
  bekasi: { latitude: -6.2383, longitude: 106.9756 },
  bogor: { latitude: -6.595, longitude: 106.8166 },
  kemang: { latitude: -6.5571, longitude: 106.7305 },
  parung: { latitude: -6.4229, longitude: 106.7334 },
  depok: { latitude: -6.4025, longitude: 106.7942 },
  tangerang: { latitude: -6.1783, longitude: 106.6319 },
  'tangerang selatan': { latitude: -6.2886, longitude: 106.7179 },
  serang: { latitude: -6.1201, longitude: 106.1503 },
  cilegon: { latitude: -6.0025, longitude: 106.0112 },
  semarang: { latitude: -6.9667, longitude: 110.4167 },
  yogyakarta: { latitude: -7.7956, longitude: 110.3695 },
  solo: { latitude: -7.5696, longitude: 110.8284 },
  malang: { latitude: -7.9666, longitude: 112.6326 },
  denpasar: { latitude: -8.6705, longitude: 115.2126 },
  medan: { latitude: 3.5952, longitude: 98.6722 },
  palembang: { latitude: -2.9761, longitude: 104.7754 },
  makassar: { latitude: -5.1477, longitude: 119.4327 },
  balikpapan: { latitude: -1.2379, longitude: 116.8529 },
  banjarmasin: { latitude: -3.3186, longitude: 114.5944 },
  manado: { latitude: 1.4748, longitude: 124.8421 },
};

const locationAliases = {
  'kota administrasi jakarta barat': 'jakarta barat',
  'kota administrasi jakarta pusat': 'jakarta pusat',
  'kota administrasi jakarta selatan': 'jakarta selatan',
  'kota administrasi jakarta timur': 'jakarta timur',
  'kota administrasi jakarta utara': 'jakarta utara',
  'kota bandung': 'bandung',
  'kabupaten bandung': 'bandung',
  'kota surabaya': 'surabaya',
  'kota bogor': 'bogor kota',
  'bogor kota jawa barat': 'bogor kota',
  'bogor kabupaten': 'kabupaten bogor',
  'kab bogor': 'kabupaten bogor',
  'kab bogor jawa barat': 'kabupaten bogor',
  'kota bekasi': 'bekasi',
  'kabupaten bekasi': 'bekasi',
  'kota depok': 'depok',
  'kota tangerang': 'tangerang',
  'kabupaten tangerang': 'tangerang',
  'tangerang kota': 'tangerang',
  'tangerang kabupaten': 'tangerang',
  'kota tangerang selatan': 'tangerang selatan',
  'kota serang': 'serang',
  'kabupaten serang': 'serang',
  'serang kota': 'serang',
  'serang kabupaten': 'serang',
  'kota cilegon': 'cilegon',
  'kota semarang': 'semarang',
  'kota yogyakarta': 'yogyakarta',
  'di yogyakarta': 'yogyakarta',
  'kota malang': 'malang',
  'kota denpasar': 'denpasar',
  'kota medan': 'medan',
  'kota palembang': 'palembang',
  'kota makassar': 'makassar',
  'kota balikpapan': 'balikpapan',
  'kota banjarmasin': 'banjarmasin',
  'kota manado': 'manado',
  'kemang bogor': 'kemang kabupaten bogor',
  'parung bogor': 'parung kabupaten bogor',
};

/**
 * Menormalkan nama lokasi ke format key rendah huruf kecil yang konsisten.
 */
export const normalizeLocationKey = (locationName = '') =>
  String(locationName || '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[/.-]/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizedLocationCoordinates = Object.fromEntries(
  Object.entries(locationCoordinates).map(([key, value]) => [normalizeLocationKey(key), value])
);

const normalizedLocationAliases = Object.fromEntries(
  Object.entries(locationAliases).map(([key, value]) => [
    normalizeLocationKey(key),
    normalizeLocationKey(value),
  ])
);

const normalizedCoordinateKeys = Object.keys(normalizedLocationCoordinates).sort(
  (firstKey, secondKey) => secondKey.length - firstKey.length
);

/**
 * Membangun beberapa variasi nama lokasi agar pencarian koordinat lebih toleran terhadap format input.
 */
const buildLocationVariants = (locationName = '') => {
  const rawLocation = String(locationName || '').trim().toLowerCase();
  const normalizedLocation = normalizeLocationKey(rawLocation);
  const variants = new Set();

  if (!normalizedLocation) {
    return [];
  }

  const addVariant = (value) => {
    const normalizedValue = normalizeLocationKey(value);

    if (normalizedValue) {
      variants.add(normalizedValue);
    }
  };

  addVariant(normalizedLocation);
  rawLocation
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach(addVariant);

  const trimmedPrefixVariant = normalizedLocation
    .replace(/^(kota|kabupaten|kab)\s+/, '')
    .replace(/^(kota administrasi|kabupaten administrasi)\s+/, '')
    .trim();

  addVariant(trimmedPrefixVariant);

  const suffixMatch = normalizedLocation.match(/^(.*)\s+(kota|kabupaten|kab)$/);

  if (suffixMatch) {
    const baseName = normalizeLocationKey(suffixMatch[1]);
    const administrativeType = suffixMatch[2] === 'kab' ? 'kabupaten' : suffixMatch[2];

    addVariant(baseName);
    addVariant(`${administrativeType} ${baseName}`);
  }

  return Array.from(variants);
};

/**
 * Mengambil koordinat kota/kabupaten terbaik dari input lokasi yang sering bervariasi.
 */
export const getLocationCoordinates = (locationName) => {
  const directVariants = buildLocationVariants(locationName);

  if (directVariants.length === 0) {
    return null;
  }

  const resolvedCandidates = Array.from(
    new Set(
      directVariants.flatMap((variant) => [
        variant,
        normalizedLocationAliases[variant],
        normalizedLocationAliases[variant]?.replace(/^kab\s+/, 'kabupaten '),
      ])
    )
  ).filter(Boolean);

  for (const candidate of resolvedCandidates) {
    if (normalizedLocationCoordinates[candidate]) {
      return normalizedLocationCoordinates[candidate];
    }
  }

  for (const candidate of resolvedCandidates) {
    const fallbackKey = normalizedCoordinateKeys.find(
      (coordinateKey) => candidate.includes(coordinateKey) || coordinateKey.includes(candidate)
    );

    if (fallbackKey) {
      return normalizedLocationCoordinates[fallbackKey];
    }
  }

  return null;
};

export default locationCoordinates;
