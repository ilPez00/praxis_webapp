import React, { useState, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { Box, Typography, CircularProgress } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';

const GMAPS_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY as string | undefined;

export interface MapMarker {
  id: string;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
}

interface LocationMapProps {
  markers: MapMarker[];
  height?: number;
}

// Dark map style matching the app theme
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0d0e1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0e1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3b82f6' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f2a1a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d1d5db' }] },
];

const MAP_OPTIONS: google.maps.MapOptions = {
  styles: DARK_STYLE,
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  clickableIcons: false,
};

function computeCenter(markers: MapMarker[]): { lat: number; lng: number } {
  const lat = markers.reduce((s, m) => s + m.lat, 0) / markers.length;
  const lng = markers.reduce((s, m) => s + m.lng, 0) / markers.length;
  return { lat, lng };
}

const LocationMap: React.FC<LocationMapProps> = ({ markers, height = 340 }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'praxis-google-map',
    googleMapsApiKey: GMAPS_KEY ?? '',
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (markers.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
      map.fitBounds(bounds, 60);
    }
  }, [markers]);

  const onUnmount = useCallback(() => { mapRef.current = null; }, []);

  const validMarkers = markers.filter(m => m.lat != null && m.lng != null);

  if (!GMAPS_KEY) {
    return (
      <Box sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        borderRadius: '16px',
        border: '1px dashed rgba(255,255,255,0.1)',
        bgcolor: 'rgba(255,255,255,0.02)',
        mb: 3,
      }}>
        <MapIcon sx={{ fontSize: 40, color: 'text.disabled', opacity: 0.4 }} />
        <Typography variant="body2" color="text.disabled">
          Add <code>VITE_GOOGLE_MAPS_KEY</code> to enable map view
        </Typography>
      </Box>
    );
  }

  if (loadError) return null;

  if (!isLoaded) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.02)', mb: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (validMarkers.length === 0) return null;

  const center = validMarkers.length === 1
    ? { lat: validMarkers[0].lat, lng: validMarkers[0].lng }
    : computeCenter(validMarkers);

  const selected = selectedId ? validMarkers.find(m => m.id === selectedId) : null;

  return (
    <Box sx={{ borderRadius: '16px', overflow: 'hidden', mb: 3, border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height }}
        center={center}
        zoom={validMarkers.length === 1 ? 14 : 10}
        options={MAP_OPTIONS}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {validMarkers.map(m => (
          <Marker
            key={m.id}
            position={{ lat: m.lat, lng: m.lng }}
            title={m.title}
            onClick={() => setSelectedId(prev => prev === m.id ? null : m.id)}
            options={{
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#F59E0B',
                fillOpacity: 1,
                strokeColor: '#0A0B14',
                strokeWeight: 2,
              },
            }}
          />
        ))}

        {selected && (
          <InfoWindow
            position={{ lat: selected.lat, lng: selected.lng }}
            onCloseClick={() => setSelectedId(null)}
            options={{ pixelOffset: new window.google.maps.Size(0, -14) }}
          >
            <Box sx={{ color: '#0A0B14', maxWidth: 180 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3 }}>
                {selected.title}
              </Typography>
              {selected.subtitle && (
                <Typography variant="caption" sx={{ color: '#374151', display: 'block', mt: 0.25 }}>
                  {selected.subtitle}
                </Typography>
              )}
            </Box>
          </InfoWindow>
        )}
      </GoogleMap>
    </Box>
  );
};

export default LocationMap;
