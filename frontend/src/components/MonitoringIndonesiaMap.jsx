const numberFormatter = new Intl.NumberFormat('id-ID');

const MAP_VIEWBOX = {
  width: 1500,
  height: 590,
  paddingX: 30,
  paddingY: 10,
};

const MAP_BOUNDS = {
  minLongitude: 94,
  maxLongitude: 142,
  minLatitude: -11.5,
  maxLatitude: 6.5,
};

const statusLabelByTone = {
  success: 'Normal',
  warning: 'Perlu review',
  danger: 'Butuh tindakan',
};

const MARKER_COLLISION_GAP = 10;
const MARKER_OFFSET_STEP = 18;
const MARKER_OFFSET_RING_COUNT = 7;

/**
 * Mengubah koordinat lintang bujur menjadi titik x/y relatif di kanvas peta.
 */
const projectGeoPoint = (latitude, longitude) => {
  const usableWidth = MAP_VIEWBOX.width - MAP_VIEWBOX.paddingX * 2;
  const usableHeight = MAP_VIEWBOX.height - MAP_VIEWBOX.paddingY * 2;
  const normalizedX =
    (longitude - MAP_BOUNDS.minLongitude) /
    (MAP_BOUNDS.maxLongitude - MAP_BOUNDS.minLongitude);
  const normalizedY =
    (MAP_BOUNDS.maxLatitude - latitude) /
    (MAP_BOUNDS.maxLatitude - MAP_BOUNDS.minLatitude);

  return {
    x: MAP_VIEWBOX.paddingX + normalizedX * usableWidth,
    y: MAP_VIEWBOX.paddingY + normalizedY * usableHeight,
  };
};

/**
 * Menentukan ukuran marker berdasarkan intensitas sinyal lokasi yang dirangkum.
 */
const getMarkerSize = (totalSignals) => {
  if (totalSignals >= 16) {
    return 26;
  }

  if (totalSignals >= 10) {
    return 22;
  }

  if (totalSignals >= 5) {
    return 19;
  }

  return 16;
};

/**
 * Menggabungkan beberapa alias lokasi menjadi caption singkat di panel detail.
 */
const formatAliases = (aliases = []) => {
  if (aliases.length <= 1) {
    return '';
  }

  return aliases.slice(0, 3).join(', ');
};

/**
 * Membatasi nilai numerik agar tetap berada di area render yang aman.
 */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Menyusun kandidat offset marker agar hotspot yang berdekatan tidak saling menimpa.
 */
const buildMarkerOffsetCandidates = () =>
  [{ x: 0, y: 0 }].concat(
    Array.from({ length: MARKER_OFFSET_RING_COUNT }, (_, ringIndex) => {
      const radius = MARKER_OFFSET_STEP * (ringIndex + 1);
      const slotCount = 8 + ringIndex * 4;
      const ringRotation = ringIndex % 2 === 0 ? -90 : -75;

      return Array.from({ length: slotCount }, (_, slotIndex) => {
        const radians =
          ((ringRotation + (slotIndex * 360) / slotCount) * Math.PI) / 180;

        return {
          x: Math.cos(radians) * radius,
          y: Math.sin(radians) * radius,
        };
      });
    }).flat()
  );

/**
 * Menghitung jarak aman minimal antara dua marker berdasarkan ukuran visualnya.
 */
const getMarkerClearance = (markerSize, placedMarkerSize) =>
  (markerSize + placedMarkerSize) / 2 + MARKER_COLLISION_GAP;

/**
 * Memproyeksikan semua titik monitoring sekaligus mencari offset terbaik per marker.
 */
