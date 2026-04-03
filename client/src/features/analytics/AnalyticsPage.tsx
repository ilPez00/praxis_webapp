import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import GlassCard from '../../components/common/GlassCard';
import CircularProgress from '@mui/material/CircularProgress';
import PageSkeleton from '../../components/common/PageSkeleton';
import {
  Container,
  Box,
  Typography,
  Alert,
  Stack,
  Chip,
  LinearProgress,
  Grid,
  Avatar,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Button,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FeedbackIcon from '@mui/icons-material/Feedback';
import InsightsIcon from '@mui/icons-material/Insights';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FlagIcon from '@mui/icons-material/Flag';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { DOMAIN_COLORS } from '../../types/goal';
import ProBanner from '../../components/common/ProBanner';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import {
  ChartContainer,
  LineChart,
  BarChart,
  PieChart,
  XAxis,
  YAxis,
  ChartsTooltip,
  ChartsLegend as Legend,
} from '@mui/x-charts';

// ── Habit Calendar ─────────────────────────────────────────────────────────────

interface DayData {
  date: string;        // YYYY-MM-DD
  count: number;       // number of tracker logs that day
  trackers: string[];  // tracker types logged
  notes?: number;      // number of journal entries (NEW)
  goalUpdates?: number; // number of goal progress updates (NEW)
  activities?: Array<{ // detailed activity list (NEW)
    type: 'tracker' | 'note' | 'goal';
    description: string;
    timestamp: string;
  }>;
}

interface GoalDate {
  date: string;  // YYYY-MM-DD
  label: string;
  emoji: string;
  color: string;
}

const WEEKS = 16; // ~4 months of history

function HabitCalendar({ dayData, goalDates }: { dayData: DayData[]; goalDates: GoalDate[] }) {
  // Build the full 16-week grid ending today
  const today = new Date();
  // Align to Sunday of current week
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (WEEKS * 7 - 1));

  // Build columns (each column = 1 week, Sun→Sat)
  const dayMap: Record<string, DayData> = {};
  for (const d of dayData) dayMap[d.date] = d;

  const goalDateMap: Record<string, GoalDate[]> = {};
  for (const g of goalDates) {
    if (!goalDateMap[g.date]) goalDateMap[g.date] = [];
    goalDateMap[g.date].push(g);
  }

  const columns: { date: Date; key: string }[][] = [];
  let current = new Date(startDate);
  // Move to Sunday
  const dayOfWeek = current.getDay(); // 0=Sun
  if (dayOfWeek !== 0) current.setDate(current.getDate() - dayOfWeek);

  while (current <= endDate) {
    const col: { date: Date; key: string }[] = [];
    for (let d = 0; d < 7; d++) {
      col.push({ date: new Date(current), key: current.toISOString().slice(0, 10) });
      current.setDate(current.getDate() + 1);
    }
    columns.push(col);
  }

  // Month labels — figure out where each month starts
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  columns.forEach((col, ci) => {
    const m = col[0].date.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col: ci, label: col[0].date.toLocaleDateString('en', { month: 'short' }) });
      lastMonth = m;
    }
  });

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const CELL = 13; // px
  const GAP = 3;   // px

  return (
    <GlassCard glowColor="rgba(245,158,11,0.1)" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <TrendingUpIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Habit Calendar</Typography>
        <Chip label={`${dayData.filter(d => d.count > 0).length} active days`} size="small"
          sx={{ height: 20, fontSize: '0.62rem', bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }} />
      </Box>

      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        {/* Month header */}
        <Box sx={{ display: 'flex', ml: `${CELL + GAP + 4}px`, mb: 0.5 }}>
          {columns.map((col, ci) => {
            const ml = monthLabels.find(m => m.col === ci);
            return (
              <Box key={ci} sx={{ width: CELL, flexShrink: 0, mr: `${GAP}px` }}>
                {ml && (
                  <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', whiteSpace: 'nowrap', lineHeight: 1 }}>
                    {ml.label}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Grid */}
        <Box sx={{ display: 'flex', gap: `${GAP}px` }}>
          {/* Day-of-week labels */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px`, pt: 0, mr: '4px' }}>
            {DAY_LABELS.map((lbl, i) => (
              <Box key={i} sx={{ width: CELL, height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(i === 1 || i === 3 || i === 5) && (
                  <Typography sx={{ fontSize: '0.52rem', color: 'text.disabled', lineHeight: 1 }}>{lbl}</Typography>
                )}
              </Box>
            ))}
          </Box>

          {/* Week columns */}
          {columns.map((col, ci) => (
            <Box key={ci} sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
              {col.map(({ date, key }) => {
                const data = dayMap[key];
                const isToday = key === today.toISOString().slice(0, 10);
                const isFuture = date > today;
                const goalsOnDay = goalDateMap[key] ?? [];
                const hasGoal = goalsOnDay.length > 0;
                const count = data?.count ?? 0;
                const opacity = count === 0 ? 0 : count === 1 ? 0.45 : count === 2 ? 0.65 : count <= 4 ? 0.82 : 1;
                const bg = isFuture
                  ? 'transparent'
                  : count > 0
                    ? `rgba(245,158,11,${opacity})`
                    : 'rgba(255,255,255,0.06)';

                const tooltipLines: string[] = [];
                
                if (count > 0) {
                  // Show breakdown by type
                  const trackerCount = data?.trackers?.length ?? 0;
                  const noteCount = data?.notes ?? 0;
                  const goalCount = data?.goalUpdates ?? 0;
                  
                  if (trackerCount > 0) tooltipLines.push(`📊 ${trackerCount} tracker${trackerCount !== 1 ? 's' : ''}`);
                  if (noteCount > 0) tooltipLines.push(`📓 ${noteCount} note${noteCount !== 1 ? 's' : ''}`);
                  if (goalCount > 0) tooltipLines.push(`🎯 ${goalCount} goal update${goalCount !== 1 ? 's' : ''}`);
                } else {
                  tooltipLines.push('No activity');
                }
                
                goalsOnDay.forEach(g => tooltipLines.push(`🎯 ${g.label} deadline`));
                tooltipLines.push(date.toLocaleDateString('en', { month: 'short', day: 'numeric' }));
                
                const tooltipTitle = isFuture ? '' : tooltipLines.join(' · ');

                return (
                  <Tooltip key={key} title={tooltipTitle} placement="top" arrow>
                    <Box sx={{
                      width: CELL, height: CELL,
                      borderRadius: '3px',
                      bgcolor: bg,
                      border: isToday
                        ? '1.5px solid rgba(245,158,11,0.8)'
                        : hasGoal
                          ? `1.5px solid ${goalsOnDay[0].color}cc`
                          : 'none',
                      position: 'relative',
                      flexShrink: 0,
                      cursor: count > 0 || hasGoal ? 'pointer' : 'default',
                      // Goal date: small flag dot at top-right
                      '&::after': hasGoal ? {
                        content: '""', position: 'absolute',
                        top: -2, right: -2, width: 5, height: 5,
                        borderRadius: '50%', bgcolor: goalsOnDay[0].color,
                        border: '1px solid rgba(13,14,26,0.8)',
                      } : {},
                    }} />
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>

        {/* Legend */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>Less</Typography>
            {[0, 0.3, 0.55, 0.75, 1].map((op, i) => (
              <Box key={i} sx={{ width: CELL, height: CELL, borderRadius: '3px', bgcolor: op === 0 ? 'rgba(255,255,255,0.06)' : `rgba(245,158,11,${op})` }} />
            ))}
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>More</Typography>
          </Box>
          {goalDates.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#F59E0B' }} />
              <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>Goal deadline</Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: CELL, height: CELL, borderRadius: '3px', border: '1.5px solid rgba(245,158,11,0.8)' }} />
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>Today</Typography>
          </Box>
        </Box>
      </Box>

      {/* Goal deadlines list */}
      {goalDates.length > 0 && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
            Goal Deadlines
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {goalDates
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((g, i) => {
                const d = new Date(g.date);
                const isPast = d < today;
                const daysAway = Math.ceil((d.getTime() - today.getTime()) / 86400000);
                return (
                  <Box key={i} sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    px: 1.5, py: 0.75, borderRadius: '10px',
                    bgcolor: `${g.color}10`,
                    border: `1px solid ${g.color}25`,
                  }}>
                    <Typography sx={{ fontSize: '0.9rem' }}>{g.emoji}</Typography>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.75rem', color: g.color, lineHeight: 1.2 }}>
                        {g.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: isPast ? '#EF4444' : 'text.disabled', fontSize: '0.6rem' }}>
                        <FlagIcon sx={{ fontSize: 9, verticalAlign: 'middle', mr: 0.25 }} />
                        {d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {!isPast && ` · ${daysAway}d`}
                        {isPast && ' · Passed'}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
          </Box>
        </Box>
      )}
    </GlassCard>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function getStreakTier(streak: number): { label: string; color: string } {
  if (streak >= 30) return { label: 'Elite', color: '#EF4444' };
  if (streak >= 14) return { label: 'Veteran', color: '#8B5CF6' };
  if (streak >= 7)  return { label: 'Disciplined', color: '#3B82F6' };
  if (streak >= 3)  return { label: 'Consistent', color: '#10B981' };
  return { label: 'Newcomer', color: '#6B7280' };
}

interface LeaderboardEntry {
  id: string;
  name: string;
  avatar_url?: string;
  praxis_points: number;
  is_premium?: boolean;
  current_streak?: number;
  reliability_score?: number;
  rank: number;
  similarity: number;
  domains: string[];
}

const StatCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; glowColor?: string }> = ({
  icon, title, children, glowColor,
}) => (
  <GlassCard glowColor={glowColor} sx={{ p: 3, height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <Box sx={{ color: 'primary.main' }}>{icon}</Box>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
    </Box>
    {children}
  </GlassCard>
);

/**
 * @description Advanced Analytics page — premium-only feature.
 * Displays goal progress, domain performance, feedback trends, achievement rate,
 * and anonymized comparison data. All endpoints require auth token.
 *
 * NOTE: getComparisonData endpoint is a placeholder returning simulated aggregates.
 * Real implementation requires anonymized aggregate DB queries (whitepaper §6).
 */
const AnalyticsPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [progressData, setProgressData] = useState<any[]>([]);
  const [domainPerformance, setDomainPerformance] = useState<any[]>([]);
  const [feedbackTrends, setFeedbackTrends] = useState<any[]>([]);
  const [achievementRate, setAchievementRate] = useState<any>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);

  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [lbFilter, setLbFilter] = useState<'all' | 'aligned'>('all');

  // Calendar data (available to all users, not premium-gated)
  const [calendarDays, setCalendarDays] = useState<DayData[]>([]);
  const [goalDates, setGoalDates] = useState<GoalDate[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  
  // Filter toggles
  const [filters, setFilters] = useState({
    trackers: true,
    notes: true,
    goals: true
  });

  // NEW: Time range filter for analytics
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [exporting, setExporting] = useState(false);

  // Fetch calendar data independently (available to everyone)
  useEffect(() => {
    if (userLoading || !user) return;
    const load = async () => {
      setCalendarLoading(true);
      try {
        // Fetch combined calendar data from new endpoint
        const [calendarRes, goalRes] = await Promise.allSettled([
          api.get('/trackers/calendar?days=112'),
          api.get(`/goals/tree/${user.id}`),
        ]);

        // Build day map from combined data
        if (calendarRes.status === 'fulfilled') {
          const data = calendarRes.value.data;
          let days: DayData[] = data.calendar ?? [];
          
          // Apply filters
          if (!filters.trackers || !filters.notes || !filters.goals) {
            days = days.map(day => {
              let count = 0;
              let trackers: string[] = [];
              
              if (filters.trackers) {
                count += day.trackers.length;
                trackers = day.trackers;
              }
              if (filters.notes) count += day.notes;
              if (filters.goals) count += day.goalUpdates;
              
              return { ...day, count, trackers };
            }).filter(d => d.count > 0);
          }
          
          setCalendarDays(days);
        }

        // Extract goal target dates from goal tree nodes
        if (goalRes.status === 'fulfilled') {
          const tree = goalRes.value.data;
          const nodes: any[] = Array.isArray(tree?.nodes) ? tree.nodes : [];
          const DOMAIN_EMOJI: Record<string, string> = {
            'Fitness': '🏋️', 'Career': '💼', 'Investing / Financial Growth': '📈',
            'Academics': '📚', 'Mental Health': '🧘', 'Philosophical Development': '🔭',
            'Culture / Hobbies': '🎨', 'Intimacy / Romantic': '💞',
            'Friendship / Social Engagement': '👥', 'Personal Goals': '🌟',
          };
          const dates: GoalDate[] = nodes
            .filter((n: any) => n.targetDate)
            .map((n: any) => ({
              date: n.targetDate.slice(0, 10),
              label: n.name ?? n.title ?? 'Goal',
              emoji: DOMAIN_EMOJI[n.domain ?? ''] ?? '🎯',
              color: (DOMAIN_COLORS as Record<string, string>)[n.domain ?? ''] ?? '#F59E0B',
            }));
          setGoalDates(dates);
        }
      } catch { /* non-fatal */ }
      finally { setCalendarLoading(false); }
    };
    load();
  }, [user, userLoading]);

  useEffect(() => {
    if (userLoading) return;
    if (!user || !user.is_premium) return; // Premium check handled in render

    const fetchAnalyticsData = async () => {
      setLoadingAnalytics(true);
      setError(null);
      try {
        const userId = user.id;
        // Auth header required — analytics endpoints are protected by authenticateToken middleware
        const [progressRes, domainRes, feedbackRes, achievementRes, comparisonRes] = await Promise.allSettled([
          api.get(`/analytics/progress-over-time/${userId}`),
          api.get(`/analytics/domain-performance/${userId}`),
          api.get(`/analytics/feedback-trends/${userId}`),
          api.get(`/analytics/achievement-rate/${userId}`),
          api.get(`/analytics/comparison-data/${userId}`),
        ]);

        if (progressRes.status === 'fulfilled') setProgressData(progressRes.value.data);
        if (domainRes.status === 'fulfilled') setDomainPerformance(domainRes.value.data);
        if (feedbackRes.status === 'fulfilled') setFeedbackTrends(feedbackRes.value.data);
        if (achievementRes.status === 'fulfilled') setAchievementRate(achievementRes.value.data);
        if (comparisonRes.status === 'fulfilled') setComparisonData(comparisonRes.value.data);

        // Leaderboard
        try {
          const lbRes = await api.get('/users/leaderboard', { params: { userId } });
          setLeaderboardEntries(Array.isArray(lbRes.data) ? lbRes.data : []);
        } catch { /* non-fatal */ }
      } catch (err) {
        setError('Failed to fetch analytics data.');
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalyticsData();
  }, [user, userLoading, navigate]);

  if (userLoading) {
    return <PageSkeleton cards={4} />;
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const isPremium = user?.is_premium ?? false;

  // NEW: Export analytics data
  const handleExportAnalytics = async () => {
    setExporting(true);
    try {
      // Fetch all analytics data
      const [progressRes, domainRes, feedbackRes, achievementRes] = await Promise.all([
        api.get('/analytics/goal-progress'),
        api.get('/analytics/domain-performance'),
        api.get('/analytics/feedback-trends'),
        api.get('/analytics/achievement-rate'),
      ]);

      // Build CSV content
      const timestamp = new Date().toISOString().slice(0, 10);
      let csvContent = 'data:text/csv;charset=utf-8,';
      
      // Section 1: Goal Progress
      csvContent += '=== GOAL PROGRESS ===\n';
      csvContent += 'Goal Name,Domain,Progress (%),Weight,Target Date\n';
      progressRes.data.forEach((g: any) => {
        csvContent += `"${g.goalName}","${g.domain}",${Math.round(g.progress * 100)},${g.weight},"${g.targetDate || 'N/A'}"\n`;
      });
      
      // Section 2: Domain Performance
      csvContent += '\n=== DOMAIN PERFORMANCE ===\n';
      csvContent += 'Domain,Average Progress,Goal Count\n';
      domainRes.data.forEach((d: any) => {
        csvContent += `"${d.domain}",${Math.round(d.avgProgress)},${d.count}\n`;
      });
      
      // Section 3: Feedback Trends
      csvContent += '\n=== FEEDBACK TRENDS ===\n';
      csvContent += 'Grade,Count\n';
      feedbackRes.data.forEach((f: any) => {
        csvContent += `${f.grade},${f.count}\n`;
      });
      
      // Section 4: Achievement Rate
      csvContent += '\n=== ACHIEVEMENT RATE ===\n';
      csvContent += `Total Goals,${achievementRes.data.totalGoals}\n`;
      csvContent += `Completed,${achievementRes.data.completed}\n`;
      csvContent += `Completion Rate,${achievementRes.data.completionRate}%\n`;
      
      // Create and download file
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `praxis-analytics-${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error: any) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, pb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <InsightsIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Analytics
            </Typography>
          </Box>
          {isPremium && (
            <Chip label="PREMIUM" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: 'primary.main', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }} />
          )}
          <Box sx={{ flexGrow: 1 }} />
          {isPremium && (
            <>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={timeRange}
                  label="Time Range"
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  sx={{ color: 'text.primary' }}
                >
                  <MenuItem value="7d">Last 7 days</MenuItem>
                  <MenuItem value="30d">Last 30 days</MenuItem>
                  <MenuItem value="90d">Last 90 days</MenuItem>
                  <MenuItem value="1y">Last year</MenuItem>
                  <MenuItem value="all">All time</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                startIcon={exporting ? <CircularProgress size={18} /> : <DownloadIcon />}
                onClick={handleExportAnalytics}
                disabled={exporting || loadingAnalytics}
                sx={{ borderRadius: '10px' }}
              >
                Export
              </Button>
            </>
          )}
        </Box>
        <Typography color="text.secondary">
          Your habit log, goal deadlines, and performance insights.
        </Typography>
      </Box>

      {/* ── Habit Calendar — visible to all users ── */}
      <ErrorBoundary label="Habit Calendar">
        {calendarLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Box sx={{ mb: 3 }}>
            {/* Filter toggles */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label="📊 Trackers"
                color={filters.trackers ? 'primary' : 'default'}
                onClick={() => setFilters(f => ({ ...f, trackers: !f.trackers }))}
                sx={{ fontWeight: 600 }}
              />
              <Chip
                label="📓 Notes"
                color={filters.notes ? 'primary' : 'default'}
                onClick={() => setFilters(f => ({ ...f, notes: !f.notes }))}
                sx={{ fontWeight: 600 }}
              />
              <Chip
                label="🎯 Goals"
                color={filters.goals ? 'primary' : 'default'}
                onClick={() => setFilters(f => ({ ...f, goals: !f.goals }))}
                sx={{ fontWeight: 600 }}
              />
            </Box>

            <HabitCalendar dayData={calendarDays} goalDates={goalDates} />
          </Box>
        )}
      </ErrorBoundary>

      {/* ── Premium analytics gate ── */}
      {!isPremium ? (
        <ProBanner message="Advanced Analytics — deep goal insights, domain performance, feedback trends, and peer comparison — is a Praxis Pro feature." />
      ) : loadingAnalytics ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
      ) : (
      <>
      <Stack spacing={3}>
        {/* Row 1: Progress + Achievement Rate */}
        <ErrorBoundary label="Goal Progress">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <StatCard icon={<TrendingUpIcon />} title="Goal Progress" glowColor="rgba(245,158,11,0.15)">
              {progressData.length > 0 ? (
                <Stack spacing={2}>
                  {progressData.map((data, i) => {
                    const pct = Math.round(data.progress * 100);
                    const color = DOMAIN_COLORS[data.domain] || '#F59E0B';
                    return (
                      <Box key={i}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{data.goalName}</Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip label={data.domain} size="small" sx={{ bgcolor: `${color}20`, color, border: `1px solid ${color}40`, fontSize: '0.7rem', height: 20 }} />
                            <Typography variant="body2" sx={{ color, fontWeight: 700 }}>{pct}%</Typography>
                          </Box>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 6, borderRadius: 3,
                            bgcolor: 'rgba(255,255,255,0.06)',
                            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography color="text.secondary" variant="body2">No goal data yet.</Typography>
              )}
            </StatCard>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <StatCard icon={<EmojiEventsIcon />} title="Achievement Rate" glowColor="rgba(16,185,129,0.15)">
              {achievementRate ? (
                <Box>
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h2" sx={{ fontWeight: 800, color: 'success.main', lineHeight: 1 }}>
                      {Math.round(achievementRate.achievementRate * 100)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>completion rate</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={achievementRate.achievementRate * 100}
                    sx={{
                      height: 8, borderRadius: 4, mb: 2,
                      bgcolor: 'rgba(16,185,129,0.12)',
                      '& .MuiLinearProgress-bar': { bgcolor: '#10B981', borderRadius: 4 },
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{achievementRate.totalGoals}</Typography>
                      <Typography variant="caption" color="text.secondary">Total Goals</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {achievementRate.completedAchievements}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Completed</Typography>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Typography color="text.secondary" variant="body2">No achievement data yet.</Typography>
              )}
            </StatCard>
          </Grid>
        </Grid>
        </ErrorBoundary>

        {/* Row 2: Domain Performance */}
        <ErrorBoundary label="Domain Performance">
        <StatCard icon={<InsightsIcon />} title="Domain Performance" glowColor="rgba(139,92,246,0.15)">
          {domainPerformance.length > 0 ? (
            <Grid container spacing={2}>
              {domainPerformance.map((data, i) => {
                const color = DOMAIN_COLORS[data.domain] || '#8B5CF6';
                const pct = Math.round(data.averageProgress * 100);
                return (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}>
                    <Box
                      sx={{
                        p: 2, borderRadius: 2, textAlign: 'center',
                        bgcolor: `${color}12`, border: `1px solid ${color}30`,
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: `${color}20`, transform: 'translateY(-2px)' },
                      }}
                    >
                      <Typography variant="h4" sx={{ fontWeight: 800, color }}>{pct}%</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {data.domain}
                      </Typography>
                      <Typography variant="caption" sx={{ color: color + 'cc' }}>
                        {data.goalCount} goal{data.goalCount !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Typography color="text.secondary" variant="body2">No domain data yet.</Typography>
          )}
        </StatCard>
        </ErrorBoundary>

        {/* Row 3: Feedback Trends + Comparison */}
        <ErrorBoundary label="Feedback & Comparison">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <StatCard icon={<FeedbackIcon />} title="Feedback Trends" glowColor="rgba(59,130,246,0.15)">
              {feedbackTrends.filter(d => d.count > 0).length > 0 ? (
                <Stack spacing={1.5}>
                  {feedbackTrends.filter(d => d.count > 0).map((data, i) => {
                    const maxCount = Math.max(...feedbackTrends.map(d => d.count));
                    const pct = maxCount > 0 ? (data.count / maxCount) * 100 : 0;
                    return (
                      <Box key={i}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{data.grade}</Typography>
                          <Typography variant="body2" color="text.secondary">{data.count}×</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 6, borderRadius: 3,
                            bgcolor: 'rgba(255,255,255,0.06)',
                            '& .MuiLinearProgress-bar': { bgcolor: 'info.main', borderRadius: 3 },
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography color="text.secondary" variant="body2">No feedback received yet.</Typography>
              )}
            </StatCard>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <StatCard icon={<CompareArrowsIcon />} title="Community Comparison" glowColor="rgba(245,158,11,0.1)">
              {comparisonData?.percentiles ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {[
                    { label: 'Streak', key: 'streak', suffix: 'd', color: '#F59E0B' },
                    { label: 'Reliability', key: 'reliability', suffix: '', color: '#10B981' },
                    { label: 'Praxis Points', key: 'praxis_points', suffix: ' PP', color: '#A78BFA' },
                    { label: 'Honor Score', key: 'honor_score', suffix: '', color: '#FBBF24' },
                  ].map(({ label, key, suffix, color }) => {
                    const userVal = comparisonData.user?.[key] ?? 0;
                    const communityAvg = comparisonData.community?.[key]?.avg ?? 0;
                    const percentile = comparisonData.percentiles?.[key] ?? 50;
                    return (
                      <Box key={key}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
                          <Box sx={{ display: 'flex', gap: 1.5 }}>
                            <Typography variant="caption" sx={{ color, fontWeight: 700 }}>
                              You: {userVal}{suffix}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              Avg: {communityAvg}{suffix}
                            </Typography>
                            <Typography variant="caption" sx={{ color: percentile >= 50 ? '#10B981' : '#F59E0B', fontWeight: 700 }}>
                              Top {100 - percentile}%
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${percentile}%`, bgcolor: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                        </Box>
                      </Box>
                    );
                  })}
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
                    Based on {comparisonData.community?.total_users ?? 0} community members
                  </Typography>
                </Box>
              ) : (
                <Typography color="text.secondary" variant="body2">No comparison data available.</Typography>
              )}
            </StatCard>
          </Grid>
        </Grid>
        </ErrorBoundary>
      </Stack>

      {/* NEW: Enhanced Charts Section */}
      {isPremium && progressData.length > 0 && (
        <ErrorBoundary label="Visual Analytics">
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShowChartIcon sx={{ color: 'primary.main' }} />
            Visual Analytics
          </Typography>
          
          <Grid container spacing={3}>
            {/* Goal Progress Line Chart */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Goal Progress Over Time</Typography>
                  <Box sx={{ height: 300 }}>
                    {progressData.length > 0 && (
                      <ChartContainer
                        series={[{
                          data: progressData.map(g => Math.round(g.progress * 100)),
                          label: 'Progress (%)',
                          color: '#F59E0B',
                        }]}
                        xAxis={[{
                          scaleType: 'band',
                          data: progressData.map(g => g.goalName.length > 15 ? g.goalName.slice(0, 15) + '...' : g.goalName),
                        }]}
                        sx={{
                          '& .MuiChartsAxis-line': { stroke: 'rgba(255,255,255,0.1)' },
                          '& .MuiChartsAxis-tick text': { fill: 'rgba(255,255,255,0.6)', fontSize: 10 },
                        }}
                      >
                        <LineChart />
                        <ChartsTooltip />
                      </ChartContainer>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Domain Performance Pie Chart */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Domain Distribution</Typography>
                  <Box sx={{ height: 300 }}>
                    {domainPerformance.length > 0 && (
                      <ChartContainer
                        series={[{
                          type: 'pie',
                          data: domainPerformance.map(d => ({
                            id: d.domain,
                            label: d.domain,
                            value: d.count,
                            color: DOMAIN_COLORS[d.domain] || '#888',
                          })),
                          innerRadius: 30,
                          outerRadius: 100,
                        }]}
                        sx={{
                          '& .MuiChartsLegend-root': { display: 'none' },
                        }}
                      >
                        <PieChart />
                        <ChartsTooltip />
                        <Legend position="bottom" />
                      </ChartContainer>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Feedback Bar Chart */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Feedback Distribution</Typography>
                  <Box sx={{ height: 250 }}>
                    {feedbackTrends.filter(d => d.count > 0).length > 0 && (
                      <ChartContainer
                        series={[{
                          type: 'bar',
                          data: feedbackTrends.map(f => ({
                            id: f.grade,
                            label: f.grade,
                            value: f.count,
                            color: f.grade === 'A+' ? '#10B981' : f.grade === 'A' ? '#3B82F6' : f.grade === 'B' ? '#F59E0B' : '#EF4444',
                          })),
                        }]}
                        xAxis={[{
                          scaleType: 'band',
                          data: feedbackTrends.map(f => f.grade),
                        }]}
                        sx={{
                          '& .MuiChartsAxis-line': { stroke: 'rgba(255,255,255,0.1)' },
                          '& .MuiChartsAxis-tick text': { fill: 'rgba(255,255,255,0.6)' },
                        }}
                      >
                        <BarChart />
                        <ChartsTooltip />
                      </ChartContainer>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Achievement Gauge */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 250 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Achievement Rate</Typography>
                  {achievementRate && (
                    <>
                      <Typography variant="h2" sx={{ fontWeight: 700, color: achievementRate.completionRate >= 50 ? '#10B981' : '#F59E0B' }}>
                        {achievementRate.completionRate}%
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        {achievementRate.completed} of {achievementRate.totalGoals} goals completed
                      </Typography>
                      <Box sx={{ width: '100%', mt: 2 }}>
                        <LinearProgress
                          variant="determinate"
                          value={achievementRate.completionRate}
                          sx={{
                            height: 12, borderRadius: 6,
                            bgcolor: 'rgba(255,255,255,0.06)',
                            '& .MuiLinearProgress-bar': { bgcolor: achievementRate.completionRate >= 50 ? '#10B981' : '#F59E0B', borderRadius: 6 },
                          }}
                        />
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
        </ErrorBoundary>
      )}

      {/* Leaderboard */}
      <ErrorBoundary label="Leaderboard">
      <GlassCard glowColor="rgba(245,158,11,0.1)" sx={{ p: 3, mt: 3 }}>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LeaderboardIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Community Leaderboard</Typography>
          </Box>
          <ToggleButtonGroup
            size="small"
            value={lbFilter}
            exclusive
            onChange={(_, v) => v && setLbFilter(v)}
            sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.4, fontSize: '0.75rem', fontWeight: 600 } }}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="aligned">
              <AutoAwesomeIcon sx={{ fontSize: 14, mr: 0.5 }} />
              Aligned
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {leaderboardEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No leaderboard data yet.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {(lbFilter === 'aligned'
              ? leaderboardEntries.filter(e => e.similarity > 0)
              : leaderboardEntries
            ).map((entry, idx) => {
              const medal = MEDALS[idx];
              const tier = getStreakTier(entry.current_streak ?? 0);
              const isMe = entry.id === user?.id;
              return (
                <Box
                  key={entry.id}
                  onClick={() => navigate(`/profile/${entry.id}`)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    p: 1.5, borderRadius: '12px', cursor: 'pointer',
                    bgcolor: isMe ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                    border: isMe ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.04)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <Typography sx={{ minWidth: 28, fontSize: medal ? '1.1rem' : '0.8rem', fontWeight: 800, color: 'text.disabled', textAlign: 'center' }}>
                    {medal ?? `#${entry.rank}`}
                  </Typography>
                  <Avatar src={entry.avatar_url || undefined} sx={{ width: 34, height: 34, border: isMe ? '2px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)' }}>
                    {(entry.name ?? 'U').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{entry.name ?? 'Praxis User'}</Typography>
                      {isMe && <Chip label="you" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(245,158,11,0.12)', color: 'primary.main' }} />}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {entry.domains?.slice(0, 2).map(d => (
                        <Typography key={d} variant="caption" sx={{ color: DOMAIN_COLORS[d] || 'text.disabled', fontWeight: 500 }}>{d}</Typography>
                      ))}
                      {lbFilter === 'aligned' && entry.similarity > 0 && (
                        <Chip label={`${Math.round(entry.similarity * 100)}% match`} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(139,92,246,0.12)', color: '#A78BFA' }} />
                      )}
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    {(entry.current_streak ?? 0) > 0 && (
                      <Tooltip title={`${tier.label} — ${entry.current_streak}d streak`}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                          <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 13 }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#F97316', fontSize: '0.7rem' }}>{entry.current_streak}</Typography>
                        </Box>
                      </Tooltip>
                    )}
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>{entry.praxis_points ?? 0}</Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>pts</Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </GlassCard>
      </ErrorBoundary>
      </>
      )}  {/* end premium block */}
    </Container>
  );
};

export default AnalyticsPage;
