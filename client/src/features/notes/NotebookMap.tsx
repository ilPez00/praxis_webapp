import React, { useEffect, useMemo, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Box, Typography } from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';

// Fix for default marker icon issue (bundlers strip relative paths)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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

const ICON_CONFIG: Record<string, { color: string; icon: string }> = {
  note:          { color: '#8B5CF6', icon: '📝' },
  goal_progress: { color: '#10B981', icon: '🎯' },
  tracker:       { color: '#F59E0B', icon: '💪' },
  achievement:   { color: '#F59E0B', icon: '🏆' },
  checkin:       { color: '#3B82F6', icon: '✅' },
  axiom_brief:   { color: '#A78BFA', icon: '🤖' },
};

const getIconForType = (entryType: string): L.DivIcon => {
  const config = ICON_CONFIG[entryType] || { color: '#8B5CF6', icon: '📍' };
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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const renderGroupPopup = (groupEntries: NotebookEntry[]): string => {
  const isMultiple = groupEntries.length > 1;
  const header = isMultiple
    ? `<div style="display:inline-block; padding:2px 8px; margin-bottom:6px; border-radius:12px; background:rgba(167,139,250,0.2); color:#A78BFA; font-size:11px; font-weight:700;">${groupEntries.length} entries here</div>`
    : '';

  const items = groupEntries.slice(0, 5).map((e, idx) => {
    const isProgress = e.entry_type === 'goal_progress';
    const color = isProgress ? '#10B981' : '#A78BFA';
    const label = isProgress ? '🎯 Progress' : '📝 Note';
    const date = new Date(e.occurred_at).toLocaleDateString();
    const title = escapeHtml((e.title || e.content.slice(0, 50) + '...') || '');
    const loc = e.location_name ? `<div style="font-size:11px; color:rgba(255,255,255,0.6); margin-top:3px;">📍 ${escapeHtml(e.location_name)}</div>` : '';
    const mood = e.mood ? `<div style="font-size:11px; margin-top:3px;">Mood: ${escapeHtml(e.mood)}</div>` : '';
    const sep = idx < Math.min(groupEntries.length, 5) - 1 ? 'margin-bottom:12px;' : '';
    return `
      <div style="${sep}">
        <div style="display:flex; align-items:center; gap:4px; margin-bottom:3px;">
          <span style="font-size:11px; font-weight:700; color:${color};">${label}</span>
          <span style="font-size:11px; color:rgba(255,255,255,0.6);">${date}</span>
        </div>
        <div style="font-size:13px; font-weight:600; margin-bottom:3px;">${title}</div>
        ${loc}${mood}
      </div>`;
  }).join('');

  const overflow = groupEntries.length > 5
    ? `<div style="font-size:11px; color:rgba(255,255,255,0.6); margin-top:8px;">+${groupEntries.length - 5} more entries at this location</div>`
    : '';

  return `<div style="min-width:200px; max-width:300px;">${header}${items}${overflow}</div>`;
};

const NotebookMap: React.FC<NotebookMapProps> = ({ entries }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const entriesWithLocation = useMemo(
    () =>
      entries.filter(
        e => e.location_lat && e.location_lng && e.location_lat !== 0 && e.location_lng !== 0,
      ),
    [entries],
  );

  // Group entries by rounded location (cheap clustering)
  const locationGroups = useMemo(() => {
    const groups = new Map<string, NotebookEntry[]>();
    for (const entry of entriesWithLocation) {
      const key = `${entry.location_lat?.toFixed(3)},${entry.location_lng?.toFixed(3)}`;
      const existing = groups.get(key) || [];
      existing.push(entry);
      groups.set(key, existing);
    }
    return groups;
  }, [entriesWithLocation]);

  // Initialize map once (after we know there's data — empty state shown below)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (entriesWithLocation.length === 0) return;

    const map = L.map(containerRef.current, {
      center: [41.9028, 12.4964], // Rome
      zoom: 6,
      scrollWheelZoom: true,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, [entriesWithLocation.length]);

  // Render markers + fit bounds when data changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: [number, number][] = [];

    for (const [key, groupEntries] of Array.from(locationGroups.entries())) {
      const lat = groupEntries[0].location_lat!;
      const lng = groupEntries[0].location_lng!;
      L.marker([lat, lng], { icon: getIconForType(groupEntries[0].entry_type) })
        .bindPopup(renderGroupPopup(groupEntries))
        .addTo(layer);
      bounds.push([lat, lng]);
      void key;
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 14 });
    }
  }, [locationGroups]);

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

  return (
    <Box
      sx={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        height: 400,
        '& .leaflet-container':        { background: 'rgba(15, 17, 23, 0.95)' },
        '& .leaflet-popup-content-wrapper': {
          background: 'rgba(30, 30, 40, 0.98)',
          color: '#fff',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
        },
        '& .leaflet-popup-tip':        { background: 'rgba(30, 30, 40, 0.98)' },
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </Box>
  );
};

export default NotebookMap;