const buildProjectedPoints = (points) => {
  const placedMarkers = [];
  const offsetCandidates = buildMarkerOffsetCandidates();

  return points.map((point) => {
    const projected = projectGeoPoint(point.latitude, point.longitude);
    const markerSize = getMarkerSize(point.totalSignals);
    const markerMargin = markerSize / 2 + 8;
    let resolvedMarker = null;

    for (const candidate of offsetCandidates) {
      const markerX = clamp(
        projected.x + candidate.x,
        markerMargin,
        MAP_VIEWBOX.width - markerMargin
      );
      const markerY = clamp(
        projected.y + candidate.y,
        markerMargin,
        MAP_VIEWBOX.height - markerMargin
      );
      const collidesWithPlacedMarker = placedMarkers.some((placedMarker) => {
        const dx = markerX - placedMarker.markerX;
        const dy = markerY - placedMarker.markerY;

        return (
          Math.hypot(dx, dy) <
          getMarkerClearance(markerSize, placedMarker.markerSize)
        );
      });

      if (!collidesWithPlacedMarker) {
        resolvedMarker = {
          markerX,
          markerY,
          offsetX: markerX - projected.x,
          offsetY: markerY - projected.y,
        };
        break;
      }
    }

    if (!resolvedMarker) {
      const fallbackMarkerX = clamp(projected.x, markerMargin, MAP_VIEWBOX.width - markerMargin);
      const fallbackMarkerY = clamp(projected.y, markerMargin, MAP_VIEWBOX.height - markerMargin);

      resolvedMarker = {
        markerX: fallbackMarkerX,
        markerY: fallbackMarkerY,
        offsetX: fallbackMarkerX - projected.x,
        offsetY: fallbackMarkerY - projected.y,
      };
    }

    placedMarkers.push({
      markerX: resolvedMarker.markerX,
      markerY: resolvedMarker.markerY,
      markerSize,
    });

    return {
      ...point,
      projected,
      markerSize,
      anchorXPercent: (projected.x / MAP_VIEWBOX.width) * 100,
      anchorYPercent: (projected.y / MAP_VIEWBOX.height) * 100,
      offsetX: Number(resolvedMarker.offsetX.toFixed(2)),
      offsetY: Number(resolvedMarker.offsetY.toFixed(2)),
      connectorLength: Number(
        Math.hypot(resolvedMarker.offsetX, resolvedMarker.offsetY).toFixed(2)
      ),
      connectorAngle: `${Math.atan2(resolvedMarker.offsetY, resolvedMarker.offsetX)}rad`,
    };
  });
};

/**
 * Merender peta monitoring Indonesia untuk dashboard superadmin dengan marker interaktif.
 */
