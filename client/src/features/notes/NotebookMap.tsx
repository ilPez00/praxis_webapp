import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Box, Typography, Chip, Stack } from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

// Fix for default marker icon issue in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface EntryLocation {
  lat: number;
  lng: number;
  location_name?: string | null;
}

interface NotebookEntry {
  id: string;
  title?: string | null;
  content: string;
  entry_type: string;
  mood?: string | null;
  occurred_at: string;
  location_lat?: number | null;
  location_lng?: number | null;
  location_name?: string | null;
}

interface NotebookMapProps {
  entries: NotebookEntry[];
}

// Custom icons by entry type
const getIconForType = (entryType: string) => {
  const iconConfig: Record<string, { color: string; icon: string }> = {
    note: { color: '#8B5CF6', icon: '📝' },
    goal_progress: { color: '#10B981', icon: '🎯' },
    tracker: { color: '#F59E0B', icon: '💪' },
    achievement: { color: '#F59E0B', icon: '🏆' },
    checkin: { color: '#3B82F6', icon: '✅' },
    axiom_brief: { color: '#A78BFA', icon: '🤖' },
  };

  const config = iconConfig[entryType] || { color: '#8B5CF6', icon: '📍' };

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${config.color};
      border: 2px solid white;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">${config.icon}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Component to fit map bounds to markers
function FitBounds({ entries }: { entries: NotebookEntry[] }) {
  const map = useMap();

  useMemo(() => {
    const validEntries = entries.filter(e => e.location_lat && e.location_lng);
    if (validEntries.length === 0) return;

    const bounds = validEntries.map(e => [e.location_lat!, e.location_lng!] as [number, number]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [map, entries]);

  return null;
}

const NotebookMap: React.FC<NotebookMapProps> = ({ entries }) => {
  // Filter entries with location data
  const entriesWithLocation = useMemo(() => 
    entries.filter(e => e.location_lat && e.location_lng && e.location_lat !== 0 && e.location_lng !== 0),
    [entries]
  );

  // Group entries by location for clustering display
  const locationGroups = useMemo(() => {
    const groups: Map<string, NotebookEntry[]> = new Map();
    
    for (const entry of entriesWithLocation) {
      const key = `${entry.location_lat?.toFixed(3)},${entry.location_lng?.toFixed(3)}`;
      const existing = groups.get(key) || [];
      existing.push(entry);
      groups.set(key, existing);
    }
    
    return groups;
  }, [entriesWithLocation]);

  if (entriesWithLocation.length === 0) {
    return (
      <Box
        sx={{
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'rgba(255,255,255,0.02)',
          p: 6,
          textAlign: 'center',
        }}
      >
        <Box sx={{ mb: 2 }}>
          <EditNoteIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary' }}>
          No location data yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Notes will appear on the map once you start logging with location enabled
        </Typography>
      </Box>
    );
  }

  const defaultCenter: EntryLocation = { lat: 41.9028, lng: 12.4964 }; // Rome

  return (
    <Box
      sx={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        height: 400,
        '& .leaflet-container': {
          background: 'rgba(15, 17, 23, 0.95)',
        },
        '& .leaflet-popup-content-wrapper': {
          background: 'rgba(30, 30, 40, 0.98)',
          color: '#fff',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
        },
        '& .leaflet-popup-tip': {
          background: 'rgba(30, 30, 40, 0.98)',
        },
      }}
    >
      <MapContainer
        center={[defaultCenter.lat, defaultCenter.lng]}
        zoom={6}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <FitBounds entries={entriesWithLocation} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {Array.from(locationGroups.entries()).map(([key, groupEntries]) => {
          const entry = groupEntries[0];
          const lat = entry.location_lat!;
          const lng = entry.location_lng!;
          const isMultiple = groupEntries.length > 1;

          return (
            <Marker
              key={key}
              position={[lat, lng]}
              icon={getIconForType(entry.entry_type)}
            >
              <Popup>
                <Box sx={{ minWidth: 200, maxWidth: 300 }}>
                  {isMultiple && (
                    <Chip
                      label={`${groupEntries.length} entries here`}
                      size="small"
                      sx={{ mb: 1, bgcolor: 'rgba(167,139,250,0.2)', color: '#A78BFA' }}
                    />
                  )}
                  
                  {groupEntries.slice(0, 5).map((e, idx) => (
                    <Box key={e.id} sx={{ mb: idx < groupEntries.length - 1 ? 1.5 : 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: e.entry_type === 'goal_progress' ? '#10B981' : '#A78BFA',
                          }}
                        >
                          {e.entry_type === 'goal_progress' ? '🎯 Progress' : '📝 Note'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(e.occurred_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {e.title || e.content.slice(0, 50)}...
                      </Typography>
                      {e.location_name && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          📍 {e.location_name}
                        </Typography>
                      )}
                      {e.mood && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                          Mood: {e.mood}
                        </Typography>
                      )}
                    </Box>
                  ))}
                  
                  {groupEntries.length > 5 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      +{groupEntries.length - 5} more entries at this location
                    </Typography>
                  )}
                </Box>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </Box>
  );
};

export default NotebookMap;
