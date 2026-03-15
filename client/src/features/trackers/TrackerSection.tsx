/**
 * TrackerSection — full tracker UI for the profile page.
 * Only shown on the user's own profile.
 * Lets users activate/deactivate tracker types and log entries.
 */

import React, { useState, useEffect, useCallback } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { TRACKER_TYPES, TRACKER_MAP, TrackerType } from './trackerTypes';
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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

interface Tracker {
  id: string;
  type: string;
}

interface TrackerEntry {
  id: string;
  tracker_id: string;
  data: Record<string, string>;
  logged_at: string;
}

interface TrackerSectionProps {
  userId: string;
  /** When set, only show trackers whose type is in this list */
  filterTypes?: string[];
}

// ─── Main component ───────────────────────────────────────────────────────────

const TrackerSection: React.FC<TrackerSectionProps> = ({ userId, filterTypes }) => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<Record<string, TrackerEntry[]>>({});
  const [loading, setLoading] = useState(true);

  // "Add tracker" dialog
  const [addOpen, setAddOpen] = useState(false);

  // "Log entry" dialog state
  const [logTracker, setLogTracker] = useState<(Tracker & { def: TrackerType }) | null>(null);
  const [logFields, setLogFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Exercise autocomplete — computed at component level (not inside map)
  const exerciseSuggestions = logTracker?.type === 'lift' ? searchExercises(logFields['exercise'] ?? '') : [];

  // Expenses autocomplete — computed at component level
  const expenseCategorySuggestions = logTracker?.type === 'expenses'
    ? searchCategories(logFields['category'] ?? '')
    : [];
  const merchantSuggestions = logTracker?.type === 'expenses'
    ? searchMerchants(logFields['merchant'] ?? '')
    : [];

  // Investments autocomplete — computed at component level
  const assetSuggestions = logTracker?.type === 'investments'
    ? searchAssets(logFields['asset'] ?? '')
    : [];

  // Job applications autocomplete — computed at component level
  const companySuggestions = logTracker?.type === 'job-apps'
    ? searchCompanies(logFields['company'] ?? '')
    : [];

  // Study subject autocomplete — computed at component level
  const subjectSuggestions = logTracker?.type === 'study'
    ? searchSubjects(logFields['subject'] ?? '')
    : [];

  // Music instrument autocomplete — computed at component level
  const instrumentSuggestions = logTracker?.type === 'music'
    ? searchInstruments(logFields['instrument'] ?? '')
    : [];

  // Food autocomplete state — declared at component level (hook rules)
  const [foodSuggestions, setFoodSuggestions] = useState<{ name: string; kcalPer100g: number }[]>([]);
  const [foodSearching, setFoodSearching] = useState(false);

  useEffect(() => {
    const foodQuery = logTracker?.type === 'meal' ? (logFields['food'] ?? '') : '';
    if (!foodQuery.trim()) { setFoodSuggestions([]); return; }
    const local = searchFoods(foodQuery).map(f => ({ name: f.name, kcalPer100g: f.kcalPer100g }));
    if (local.length > 0) { setFoodSuggestions(local); return; }
    // Fallback to Open Food Facts
    setFoodSearching(true);
    let active = true;
    fetchCaloriesFromOFF(foodQuery).then(r => { if (active) { setFoodSuggestions(r); setFoodSearching(false); } });
    return () => { active = false; };
  }, [logTracker?.type, logFields['food']]);

  // Book autocomplete state — declared at component level (hook rules)
  const [bookResults, setBookResults] = useState<{ title: string; author: string; totalPages: number | null }[]>([]);
  const [bookSearching, setBookSearching] = useState(false);

  useEffect(() => {
    const bookQuery = logTracker?.type === 'books' ? (logFields['title'] ?? '') : '';
    if (!bookQuery.trim()) { setBookResults([]); return; }
    let active = true;
    setBookSearching(true);
    searchBooks(bookQuery).then(r => { if (active) { setBookResults(r); setBookSearching(false); } });
    return () => { active = false; };
  }, [logTracker?.type, logFields['title']]);

  // ── data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: tData } = await supabase
      .from('trackers')
      .select('id, type')
      .eq('user_id', userId)
      .order('created_at');

    const activeTrackers: Tracker[] = tData ?? [];
    setTrackers(activeTrackers);

    if (activeTrackers.length > 0) {
      const ids = activeTrackers.map(t => t.id);
      const { data: eData } = await supabase
        .from('tracker_entries')
        .select('id, tracker_id, data, logged_at')
        .in('tracker_id', ids)
        .order('logged_at', { ascending: false });

      const grouped: Record<string, TrackerEntry[]> = {};
      for (const e of (eData ?? [])) {
        if (!grouped[e.tracker_id]) grouped[e.tracker_id] = [];
        if (grouped[e.tracker_id].length < 5) grouped[e.tracker_id].push(e);
      }
      setEntries(grouped);
    } else {
      setEntries({});
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── activate tracker ────────────────────────────────────────────────────────

  const activateTracker = async (typeId: string) => {
    const { error } = await supabase
      .from('trackers')
      .insert({ user_id: userId, type: typeId });
    if (error) { toast.error(error.message); return; }
    setAddOpen(false);
    loadData();
  };

  // ── remove tracker ──────────────────────────────────────────────────────────

  const removeTracker = async (trackerId: string) => {
    const { error } = await supabase.from('trackers').delete().eq('id', trackerId);
    if (error) { toast.error(error.message); return; }
    loadData();
  };

  // ── delete entry ────────────────────────────────────────────────────────────

  const deleteEntry = async (entryId: string) => {
    await supabase.from('tracker_entries').delete().eq('id', entryId);
    loadData();
  };

  // ── open log dialog ─────────────────────────────────────────────────────────

  const openLog = (tracker: Tracker) => {
    const def = TRACKER_MAP[tracker.type];
    if (!def) return;
    setLogTracker({ ...tracker, def });
    setLogFields({});
  };

  // ── save log entry ──────────────────────────────────────────────────────────

  const saveEntry = async () => {
    if (!logTracker) return;
    const missing = logTracker.def.fields
      .filter(f => !f.optional && !logFields[f.key]?.trim())
      .map(f => f.label);
    if (missing.length > 0) { toast.error(`Fill in: ${missing.join(', ')}`); return; }
    setSaving(true);
    const { error } = await supabase.from('tracker_entries').insert({
      tracker_id: logTracker.id,
      user_id: userId,
      data: logFields,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Logged!');
    setLogTracker(null);
    loadData();
    // Tracker log counts as a check-in (fire-and-forget)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      fetch(`${API_URL}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
    });
  };

  // ── already-active type ids ─────────────────────────────────────────────────

  const activeTypeIds = new Set(trackers.map(t => t.type));
  const filterSet = filterTypes ? new Set(filterTypes) : null;
  const visibleTrackers = filterSet
    ? trackers.filter(t => filterSet.has(t.type))
    : trackers;
  const available = TRACKER_TYPES.filter(t =>
    !activeTypeIds.has(t.id) && (!filterSet || filterSet.has(t.id))
  );

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <CircularProgress size={24} />
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Trackers</Typography>
          {visibleTrackers.filter(t => t.type !== 'progress').length > 0 && (
            <Chip label={visibleTrackers.filter(t => t.type !== 'progress').length} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(255,255,255,0.08)' }} />
          )}
        </Box>
        {available.length > 0 && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
            sx={{ borderRadius: '10px', fontWeight: 600 }}
          >
            Add Tracker
          </Button>
        )}
      </Box>

      {visibleTrackers.length === 0 ? (
        <Box
          sx={{
            border: '2px dashed rgba(255,255,255,0.1)',
            borderRadius: 3,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': { borderColor: 'rgba(245,158,11,0.3)', bgcolor: 'rgba(245,158,11,0.03)' },
            transition: 'all 0.2s',
          }}
          onClick={() => setAddOpen(true)}
        >
          <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>No trackers yet</Typography>
          <Button size="small" startIcon={<AddCircleOutlineIcon />} sx={{ borderRadius: '10px' }}>
            Add your first tracker
          </Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {visibleTrackers.filter(t => t.type !== 'progress').map(tracker => {
            const def = TRACKER_MAP[tracker.type];
            if (!def) return null;
            const trackerEntries = entries[tracker.id] ?? [];
            return (
              <GlassCard
                key={tracker.id}
                sx={{
                  p: 2.5,
                  border: `1px solid ${def.border}`,
                  bgcolor: def.bg,
                  borderRadius: '16px',
                }}
              >
                {/* Tracker header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>{def.icon}</Typography>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: def.color }}>{def.label}</Typography>
                      <Typography variant="caption" color="text.disabled">{def.description}</Typography>
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => openLog(tracker)}
                      sx={{
                        borderRadius: '8px',
                        borderColor: def.border,
                        color: def.color,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        '&:hover': { borderColor: def.color, bgcolor: def.bg },
                      }}
                    >
                      + Log
                    </Button>
                    <Tooltip title="Remove tracker">
                      <IconButton
                        size="small"
                        onClick={() => removeTracker(tracker.id)}
                        sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                {/* Recent entries */}
                {trackerEntries.length > 0 ? (
                  <Stack spacing={0.5}>
                    {trackerEntries.map((entry, i) => (
                      <Box key={entry.id}>
                        {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', my: 0.5 }} />}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.82rem' }}>
                              {def.entryLabel(entry.data)}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {new Date(entry.logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => deleteEntry(entry.id)}
                            sx={{ color: 'transparent', '&:hover': { color: 'text.disabled' } }}
                          >
                            <CloseIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.disabled">No entries yet — hit + Log to start</Typography>
                )}
              </GlassCard>
            );
          })}
        </Stack>
      )}

      {/* ── Add Tracker Dialog ─────────────────────────────────────────── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Add a Tracker</Typography>
            <IconButton size="small" onClick={() => setAddOpen(false)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            {available.map(t => (
              <Box
                key={t.id}
                onClick={() => activateTracker(t.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${t.border}`,
                  bgcolor: t.bg,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: t.color, transform: 'translateX(4px)' },
                }}
              >
                <Typography sx={{ fontSize: '1.5rem', lineHeight: 1 }}>{t.icon}</Typography>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: t.color }}>{t.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                </Box>
              </Box>
            ))}
            {available.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                All trackers are active!
              </Typography>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* ── Log Entry Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!logTracker} onClose={() => setLogTracker(null)} maxWidth="xs" fullWidth>
        {logTracker && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: '1.3rem' }}>{logTracker.def.icon}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{logTracker.def.label}</Typography>
                </Box>
                <IconButton size="small" onClick={() => setLogTracker(null)}><CloseIcon /></IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 0.5 }}>
                {logTracker.def.fields.map(field => (
                  field.key === 'category' && logTracker?.type === 'expenses' ? (
                    <Autocomplete
                      key={field.key}
                      freeSolo
                      options={expenseCategorySuggestions}
                      getOptionLabel={o => typeof o === 'string' ? o : `${o.emoji} ${o.name}`}
                      inputValue={logFields['category'] ?? ''}
                      onInputChange={(_, v) => setLogFields(p => ({ ...p, category: v }))}
                      onChange={(_, v) => {
                        if (v && typeof v !== 'string') setLogFields(p => ({ ...p, category: v.name }));
                      }}
                      renderInput={params => <TextField {...params} label="Category *" size="small" fullWidth />}
                    />
                  ) : field.key === 'merchant' && logTracker?.type === 'expenses' ? (
                    <Autocomplete
                      key={field.key}
                      freeSolo
                      options={merchantSuggestions}
                      getOptionLabel={o => typeof o === 'string' ? o : o.name}
                      inputValue={logFields['merchant'] ?? ''}
                      onInputChange={(_, v) => setLogFields(p => ({ ...p, merchant: v }))}
                      onChange={(_, v) => {
                        if (v && typeof v !== 'string') {
                          setLogFields(p => ({ ...p, merchant: v.name, category: p['category'] || v.category }));
                        }
                      }}
                      renderInput={params => <TextField {...params} label="Merchant / Description (optional)" size="small" fullWidth />}
                    />
                  ) : field.key === 'asset' && logTracker?.type === 'investments' ? (
                    <Autocomplete
                      key={field.key}
                      freeSolo
                      options={assetSuggestions}
                      getOptionLabel={o => typeof o === 'string' ? o : `${o.ticker} — ${o.name}`}
                      inputValue={logFields['asset'] ?? ''}
                      onInputChange={(_, v) => setLogFields(p => ({ ...p, asset: v }))}
                      onChange={(_, v) => {
                        if (v && typeof v !== 'string') setLogFields(p => ({ ...p, asset: `${v.ticker} — ${v.name}` }));
                      }}
                      renderInput={params => <TextField {...params} label="Asset *" size="small" fullWidth />}
                    />
                  ) : field.key === 'company' && logTracker?.type === 'job-apps' ? (
                    <Autocomplete
                      key={field.key}
                      freeSolo
                      options={companySuggestions}
                      getOptionLabel={o => typeof o === 'string' ? o : o.name}
                      inputValue={logFields['company'] ?? ''}
                      onInputChange={(_, v) => setLogFields(p => ({ ...p, company: v }))}
                      onChange={(_, v) => {
                        if (v && typeof v !== 'string') setLogFields(p => ({ ...p, company: v.name }));
                      }}
                      renderInput={params => <TextField {...params} label="Company *" size="small" fullWidth />}
                    />
                  ) : field.key === 'title' && logTracker?.type === 'books' ? (
                    <Autocomplete
                      key={field.key}
                      freeSolo
                      loading={bookSearching}
                      options={bookResults}
                      getOptionLabel={o => typeof o === 'string' ? o : `${o.title} — ${o.author}`}
                      inputValue={logFields['title'] ?? ''}
                      onInputChange={(_, v) => setLogFields(p => ({ ...p, title: v }))}
                      onChange={(_, v) => {
                        if (v && typeof v !== 'string') {
                          setLogFields(p => ({
                            ...p,
                            title: v.title,
                            author: v.author,
                            total_pages: v.totalPages ? String(v.totalPages) : p['total_pages'],
                          }));
                        }
                      }}
                      renderInput={params => <TextField {...params} label="Book title *" size="small" fullWidth />}
                    />
                  ) : field.key === 'subject' && logTracker?.type === 'study' ? (
                    <Autocomplete
                      key={field.key}
                      freeSolo
                      options={subjectSuggestions}
                      getOptionLabel={o => typeof o === 'string' ? o : o.name}
                      inputValue={logFields['subject'] ?? ''}
                      onInputChange={(_, v) => setLogFields(p => ({ ...p, subject: v }))}
                      onChange={(_, v) => {
                        if (v && typeof v !== 'string') setLogFields(p => ({ ...p, subject: v.name }));
                      }}
                      renderInput={params => <TextField {...params} label="Subject *" size="small" fullWidth />}
                    />
                  ) : field.key === 'instrument' && logTracker?.type === 'music' ? (
                    <Autocomplete
                      key={field.key}
                      freeSolo
                      options={instrumentSuggestions}
                      getOptionLabel={o => typeof o === 'string' ? o : o.name}
                      inputValue={logFields['instrument'] ?? ''}
                      onInputChange={(_, v) => setLogFields(p => ({ ...p, instrument: v }))}
                      onChange={(_, v) => {
                        if (v && typeof v !== 'string') setLogFields(p => ({ ...p, instrument: v.name }));
                      }}
                      renderInput={params => <TextField {...params} label="Instrument *" size="small" fullWidth />}
                    />
                  ) : field.key === 'food' ? (
                    <Autocomplete
                      key={field.key}
                      freeSolo
                      loading={foodSearching}
                      options={foodSuggestions}
                      getOptionLabel={o => typeof o === 'string' ? o : `${o.name} (${o.kcalPer100g} kcal/100g)`}
                      inputValue={logFields['food'] ?? ''}
                      onInputChange={(_, v) => setLogFields(p => ({ ...p, food: v }))}
                      onChange={(_, v) => {
                        if (v && typeof v !== 'string') {
                          setLogFields(p => ({ ...p, food: v.name, calories: String(v.kcalPer100g) }));
                        }
                      }}
                      renderInput={params => (
                        <TextField {...params} label="What did you eat? *" size="small" fullWidth />
                      )}
                    />
                  ) : field.key === 'exercise' ? (
                    <Autocomplete
                      key={field.key}
                      freeSolo
                      options={exerciseSuggestions}
                      getOptionLabel={o => typeof o === 'string' ? o : o.name}
                      groupBy={o => typeof o === 'string' ? '' : o.muscle}
                      inputValue={logFields['exercise'] ?? ''}
                      onInputChange={(_, v) => setLogFields(p => ({ ...p, exercise: v }))}
                      onChange={(_, v) => {
                        if (v && typeof v !== 'string') setLogFields(p => ({ ...p, exercise: v.name }));
                      }}
                      renderInput={params => (
                        <TextField {...params} label="Exercise *" size="small" placeholder="e.g. Bench Press" fullWidth />
                      )}
                    />
                  ) : field.type === 'select' ? (
                    <TextField
                      key={field.key}
                      select
                      label={`${field.label}${field.optional ? ' (optional)' : ' *'}`}
                      value={logFields[field.key] ?? ''}
                      onChange={e => setLogFields(p => ({ ...p, [field.key]: e.target.value }))}
                      fullWidth
                      size="small"
                    >
                      {field.options!.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  ) : (
                    <TextField
                      key={field.key}
                      label={`${field.label}${field.optional ? ' (optional)' : ' *'}`}
                      type={field.type}
                      value={logFields[field.key] ?? ''}
                      onChange={e => setLogFields(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      fullWidth
                      size="small"
                      inputProps={field.type === 'number' ? { min: 0, step: 'any' } : undefined}
                    />
                  )
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setLogTracker(null)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={saveEntry}
                disabled={saving}
                sx={{ borderRadius: '10px', fontWeight: 700, minWidth: 80 }}
              >
                {saving ? <CircularProgress size={18} color="inherit" /> : 'Log'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default TrackerSection;
