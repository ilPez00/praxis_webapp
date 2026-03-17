/**
 * EditableTrackerForm - Dynamic tracker form with configurable rows
 * Users can add/remove rows and customize labels for each tracker type
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, IconButton, Stack, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Autocomplete, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import toast from 'react-hot-toast';
import { TrackerType } from './trackerTypes';
import { searchExercises } from './exerciseLibrary';
import { searchFoods, fetchCaloriesFromOFF } from './foodLibrary';

interface TrackerRow {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  weight?: number;
  reps?: number;
  sets?: number;
}

interface EditableTrackerFormProps {
  open: boolean;
  onClose: () => void;
  tracker: { id: string; type: string; def: TrackerType } | null;
  onSave: (data: any) => Promise<void>;
  saving: boolean;
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
};

const EditableTrackerForm: React.FC<EditableTrackerFormProps> = ({
  open,
  onClose,
  tracker,
  onSave,
  saving,
}) => {
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [foodSuggestions, setFoodSuggestions] = useState<string[]>([]);
  const [exerciseSuggestions, setExerciseSuggestions] = useState<string[]>([]);

  // Initialize rows when tracker opens
  useEffect(() => {
    if (open && tracker) {
      const defaults = DEFAULT_ROWS[tracker.type] || [];
      setRows(defaults.length > 0 ? JSON.parse(JSON.stringify(defaults)) : [
        { id: Date.now().toString(), label: '', value: 0 }
      ]);
    }
  }, [open, tracker]);

  // Update suggestions based on tracker type
  useEffect(() => {
    if (tracker?.type === 'meal') {
      const foodQuery = rows.find(r => r.id === editingLabel)?.label || '';
      if (foodQuery.length >= 2) {
        const results = searchFoods(foodQuery);
        setFoodSuggestions(results);
        if (results.length === 1) {
          fetchCaloriesFromOFF(results[0]).then(cal => {
            if (cal && editingLabel) {
              setRows(prev => prev.map(r => 
                r.id === editingLabel ? { ...r, label: results[0] } : r
              ));
            }
          });
        }
      } else {
        setFoodSuggestions([]);
      }
    }
    if (tracker?.type === 'lift') {
      const exerciseQuery = rows.find(r => r.id === editingLabel)?.label || '';
      setExerciseSuggestions(exerciseQuery ? searchExercises(exerciseQuery) : []);
    }
  }, [tracker?.type, editingLabel, rows]);

  const handleAddRow = () => {
    const newRow: TrackerRow = tracker?.type === 'lift'
      ? { id: Date.now().toString(), label: '', value: 0, weight: 0, reps: 0, sets: 0 }
      : { id: Date.now().toString(), label: '', value: 0, unit: tracker?.type === 'meal' ? 'g' : 'pcs' };
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

  const handleLabelChange = (id: string, newLabel: string) => {
    handleUpdateRow(id, { label: newLabel });
  };

  const handleSave = async () => {
    // Validate rows
    const emptyLabels = rows.filter(r => !r.label.trim());
    if (emptyLabels.length > 0) {
      toast.error('Please fill in all item names');
      return;
    }

    // Build data object
    const data: any = {
      items: rows.map(r => ({
        name: r.label,
        value: r.value,
        unit: r.unit,
        weight: r.weight,
        reps: r.reps,
        sets: r.sets,
      })),
    };

    await onSave(data);
    setRows([]);
    onClose();
  };

  if (!tracker) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '1.2rem' }}>{tracker.def.icon}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{tracker.def.label}</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          {/* Rows */}
          {rows.map((row, index) => (
            <Box
              key={row.id}
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.1)',
                bgcolor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                {/* Label / Name Field */}
                {editingLabel === row.id ? (
                  <Autocomplete
                    freeSolo
                    options={tracker.type === 'meal' ? foodSuggestions : exerciseSuggestions}
                    value={row.label}
                    onChange={(_, val) => handleLabelChange(row.id, val || '')}
                    onInputChange={(_, val) => handleLabelChange(row.id, val || '')}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        placeholder={tracker.type === 'meal' ? 'Food item...' : 'Exercise...'}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingLabel(null);
                          if (e.key === 'Escape') setEditingLabel(null);
                        }}
                        autoFocus
                        fullWidth
                      />
                    )}
                  />
                ) : (
                  <Box
                    onClick={() => setEditingLabel(row.id)}
                    sx={{
                      flex: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: row.label ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                      border: '1px dashed rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Typography sx={{ fontSize: '0.9rem', color: row.label ? 'text.primary' : 'text.disabled' }}>
                      {row.label || 'Click to add item...'}
                    </Typography>
                    <EditIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  </Box>
                )}

                {/* Remove button */}
                <IconButton
                  size="small"
                  onClick={() => handleRemoveRow(row.id)}
                  disabled={rows.length === 1}
                  sx={{ color: 'text.secondary' }}
                >
                  <RemoveIcon />
                </IconButton>
              </Box>

              {/* Value Fields based on tracker type */}
              {tracker.type === 'meal' ? (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    type="number"
                    size="small"
                    value={row.value}
                    onChange={(e) => handleUpdateRow(row.id, { value: parseFloat(e.target.value) || 0 })}
                    sx={{ width: 100 }}
                    inputProps={{ min: 0, step: 0.5 }}
                  />
                  <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', minWidth: 30 }}>
                    {row.unit || 'g'}
                  </Typography>
                </Box>
              ) : tracker.type === 'lift' ? (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <TextField
                    type="number"
                    size="small"
                    placeholder="kg"
                    value={row.weight || ''}
                    onChange={(e) => handleUpdateRow(row.id, { weight: parseFloat(e.target.value) || 0 })}
                    sx={{ width: 80 }}
                    inputProps={{ min: 0, step: 0.5 }}
                  />
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', alignSelf: 'center' }}>kg</Typography>
                  
                  <TextField
                    type="number"
                    size="small"
                    placeholder="Reps"
                    value={row.reps || ''}
                    onChange={(e) => handleUpdateRow(row.id, { reps: parseInt(e.target.value) || 0 })}
                    sx={{ width: 70 }}
                    inputProps={{ min: 0 }}
                  />
                  
                  <TextField
                    type="number"
                    size="small"
                    placeholder="Sets"
                    value={row.sets || ''}
                    onChange={(e) => handleUpdateRow(row.id, { sets: parseInt(e.target.value) || 0 })}
                    sx={{ width: 70 }}
                    inputProps={{ min: 0 }}
                  />
                </Box>
              ) : (
                <TextField
                  type="number"
                  size="small"
                  value={row.value}
                  onChange={(e) => handleUpdateRow(row.id, { value: parseFloat(e.target.value) || 0 })}
                  sx={{ width: 100 }}
                  inputProps={{ min: 0 }}
                />
              )}
            </Box>
          ))}

          {/* Add Row Button */}
          <Button
            fullWidth
            variant="outlined"
            onClick={handleAddRow}
            startIcon={<AddIcon />}
            sx={{
              border: '1px dashed rgba(255,255,255,0.3)',
              color: 'text.secondary',
              py: 1.5,
              '&:hover': {
                border: '1px dashed rgba(255,255,255,0.5)',
                bgcolor: 'rgba(255,255,255,0.02)',
              },
            }}
          >
            Add Item
          </Button>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          sx={{
            bgcolor: '#F59E0B',
            color: '#0D0E1A',
            fontWeight: 700,
            px: 3,
            '&:hover': { bgcolor: '#FBBF24' },
          }}
        >
          {saving ? <CircularProgress size={20} /> : 'Save Log'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditableTrackerForm;
