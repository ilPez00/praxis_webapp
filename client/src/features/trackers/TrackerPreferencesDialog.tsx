import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, Chip, Switch,
} from '@mui/material';
import { TRACKER_TYPES } from './trackerTypes';
import { getSelectedTrackers, setSelectedTrackers } from './trackerPreferences';

interface Props {
  open: boolean;
  onClose: () => void;
  domain: string;
  available: string[];
  onSaved: (ids: string[]) => void;
}

const TrackerPreferencesDialog: React.FC<Props> = ({
  open, onClose, domain, available, onSaved,
}) => {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelected(getSelectedTrackers(domain, available));
  }, [open, domain, available]);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const save = () => {
    setSelectedTrackers(domain, selected);
    onSaved(selected);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: '20px', bgcolor: '#0F1117' } }}
    >
      <DialogTitle sx={{ fontWeight: 900, fontSize: '1.1rem' }}>
        Trackers for {domain}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontWeight: 500 }}>
          Pick which trackers appear in the logger for this topic. Keep it to 1-2 for focus; add more only when you need them.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {available.map(id => {
            const cfg = TRACKER_TYPES.find(t => t.id === id);
            const isOn = selected.includes(id);
            const accent = cfg?.color || '#A78BFA';
            return (
              <Box
                key={id}
                onClick={() => toggle(id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25,
                  p: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                  bgcolor: isOn ? `${accent}14` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isOn ? accent + '55' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.12s',
                  '&:hover': { bgcolor: `${accent}18` },
                }}
              >
                <Typography sx={{ fontSize: '1.1rem' }}>{cfg?.icon || '📊'}</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#F3F4F6' }} noWrap>
                    {cfg?.label || id}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)' }} noWrap>
                    {cfg?.description || ''}
                  </Typography>
                </Box>
                <Switch
                  checked={isOn}
                  size="small"
                  sx={{
                    '& .MuiSwitch-thumb': { bgcolor: isOn ? accent : undefined },
                    '& .MuiSwitch-track': { bgcolor: isOn ? `${accent}66 !important` : undefined },
                  }}
                />
              </Box>
            );
          })}
        </Box>
        {selected.length > 2 && (
          <Chip
            label="Heads up: more than 2 trackers per topic can dilute focus."
            size="small"
            sx={{
              mt: 1.5, width: '100%', fontSize: '0.65rem',
              bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={selected.length === 0}
          sx={{ borderRadius: '10px', fontWeight: 700 }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TrackerPreferencesDialog;
