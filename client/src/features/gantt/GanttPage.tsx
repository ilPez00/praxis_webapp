import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, Stack, Paper, IconButton, TextField,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import api from '../../lib/api';

interface Task {
  timestamp: string;
  duration: number;
  activity: string;
  goal_id: string;
  goal_name: string;
}

interface DayData {
  date: string;
  tasks: Task[];
}

interface PlanTask {
  id: string;
  title: string;
  startTime: string;
  duration: number;
  goal_id: string;
}

const GOAL_COLORS: Record<string, string> = {
  development: '#6366F1',
  communication: '#EC4899',
  focus: '#10B981',
  other: '#6B7280',
};

const GanttRow: React.FC<{ task: Task; hourWidth: number }> = ({ task, hourWidth }) => {
  const hour = new Date(task.timestamp).getHours();
  const minute = new Date(task.timestamp).getMinutes();
  const leftPx = (hour + minute / 60) * hourWidth;
  const widthPx = Math.max((task.duration / 60) * hourWidth, 20);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        height: '28px',
        backgroundColor: GOAL_COLORS[task.goal_id] || '#6B7280',
        borderRadius: '6px',
        opacity: 0.85,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '8px',
        fontSize: '11px',
        color: '#fff',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        top: '2px',
      }}
      title={`${task.activity} (${task.duration}min)`}
    >
      {task.activity}
    </div>
  );
};

const GanttChart: React.FC<{ tasks: Task[]; date: string }> = ({ tasks, date }) => {
  const hourWidth = 60;
  const totalWidth = 24 * hourWidth;

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const grouped = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    const gid = t.goal_id || 'other';
    if (!acc[gid]) acc[gid] = [];
    acc[gid].push(t);
    return acc;
  }, {});

  const rowHeight = 36;

  return (
    <Box sx={{ overflowX: 'auto', pb: 2 }}>
      {/* Time axis */}
      <Box sx={{ display: 'flex', ml: '100px', height: '24px' }}>
        {hours.map((h) => (
          <Box
            key={h}
            sx={{
              width: `${hourWidth}px`,
              minWidth: `${hourWidth}px`,
              fontSize: '10px',
              color: 'text.secondary',
              borderLeft: '1px solid',
              borderColor: 'divider',
              pl: 0.5,
            }}
          >
            {h.toString().padStart(2, '0')}:00
          </Box>
        ))}
      </Box>

      {/* Goal rows */}
      {Object.entries(grouped).map(([goalId, goalTasks]) => (
        <Box key={goalId} sx={{ display: 'flex', alignItems: 'center', height: `${rowHeight}px`, mb: 0.5 }}>
          <Box
            sx={{
              width: '96px',
              minWidth: '96px',
              pr: 1,
              textAlign: 'right',
            }}
          >
            <Chip
              label={goalTasks[0]?.goal_name || goalId}
              size="small"
              sx={{
                backgroundColor: GOAL_COLORS[goalId] || '#6B7280',
                color: '#fff',
                fontWeight: 600,
                fontSize: '10px',
                height: '22px',
              }}
            />
          </Box>
          <Box sx={{ position: 'relative', width: `${totalWidth}px`, minWidth: `${totalWidth}px`, height: `${rowHeight}px` }}>
            {goalTasks.map((task, i) => (
              <GanttRow key={i} task={task} hourWidth={hourWidth} />
            ))}
          </Box>
        </Box>
      ))}

      {tasks.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No tasks recorded for {date}
        </Typography>
      )}
    </Box>
  );
};

const GanttPage: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [planTasks, setPlanTasks] = useState<PlanTask[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDay = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const [dayRes, planRes] = await Promise.all([
        api.get(`/gantt/day?date=${d}`),
        api.get(`/gantt/plan?date=${d}`),
      ]);

      if (dayRes.data?.tasks) {
        setDayData(dayRes.data);
      } else {
        setDayData({ date: d, tasks: [] });
      }

      if (planRes.data?.tasks) {
        setPlanTasks(planRes.data.tasks);
      } else {
        setPlanTasks([]);
      }
    } catch {
      setDayData({ date: d, tasks: [] });
      setPlanTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDay(date);
  }, [date, loadDay]);

  const changeDay = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  const goToday = () => {
    setDate(new Date().toISOString().slice(0, 10));
  };

  const addPlanTask = () => {
    setPlanTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: '', startTime: '09:00', duration: 60, goal_id: 'other' },
    ]);
  };

  const updatePlanTask = (id: string, field: keyof PlanTask, value: string | number) => {
    setPlanTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const removePlanTask = (id: string) => {
    setPlanTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const savePlan = async () => {
    try {
      const futureDate = new Date(date);
      futureDate.setDate(futureDate.getDate() + 1);
      const planDate = futureDate.toISOString().slice(0, 10);

      await api.post('/gantt/plan', {
        date: planDate,
        tasks: planTasks.filter((t) => t.title.trim()),
      });
      alert('Plan saved!');
    } catch {
      alert('Failed to save plan.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        Loading...
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Gantt Chart
      </Typography>

      {/* Day navigation */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <IconButton size="small" onClick={() => changeDay(-1)}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="body1" sx={{ fontWeight: 600, minWidth: '120px', textAlign: 'center' }}>
          {date}
        </Typography>
        <IconButton size="small" onClick={() => changeDay(1)}>
          <ChevronRightIcon />
        </IconButton>
        <Button size="small" variant="outlined" startIcon={<TodayIcon />} onClick={goToday}>
          Today
        </Button>
      </Stack>

      {/* Gantt chart */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <GanttChart tasks={dayData?.tasks || []} date={date} />
      </Paper>

      {/* Aura feedback */}
      {dayData && dayData.tasks.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 2, backgroundColor: '#F3F4F6' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Aura Feedback
          </Typography>
          <Stack direction="row" spacing={2}>
            {Object.entries(
              dayData.tasks.reduce<Record<string, number>>((acc, t) => {
                const gid = t.goal_id || 'other';
                acc[gid] = (acc[gid] || 0) + t.duration;
                return acc;
              }, {})
            ).map(([goalId, totalDuration]) => (
              <Chip
                key={goalId}
                label={`${goalId}: ${totalDuration}min`}
                size="small"
                sx={{
                  backgroundColor: GOAL_COLORS[goalId] || '#6B7280',
                  color: '#fff',
                }}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {/* Next day planner */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Plan for Tomorrow
        </Typography>

        {planTasks.map((task) => (
          <Stack key={task.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <TextField
              size="small"
              placeholder="Task name"
              value={task.title}
              onChange={(e) => updatePlanTask(task.id, 'title', e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="time"
              value={task.startTime}
              onChange={(e) => updatePlanTask(task.id, 'startTime', e.target.value)}
              sx={{ width: '100px' }}
            />
            <TextField
              size="small"
              type="number"
              label="min"
              value={task.duration}
              onChange={(e) => updatePlanTask(task.id, 'duration', parseInt(e.target.value) || 30)}
              sx={{ width: '80px' }}
            />
            <IconButton size="small" color="error" onClick={() => removePlanTask(task.id)}>
              ✕
            </IconButton>
          </Stack>
        ))}

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" size="small" onClick={addPlanTask}>
            + Add Task
          </Button>
          <Button variant="contained" size="small" onClick={savePlan} disabled={planTasks.length === 0}>
            Save Plan
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default GanttPage;
