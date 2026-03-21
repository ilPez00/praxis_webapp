/**
 * EditableTrackerForm - Dynamic tracker form with configurable rows
 * Users can add/remove rows and customize labels for each tracker type
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, IconButton, Stack, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Autocomplete, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import toast from 'react-hot-toast';
import { TrackerType } from './trackerTypes';
import { searchExercises } from './exerciseLibrary';
import { searchFoods, fetchCaloriesFromOFF } from './foodLibrary';
import { searchBooks } from './booksLibrary';
import { searchCategories, searchMerchants } from './expensesLibrary';
import { searchAssets } from './investmentsLibrary';
import { searchCompanies } from './companiesLibrary';
import { searchSubjects } from './subjectsLibrary';
import { searchInstruments } from './musicLibrary';

interface TrackerRow {
  id: string;
  label: string; // usually the "name" or "item"
  value: string | number;
  unit?: string;
  weight?: number;
  reps?: number;
  sets?: number;
  // Specialized fields
  category?: string;
  merchant?: string;
  amount?: number;
  status?: string;
  action?: string;
  price?: number;
  quantity?: number;
  duration?: number;
  distance?: number;
  author?: string;
  pages_read?: number;
  total_pages?: number;
  subject?: string;
  instrument?: string;
  person?: string;
  type?: string;
}

interface EditableTrackerFormProps {
  open: boolean;
  onClose: () => void;
  tracker: { id: string; type: string; def: TrackerType } | null;
  onSave: (data: any) => Promise<void>;
  saving: boolean;
  /** Render form rows inline (no Dialog wrapper) */
  inline?: boolean;
  /** Accent color for inline mode buttons */
  accentColor?: string;
}

// Default rows for common trackers
const DEFAULT_ROWS: Record<string, TrackerRow[]> = {
  meal: [
    { id: '1', label: 'Eggs', value: 0, unit: 'pcs' },
    { id: '2', label: 'Chicken Breast', value: 0, unit: 'g' },
    { id: '3', label: 'Rice', value: 0, unit: 'g' },
    { id: '4', label: 'Olive Oil', value: 0, unit: 'ml' },
    { id: '5', label: 'Milk', value: 0, unit: 'ml' },
  ],
  lift: [
    { id: '1', label: 'Bench Press', value: 0, weight: 0, reps: 0, sets: 0 },
    { id: '2', label: 'Squat', value: 0, weight: 0, reps: 0, sets: 0 },
    { id: '3', label: 'Deadlift', value: 0, weight: 0, reps: 0, sets: 0 },
    { id: '4', label: 'Shoulder Press', value: 0, weight: 0, reps: 0, sets: 0 },
  ],
  expenses: [
    { id: '1', label: 'Groceries', category: 'Food', amount: 0, merchant: '' }
  ],
  cardio: [
    { id: '1', label: 'Running', duration: 30, distance: 5 }
  ],
  study: [
    { id: '1', label: 'Focus Session', subject: '', duration: 60 }
  ]
};

