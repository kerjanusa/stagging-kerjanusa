import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const numberFormatter = new Intl.NumberFormat('id-ID');

const DEFAULT_MAP_CENTER = [-2.5, 118];
const DEFAULT_MAP_BOUNDS = [
  [-15, 92],
  [8.5, 145],
];
const DEFAULT_MIN_ZOOM = 4;
const DEFAULT_MAX_ZOOM = 12;

const statusLabelByTone = {
  success: 'Normal',
  warning: 'Perlu review',
  danger: 'Butuh tindakan',
};

const toneColorByStatus = {
  success: '#16a34a',
  warning: '#d7a53d',
  danger: '#cf2525',
};

/**
 * Mengembalikan radius marker berdasarkan kepadatan sinyal lokasi.
 */
const getMarkerRadius = (totalSignals) => {
  if (totalSignals >= 16) {
    return 12;
  }

  if (totalSignals >= 10) {
    return 10;
  }

  if (totalSignals >= 5) {
    return 8;
  }

  return 6;
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
 * Menyusun bounds peta dari sekumpulan hotspot monitoring.
 */
const buildMonitoringBounds = (points = []) => {
  const coordinates = points
    .filter(
      (point) =>
        Number.isFinite(point?.latitude) &&
        Number.isFinite(point?.longitude)
    )
    .map((point) => [point.latitude, point.longitude]);

  if (coordinates.length === 0) {
    return null;
  }

  return L.latLngBounds(coordinates);
};

/**
 * Memusatkan peta ke seluruh hotspot aktif, atau fallback ke framing Indonesia.
 */
const fitMapToMonitoringPoints = (map, points = []) => {
  const bounds = buildMonitoringBounds(points);

  if (bounds?.isValid()) {
    map.fitBounds(bounds.pad(0.28), {
      padding: [24, 24],
      maxZoom: 6,
      animate: true,
    });
    return;
  }

  map.fitBounds(DEFAULT_MAP_BOUNDS, {
    padding: [24, 24],
    animate: true,
  });
};

/**
 * Sinkronisasi event zoom dan fokus marker terpilih langsung ke instance Leaflet.
 */
const MonitoringMapViewportSync = ({
  points,
  onMapReady,
  onZoomChange,
  resetSignal,
}) => {
  const map = useMapEvents({
    zoomend() {
      onZoomChange(Math.round(map.getZoom()));
    },
  });

  useEffect(() => {
    onMapReady(map);
    onZoomChange(Math.round(map.getZoom()));
  }, [map, onMapReady, onZoomChange]);

  useEffect(() => {
    fitMapToMonitoringPoints(map, points);
  }, [map, points]);

  useEffect(() => {
    if (!resetSignal) {
      return;
    }

    fitMapToMonitoringPoints(map, points);
  }, [map, points, resetSignal]);

  return null;
};

/**
 * Merender peta monitoring Indonesia untuk dashboard superadmin dengan interaksi gaya peta modern.
 */
const MonitoringIndonesiaMap = ({
  points = [],
  selectedPointKey = '',
  onSelectPoint,
  unmappedLocations = [],
  formatDateTime,
}) => {
  const [mapInstance, setMapInstance] = useState(null);
  const [currentZoomLevel, setCurrentZoomLevel] = useState(DEFAULT_MIN_ZOOM);
  const [resetSignal, setResetSignal] = useState(0);

  const monitoringPoints = useMemo(
    () =>
      points
        .filter(
          (point) =>
            Number.isFinite(point?.latitude) &&
            Number.isFinite(point?.longitude)
        )
        .map((point) => ({
          ...point,
          markerRadius: getMarkerRadius(point.totalSignals),
        })),
    [points]
  );

  const selectedPoint =
    monitoringPoints.find((point) => point.key === selectedPointKey) || monitoringPoints[0] || null;

  const totalSignals = monitoringPoints.reduce((sum, point) => sum + point.totalSignals, 0);
  const reviewHotspotsCount = monitoringPoints.filter((point) => point.reviewCount > 0).length;
  const flaggedHotspotsCount = monitoringPoints.filter((point) => point.flaggedJobCount > 0).length;

  const handleZoomIn = () => {
    mapInstance?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstance?.zoomOut();
  };

  const handleResetView = () => {
    setResetSignal((currentValue) => currentValue + 1);
  };

  if (monitoringPoints.length === 0) {
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
            Peta interaktif ini menampilkan konsentrasi preferensi kandidat, recruiter,
            lowongan aktif, dan lamaran masuk per kota.
          </p>
        </div>
        <div className="superadmin-monitoring-map-summary">
          <span className="superadmin-monitoring-map-summary-chip">
            <strong>{numberFormatter.format(monitoringPoints.length)}</strong>
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
        <div className="superadmin-monitoring-map-controls">
          <span className="superadmin-monitoring-map-zoom-label">
            Zoom {currentZoomLevel}
          </span>
          <button
            type="button"
            className="superadmin-monitoring-map-control-button"
            onClick={handleZoomOut}
            disabled={currentZoomLevel <= DEFAULT_MIN_ZOOM}
            aria-label="Perkecil peta"
            title="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            className="superadmin-monitoring-map-control-button"
            onClick={handleZoomIn}
            disabled={currentZoomLevel >= DEFAULT_MAX_ZOOM}
            aria-label="Perbesar peta"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="superadmin-monitoring-map-control-button is-reset"
            onClick={handleResetView}
            aria-label="Reset posisi peta"
            title="Reset view"
          >
            Reset
          </button>
        </div>

        <div className="superadmin-monitoring-map-canvas">
          <MapContainer
            center={DEFAULT_MAP_CENTER}
            zoom={DEFAULT_MIN_ZOOM}
            minZoom={DEFAULT_MIN_ZOOM}
            maxZoom={DEFAULT_MAX_ZOOM}
            zoomControl={false}
            attributionControl
            scrollWheelZoom
            dragging
            doubleClickZoom
            touchZoom
            boxZoom={false}
            maxBounds={DEFAULT_MAP_BOUNDS}
            maxBoundsViscosity={0.6}
            className="superadmin-monitoring-leaflet"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MonitoringMapViewportSync
              points={monitoringPoints}
              onMapReady={setMapInstance}
              onZoomChange={setCurrentZoomLevel}
              resetSignal={resetSignal}
            />

            {monitoringPoints.map((point) => {
              const markerColor = toneColorByStatus[point.tone] || toneColorByStatus.success;
              const isSelected = selectedPoint?.key === point.key;

              return (
                <CircleMarker
                  key={point.key}
                  center={[point.latitude, point.longitude]}
                  radius={isSelected ? point.markerRadius + 1.5 : point.markerRadius}
                  pathOptions={{
                    color: '#ffffff',
                    weight: isSelected ? 3 : 2,
                    fillColor: markerColor,
                    fillOpacity: 0.96,
                  }}
                  eventHandlers={{
                    click: () => onSelectPoint?.(point.key),
                    mouseover: () => onSelectPoint?.(point.key),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -point.markerRadius]} opacity={1}>
                    <strong>{point.label}</strong>
                    <br />
                    {numberFormatter.format(point.totalSignals)} sinyal • {statusLabelByTone[point.tone]}
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
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
            Geser peta untuk menjelajah hotspot, gunakan scroll atau tombol +/- untuk zoom.
          </span>
        </div>

        {selectedPoint ? (
          <div className={`superadmin-monitoring-map-detail is-${selectedPoint.tone}`}>
            <div className="superadmin-monitoring-map-detail-head">
              <div>
                <span className="superadmin-monitoring-map-detail-kicker">Hotspot terpilih</span>
                <strong>{selectedPoint.label}</strong>
                {selectedPoint.aliases?.length > 1 ? (
                  <p>Alias lokasi: {formatAliases(selectedPoint.aliases)}</p>
                ) : (
                  <p>Klik dan zoom area ini untuk melihat konteks lokasi monitoring secara lebih detail.</p>
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
