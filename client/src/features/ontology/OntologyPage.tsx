/**
 * OntologyPage — per-user editor for Rachmaninov's symbolic domain vocabulary.
 * Each user can override contextHints, unit, defaultMode, and ayuDomain per domain.
 * Changes are stored server-side under their user ID; they don't affect other users.
 */
import React, { useState, useEffect } from 'react';
import {
  Container, Box, Typography, Card, CardContent, Chip, Button,
  TextField, Select, MenuItem, FormControl, InputLabel, Stack,
  IconButton, Divider, CircularProgress, Tooltip, Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RestoreIcon from '@mui/icons-material/Restore';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const AYU_DOMAINS = ['FABRICATE', 'STUDY', 'CONSTRUCT', 'BOND', 'HEAL'];
const ACTION_MODES = ['LIFT', 'WALK', 'WORK', 'LEARN', 'CODE', 'CREATE', 'REST'];

interface DomainEntry {
  ayuDomain: string;
  defaultMode: string;
  scoreAxis: string;
  unit: string;
  contextHints: string[];
  color: string;
  icon: string;
}

interface EditState {
  ayuDomain: string;
  defaultMode: string;
  unit: string;
  contextHints: string;
}

const OntologyPage: React.FC = () => {
  const [ontology, setOntology] = useState<Record<string, DomainEntry>>({});
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ ayuDomain: '', defaultMode: '', unit: '', contextHints: '' });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    api.get('/rachmaninov/user-ontology')
      .then(r => {
        setOntology(r.data.ontology ?? {});
        setOverrides(r.data.overrides ?? {});
      })
      .catch(() => toast.error('Failed to load ontology.'))
      .finally(() => setLoading(false));
  }, []);

  const openEdit = (domain: string, def: DomainEntry) => {
    setEditing(domain);
    setEditState({
      ayuDomain: def.ayuDomain,
      defaultMode: def.defaultMode,
      unit: def.unit,
      contextHints: def.contextHints.join(', '),
    });
  };

  const handleSave = async (domain: string) => {
    setSaving(true);
    try {
      const contextHints = editState.contextHints.split(',').map(s => s.trim()).filter(Boolean);
      await api.patch(`/rachmaninov/user-ontology/domain/${encodeURIComponent(domain)}`, {
        ayuDomain: editState.ayuDomain,
        defaultMode: editState.defaultMode,
        unit: editState.unit,
        contextHints,
      });
      // Refresh
      const r = await api.get('/rachmaninov/user-ontology');
      setOntology(r.data.ontology ?? {});
      setOverrides(r.data.overrides ?? {});
      toast.success(`${domain} updated.`);
      setEditing(null);
    } catch {
      toast.error('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (domain: string) => {
    setResetting(domain);
    try {
      await api.delete(`/rachmaninov/user-ontology/domain/${encodeURIComponent(domain)}`);
      const r = await api.get('/rachmaninov/user-ontology');
      setOntology(r.data.ontology ?? {});
      setOverrides(r.data.overrides ?? {});
      toast.success(`${domain} reset to default.`);
    } catch {
      toast.error('Reset failed.');
    } finally {
      setResetting(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ pt: 4, pb: 12 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.02em', mb: 0.5 }}>
          Ontology
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Rachmaninov's symbolic domain vocabulary — your personal overrides. Changes apply to your Aura and Axiom context only.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2, bgcolor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', color: 'text.secondary' }}>
        Overriding a domain changes how Axiom classifies your actions and which tools Aura suggests. Context hints are keywords that trigger a domain match.
      </Alert>

      <Stack spacing={2}>
        {Object.entries(ontology).map(([domain, def]) => {
          const isOverridden = !!overrides[domain];
          const isEditing = editing === domain;

          return (
            <Card key={domain} sx={{
              bgcolor: 'rgba(255,255,255,0.02)',
              border: isOverridden
                ? `1px solid ${def.color}40`
                : '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              transition: 'border-color 0.2s',
            }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: isEditing ? 2 : 0 }}>
                  <Typography sx={{ fontSize: '1.6rem', lineHeight: 1, mt: 0.25 }}>{def.icon}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: def.color }}>{domain}</Typography>
                      {isOverridden && (
                        <Chip label="customised" size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: `${def.color}20`, color: def.color, fontWeight: 700 }} />
                      )}
                    </Box>
                    {!isEditing && (
                      <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip label={def.ayuDomain} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.05)' }} />
                        <Chip label={def.defaultMode} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.05)' }} />
                        <Chip label={`unit: ${def.unit}`} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.05)' }} />
                        {def.contextHints.slice(0, 3).map(h => (
                          <Chip key={h} label={h} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem', borderColor: 'rgba(255,255,255,0.1)' }} />
                        ))}
                        {def.contextHints.length > 3 && (
                          <Typography variant="caption" color="text.disabled">+{def.contextHints.length - 3}</Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                  {!isEditing && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {isOverridden && (
                        <Tooltip title="Reset to default">
                          <IconButton size="small" onClick={() => handleReset(domain)} disabled={resetting === domain} sx={{ color: 'text.disabled', '&:hover': { color: 'warning.main' } }}>
                            {resetting === domain ? <CircularProgress size={14} /> : <RestoreIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit this domain">
                        <IconButton size="small" onClick={() => openEdit(domain, def)} sx={{ color: 'text.disabled', '&:hover': { color: def.color } }}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>

                {/* Edit form */}
                {isEditing && (
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel>Ayu Domain</InputLabel>
                        <Select
                          value={editState.ayuDomain}
                          label="Ayu Domain"
                          onChange={e => setEditState(s => ({ ...s, ayuDomain: e.target.value }))}
                        >
                          {AYU_DOMAINS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel>Default Mode</InputLabel>
                        <Select
                          value={editState.defaultMode}
                          label="Default Mode"
                          onChange={e => setEditState(s => ({ ...s, defaultMode: e.target.value }))}
                        >
                          {ACTION_MODES.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <TextField
                        size="small"
                        label="Unit"
                        value={editState.unit}
                        onChange={e => setEditState(s => ({ ...s, unit: e.target.value }))}
                        sx={{ width: 120 }}
                      />
                    </Box>
                    <TextField
                      size="small"
                      label="Context Hints (comma-separated)"
                      placeholder="e.g. gym, lift, sport, workout"
                      value={editState.contextHints}
                      onChange={e => setEditState(s => ({ ...s, contextHints: e.target.value }))}
                      helperText="Keywords that trigger this domain in Aura's context engine"
                      fullWidth
                    />
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button size="small" onClick={() => setEditing(null)} startIcon={<CloseIcon />} sx={{ color: 'text.secondary' }}>
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleSave(domain)}
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <CheckIcon />}
                        sx={{ bgcolor: def.color, color: '#0D0E1A', fontWeight: 800, '&:hover': { filter: 'brightness(1.1)' } }}
                      >
                        Save
                      </Button>
                    </Box>
                  </Stack>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Container>
  );
};

export default OntologyPage;
