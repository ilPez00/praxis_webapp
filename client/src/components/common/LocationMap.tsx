import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Box, Typography, Avatar } from '@mui/material';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons not showing in production
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
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

// Helper component to auto-fit bounds when markers change
function MapAutoFit({ markers, userLocation }: { markers: MapMarker[], userLocation?: { lat: number; lng: number } }) {
  const map = useMap();
  React.useEffect(() => {
    if (markers.length === 0) {
      if (userLocation) {
        map.setView([userLocation.lat, userLocation.lng], 12);
      }
      return;
    }
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, markers, userLocation]);
  return null;
}

// Custom marker creator
const createCustomIcon = (m: MapMarker) => {
  if (m.type === 'user' && m.avatarUrl) {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-image: url(${m.avatarUrl}); background-size: cover; width: 36px; height: 36px; border-radius: 50%; border: 3px solid #F59E0B; box-shadow: 0 4px 12px rgba(0,0,0,0.3);"></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }
  
  const color = m.type === 'event' ? '#EC4899' : (m.type === 'place' ? '#6366F1' : '#F59E0B');
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const LocationMap: React.FC<LocationMapProps> = ({ markers, height = 340, userLocation, onMarkerClick }) => {
  const validMarkers = markers.filter(m => m.lat != null && m.lng != null);

  const defaultCenter: [number, number] = [45.4642, 9.1900];
  let center: [number, number] = defaultCenter;

  if (validMarkers.length > 0) {
    center = validMarkers.length === 1 
      ? [validMarkers[0].lat, validMarkers[0].lng]
      : [
          validMarkers.reduce((s, m) => s + m.lat, 0) / validMarkers.length,
          validMarkers.reduce((s, m) => s + m.lng, 0) / validMarkers.length
        ];
  } else if (userLocation) {
    center = [userLocation.lat, userLocation.lng];
  }

  return (
    <Box sx={{ 
      borderRadius: '16px', 
      overflow: 'hidden', 
      height,
      border: '1px solid rgba(255,255,255,0.07)', 
      zIndex: 1,
      bgcolor: '#0A0B14'
    }}>
      <MapContainer 
        center={center} 
        zoom={12} 
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapAutoFit markers={validMarkers} userLocation={userLocation} />

        {validMarkers.map(m => (
          <Marker 
            key={m.id} 
            position={[m.lat, m.lng]} 
            icon={createCustomIcon(m)}
            eventHandlers={{
              click: () => onMarkerClick && onMarkerClick(m.id, m.type),
            }}
          >
            <Popup>
              <Box sx={{ color: '#0A0B14', minWidth: 140, p: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  {m.title}
                </Typography>
                {m.subtitle && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    {m.subtitle}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, mt: 1, display: 'block', cursor: 'pointer' }}>
                  Click to view details
                </Typography>
              </Box>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Box>
  );
};

export default LocationMap;
