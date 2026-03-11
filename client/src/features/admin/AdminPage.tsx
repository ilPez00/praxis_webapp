import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container, Box, Typography, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Chip, Avatar, TextField, InputAdornment, CircularProgress,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
  Divider, Tabs, Tab, Select, MenuItem, FormControl, InputLabel,
  Grid,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BlockIcon from '@mui/icons-material/Block';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ShieldIcon from '@mui/icons-material/Shield';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import SearchIcon from '@mui/icons-material/Search';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import RefreshIcon from '@mui/icons-material/Refresh';
import StarsIcon from '@mui/icons-material/Stars';
import GroupsIcon from '@mui/icons-material/Groups';
import BarChartIcon from '@mui/icons-material/BarChart';
import HubIcon from '@mui/icons-material/Hub';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AddIcon from '@mui/icons-material/Add';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SchoolIcon from '@mui/icons-material/School';
import DownloadIcon from '@mui/icons-material/Download';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditTreeIcon from '@mui/icons-material/AccountTree';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { DOMAIN_COLORS } from '../../types/goal';
import { Domain } from '../../models/Domain';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  email?: string;
  name?: string;
  is_demo?: boolean;
  is_admin?: boolean;
  is_premium?: boolean;
  onboarding_completed?: boolean;
  banned_until?: string | null;
  role?: string;
  honor_score?: number;
  praxis_points?: number;
  current_streak?: number;
  reliability_score?: number;
  goal_tree_edit_count?: number;
  created_at: string;
}

interface UserDetail extends AdminUser {
  bio?: string;
  avatar_url?: string;
  username?: string;
  city?: string;
  checkin_count: number;
  post_count: number;
  friend_count: number;
  root_goal_count: number;
  total_node_count: number;
  verification_count: number;
}

interface AdminGroup {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  is_board?: boolean;
}

interface AdminStats {
  totalUsers: number;
  totalGoalTrees: number;
  totalPoints: number;
  avgStreak: number;
  premiumCount: number;
  activeToday: number;
  totalChallenges: number;
}

interface NetworkNode {
  id: string;
  name: string;
  points: number;
  streak: number;
  domains: string[];
}

interface NetworkEdge {
  source: string;
  target: string;
  sharedDomains: string[];
}

interface AdminChallenge {
  id: string;
  title: string;
  description?: string;
  domain: string;
  duration_days: number;
  reward_points: number;
  created_at: string;
}

interface AdminService {
  id: string;
  user_id: string;
  user_name?: string;
  title: string;
  type: string;
  domain?: string;
  price?: number;
  price_currency?: string;
  active: boolean;
  created_at: string;
}

interface AdminCoach {
  id: string;
  user_id: string;
  bio?: string;
  domains?: string[];
  skills?: string[];
  rating?: number;
  hourly_rate?: number;
  is_available: boolean;
  created_at: string;
}

interface SystemConfig {
  key: string;
  value: string;
  updated_at: string;
  updated_by?: string;
}

type ConfirmAction =
  | { type: 'delete'; user: AdminUser }
  | { type: 'ban'; user: AdminUser }
  | { type: 'delete-demo' }
  | { type: 'delete-group'; group: AdminGroup }
  | { type: 'delete-service'; service: AdminService }
  | null;

// ── Auth helper ───────────────────────────────────────────────────────────────

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

const authHeaders = async () => {
  const token = await getToken();
  return { Authorization: `Bearer ${token}` };
};

// ── CSV helper ────────────────────────────────────────────────────────────────

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
  };
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Tab panel ─────────────────────────────────────────────────────────────────

const TabPanel: React.FC<{ value: number; index: number; children: React.ReactNode }> = ({ value, index, children }) => (
  <div hidden={value !== index} style={{ paddingTop: 24 }}>
    {value === index && children}
  </div>
);

// ── Network diagram (circular chord-style) ────────────────────────────────────

