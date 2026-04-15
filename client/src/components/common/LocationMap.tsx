import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Box } from '@mui/material';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons not showing in production
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export interface MapMarker {
  id: string;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  type?: 'user' | 'place' | 'event';
  avatarUrl?: string;
}

interface LocationMapProps {
  markers: MapMarker[];
  height?: string | number;
  userLocation?: { lat: number; lng: number };
  onMarkerClick?: (id: string, type?: string) => void;
}

const createCustomIcon = (m: MapMarker): L.DivIcon => {
  if (m.type === 'user' && m.avatarUrl) {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-image: url(${m.avatarUrl}); background-size: cover; width: 36px; height: 36px; border-radius: 50%; border: 3px solid #F59E0B; box-shadow: 0 4px 12px rgba(0,0,0,0.3);"></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }
  const color = m.type === 'event' ? '#EC4899' : m.type === 'place' ? '#6366F1' : '#F59E0B';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const renderPopupHtml = (m: MapMarker): string => `
  <div style="color: #0A0B14; min-width: 140px; padding: 4px;">
    <div style="font-weight: 800; line-height: 1.2; font-size: 14px;">${escapeHtml(m.title)}</div>
    ${m.subtitle ? `<div style="font-size: 12px; color: rgba(0,0,0,0.6); margin-top: 4px;">${escapeHtml(m.subtitle)}</div>` : ''}
    <div style="font-size: 12px; color: #6366F1; font-weight: 700; margin-top: 8px; cursor: pointer;">Click to view details</div>
  </div>
`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LocationMap: React.FC<LocationMapProps> = ({
  markers,
  height = 340,
  userLocation,
  onMarkerClick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const hasAutoCenteredRef = useRef(false);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const validMarkers = markers.filter(m => m.lat != null && m.lng != null);
    let center: [number, number] = [45.4642, 9.1900];
    if (validMarkers.length > 0) {
      center =
        validMarkers.length === 1
          ? [validMarkers[0].lat, validMarkers[0].lng]
          : [
              validMarkers.reduce((s, m) => s + m.lat, 0) / validMarkers.length,
              validMarkers.reduce((s, m) => s + m.lng, 0) / validMarkers.length,
            ];
    } else if (userLocation) {
      center = [userLocation.lat, userLocation.lng];
    }

    const map = L.map(containerRef.current, {
      center,
      zoom: 12,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      hasAutoCenteredRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render markers + auto-fit when data changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const validMarkers = markers.filter(m => m.lat != null && m.lng != null);

    for (const m of validMarkers) {
      const marker = L.marker([m.lat, m.lng], { icon: createCustomIcon(m) });
      marker.bindPopup(renderPopupHtml(m));
      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(m.id, m.type));
      }
      marker.addTo(layer);
    }

    // Auto-fit: prefer user location once, then fall back to marker bounds
    if (userLocation && !hasAutoCenteredRef.current) {
      map.setView([userLocation.lat, userLocation.lng], 12);
      hasAutoCenteredRef.current = true;
      return;
    }
    if (validMarkers.length === 1) {
      map.setView([validMarkers[0].lat, validMarkers[0].lng], 14);
    } else if (validMarkers.length > 1) {
      const bounds = L.latLngBounds(validMarkers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [markers, userLocation, onMarkerClick]);

  return (
    <Box
      sx={{
        borderRadius: '16px',
        overflow: 'hidden',
        height,
        border: '1px solid rgba(255,255,255,0.07)',
        zIndex: 1,
        bgcolor: '#0A0B14',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </Box>
  );
};

export default LocationMap;
