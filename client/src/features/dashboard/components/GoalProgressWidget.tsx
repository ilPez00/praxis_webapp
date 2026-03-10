import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Popover,
  Button,
  Stack,
  Tooltip,
} from '@mui/material';
import Slider from '@mui/material/Slider';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GlassCard from '../../../components/common/GlassCard';
import { DOMAIN_COLORS } from '../../../types/goal';
import { Domain } from '../../../models/Domain';

interface BackendNode {
  id: string;
  name: string;
  progress: number; // 0-1
  domain: string;
  parentId?: string;
  weight: number;
}

interface Props {
  userId: string;
  nodes: BackendNode[];
  onProgressUpdate: (nodeId: string, newProgress: number) => void;
}

const GoalProgressWidget: React.FC<Props> = ({ userId, nodes, onProgressUpdate }) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeNode, setActiveNode] = useState<BackendNode | null>(null);
  const [sliderVal, setSliderVal] = useState(0);
  const [saving, setSaving] = useState(false);

  // Only show root-level goals (no parentId)
  const rootNodes = nodes.filter(n => !n.parentId);
  if (rootNodes.length === 0) return null;

  const handleOpen = (e: React.MouseEvent<HTMLElement>, node: BackendNode) => {
    e.stopPropagation();
    setActiveNode(node);
    setSliderVal(Math.round(node.progress * 100));
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setActiveNode(null);
  };

  const handleQuickIncrement = async (node: BackendNode) => {
    const newPct = Math.min(100, Math.round(node.progress * 100) + 10);
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.patch(
        `${API_URL}/goals/${userId}/node/${node.id}/progress`,
        { progress: newPct },
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      onProgressUpdate(node.id, newPct / 100);
      toast.success(`+10% → ${newPct}%`);
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!activeNode) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.patch(
        `${API_URL}/goals/${userId}/node/${activeNode.id}/progress`,
        { progress: sliderVal },
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      onProgressUpdate(activeNode.id, sliderVal / 100);
      toast.success(`Updated "${activeNode.name}" to ${sliderVal}%`);
      handleClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update progress.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ mt: 5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Your Goals</Typography>
        <Tooltip title="Open full goal tree">
          <IconButton size="small" onClick={() => navigate('/goal-tree')} sx={{ color: 'text.disabled' }}>
            <OpenInNewIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <GlassCard sx={{ p: 0, borderRadius: '20px', overflow: 'hidden' }}>
        {rootNodes.map((node, idx) => {
          const pct = Math.round(node.progress * 100);
          const color = DOMAIN_COLORS[node.domain as Domain] ?? '#8B5CF6';
          const isLast = idx === rootNodes.length - 1;
          return (
            <Box
              key={node.id}
              sx={{
                px: 3, py: 2,
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', gap: 2,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                transition: 'background 0.15s',
              }}
            >
              {/* Domain color bar */}
              <Box sx={{ width: 4, height: 40, borderRadius: 2, bgcolor: color, flexShrink: 0, opacity: 0.8 }} />

              {/* Goal info */}
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{node.name}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color, ml: 2, flexShrink: 0 }}>
                    {pct}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 5, borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: color },
                  }}
                />
              </Box>

              {/* Update button */}
              <Tooltip title="Update progress">
                <IconButton
                  size="small"
                  onClick={(e) => handleOpen(e, node)}
                  sx={{ color: 'text.disabled', flexShrink: 0, '&:hover': { color } }}
                >
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>

              {/* Quick +10% button */}
              <Tooltip title="+10%">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => handleQuickIncrement(node)}
                    disabled={saving || Math.round(node.progress * 100) >= 100}
                    sx={{ color: color, opacity: Math.round(node.progress * 100) >= 100 ? 0.3 : 0.7, '&:hover': { color } }}
                  >
                    <TrendingUpIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        })}
      </GlassCard>

      {/* Progress slider popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              p: 2.5, minWidth: 280, borderRadius: '16px',
              bgcolor: '#1A1B2E', border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            },
          },
        }}
      >
        {activeNode && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
              Update: {activeNode.name}
            </Typography>
            <Box sx={{ px: 1, mb: 1 }}>
              <Slider
                value={sliderVal}
                onChange={(_, v) => setSliderVal(v as number)}
                min={0} max={100} step={5}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}%`}
                sx={{
                  color: DOMAIN_COLORS[activeNode.domain as Domain] ?? '#8B5CF6',
                  '& .MuiSlider-thumb': { width: 20, height: 20 },
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              {[0, 25, 50, 75, 100].map(v => (
                <Button
                  key={v}
                  size="small"
                  variant={sliderVal === v ? 'contained' : 'text'}
                  onClick={() => setSliderVal(v)}
                  sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: '0.7rem', borderRadius: '6px' }}
                >
                  {v}%
                </Button>
              ))}
            </Box>
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="outlined" size="small" onClick={handleClose} sx={{ borderRadius: '10px' }}>
                Cancel
              </Button>
              <Button
                fullWidth variant="contained" size="small"
                onClick={handleSave} disabled={saving}
                sx={{ borderRadius: '10px' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </Stack>
          </Box>
        )}
      </Popover>
    </Box>
  );
};

export default GoalProgressWidget;
