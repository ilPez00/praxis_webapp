import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Box, Typography } from '@mui/material';
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
}

interface LocationMapProps {
  markers: MapMarker[];
  height?: number;
  userLocation?: { lat: number; lng: number };
}

// Helper component to auto-fit bounds when markers change
function MapAutoFit({ markers, userLocation }: { markers: MapMarker[], userLocation?: { lat: number; lng: number } }) {
  const map = useMap();
  React.useEffect(() => {
    if (markers.length === 0) {
      if (userLocation) {
        map.setView([userLocation.lat, userLocation.lng], 13);
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

const LocationMap: React.FC<LocationMapProps> = ({ markers, height = 340, userLocation }) => {
  const validMarkers = markers.filter(m => m.lat != null && m.lng != null);

  // Default center if no markers or user location (Europe/Milan as neutral default for Praxis context)
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
      mb: 3, 
      height,
      border: '1px solid rgba(255,255,255,0.07)', 
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      zIndex: 1,
      bgcolor: '#0A0B14' // Background color while map tiles load
    }}>
      <MapContainer 
        center={center} 
        zoom={validMarkers.length === 1 ? 14 : (validMarkers.length > 1 ? 10 : 12)} 
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={false}
      >
        {/* CartoDB Dark Matter — perfectly matches Praxis dark theme */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapAutoFit markers={validMarkers} userLocation={userLocation} />

        {validMarkers.map(m => (
          <Marker key={m.id} position={[m.lat, m.lng]}>
            <Popup>
              <Box sx={{ color: '#0A0B14', minWidth: 120, p: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                  {m.title}
                </Typography>
                {m.subtitle && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    {m.subtitle}
                  </Typography>
                )}
              </Box>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Box>
  );
};

export default LocationMap;
