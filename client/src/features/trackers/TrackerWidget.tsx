/**
 * TrackerWidget — compact tracker panel for the Dashboard.
 * Shows active trackers with today's entry count and a quick-log button.
 * Supports offline logging with auto-sync.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/db';
import { TRACKER_MAP, DOMAIN_TRACKER_MAP, TrackerType } from './trackerTypes';
import { searchExercises } from './exerciseLibrary';
import { searchFoods, fetchCaloriesFromOFF } from './foodLibrary';
import { searchBooks } from './booksLibrary';
import { searchCategories, searchMerchants } from './expensesLibrary';
import { searchAssets } from './investmentsLibrary';
import { searchCompanies } from './companiesLibrary';
import { searchSubjects } from './subjectsLibrary';
import { searchInstruments } from './musicLibrary';
import GlassCard from '../../components/common/GlassCard';
import toast from 'react-hot-toast';
import Autocomplete from '@mui/material/Autocomplete';
import {
  Box,
  Typography,
  Button,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../lib/api';

interface Tracker { id: string; type: string; }

interface TrackerWidgetProps {
  userId: string;
}

const TrackerWidget: React.FC<TrackerWidgetProps> = ({ userId }) => {
  const navigate = useNavigate();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [todayCounts, setTodayCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Log dialog
  const [logTracker, setLogTracker] = useState<(Tracker & { def: TrackerType }) | null>(null);
  const [logFields, setLogFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Autocomplete suggestions
  const [exerciseSuggestions, setExerciseSuggestions] = useState<string[]>([]);
  const [foodSuggestions, setFoodSuggestions] = useState<string[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [merchantSuggestions, setMerchantSuggestions] = useState<string[]>([]);
  const [assetSuggestions, setAssetSuggestions] = useState<string[]>([]);
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([]);
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
  const [instrumentSuggestions, setInstrumentSuggestions] = useState<string[]>([]);
  const [bookSuggestions, setBookSuggestions] = useState<{ title: string; author: string }[]>([]);

  // Update suggestions based on input
  useEffect(() => {
    const exerciseQuery = logTracker?.type === 'lift' ? (logFields['exercise'] ?? '') : '';
    setExerciseSuggestions(exerciseQuery ? searchExercises(exerciseQuery) : []);
  }, [logTracker?.type, logFields['exercise']]);

  useEffect(() => {
    const foodQuery = logTracker?.type === 'meal' ? (logFields['food'] ?? '') : '';
    if (foodQuery.length >= 2) {
      const results = searchFoods(foodQuery);
      setFoodSuggestions(results);
      // If exactly one match, auto-fetch calories
      if (results.length === 1 && !logFields['calories']) {
        fetchCaloriesFromOFF(results[0]).then(cal => {
          if (cal) setLogFields(f => ({ ...f, calories: String(cal) }));
        });
      }
    } else {
      setFoodSuggestions([]);
    }
  }, [logTracker?.type, logFields['food']]);

  useEffect(() => {
    const bookQuery = logTracker?.type === 'books' ? (logFields['title'] ?? '') : '';
    if (bookQuery.length >= 2) {
      searchBooks(bookQuery).then(setBookSuggestions);
    } else {
      setBookSuggestions([]);
    }
  }, [logTracker?.type, logFields['title']]);

  useEffect(() => {
    if (logTracker?.type === 'expenses') {
      setCategorySuggestions(searchCategories());
      const merchantQuery = logFields['merchant'] ?? '';
      if (merchantQuery.length >= 2) {
        setMerchantSuggestions(searchMerchants(merchantQuery));
      } else {
        setMerchantSuggestions([]);
      }
    }
  }, [logTracker?.type, logFields['merchant']]);

  useEffect(() => {
    if (logTracker?.type === 'investments') {
      const assetQuery = logFields['asset'] ?? '';
      if (assetQuery.length >= 2) {
        setAssetSuggestions(searchAssets(assetQuery));
      } else {
        setAssetSuggestions([]);
      }
    }
  }, [logTracker?.type, logFields['asset']]);

  useEffect(() => {
    if (logTracker?.type === 'job-apps') {
      const companyQuery = logFields['company'] ?? '';
      if (companyQuery.length >= 2) {
        setCompanySuggestions(searchCompanies(companyQuery));
      } else {
        setCompanySuggestions([]);
      }
    }
  }, [logTracker?.type, logFields['company']]);

  useEffect(() => {
    if (logTracker?.type === 'study') {
      const subjectQuery = logFields['subject'] ?? '';
      if (subjectQuery.length >= 2) {
        setSubjectSuggestions(searchSubjects(subjectQuery));
      } else {
        setSubjectSuggestions([]);
      }
    }
  }, [logTracker?.type, logFields['subject']]);

  useEffect(() => {
    if (logTracker?.type === 'music') {
      const instrumentQuery = logFields['instrument'] ?? '';
      if (instrumentQuery.length >= 2) {
        setInstrumentSuggestions(searchInstruments(instrumentQuery));
      } else {
        setInstrumentSuggestions([]);
      }
    }
  }, [logTracker?.type, logFields['instrument']]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch user's goal domains to determine which trackers to auto-activate
      const { data: treeData } = await supabase
        .from('goal_trees')
        .select('nodes')
        .eq('user_id', userId)
        .single();

      if (treeData?.nodes) {
        const nodes = treeData.nodes as any[];
        const domains = [...new Set(nodes.map(n => n.domain).filter(Boolean))];
        const trackerIdsToActivate = new Set<string>();
        domains.forEach(d => {
          const trackerIds = DOMAIN_TRACKER_MAP[d] ?? [];
          trackerIds.forEach(id => trackerIdsToActivate.add(id));
        });

        // Fetch already-active trackers for this user
        const { data: activeTrackers } = await supabase
          .from('trackers')
          .select('id, type')
          .eq('user_id', userId);

        const existingTypes = new Set(activeTrackers?.map(t => t.type) ?? []);
        const toCreate = [...trackerIdsToActivate].filter(id => !existingTypes.has(id));

        if (toCreate.length > 0) {
          const inserts = toCreate.map(type => ({ user_id: userId, type }));
          await supabase.from('trackers').insert(inserts);
        }
      }

      // 2. Fetch the (now possibly updated) active trackers
      const { data: tData } = await supabase
        .from('trackers')
        .select('id, type')
        .eq('user_id', userId);
      const activeTrackers: Tracker[] = tData ?? [];
      setTrackers(activeTrackers);

      // 3. Count today's entries per tracker (including offline entries)
      if (activeTrackers.length > 0) {
        const ids = activeTrackers.map(t => t.id);
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10);

        // Fetch online entries
        const { data: entries } = await supabase
          .from('tracker_entries')
          .select('tracker_id')
          .in('tracker_id', ids)
          .gte('logged_at', today)
          .lt('logged_at', tomorrowStr);

        const counts: Record<string, number> = {};
        entries?.forEach(e => {
          counts[e.tracker_id] = (counts[e.tracker_id] ?? 0) + 1;
        });

        // Add offline entries
        const offlineEntries = await db.trackerEntries
          .where('logged_at')
          .between(today, tomorrowStr)
          .toArray();
        
        offlineEntries.forEach(e => {
          counts[e.tracker_id] = (counts[e.tracker_id] ?? 0) + 1;
        });

        setTodayCounts(counts);
      }
    } catch (err) {
      console.error('TrackerWidget: error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openLog = (tracker: Tracker) => {
    const def = TRACKER_MAP[tracker.type];
    if (!def) return;
    setLogTracker({ ...tracker, def });
    setLogFields({});
  };

  const saveEntry = async () => {
    if (!logTracker) return;
    const missing = logTracker.def.fields
      .filter(f => !f.optional && !logFields[f.key]?.trim())
      .map(f => f.label);
    if (missing.length > 0) { toast.error(`Fill in: ${missing.join(', ')}`); return; }
    
    setSaving(true);
    
    const entryData = {
      tracker_id: logTracker.id,
      tracker_type: logTracker.type,
      data: logFields,
      logged_at: new Date().toISOString(),
    };

    try {
      // Try online first
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      
      await axios.post(`${API_URL}/trackers/log`, {
        type: logTracker.type,
        data: logFields,
      }, { headers });
      
      toast.success('Logged!');
    } catch (err: any) {
      // If network error, save offline
      if (err.message === 'Network Error' || !navigator.onLine) {
        await db.trackerEntries.add({
          tracker_id: logTracker.id,
          tracker_type: logTracker.type,
          data: logFields,
          logged_at: new Date().toISOString(),
          sync_status: 'pending'
        });
        toast.success('Saved offline (will sync when online) 📡');
      } else {
        toast.error('Failed to log');
        console.error('Tracker error:', err);
      }
    }
    
    setSaving(false);
    setLogTracker(null);
    loadData();
  };

  return (
    <GlassCard sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Trackers</Typography>
        <Button
          size="small"
          variant="text"
          onClick={() => navigate('/profile')}
          sx={{ fontSize: '0.75rem', color: 'text.secondary', borderRadius: '8px' }}
        >
          Manage
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : trackers.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 1.5 }}>
            No trackers set up yet
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate('/profile')}
            variant="outlined"
            sx={{ borderRadius: '10px', fontSize: '0.78rem' }}
          >
            Set up trackers
          </Button>
        </Box>
      ) : (
        <Stack spacing={1}>
          {trackers.map(tracker => {
            const def = TRACKER_MAP[tracker.type];
            if (!def) return null;
            const count = todayCounts[tracker.id] ?? 0;
            return (
              <Box
                key={tracker.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${def.border}`,
                  bgcolor: def.bg,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>{def.icon}</Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: def.color, lineHeight: 1.2 }}>
                      {def.label}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {count > 0 ? `${count} log${count > 1 ? 's' : ''} today` : 'Not logged today'}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  size="small"
                  onClick={() => openLog(tracker)}
                  sx={{
                    borderRadius: '8px',
                    minWidth: 0,
                    px: 1.5,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    bgcolor: def.color,
                    color: '#0D0E1A',
                    '&:hover': { bgcolor: def.color, opacity: 0.9 },
                  }}
                >
                  + Log
                </Button>
              </Box>
            );
          })}
        </Stack>
      )}

      {/* Log Dialog */}
      <Dialog open={!!logTracker} onClose={() => setLogTracker(null)} maxWidth="xs" fullWidth>
        {logTracker && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: '1.2rem' }}>{logTracker.def.icon}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{logTracker.def.label}</Typography>
                </Box>
                <IconButton size="small" onClick={() => setLogTracker(null)}><CloseIcon /></IconButton>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Stack spacing={2}>
                {logTracker.def.fields.map(field => (
                  field.key === 'category' && logTracker?.type === 'expenses' ? (
                    <TextField
                      key={field.key}
                      select
                      label={field.label}
                      value={logFields[field.key] ?? ''}
                      onChange={(e) => setLogFields({ ...logFields, [field.key]: e.target.value })}
                      fullWidth
                    >
                      {categorySuggestions.map(cat => (
                        <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                      ))}
                    </TextField>
                  ) : field.key === 'merchant' && logTracker?.type === 'expenses' ? (
                    <Autocomplete
                      key={field.key}
                      options={merchantSuggestions}
                      inputValue={logFields[field.key] ?? ''}
                      onInputChange={(_, val) => setLogFields({ ...logFields, [field.key]: val })}
                      renderInput={(params) => <TextField {...params} label={field.label} />}
                    />
                  ) : field.key === 'asset' && logTracker?.type === 'investments' ? (
                    <Autocomplete
                      key={field.key}
                      options={assetSuggestions}
                      inputValue={logFields[field.key] ?? ''}
                      onInputChange={(_, val) => setLogFields({ ...logFields, [field.key]: val })}
                      renderInput={(params) => <TextField {...params} label={field.label} />}
                    />
                  ) : field.key === 'company' && logTracker?.type === 'job-apps' ? (
                    <Autocomplete
                      key={field.key}
                      options={companySuggestions}
                      inputValue={logFields[field.key] ?? ''}
                      onInputChange={(_, val) => setLogFields({ ...logFields, [field.key]: val })}
                      renderInput={(params) => <TextField {...params} label={field.label} />}
                    />
                  ) : field.key === 'title' && logTracker?.type === 'books' ? (
                    <Autocomplete
                      key={field.key}
                      options={bookSuggestions.map(b => b.title)}
                      inputValue={logFields[field.key] ?? ''}
                      onInputChange={(_, val) => {
                        setLogFields({ ...logFields, [field.key]: val });
                        const book = bookSuggestions.find(b => b.title === val);
                        if (book) {
                          setLogFields({ ...logFields, author: book.author });
                        }
                      }}
                      renderInput={(params) => <TextField {...params} label={field.label} />}
                    />
                  ) : field.key === 'subject' && logTracker?.type === 'study' ? (
                    <Autocomplete
                      key={field.key}
                      options={subjectSuggestions}
                      inputValue={logFields[field.key] ?? ''}
                      onInputChange={(_, val) => setLogFields({ ...logFields, [field.key]: val })}
                      renderInput={(params) => <TextField {...params} label={field.label} />}
                    />
                  ) : field.key === 'instrument' && logTracker?.type === 'music' ? (
                    <Autocomplete
                      key={field.key}
                      options={instrumentSuggestions}
                      inputValue={logFields[field.key] ?? ''}
                      onInputChange={(_, val) => setLogFields({ ...logFields, [field.key]: val })}
                      renderInput={(params) => <TextField {...params} label={field.label} />}
                    />
                  ) : field.key === 'exercise' && logTracker?.type === 'lift' ? (
                    <Autocomplete
                      key={field.key}
                      options={exerciseSuggestions}
                      inputValue={logFields[field.key] ?? ''}
                      onInputChange={(_, val) => setLogFields({ ...logFields, [field.key]: val })}
                      renderInput={(params) => <TextField {...params} label={field.label} />}
                    />
                  ) : field.key === 'food' && logTracker?.type === 'meal' ? (
                    <Autocomplete
                      key={field.key}
                      options={foodSuggestions}
                      inputValue={logFields[field.key] ?? ''}
                      onInputChange={(_, val) => setLogFields({ ...logFields, [field.key]: val })}
                      renderInput={(params) => <TextField {...params} label={field.label} />}
                    />
                  ) : (
                    <TextField
                      key={field.key}
                      label={field.label}
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={logFields[field.key] ?? ''}
                      onChange={(e) => setLogFields({ ...logFields, [field.key]: e.target.value })}
                      fullWidth
                      required={!field.optional}
                    />
                  )
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setLogTracker(null)}>Cancel</Button>
              <Button
                onClick={saveEntry}
                variant="contained"
                disabled={saving}
                sx={{ bgcolor: '#F59E0B', color: '#0D0E1A', fontWeight: 700 }}
              >
                {saving ? <CircularProgress size={20} /> : 'Save'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </GlassCard>
  );
};

export default TrackerWidget;