const EditableTrackerForm: React.FC<EditableTrackerFormProps> = ({
  open,
  onClose,
  tracker,
  onSave,
  saving,
  inline = false,
  accentColor,
}) => {
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  
  // Library suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Initialize rows when tracker opens
  useEffect(() => {
    if (open && tracker) {
      const defaults = DEFAULT_ROWS[tracker.type] || [];
      setRows(defaults.length > 0 ? JSON.parse(JSON.stringify(defaults)) : [
        { id: Date.now().toString(), label: '', value: 0 }
      ]);
    }
  }, [open, tracker]);

  // Handle autocomplete search
  useEffect(() => {
    if (!editingLabel) return;
    const row = rows.find(r => r.id === editingLabel);
    const query = row?.label || '';
    if (!query.trim()) { setSuggestions([]); return; }

    let results: any[] = [];
    setSearching(true);

    switch(tracker?.type) {
      case 'meal':
        results = searchFoods(query);
        break;
      case 'lift':
        results = searchExercises(query);
        break;
      case 'books':
        searchBooks(query).then(res => setSuggestions(res)).finally(() => setSearching(false));
        return;
      case 'expenses':
        results = searchCategories(query);
        break;
      case 'investments':
        results = searchAssets(query);
        break;
      case 'job-apps':
        results = searchCompanies(query);
        break;
      case 'study':
        results = searchSubjects(query);
        break;
      case 'music':
        results = searchInstruments(query);
        break;
    }

    setSuggestions(results);
    setSearching(false);
  }, [editingLabel, rows, tracker?.type]);

  const handleAddRow = () => {
    const baseRow = { id: Date.now().toString(), label: '', value: 0 };
    let newRow: TrackerRow = baseRow;

    if (tracker?.type === 'lift') {
      newRow = { ...baseRow, weight: 0, reps: 0, sets: 0 };
    } else if (tracker?.type === 'meal') {
      newRow = { ...baseRow, unit: 'g' };
    } else if (tracker?.type === 'expenses') {
      newRow = { ...baseRow, category: 'Food', amount: 0, merchant: '' };
    } else if (tracker?.type === 'cardio') {
      newRow = { ...baseRow, duration: 0, distance: 0 };
    } else if (tracker?.type === 'study') {
      newRow = { ...baseRow, subject: '', duration: 0 };
    }

    setRows([...rows, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(r => r.id !== id));
    }
  };

  const handleUpdateRow = (id: string, updates: Partial<TrackerRow>) => {
    setRows(rows.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleSelectSuggestion = (id: string, val: any) => {
    if (!val) return;
    const name = typeof val === 'string' ? val : (val.name || val.title || val.ticker || val.label);
    const updates: Partial<TrackerRow> = { label: name };

    // Type-specific auto-fill
    if (tracker?.type === 'meal' && val.kcalPer100g) {
      updates.value = val.kcalPer100g;
    } else if (tracker?.type === 'books') {
      updates.author = val.author;
      updates.total_pages = val.totalPages;
    } else if (tracker?.type === 'expenses' && val.name) {
      updates.category = val.name;
    } else if (tracker?.type === 'investments' && val.ticker) {
      updates.label = `${val.ticker} — ${val.name}`;
    }

    handleUpdateRow(id, updates);
    setEditingLabel(null);
  };

  const handleSave = async () => {
    // Validate rows
    const emptyLabels = rows.filter(r => !r.label.trim() && !r.subject?.trim());
    if (emptyLabels.length > 0) {
      toast.error('Please fill in all item names');
      return;
    }

    // Build data object
    const data: any = {
      items: rows.map(r => ({
        name: r.label || r.subject || 'Item',
        value: r.value,
        unit: r.unit,
        weight: r.weight,
        reps: r.reps,
        sets: r.sets,
        category: r.category,
        merchant: r.merchant,
        amount: r.amount,
        status: r.status,
        action: r.action,
        price: r.price,
        quantity: r.quantity,
        duration: r.duration,
        distance: r.distance,
        author: r.author,
        pages_read: r.pages_read,
        total_pages: r.total_pages,
        subject: r.subject,
        instrument: r.instrument,
        person: r.person,
        type: r.type
      })),
    };

    await onSave(data);
    setRows([]);
    onClose();
  };

  const renderRowFields = (row: TrackerRow) => {
    switch(tracker?.type) {
      case 'meal':
        return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              type="number" label="Qty" size="small"
              value={row.value}
              onChange={(e) => handleUpdateRow(row.id, { value: parseFloat(e.target.value) || 0 })}
              sx={{ width: 80 }}
            />
            <Select
              size="small" value={row.unit || 'g'}
              onChange={(e) => handleUpdateRow(row.id, { unit: e.target.value })}
              sx={{ width: 80 }}
            >
              <MenuItem value="g">g</MenuItem>
              <MenuItem value="ml">ml</MenuItem>
              <MenuItem value="pcs">pcs</MenuItem>
              <MenuItem value="kcal">kcal</MenuItem>
            </Select>
          </Box>
        );
      case 'lift':
        return (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              type="number" label="kg" size="small"
              value={row.weight || ''}
              onChange={(e) => handleUpdateRow(row.id, { weight: parseFloat(e.target.value) || 0 })}
              sx={{ width: 70 }}
            />
            <TextField
              type="number" label="Reps" size="small"
              value={row.reps || ''}
              onChange={(e) => handleUpdateRow(row.id, { reps: parseInt(e.target.value) || 0 })}
              sx={{ width: 70 }}
            />
            <TextField
              type="number" label="Sets" size="small"
              value={row.sets || ''}
              onChange={(e) => handleUpdateRow(row.id, { sets: parseInt(e.target.value) || 0 })}
              sx={{ width: 70 }}
            />
          </Box>
        );
      case 'expenses':
        return (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              type="number" label="Amount (€)" size="small"
              value={row.amount || ''}
              onChange={(e) => handleUpdateRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
              sx={{ width: 100 }}
            />
            <TextField
              label="Merchant" size="small"
              value={row.merchant || ''}
              onChange={(e) => handleUpdateRow(row.id, { merchant: e.target.value })}
              sx={{ flex: 1, minWidth: 120 }}
            />
          </Box>
        );
      case 'cardio':
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              type="number" label="Min" size="small"
              value={row.duration || ''}
              onChange={(e) => handleUpdateRow(row.id, { duration: parseInt(e.target.value) || 0 })}
              sx={{ width: 80 }}
            />
            <TextField
              type="number" label="km" size="small"
              value={row.distance || ''}
              onChange={(e) => handleUpdateRow(row.id, { distance: parseFloat(e.target.value) || 0 })}
              sx={{ width: 80 }}
            />
          </Box>
        );
      case 'books':
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              type="number" label="Pages read" size="small"
              value={row.pages_read || ''}
              onChange={(e) => handleUpdateRow(row.id, { pages_read: parseInt(e.target.value) || 0 })}
              sx={{ width: 100 }}
            />
            <Typography sx={{ alignSelf: 'center', color: 'text.disabled' }}>/</Typography>
            <TextField
              type="number" label="Total" size="small"
              value={row.total_pages || ''}
              onChange={(e) => handleUpdateRow(row.id, { total_pages: parseInt(e.target.value) || 0 })}
              sx={{ width: 80 }}
            />
          </Box>
        );
      default:
        return (
          <TextField
            type="number" label="Value" size="small"
            value={row.value}
            onChange={(e) => handleUpdateRow(row.id, { value: parseFloat(e.target.value) || 0 })}
            sx={{ width: 100 }}
          />
        );
    }
  };

  if (!tracker) return null;

  // Shared form body — used by both Dialog and inline modes
  const formBody = (
    <Stack spacing={2}>
      {rows.map((row) => (
        <Box
          key={row.id}
          sx={{
            p: 1.5,
            borderRadius: inline ? '12px' : '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.02)',
            position: 'relative'
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
            {editingLabel === row.id ? (
              <Autocomplete
                freeSolo
                loading={searching}
                options={suggestions}
                getOptionLabel={o => typeof o === 'string' ? o : (o.name || o.title || o.ticker || o.label || '')}
                value={row.label}
                onChange={(_, val) => handleSelectSuggestion(row.id, val)}
                onInputChange={(_, val) => handleUpdateRow(row.id, { label: val })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Search or type name..."
                    autoFocus
                    fullWidth
                  />
                )}
                sx={{ flex: 1 }}
              />
            ) : (
              <Box
                onClick={() => setEditingLabel(row.id)}
                sx={{
                  flex: 1,
                  p: 1,
                  borderRadius: '8px',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: '1px dashed rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  {row.label || row.subject || 'Click to set item name...'}
                </Typography>
                <EditIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              </Box>
            )}

            <IconButton
              size="small"
              onClick={() => handleRemoveRow(row.id)}
              disabled={rows.length === 1}
              sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'error.main' } }}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
          </Box>

          {renderRowFields(row)}
        </Box>
      ))}

      <Button
        fullWidth
        variant="outlined"
        onClick={handleAddRow}
        startIcon={<AddIcon />}
        sx={{
          borderRadius: '12px',
          border: '1px dashed rgba(255,255,255,0.15)',
          color: 'text.secondary',
          py: 1,
          fontSize: '0.75rem',
          '&:hover': { border: '1px dashed', borderColor: accentColor || 'primary.main', bgcolor: `${accentColor || 'rgba(139,92,246'}${accentColor ? '0a' : ',0.05)'}` }
        }}
      >
        Add Row
      </Button>
    </Stack>
  );

  // ── Inline mode: render form body + log button directly ──
  if (inline) {
    return (
      <Box>
        {formBody}
        <Button
          fullWidth
          onClick={handleSave}
          disabled={saving}
          sx={{
            mt: 2, borderRadius: '14px', fontWeight: 800, py: 1.25, fontSize: '0.85rem',
            background: accentColor
              ? `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`
              : 'linear-gradient(135deg, #A78BFA, #F59E0B)',
            color: '#0D0E1A',
            '&:hover': { filter: 'brightness(1.1)' },
            '&:disabled': { opacity: 0.4 },
          }}
        >
          {saving ? <CircularProgress size={18} color="inherit" /> : `Log Entry (+1 PP)`}
        </Button>
      </Box>
    );
  }

  // ── Dialog mode (original) ──
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '1.5rem' }}>{tracker.def.icon}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{tracker.def.label}</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {formBody}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary', borderRadius: '10px' }}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          sx={{
            borderRadius: '10px',
            bgcolor: 'primary.main',
            color: '#0D0E1A',
            fontWeight: 800,
            px: 4,
            '&:hover': { bgcolor: 'primary.light' },
          }}
        >
          {saving ? <CircularProgress size={20} color="inherit" /> : 'Log Entry'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditableTrackerForm;
