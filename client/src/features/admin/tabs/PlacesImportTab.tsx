import React, { useState, useCallback } from 'react';
import {
  Box, Typography, TextField, Button, Stack, Chip, Paper,
  CircularProgress, Alert, InputAdornment, IconButton, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import MapIcon from '@mui/icons-material/Map';
import PlaceIcon from '@mui/icons-material/Place';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../../lib/api';

// Fix leaflet default icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41],
});

// ── Map click handler ─────────────────────────────────────────────────────────

interface MapClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Auto-pan when coordinates change
const MapPanner: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  React.useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], 12, { duration: 1 });
  }, [lat, lng, map]);
  return null;
};

// ── Import result type ────────────────────────────────────────────────────────

interface ImportResult {
  success: boolean;
  city: string;
  dryRun: boolean;
  imported: number;
  skipped: number;
  total: number;
  errors: string[];
}

// ── Nominatim geocoding ───────────────────────────────────────────────────────

async function geocodeCity(query: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
    { headers: { 'User-Agent': 'PraxisApp/1.0' } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
    { headers: { 'User-Agent': 'PraxisApp/1.0' } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.address?.city || data.address?.town || data.address?.village || data.display_name?.split(',')[0] || null;
}

// ── Component ─────────────────────────────────────────────────────────────────

const PlacesImportTab: React.FC = () => {
  const [cityInput, setCityInput] = useState('');
  const [resolvedCity, setResolvedCity] = useState('');
  const [lat, setLat] = useState(45.4384); // Verona default
  const [lng, setLng] = useState(10.9916);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search for a city by name
  const handleSearch = useCallback(async () => {
    if (!cityInput.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const geo = await geocodeCity(cityInput.trim());
      if (!geo) {
        setError(`Could not find "${cityInput}". Try a more specific name.`);
        return;
      }
      setLat(geo.lat);
      setLng(geo.lng);
      setMarkerPos([geo.lat, geo.lng]);
      setResolvedCity(geo.displayName.split(',')[0]);
    } catch (err) {
      setError('Geocoding failed. Check your connection.');
    } finally {
      setSearching(false);
    }
  }, [cityInput]);

  // Use browser GPS
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser.');
      return;
    }
    setSearching(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setMarkerPos([latitude, longitude]);
        const city = await reverseGeocode(latitude, longitude);
        if (city) {
          setResolvedCity(city);
          setCityInput(city);
        }
        setSearching(false);
      },
      () => {
        setError('Could not get your location. Check browser permissions.');
        setSearching(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Handle map click — pick coordinates
  const handleMapClick = useCallback(async (clickLat: number, clickLng: number) => {
    setLat(clickLat);
    setLng(clickLng);
    setMarkerPos([clickLat, clickLng]);
    const city = await reverseGeocode(clickLat, clickLng);
    if (city) {
      setResolvedCity(city);
      setCityInput(city);
    }
  }, []);

  // Import or dry-run
  const handleImport = useCallback(async (dryRun: boolean) => {
    const city = resolvedCity || cityInput.trim();
    if (!city) {
      setError('Enter a city name or click the map first.');
      return;
    }
    setError(null);
    setResult(null);
    if (dryRun) setDryRunning(true);
    else setImporting(true);

    try {
      const res = await api.post('/admin/import-osm-places', { city, dryRun });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Import request failed. Is the backend running?');
    } finally {
      setImporting(false);
      setDryRunning(false);
    }
  }, [resolvedCity, cityInput]);

  const targetCity = resolvedCity || cityInput.trim();

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        OSM Place Import
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Import places from OpenStreetMap into Praxis. Search a city, click the map, or use GPS.
      </Typography>

      {/* Search bar + GPS */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="City name (e.g. Milano, Roma, Berlin...)"
          value={cityInput}
          onChange={e => setCityInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              bgcolor: 'rgba(255,255,255,0.03)',
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={searching || !cityInput.trim()}
          startIcon={searching ? <CircularProgress size={16} /> : <MapIcon />}
          sx={{
            borderRadius: '12px', fontWeight: 700, minWidth: 120,
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          }}
        >
          Search
        </Button>
        <IconButton
          onClick={handleGPS}
          disabled={searching}
          sx={{
            bgcolor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '12px', width: 42, height: 42,
            '&:hover': { bgcolor: 'rgba(245,158,11,0.2)' },
          }}
        >
          <MyLocationIcon sx={{ color: '#F59E0B', fontSize: 20 }} />
        </IconButton>
      </Stack>

      {/* Coordinates display */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="Latitude"
          type="number"
          value={lat.toFixed(4)}
          onChange={e => { setLat(parseFloat(e.target.value) || 0); setMarkerPos([parseFloat(e.target.value) || 0, lng]); }}
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.03)' } }}
        />
        <TextField
          size="small"
          label="Longitude"
          type="number"
          value={lng.toFixed(4)}
          onChange={e => { setLng(parseFloat(e.target.value) || 0); setMarkerPos([lat, parseFloat(e.target.value) || 0]); }}
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.03)' } }}
        />
        {resolvedCity && (
          <Chip
            icon={<PlaceIcon sx={{ fontSize: '16px !important' }} />}
            label={resolvedCity}
            sx={{
              height: 40, fontWeight: 700, fontSize: '0.8rem',
              bgcolor: 'rgba(99,102,241,0.1)', color: '#818CF8',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
          />
        )}
      </Stack>

      {/* Map */}
      <Box sx={{
        borderRadius: '16px', overflow: 'hidden', height: 360, mb: 3,
        border: '1px solid rgba(255,255,255,0.07)', bgcolor: '#0A0B14',
      }}>
        <MapContainer
          center={[lat, lng]}
          zoom={12}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} />
          <MapPanner lat={lat} lng={lng} />
          {markerPos && <Marker position={markerPos} />}
        </MapContainer>
      </Box>

      {/* Action buttons */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          onClick={() => handleImport(true)}
          disabled={dryRunning || importing || !targetCity}
          startIcon={dryRunning ? <CircularProgress size={16} /> : <SearchIcon />}
          sx={{
            borderRadius: '12px', fontWeight: 700, flex: 1,
            borderColor: 'rgba(139,92,246,0.4)', color: '#A78BFA',
            '&:hover': { borderColor: '#A78BFA', bgcolor: 'rgba(139,92,246,0.08)' },
          }}
        >
          {dryRunning ? 'Scanning...' : `Preview "${targetCity || '...'}"`}
        </Button>
        <Button
          variant="contained"
          onClick={() => handleImport(false)}
          disabled={importing || dryRunning || !targetCity}
          startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <CloudDownloadIcon />}
          sx={{
            borderRadius: '12px', fontWeight: 700, flex: 1,
            background: 'linear-gradient(135deg, #10B981, #059669)',
            '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)' },
          }}
        >
          {importing ? 'Importing...' : `Import "${targetCity || '...'}"`}
        </Button>
      </Stack>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
          {error}
        </Alert>
      )}

      {/* Results */}
      {result && (
        <Paper sx={{
          p: 3, borderRadius: '16px',
          bgcolor: 'rgba(255,255,255,0.03)',
          border: `1px solid ${result.dryRun ? 'rgba(139,92,246,0.3)' : 'rgba(16,185,129,0.3)'}`,
        }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {result.dryRun ? 'Preview' : 'Import Complete'}
            </Typography>
            <Chip
              label={result.dryRun ? 'DRY RUN' : 'LIVE'}
              size="small"
              sx={{
                height: 22, fontSize: '0.6rem', fontWeight: 800,
                bgcolor: result.dryRun ? 'rgba(139,92,246,0.15)' : 'rgba(16,185,129,0.15)',
                color: result.dryRun ? '#A78BFA' : '#10B981',
                border: `1px solid ${result.dryRun ? 'rgba(139,92,246,0.3)' : 'rgba(16,185,129,0.3)'}`,
              }}
            />
          </Stack>

          <Stack direction="row" spacing={3} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em' }}>
                TOTAL FOUND
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#818CF8' }}>
                {result.total.toLocaleString()}
              </Typography>
            </Box>
            {!result.dryRun && (
              <>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em' }}>
                    IMPORTED
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#10B981' }}>
                    {result.imported.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em' }}>
                    SKIPPED
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#F59E0B' }}>
                    {result.skipped.toLocaleString()}
                  </Typography>
                </Box>
              </>
            )}
          </Stack>

          <Typography variant="caption" color="text.secondary">
            City: {result.city} · Places are classified into Praxis domains (Body & Health, Culture & Hobbies, etc.)
          </Typography>

          {result.errors.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ opacity: 0.1, mb: 1 }} />
              <Typography variant="caption" color="error.main" sx={{ fontWeight: 700 }}>
                Errors ({result.errors.length}):
              </Typography>
              {result.errors.map((e, i) => (
                <Typography key={i} variant="caption" color="error.main" sx={{ display: 'block', fontSize: '0.65rem' }}>
                  {e}
                </Typography>
              ))}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default PlacesImportTab;