const MonitoringIndonesiaMap = ({
  points = [],
  selectedPointKey = '',
  onSelectPoint,
  unmappedLocations = [],
  formatDateTime,
}) => {
  const projectedPoints = buildProjectedPoints(points).map((point) => ({
    ...point,
    hasOffset: point.connectorLength >= 6,
  }));

  const selectedPoint =
    projectedPoints.find((point) => point.key === selectedPointKey) || projectedPoints[0] || null;

  const totalSignals = projectedPoints.reduce((sum, point) => sum + point.totalSignals, 0);
  const reviewHotspotsCount = projectedPoints.filter((point) => point.reviewCount > 0).length;
  const flaggedHotspotsCount = projectedPoints.filter((point) => point.flaggedJobCount > 0).length;

  if (projectedPoints.length === 0) {
    return (
      <div className="superadmin-empty-state is-panel">
        <div className="superadmin-empty-icon">⌁</div>
        <p>Belum ada lokasi yang bisa dipetakan untuk monitoring nasional.</p>
      </div>
    );
  }

  return (
    <>
      <div className="superadmin-panel-head superadmin-monitoring-map-head">
        <div>
          <h3>Peta Monitoring Indonesia</h3>
          <p>
            Marker dibangun dari koordinat kota untuk memantau preferensi kandidat, recruiter,
            lowongan aktif, dan lamaran masuk.
          </p>
        </div>
        <div className="superadmin-monitoring-map-summary">
          <span className="superadmin-monitoring-map-summary-chip">
            <strong>{numberFormatter.format(projectedPoints.length)}</strong>
            <span>Kota termonitor</span>
          </span>
          <span className="superadmin-monitoring-map-summary-chip">
            <strong>{numberFormatter.format(totalSignals)}</strong>
            <span>Sinyal lokasi</span>
          </span>
          <span className="superadmin-monitoring-map-summary-chip">
            <strong>{numberFormatter.format(reviewHotspotsCount)}</strong>
            <span>Hotspot review</span>
          </span>
        </div>
      </div>

      <div className="superadmin-monitoring-map-stage">
        <div
          className="superadmin-monitoring-map-image-frame"
          role="img"
          aria-label="Peta Indonesia dengan penanda kota untuk monitoring"
        >
          <img
            className="superadmin-monitoring-map-image"
            src="/indonesia-monitoring-map.png"
            alt=""
            aria-hidden="true"
            loading="lazy"
          />
        </div>

        <div className="superadmin-monitoring-marker-layer">
          {projectedPoints.map((point) => (
            <div
              key={point.key}
              className="superadmin-monitoring-point"
              style={{
                left: `${point.anchorXPercent}%`,
                top: `${point.anchorYPercent}%`,
              }}
            >
              <span className={`superadmin-monitoring-anchor is-${point.tone}`} />

              {point.hasOffset ? (
                <span
                  className="superadmin-monitoring-marker-connector"
                  style={{
                    '--connector-angle': point.connectorAngle,
                    '--connector-length': `${point.connectorLength}px`,
                  }}
                />
              ) : null}

              <button
                type="button"
                className={`superadmin-monitoring-marker is-${point.tone}${
                  selectedPoint?.key === point.key ? ' is-selected' : ''
                }`}
                style={{
                  '--marker-size': `${point.markerSize}px`,
                  '--marker-offset-x': `${point.offsetX}px`,
                  '--marker-offset-y': `${point.offsetY}px`,
                }}
                onMouseEnter={() => onSelectPoint?.(point.key)}
                onFocus={() => onSelectPoint?.(point.key)}
                onClick={() => onSelectPoint?.(point.key)}
                aria-label={`${point.label}: ${numberFormatter.format(
                  point.totalSignals
                )} sinyal lokasi, status ${statusLabelByTone[point.tone]}`}
                aria-pressed={selectedPoint?.key === point.key}
                title={`${point.label} • ${numberFormatter.format(point.totalSignals)} sinyal lokasi`}
              >
                <span className="superadmin-monitoring-marker-core" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="superadmin-monitoring-map-footer">
        <div className="superadmin-monitoring-map-legend">
          <span className="superadmin-monitoring-map-legend-item">
            <i className="is-success" />
            Lokasi normal
          </span>
          <span className="superadmin-monitoring-map-legend-item">
            <i className="is-warning" />
            Perlu review
          </span>
          <span className="superadmin-monitoring-map-legend-item">
            <i className="is-danger" />
            Butuh tindakan
          </span>
          <span className="superadmin-monitoring-map-legend-note">
            Ukuran marker mengikuti kepadatan sinyal lokasi.
          </span>
          <span className="superadmin-monitoring-map-legend-note">
            Hotspot berdekatan digeser tipis dari anchor agar tetap bisa diklik.
          </span>
        </div>

        {selectedPoint ? (
          <div className={`superadmin-monitoring-map-detail is-${selectedPoint.tone}`}>
            <div className="superadmin-monitoring-map-detail-head">
              <div>
                <span className="superadmin-monitoring-map-detail-kicker">Hotspot terpilih</span>
                <strong>{selectedPoint.label}</strong>
                {selectedPoint.hasOffset ? (
                  <p>
                    Marker ditarik sedikit dari titik koordinat asli agar hotspot terdekat tetap
                    terbaca tanpa saling menutup.
                  </p>
                ) : selectedPoint.aliases.length > 1 ? (
                  <p>Alias lokasi: {formatAliases(selectedPoint.aliases)}</p>
                ) : (
                  <p>Koordinat digunakan sebagai anchor monitoring kota ini.</p>
                )}
              </div>
              <span className={`superadmin-inline-badge is-${selectedPoint.tone}`}>
                {statusLabelByTone[selectedPoint.tone]}
              </span>
            </div>

            <div className="superadmin-monitoring-map-detail-metrics">
              <div>
                <span>Lamaran</span>
                <strong>{numberFormatter.format(selectedPoint.applicationCount)}</strong>
              </div>
              <div>
                <span>Lowongan</span>
                <strong>{numberFormatter.format(selectedPoint.jobCount)}</strong>
              </div>
              <div>
                <span>Recruiter</span>
                <strong>{numberFormatter.format(selectedPoint.recruiterCount)}</strong>
              </div>
              <div>
                <span>Preferensi kandidat</span>
                <strong>{numberFormatter.format(selectedPoint.candidateInterestCount)}</strong>
              </div>
              <div>
                <span>Flagged / review</span>
                <strong>{numberFormatter.format(selectedPoint.reviewCount)}</strong>
              </div>
            </div>

            <div className="superadmin-monitoring-map-detail-meta">
              <span>
                Lat {selectedPoint.latitude.toFixed(4)} • Lng {selectedPoint.longitude.toFixed(4)}
              </span>
              <span>
                Update terakhir:{' '}
                {selectedPoint.lastUpdatedAt ? formatDateTime(selectedPoint.lastUpdatedAt) : 'Belum ada'}
              </span>
            </div>
          </div>
        ) : null}

        {unmappedLocations.length > 0 ? (
          <div className="superadmin-monitoring-map-note">
            <strong>Koordinat belum tersedia:</strong>{' '}
            {unmappedLocations.slice(0, 5).join(', ')}
            {unmappedLocations.length > 5
              ? `, +${numberFormatter.format(unmappedLocations.length - 5)} lokasi lain`
              : ''}
          </div>
        ) : (
          <div className="superadmin-monitoring-map-note is-success">
            Semua lokasi aktif di monitoring sudah memiliki koordinat.
          </div>
        )}

        {flaggedHotspotsCount > 0 ? (
          <div className="superadmin-monitoring-map-note is-warning">
            {numberFormatter.format(flaggedHotspotsCount)} hotspot memiliki lowongan flagged dan
            perlu perhatian admin.
          </div>
        ) : null}
      </div>
    </>
  );
};

export default MonitoringIndonesiaMap;
