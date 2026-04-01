import React, { useState, useCallback, useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Container, Box, Typography, Button, Tabs, Tab,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import GroupsIcon from '@mui/icons-material/Groups';
import BarChartIcon from '@mui/icons-material/BarChart';
import HubIcon from '@mui/icons-material/Hub';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SchoolIcon from '@mui/icons-material/School';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PublicIcon from '@mui/icons-material/Public';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TerminalIcon from '@mui/icons-material/Terminal';
import BugReportIcon from '@mui/icons-material/BugReport';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import {
  AdminUser, AdminGroup, AdminStats, NetworkNode, NetworkEdge,
  AdminChallenge, AdminService, AdminCoach,
} from './tabs/adminTypes';
import api from '../../lib/api';
import UsersTab from './tabs/UsersTab';
import GroupsTab from './tabs/GroupsTab';
import StatsTab from './tabs/StatsTab';
import NetworkTab from './tabs/NetworkTab';
import ChallengesTab from './tabs/ChallengesTab';
import ServicesTab from './tabs/ServicesTab';
import CoachesTab from './tabs/CoachesTab';
import AxiomTab from './tabs/AxiomTab';
import PlacesImportTab from './tabs/PlacesImportTab';
import CLITab from './tabs/CLITab';
import DebugTab from './tabs/DebugTab';
import MetricsTab, { useMetrics } from './tabs/MetricsTab';

// ── Tab panel ─────────────────────────────────────────────────────────────────

const TabPanel: React.FC<{ value: number; index: number; children: React.ReactNode }> = ({ value, index, children }) => (
  <div hidden={value !== index} style={{ paddingTop: 24 }}>
    {value === index && children}
  </div>
);

// ── Metrics Tab with Data ─────────────────────────────────────────────────────

const MetricsTabWithData: React.FC = () => {
  const { metrics, loadingMetrics, fetchMetrics } = useMetrics();
  return <MetricsTab metrics={metrics} loadingMetrics={loadingMetrics} fetchMetrics={fetchMetrics} />;
};

// ── Main component ────────────────────────────────────────────────────────────

const AdminPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  // ── Shared state (passed to tabs) ──────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [netNodes, setNetNodes] = useState<NetworkNode[]>([]);
  const [netEdges, setNetEdges] = useState<NetworkEdge[]>([]);
  const [loadingNet, setLoadingNet] = useState(false);
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [services, setServices] = useState<AdminService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [coaches, setCoaches] = useState<AdminCoach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/admin/users');
      const data = res.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally { setLoadingUsers(false); }
  }, []);

  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await api.get('/admin/groups');
      setGroups(res.data);
    } catch { /* ignore */ } finally { setLoadingGroups(false); }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch { /* ignore */ } finally { setLoadingStats(false); }
  }, []);

  const fetchNetwork = useCallback(async () => {
    setLoadingNet(true);
    try {
      const res = await api.get('/admin/network');
      const { nodes, edges } = res.data;
      setNetNodes(nodes ?? []);
      setNetEdges(edges ?? []);
    } catch { /* ignore */ } finally { setLoadingNet(false); }
  }, []);

  const fetchChallenges = useCallback(async () => {
    setLoadingChallenges(true);
    try {
      const res = await api.get('/admin/challenges');
      setChallenges(res.data);
    } catch { /* ignore */ } finally { setLoadingChallenges(false); }
  }, []);

  const fetchServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const res = await api.get('/admin/services');
      const data = res.data;
      setServices(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally { setLoadingServices(false); }
  }, []);

  const fetchCoaches = useCallback(async () => {
    setLoadingCoaches(true);
    try {
      const res = await api.get('/admin/coaches');
      const data = res.data;
      setCoaches(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally { setLoadingCoaches(false); }
  }, []);

  // ── Load data when tab changes ─────────────────────────────────────────────

  useEffect(() => {
    if (!user?.is_admin && user?.email !== 'pezzingiovanniantonio@gmail.com') return;
    if (tab === 0 && users.length === 0) fetchUsers();
    if (tab === 1 && groups.length === 0) fetchGroups();
    if (tab === 2 && !stats) fetchStats();
    if (tab === 3 && netNodes.length === 0) fetchNetwork();
    if (tab === 4 && challenges.length === 0) fetchChallenges();
    if (tab === 5 && services.length === 0) fetchServices();
    if (tab === 6 && coaches.length === 0) fetchCoaches();
    if (tab === 7 && users.length === 0) fetchUsers();
  }, [tab, user]);

  // ── Access guard ───────────────────────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────────────────────

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
        <Tab icon={<TrendingUpIcon fontSize="small" />} iconPosition="start" label="Metrics" />
        <Tab icon={<HubIcon fontSize="small" />} iconPosition="start" label="Network" />
        <Tab icon={<EmojiEventsIcon fontSize="small" />} iconPosition="start" label="Challenges" />
        <Tab icon={<HandshakeIcon fontSize="small" />} iconPosition="start" label="Services" />
        <Tab icon={<SchoolIcon fontSize="small" />} iconPosition="start" label="Coaches" />
        <Tab icon={<SmartToyIcon fontSize="small" />} iconPosition="start" label="Axiom" />
        <Tab icon={<PublicIcon fontSize="small" />} iconPosition="start" label="Places" />
        <Tab icon={<TerminalIcon fontSize="small" />} iconPosition="start" label="CLI" />
        <Tab icon={<BugReportIcon fontSize="small" />} iconPosition="start" label="Debug" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <UsersTab
          currentUserId={user?.id}
          users={users}
          setUsers={setUsers}
          loadingUsers={loadingUsers}
          fetchUsers={fetchUsers}
        />
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <GroupsTab groups={groups} setGroups={setGroups} loadingGroups={loadingGroups} fetchGroups={fetchGroups} />
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <StatsTab stats={stats} loadingStats={loadingStats} fetchStats={fetchStats} />
      </TabPanel>

      <TabPanel value={tab} index={3}>
        <MetricsTabWithData />
      </TabPanel>

      <TabPanel value={tab} index={4}>
        <NetworkTab nodes={netNodes} edges={netEdges} loading={loadingNet} fetchNetwork={fetchNetwork} />
      </TabPanel>

      <TabPanel value={tab} index={4}>
        <ChallengesTab challenges={challenges} setChallenges={setChallenges} loading={loadingChallenges} fetchChallenges={fetchChallenges} />
      </TabPanel>

      <TabPanel value={tab} index={5}>
        <ServicesTab services={services} setServices={setServices} loading={loadingServices} fetchServices={fetchServices} />
      </TabPanel>

      <TabPanel value={tab} index={6}>
        <CoachesTab coaches={coaches} loading={loadingCoaches} fetchCoaches={fetchCoaches} />
      </TabPanel>

      <TabPanel value={tab} index={7}>
        <AxiomTab users={users} />
      </TabPanel>

      <TabPanel value={tab} index={8}>
        <PlacesImportTab />
      </TabPanel>

      <TabPanel value={tab} index={9}>
        <CLITab />
      </TabPanel>

      <TabPanel value={tab} index={10}>
        <DebugTab />
      </TabPanel>
    </Container>
  );
};

export default AdminPage;