const NetworkDiagram: React.FC<{ nodes: NetworkNode[]; edges: NetworkEdge[] }> = ({ nodes, edges }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 560;
  const H = 560;
  const CX = W / 2;
  const CY = H / 2;
  const ORBIT_R = 210;
  const NODE_R = 18;

  if (nodes.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
        <HubIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
        <Typography variant="body2">No users with goal trees yet.</Typography>
      </Box>
    );
  }

  // Arrange nodes in a circle
  const positions = nodes.map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    return { ...n, px: CX + ORBIT_R * Math.cos(angle), py: CY + ORBIT_R * Math.sin(angle) };
  });
  const posMap = new Map(positions.map((p) => [p.id, p]));

  // Assign color to each node by first domain
  const nodeColor = (n: NetworkNode) => {
    const d = n.domains[0];
    return d ? (DOMAIN_COLORS as Record<string, string>)[d] || '#6B7280' : '#6B7280';
  };

  return (
    <Box sx={{ overflowX: 'auto', display: 'flex', justifyContent: 'center', position: 'relative' }}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <defs>
          <filter id="adm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width={W} height={H} fill="rgba(8,9,18,0.6)" rx={16} />

        {/* Orbit ring */}
        <circle cx={CX} cy={CY} r={ORBIT_R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={28} fill="rgba(30,32,55,0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} />
        <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="rgba(255,255,255,0.45)" fontFamily="inherit">
          {nodes.length} users
        </text>

        {/* Edges (connections) */}
        {edges.map((e, i) => {
          const src = posMap.get(e.source);
          const tgt = posMap.get(e.target);
          if (!src || !tgt) return null;
          const color = e.sharedDomains[0]
            ? (DOMAIN_COLORS as Record<string, string>)[e.sharedDomains[0]] || '#6B7280'
            : '#6B7280';
          // Bezier through center for chord-diagram feel
          return (
            <path
              key={i}
              d={`M ${src.px} ${src.py} Q ${CX} ${CY} ${tgt.px} ${tgt.py}`}
              stroke={color}
              strokeWidth={0.8}
              strokeOpacity={0.18}
              fill="none"
            />
          );
        })}

        {/* Nodes */}
        {positions.map((p) => {
          const color = nodeColor(p);
          const initials = (p.name || '?').slice(0, 2).toUpperCase();
          return (
            <g
              key={p.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(ev) => {
                const rect = svgRef.current?.getBoundingClientRect();
                if (rect) {
                  setTooltip({
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top - 10,
                    label: `${p.name || 'Unknown'} · ${p.points.toLocaleString()} pts · 🔥${p.streak}d\n${p.domains.slice(0, 3).join(', ')}`,
                  });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <circle cx={p.px} cy={p.py} r={NODE_R + 3} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.2} />
              <circle cx={p.px} cy={p.py} r={NODE_R} fill={`${color}33`} stroke={color} strokeWidth={1.5} filter="url(#adm-glow)" />
              <text x={p.px} y={p.py + 1} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="700" fill="rgba(255,255,255,0.85)" fontFamily="inherit">
                {initials}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <Box
          sx={{
            position: 'absolute',
            left: tooltip.x + 8,
            top: tooltip.y,
            bgcolor: 'rgba(10,11,20,0.95)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 1.5,
            px: 1.5, py: 1,
            pointerEvents: 'none',
            zIndex: 10,
            maxWidth: 200,
          }}
        >
          {tooltip.label.split('\n').map((line, i) => (
            <Typography key={i} variant="caption" sx={{ display: 'block', color: i === 0 ? 'white' : 'text.secondary', whiteSpace: 'pre' }}>
              {line}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const AdminPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [axiomPrompt, setAxiomPrompt] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [triggeringScan, setTriggeringScan] = useState(false);

  // ── Users state ─────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [acting, setActing] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [ppAmounts, setPpAmounts] = useState<Record<string, string>>({});
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Groups state ────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const fetchAxiomPrompt = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/admin/config`, { headers });
      const configs: SystemConfig[] = await res.json();
      const prompt = configs.find(c => c.key === 'axiom_prompt');
      if (prompt) setAxiomPrompt(prompt.value);
    } catch {
      toast.error('Failed to fetch Axiom prompt.');
    }
  }, []);

  const handleUpdatePrompt = async () => {
    setSavingPrompt(true);
    try {
      const headers = await authHeaders();
      await fetch(`${API_URL}/admin/config/axiom_prompt`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: axiomPrompt }),
      });
      toast.success('Axiom prompt updated!');
    } catch {
      toast.error('Failed to update prompt.');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleTriggerScan = async () => {
    if (!window.confirm('Trigger global midnight scan now? This will generate daily recommendations for all active users.')) return;
    setTriggeringScan(true);
    try {
      const headers = await authHeaders();
      await fetch(`${API_URL}/admin/axiom/trigger-scan`, { method: 'POST', headers });
      toast.success('Axiom scan triggered in background.');
    } catch {
      toast.error('Failed to trigger scan.');
    } finally {
      setTriggeringScan(false);
    }
  };
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // ── Network state ───────────────────────────────────────────────────────────
  const [netNodes, setNetNodes] = useState<NetworkNode[]>([]);
  const [netEdges, setNetEdges] = useState<NetworkEdge[]>([]);
  const [loadingNet, setLoadingNet] = useState(false);

  // ── Challenges state ────────────────────────────────────────────────────────
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    title: '', description: '', domain: Domain.FITNESS as string,
    duration_days: 30, reward_points: 100,
  });
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  // ── Services state ──────────────────────────────────────────────────────────
  const [services, setServices] = useState<AdminService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // ── Coaches state ───────────────────────────────────────────────────────────
  const [coaches, setCoaches] = useState<AdminCoach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);

  // ── Data fetchers ────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/admin/users`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ } finally { setLoadingUsers(false); }
  }, []);

  // Simpler fetch helper
  const apiFetch = async (path: string, opts?: RequestInit) => {
    const headers = await authHeaders();
    return fetch(`${API_URL}${path}`, { ...opts, headers: { ...headers, ...(opts?.headers || {}) } });
  };

  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await apiFetch('/admin/groups');
      if (res.ok) setGroups(await res.json());
    } catch { /* ignore */ } finally { setLoadingGroups(false); }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await apiFetch('/admin/stats');
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ } finally { setLoadingStats(false); }
  }, []);

  const fetchNetwork = useCallback(async () => {
    setLoadingNet(true);
    try {
      const res = await apiFetch('/admin/network');
      if (res.ok) {
        const { nodes, edges } = await res.json();
        setNetNodes(nodes ?? []);
        setNetEdges(edges ?? []);
      }
    } catch { /* ignore */ } finally { setLoadingNet(false); }
  }, []);

  const fetchChallenges = useCallback(async () => {
    setLoadingChallenges(true);
    try {
      const res = await apiFetch('/admin/challenges');
      if (res.ok) setChallenges(await res.json());
    } catch { /* ignore */ } finally { setLoadingChallenges(false); }
  }, []);

  const fetchServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const res = await apiFetch('/admin/services');
      if (res.ok) {
        const data = await res.json();
        setServices(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ } finally { setLoadingServices(false); }
  }, []);

  const fetchCoaches = useCallback(async () => {
    setLoadingCoaches(true);
    try {
      const res = await apiFetch('/admin/coaches');
      if (res.ok) {
        const data = await res.json();
        setCoaches(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ } finally { setLoadingCoaches(false); }
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (!user?.is_admin && user?.email !== 'pezzingiovanniantonio@gmail.com') return;
    if (tab === 0 && users.length === 0) fetchUsers();
    if (tab === 1 && groups.length === 0) fetchGroups();
    if (tab === 2 && !stats) fetchStats();
    if (tab === 3 && netNodes.length === 0) fetchNetwork();
    if (tab === 4 && challenges.length === 0) fetchChallenges();
    if (tab === 5 && services.length === 0) fetchServices();
    if (tab === 6 && coaches.length === 0) fetchCoaches();
    if (tab === 7) fetchAxiomPrompt();
  }, [tab, user, fetchAxiomPrompt]);

  // ── User actions ─────────────────────────────────────────────────────────────

  const handleDeleteUser = async (userId: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) { setUsers(prev => prev.filter(u => u.id !== userId)); toast.success('User deleted.'); }
      else { const b = await res.json().catch(() => ({})); toast.error((b as any).message || 'Failed.'); }
    } catch { toast.error('Failed.'); } finally { setActing(false); setConfirm(null); }
  };

  const handleBanUser = async (userId: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/admin/users/${userId}/ban`, { method: 'POST' });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned_until: new Date(Date.now() + 876000 * 3600 * 1000).toISOString() } : u));
        toast.success('User banned.');
      } else toast.error('Failed to ban user.');
    } catch { toast.error('Failed.'); } finally { setActing(false); setConfirm(null); }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}/unban`, { method: 'POST' });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned_until: null } : u));
        toast.success('User unbanned.');
      }
    } catch { toast.error('Failed.'); }
  };

  const handlePromoteUser = async (userId: string, role: string) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role, is_admin: role === 'admin' } : u));
        toast.success(`User set to ${role}.`);
      } else {
        const b = await res.json().catch(() => ({}));
        toast.error((b as any).message || 'Failed to update role.');
      }
    } catch { toast.error('Failed.'); }
  };

  const handleModifyPoints = async (userId: string, sign: 1 | -1) => {
    const raw = ppAmounts[userId] || '100';
    const amount = parseInt(raw, 10);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid positive amount.'); return; }
    const delta = sign * amount;
    try {
      const res = await apiFetch(`/admin/users/${userId}/grant-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      if (res.ok) {
        const body = await res.json();
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, praxis_points: body.points } : u));
        toast.success(`PP: ${body.points.toLocaleString()} (${delta > 0 ? '+' : ''}${delta})`);
      } else toast.error('Failed to update points.');
    } catch { toast.error('Failed.'); }
  };

  const handleResetTreeEdits = async (userId: string) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}/reset-tree-edits`, { method: 'POST' });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, goal_tree_edit_count: 0 } : u));
        toast.success('Goal tree edit reset — user gets 1 free edit.');
      } else toast.error('Failed.');
    } catch { toast.error('Failed.'); }
  };

  const handleOpenDetail = async (userId: string) => {
    setLoadingDetail(true);
    setUserDetail(null);
    try {
      const res = await apiFetch(`/admin/users/${userId}/detail`);
      if (res.ok) setUserDetail(await res.json());
      else toast.error('Failed to load user detail.');
    } catch { toast.error('Failed.'); } finally { setLoadingDetail(false); }
  };

  const handleDeleteAllDemo = async () => {
    setActing(true);
    try {
      const res = await apiFetch('/admin/demo-users', { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json();
        setUsers(prev => prev.filter(u => !u.is_demo));
        toast.success(body.message || 'Demo users deleted.');
      }
    } catch { toast.error('Failed.'); } finally { setActing(false); setConfirm(null); }
  };

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      const res = await apiFetch('/admin/seed', { method: 'POST' });
      if (res.ok) {
        const body = await res.json();
        toast.success(body.message || 'Demo users seeded.');
        fetchUsers();
      }
    } catch { toast.error('Failed.'); } finally { setSeedingDemo(false); }
  };

  // ── Group actions ─────────────────────────────────────────────────────────────

  const handleDeleteGroup = async (groupId: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/admin/groups/${groupId}`, { method: 'DELETE' });
      if (res.ok) { setGroups(prev => prev.filter(g => g.id !== groupId)); toast.success('Group deleted.'); }
      else toast.error('Failed to delete group.');
    } catch { toast.error('Failed.'); } finally { setActing(false); setConfirm(null); }
  };

  // ── Service actions ───────────────────────────────────────────────────────────

  const handleDeleteService = async (serviceId: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/admin/services/${serviceId}`, { method: 'DELETE' });
      if (res.ok) { setServices(prev => prev.filter(s => s.id !== serviceId)); toast.success('Service deleted.'); }
      else toast.error('Failed to delete service.');
    } catch { toast.error('Failed.'); } finally { setActing(false); setConfirm(null); }
  };

  // ── Challenge actions ─────────────────────────────────────────────────────────

  const handleCreateChallenge = async () => {
    if (!newChallenge.title.trim()) { toast.error('Title is required.'); return; }
    setCreatingChallenge(true);
    try {
      const res = await apiFetch('/admin/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChallenge),
      });
      if (res.ok) {
        const created = await res.json();
        setChallenges(prev => [created, ...prev]);
        setNewChallenge({ title: '', description: '', domain: Domain.FITNESS, duration_days: 30, reward_points: 100 });
        toast.success(`Challenge "${created.title}" created!`);
      } else {
        const b = await res.json().catch(() => ({}));
        toast.error((b as any).message || 'Failed to create challenge.');
      }
    } catch { toast.error('Failed.'); } finally { setCreatingChallenge(false); }
  };

  // ── Access guard ─────────────────────────────────────────────────────────────

  const isAdmin = user?.is_admin || user?.email === 'pezzingiovanniantonio@gmail.com';

  if (!isAdmin) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <AdminPanelSettingsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" color="error.main" sx={{ fontWeight: 700 }}>Access Denied</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>Admin access required.</Typography>
      </Container>
    );
  }

  const isBanned = (u: AdminUser) => !!u.banned_until && new Date(u.banned_until) > new Date();
  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );
  const demoCount = users.filter(u => u.is_demo).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="lg" sx={{ mt: 4, pb: 8 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AdminPanelSettingsIcon sx={{ fontSize: 26, color: 'error.main', display: 'block' }} />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Admin Panel</Typography>
          <Typography variant="body2" color="text.secondary">Godmode — handle with care</Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<TextFieldsIcon />}
          onClick={() => navigate('/words')}
          sx={{ borderRadius: 2, fontSize: '0.8rem', borderColor: 'rgba(167,139,250,0.4)', color: '#A78BFA', '&:hover': { borderColor: '#A78BFA', bgcolor: 'rgba(167,139,250,0.08)' } }}
        >
          Goal Language
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          '& .MuiTab-root': { fontWeight: 600, fontSize: '0.82rem', minWidth: 100 },
        }}
      >
        <Tab icon={<AdminPanelSettingsIcon fontSize="small" />} iconPosition="start" label="Users" />
        <Tab icon={<GroupsIcon fontSize="small" />} iconPosition="start" label="Groups" />
        <Tab icon={<BarChartIcon fontSize="small" />} iconPosition="start" label="Stats" />
        <Tab icon={<HubIcon fontSize="small" />} iconPosition="start" label="Network" />
        <Tab icon={<EmojiEventsIcon fontSize="small" />} iconPosition="start" label="Challenges" />
        <Tab icon={<HandshakeIcon fontSize="small" />} iconPosition="start" label="Services" />
        <Tab icon={<SchoolIcon fontSize="small" />} iconPosition="start" label="Coaches" />
        <Tab icon={<SmartToyIcon fontSize="small" />} iconPosition="start" label="Axiom" />
      </Tabs>

      {/* ── Tab 0: Users ──────────────────────────────────────────────────────── */}
      <TabPanel value={tab} index={0}>
        {/* Demo management */}
        <Card sx={{ mb: 3, bgcolor: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, py: '14px !important' }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Demo Users</Typography>
              <Typography variant="caption" color="text.secondary">
                {demoCount > 0 ? `${demoCount} demo accounts active` : 'No demo accounts — feed will be empty for new users'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="outlined" color="error" startIcon={<PersonRemoveIcon />}
                disabled={acting || demoCount === 0} onClick={() => setConfirm({ type: 'delete-demo' })} sx={{ borderRadius: 2 }}>
                Delete all demo
              </Button>
              <Button size="small" variant="outlined" color="warning"
                startIcon={seedingDemo ? <CircularProgress size={14} color="inherit" /> : <PersonAddIcon />}
                disabled={seedingDemo} onClick={handleSeedDemo} sx={{ borderRadius: 2 }}>
                Seed demo users
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Quick stats chips */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', value: users.length, color: 'primary.main' },
            { label: 'Real', value: users.filter(u => !u.is_demo).length, color: 'success.main' },
            { label: 'Demo', value: demoCount, color: 'warning.main' },
            { label: 'Banned', value: users.filter(u => isBanned(u)).length, color: 'error.main' },
          ].map(s => (
            <Card key={s.label} sx={{ flex: '1 1 80px', minWidth: 80 }}>
              <CardContent sx={{ textAlign: 'center', py: '12px !important' }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
            sx={{ width: 320 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => downloadCSV(users as unknown as Record<string, unknown>[], 'praxis-users.csv')}
              disabled={users.length === 0}
              sx={{ borderRadius: 2 }}
            >
              Download CSV
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchUsers} disabled={loadingUsers} sx={{ color: 'text.secondary' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {loadingUsers ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Flags</TableCell>
                  <TableCell>PP / Streak</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id} sx={{
                    opacity: u.is_demo ? 0.65 : 1,
                    bgcolor: isBanned(u) ? 'rgba(239,68,68,0.04)' : undefined,
                    '&:last-child td': { border: 0 },
                    '&:hover': { bgcolor: isBanned(u) ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.02)' },
                  }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', opacity: isBanned(u) ? 0.5 : 1 }}>
                          {(u.name || u.email || '?')[0].toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{u.name || '—'}</Typography>
                          {u.id === user?.id && <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>you</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{u.email || '—'}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {isBanned(u) && <Chip label="banned" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(239,68,68,0.15)', color: 'error.main', border: '1px solid rgba(239,68,68,0.3)' }} />}
                        {u.is_demo && <Chip label="demo" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(245,158,11,0.12)', color: 'warning.main', border: '1px solid rgba(245,158,11,0.25)' }} />}
                        {u.is_admin && <Chip label="admin" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(239,68,68,0.12)', color: 'error.main', border: '1px solid rgba(239,68,68,0.25)' }} />}
                        {!u.is_admin && u.role === 'moderator' && <Chip label="mod" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)' }} />}
                        {!u.is_admin && u.role === 'staff' && <Chip label="staff" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }} />}
                        {u.is_premium && <Chip label="pro" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(139,92,246,0.12)', color: 'secondary.main', border: '1px solid rgba(139,92,246,0.25)' }} />}
                        {(u.honor_score ?? 0) > 0 && <Chip label={`⭐ ${u.honor_score}`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }} />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700 }}>
                        ⚡{(u.praxis_points ?? 0).toLocaleString()}
                      </Typography>
                      {(u.current_streak ?? 0) > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          🔥{u.current_streak}d
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell><Typography variant="caption" color="text.disabled">{new Date(u.created_at).toLocaleDateString()}</Typography></TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* PP modifier */}
                        <TextField
                          size="small"
                          type="number"
                          value={ppAmounts[u.id] ?? '100'}
                          onChange={e => setPpAmounts(prev => ({ ...prev, [u.id]: e.target.value }))}
                          inputProps={{ min: 1, style: { width: 52, padding: '2px 4px', fontSize: '0.72rem' } }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1, height: 24 } }}
                        />
                        <Tooltip title="Add PP">
                          <IconButton size="small" onClick={() => handleModifyPoints(u.id, 1)} sx={{ color: '#A78BFA', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                            <AddCircleOutlineIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove PP">
                          <IconButton size="small" onClick={() => handleModifyPoints(u.id, -1)} sx={{ color: 'warning.main', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                            <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={`Reset free goal-tree edit (currently ${u.goal_tree_edit_count ?? 0} edits used)`}>
                          <IconButton size="small" onClick={() => handleResetTreeEdits(u.id)} sx={{ color: '#10B981', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                            <EditTreeIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View all user metrics">
                          <IconButton size="small" onClick={() => handleOpenDetail(u.id)} sx={{ color: 'text.secondary', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        {u.id !== user?.id && (
                          <>
                            <Tooltip title={u.role === 'staff' ? 'Demote to user' : 'Make staff'}>
                              <IconButton size="small" onClick={() => handlePromoteUser(u.id, u.role === 'staff' ? 'user' : 'staff')} sx={{ color: '#10B981', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                                <ShieldIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={u.role === 'moderator' || u.is_admin ? 'Demote to user' : 'Make moderator'}>
                              <IconButton size="small" onClick={() => handlePromoteUser(u.id, (u.role === 'moderator' || u.is_admin) ? 'user' : 'moderator')} sx={{ color: '#3B82F6', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                                <WorkspacePremiumIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {isBanned(u) ? (
                              <Tooltip title="Unban user">
                                <IconButton size="small" onClick={() => handleUnbanUser(u.id)} sx={{ color: 'success.main', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                                  <LockOpenIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Ban user">
                                <IconButton size="small" onClick={() => setConfirm({ type: 'ban', user: u })} sx={{ color: 'warning.main', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                                  <BlockIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Delete permanently">
                              <IconButton size="small" onClick={() => setConfirm({ type: 'delete', user: u })} sx={{ color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
                      No users match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* ── Tab 1: Groups & Boards ────────────────────────────────────────────── */}
      <TabPanel value={tab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Groups & Boards</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => downloadCSV(groups as unknown as Record<string, unknown>[], 'praxis-groups.csv')}
              disabled={groups.length === 0}
              sx={{ borderRadius: 2 }}
            >
              Download CSV
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchGroups} disabled={loadingGroups} sx={{ color: 'text.secondary' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {loadingGroups ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : groups.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
            <GroupsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography variant="body2">No groups or boards yet.</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.map(g => (
                  <TableRow key={g.id} sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{g.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={g.is_board ? 'board' : 'chat'}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.65rem',
                          bgcolor: g.is_board ? 'rgba(99,102,241,0.12)' : 'rgba(34,197,94,0.1)',
                          color: g.is_board ? '#818CF8' : '#4ADE80',
                          border: `1px solid ${g.is_board ? 'rgba(99,102,241,0.3)' : 'rgba(34,197,94,0.25)'}`,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 300, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.disabled">{new Date(g.created_at).toLocaleDateString()}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete group permanently">
                        <IconButton size="small" onClick={() => setConfirm({ type: 'delete-group', group: g })}
                          sx={{ color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* ── Tab 2: Stats ──────────────────────────────────────────────────────── */}
      <TabPanel value={tab} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Platform Stats</Typography>
          <Tooltip title="Refresh stats">
            <IconButton onClick={fetchStats} disabled={loadingStats} sx={{ color: 'text.secondary' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {loadingStats ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : stats ? (
          <Grid container spacing={2}>
            {[
              { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: '👥', color: '#60A5FA' },
              { label: 'Goal Trees', value: stats.totalGoalTrees.toLocaleString(), icon: '🌳', color: '#34D399' },
              { label: 'Total Points', value: stats.totalPoints.toLocaleString(), icon: '⚡', color: '#FBBF24' },
              { label: 'Avg Streak', value: `${stats.avgStreak}d`, icon: '🔥', color: '#F87171' },
              { label: 'Pro Users', value: stats.premiumCount.toLocaleString(), icon: '👑', color: '#A78BFA' },
              { label: 'Active Today', value: stats.activeToday.toLocaleString(), icon: '✅', color: '#6EE7B7' },
              { label: 'Challenges', value: stats.totalChallenges.toLocaleString(), icon: '🏆', color: '#FCD34D' },
            ].map(s => (
              <Grid key={s.label} size={{ xs: 6, sm: 4, md: 3 }}>
                <Card sx={{ borderRadius: 3, border: `1px solid ${s.color}22`, background: `linear-gradient(135deg, ${s.color}0A 0%, transparent 100%)` }}>
                  <CardContent sx={{ textAlign: 'center', py: '20px !important' }}>
                    <Typography sx={{ fontSize: 28, mb: 0.5 }}>{s.icon}</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{s.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
            <Typography variant="body2">Could not load stats.</Typography>
            <Button onClick={fetchStats} sx={{ mt: 2 }}>Retry</Button>
          </Box>
        )}
      </TabPanel>

      {/* ── Tab 3: Network Diagram ────────────────────────────────────────────── */}
      <TabPanel value={tab} index={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>User Connection Network</Typography>
            <Typography variant="caption" color="text.secondary">
              Chord diagram — nodes = users, edges = shared goal domains
            </Typography>
          </Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchNetwork} disabled={loadingNet} sx={{ color: 'text.secondary' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {loadingNet ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : (
          <>
            <NetworkDiagram nodes={netNodes} edges={netEdges} />
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.disabled">
                {netNodes.length} users · {netEdges.length} connections · Hover nodes for details
              </Typography>
            </Box>
          </>
        )}
      </TabPanel>

      {/* ── Tab 4: Challenges ─────────────────────────────────────────────────── */}
      <TabPanel value={tab} index={4}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Community Challenges</Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchChallenges} disabled={loadingChallenges} sx={{ color: 'text.secondary' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Create form */}
        <Card sx={{ mb: 3, border: '1px solid rgba(251,191,36,0.2)', bgcolor: 'rgba(251,191,36,0.03)' }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Launch New Challenge</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth size="small" label="Title"
                  value={newChallenge.title}
                  onChange={e => setNewChallenge(prev => ({ ...prev, title: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Domain</InputLabel>
                  <Select
                    label="Domain"
                    value={newChallenge.domain}
                    onChange={e => setNewChallenge(prev => ({ ...prev, domain: e.target.value }))}
                  >
                    {Object.values(Domain).map(d => (
                      <MenuItem key={d} value={d}>{d}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth size="small" label="Description (optional)" multiline rows={2}
                  value={newChallenge.description}
                  onChange={e => setNewChallenge(prev => ({ ...prev, description: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  fullWidth size="small" label="Duration (days)" type="number"
                  value={newChallenge.duration_days}
                  onChange={e => setNewChallenge(prev => ({ ...prev, duration_days: Number(e.target.value) }))}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  fullWidth size="small" label="Reward Points" type="number"
                  value={newChallenge.reward_points}
                  onChange={e => setNewChallenge(prev => ({ ...prev, reward_points: Number(e.target.value) }))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button
                  fullWidth variant="contained" color="warning"
                  startIcon={creatingChallenge ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                  disabled={creatingChallenge || !newChallenge.title.trim()}
                  onClick={handleCreateChallenge}
                  sx={{ borderRadius: 2 }}
                >
                  Launch Challenge
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Existing challenges */}
        {loadingChallenges ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : challenges.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
            <EmojiEventsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography variant="body2">No challenges yet. Create the first one!</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {challenges.map(c => {
              const color = (DOMAIN_COLORS as Record<string, string>)[c.domain] || '#9CA3AF';
              return (
                <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ borderRadius: 3, border: `1px solid ${color}22`, height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>{c.title}</Typography>
                        <Chip
                          label={`+${c.reward_points} pts`}
                          size="small"
                          sx={{ ml: 1, height: 20, fontSize: '0.65rem', bgcolor: `${color}22`, color }}
                        />
                      </Box>
                      {c.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          {c.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={c.domain}
                          size="small"
                          sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${color}18`, color, border: `1px solid ${color}33` }}
                        />
                        <Chip
                          label={`${c.duration_days}d`}
                          size="small"
                          sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary' }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </TabPanel>

      {/* ── Tab 5: Services ───────────────────────────────────────────────────── */}
      <TabPanel value={tab} index={5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Services & Listings</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => downloadCSV(services as unknown as Record<string, unknown>[], 'praxis-services.csv')}
              disabled={services.length === 0}
              sx={{ borderRadius: 2 }}
            >
              Download CSV
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchServices} disabled={loadingServices} sx={{ color: 'text.secondary' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {loadingServices ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : services.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
            <HandshakeIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography variant="body2">No services listed yet.</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                  <TableCell>User</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Domain</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {services.map(s => (
                  <TableRow key={s.id} sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {s.user_name || s.user_id.slice(0, 8)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={s.type}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{s.domain || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {s.price != null ? `${s.price} ${s.price_currency || 'EUR'}` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={s.active ? 'active' : 'inactive'}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.65rem',
                          bgcolor: s.active ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.12)',
                          color: s.active ? '#4ADE80' : 'text.secondary',
                          border: `1px solid ${s.active ? 'rgba(34,197,94,0.25)' : 'rgba(107,114,128,0.2)'}`,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.disabled">{new Date(s.created_at).toLocaleDateString()}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete service">
                        <IconButton size="small" onClick={() => setConfirm({ type: 'delete-service', service: s })}
                          sx={{ color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* ── Tab 6: Coaches ────────────────────────────────────────────────────── */}
      <TabPanel value={tab} index={6}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Coach Profiles</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => downloadCSV(coaches as unknown as Record<string, unknown>[], 'praxis-coaches.csv')}
              disabled={coaches.length === 0}
              sx={{ borderRadius: 2 }}
            >
              Download CSV
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchCoaches} disabled={loadingCoaches} sx={{ color: 'text.secondary' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {loadingCoaches ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : coaches.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
            <SchoolIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography variant="body2">No coach profiles yet (or table not created).</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                  <TableCell>User ID</TableCell>
                  <TableCell>Bio</TableCell>
                  <TableCell>Domains</TableCell>
                  <TableCell>Rating</TableCell>
                  <TableCell>Rate/hr</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {coaches.map(c => (
                  <TableRow key={c.id} sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {c.user_id.slice(0, 8)}…
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.bio || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 180 }}>
                        {(c.domains ?? []).slice(0, 3).map(d => (
                          <Chip key={d} label={d} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
                        ))}
                        {(c.domains ?? []).length > 3 && (
                          <Typography variant="caption" color="text.disabled">+{(c.domains ?? []).length - 3}</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: c.rating != null ? '#FBBF24' : 'text.disabled' }}>
                        {c.rating != null ? c.rating.toFixed(1) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {c.hourly_rate != null ? `€${c.hourly_rate}` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.is_available ? 'yes' : 'no'}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.65rem',
                          bgcolor: c.is_available ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.12)',
                          color: c.is_available ? '#4ADE80' : 'text.secondary',
                          border: `1px solid ${c.is_available ? 'rgba(34,197,94,0.25)' : 'rgba(107,114,128,0.2)'}`,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.disabled">{new Date(c.created_at).toLocaleDateString()}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* ── Confirm dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={!!confirm} onClose={() => !acting && setConfirm(null)} maxWidth="xs" fullWidth>
        {confirm?.type === 'delete' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Delete user?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                Permanently delete <strong>{confirm.user.name || confirm.user.email}</strong>?
                Removes their account and all data.{' '}
                <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>Cannot be undone.</Box>
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="error" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={() => handleDeleteUser(confirm.user.id)}>
                Delete permanently
              </Button>
            </DialogActions>
          </>
        )}
        {confirm?.type === 'ban' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Ban user?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                Ban <strong>{confirm.user.name || confirm.user.email}</strong>? They will be immediately signed out.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="warning" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={() => handleBanUser(confirm.user.id)}>
                Ban user
              </Button>
            </DialogActions>
          </>
        )}
        {confirm?.type === 'delete-demo' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Delete all demo users?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                This will permanently delete all <strong>{demoCount} demo accounts</strong> and their data.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="error" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={handleDeleteAllDemo}>
                Delete all demo
              </Button>
            </DialogActions>
          </>
        )}
        {confirm?.type === 'delete-group' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Delete {confirm.group.is_board ? 'board' : 'group'}?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                Permanently delete <strong>{confirm.group.name}</strong>?
                All messages and posts in this {confirm.group.is_board ? 'board' : 'group'} will be removed.{' '}
                <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>Cannot be undone.</Box>
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="error" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={() => handleDeleteGroup(confirm.group.id)}>
                Delete permanently
              </Button>
            </DialogActions>
          </>
        )}
        {confirm?.type === 'delete-service' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Delete service?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                Permanently delete the listing <strong>{confirm.service.title}</strong>?{' '}
                <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>Cannot be undone.</Box>
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="error" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={() => handleDeleteService(confirm.service.id)}>
                Delete permanently
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── User Detail Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!userDetail || loadingDetail} onClose={() => setUserDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoOutlinedIcon sx={{ color: 'primary.main' }} />
          User Metrics
        </DialogTitle>
        <DialogContent>
          {loadingDetail && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
          {userDetail && (() => {
            const d = userDetail;
            const rows: { label: string; value: string | number | boolean | null | undefined }[] = [
              { label: 'ID', value: d.id },
              { label: 'Name', value: d.name || '—' },
              { label: 'Email', value: d.email || '—' },
              { label: 'Username', value: d.username || '—' },
              { label: 'City', value: d.city || '—' },
              { label: 'Bio', value: d.bio || '—' },
              { label: 'Role', value: d.role || 'user' },
              { label: 'Premium', value: d.is_premium ? 'Yes' : 'No' },
              { label: 'Admin', value: d.is_admin ? 'Yes' : 'No' },
              { label: 'Demo', value: d.is_demo ? 'Yes' : 'No' },
              { label: 'Onboarding complete', value: d.onboarding_completed ? 'Yes' : 'No' },
              { label: 'Praxis Points (PP)', value: (d.praxis_points ?? 0).toLocaleString() },
              { label: 'Current Streak', value: `${d.current_streak ?? 0} days` },
              { label: 'Reliability Score', value: d.reliability_score != null ? d.reliability_score.toFixed(2) : '—' },
              { label: 'Honor Score', value: d.honor_score ?? 0 },
              { label: 'Goal Tree Edits Used', value: d.goal_tree_edit_count ?? 0 },
              { label: 'Root Goals', value: d.root_goal_count },
              { label: 'Total Goal Nodes', value: d.total_node_count },
              { label: 'Total Check-ins', value: d.checkin_count },
              { label: 'Total Posts', value: d.post_count },
              { label: 'Friends', value: d.friend_count },
              { label: 'Verifications Given', value: d.verification_count },
              { label: 'Joined', value: new Date(d.created_at).toLocaleString() },
            ];
            return (
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {rows.map(r => (
                    <Box
                      component="tr"
                      key={r.label}
                      sx={{ '&:nth-of-type(odd)': { bgcolor: 'rgba(255,255,255,0.03)' } }}
                    >
                      <Box component="td" sx={{ py: 0.75, px: 1.5, color: 'text.secondary', fontSize: '0.78rem', fontWeight: 600, width: '45%', verticalAlign: 'top' }}>
                        {r.label}
                      </Box>
                      <Box component="td" sx={{ py: 0.75, px: 1.5, fontSize: '0.78rem', wordBreak: 'break-all', verticalAlign: 'top' }}>
                        {String(r.value ?? '—')}
                      </Box>
                    </Box>
                  ))}
                </tbody>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUserDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      {/* ── Tab 7: Axiom ──────────────────────────────────────────────────────── */}
      <TabPanel value={tab} index={7}>
        <Box sx={{ maxWidth: 800, mx: 'auto', py: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 3, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AutoAwesomeIcon /> Axiom Engine Management
          </Typography>

          <Grid container spacing={4}>
            {/* System Prompt */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>System Identity & Prompt</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    This prompt defines Axiom's personality, knowledge, and tone. It is injected into every coaching request.
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={10}
                    value={axiomPrompt}
                    onChange={(e) => setAxiomPrompt(e.target.value)}
                    placeholder="Enter Axiom's system prompt..."
                    sx={{ 
                      mb: 2,
                      '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', fontFamily: 'monospace', fontSize: '0.85rem' }
                    }}
                  />
                  <Button 
                    variant="contained" 
                    onClick={handleUpdatePrompt}
                    disabled={savingPrompt || !axiomPrompt.trim()}
                    sx={{ borderRadius: '10px', fontWeight: 800, px: 4 }}
                  >
                    {savingPrompt ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : 'Save Prompt'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Manual Triggers */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Manual Scan Trigger</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Manually initiate the midnight automated scan. This will process all active users, analyze their activity, and generate new daily protocols. Use sparingly.
                  </Typography>
                  <Button 
                    variant="outlined" 
                    color="primary"
                    onClick={handleTriggerScan}
                    disabled={triggeringScan}
                    startIcon={<RefreshIcon />}
                    sx={{ borderRadius: '10px', fontWeight: 800, border: '2px solid' }}
                  >
                    {triggeringScan ? 'Triggering...' : 'Trigger Global Midnight Scan Now'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </TabPanel>
    </Container>
  );
};

export default AdminPage;
