import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import api from '../../lib/api';

interface ActivityGraphProps {
  nodeId: string;
  days?: number;
}

interface ActivityDay {
  date: string;
  count: number;
}

const ActivityGraph: React.FC<ActivityGraphProps> = ({ nodeId, days = 14 }) => {
  const [activities, setActivities] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchActivity = async () => {
      try {
        const { data } = await api.get(`/trackers/node-activity/${nodeId}?days=${days}`);
        if (!cancelled) setActivities(data.activities || []);
      } catch (err) {
        console.error('Failed to fetch activity:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchActivity();
    return () => { cancelled = true; };
  }, [nodeId, days]);

  if (loading || activities.length === 0) return null;

  const activityMap = Object.fromEntries(activities.map(a => [a.date, a.count]));
  const today = new Date();
  const weeks: ActivityDay[][] = [];
  
  for (let w = 0; w < 2; w++) {
    const week: ActivityDay[] = [];
    for (let d = 6 - w * 7; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().slice(0, 10);
      week.push({ date: dateStr, count: activityMap[dateStr] || 0 });
    }
    weeks.push(week);
  }

  const maxCount = Math.max(...activities.map(a => a.count), 1);

  return (
    <Box sx={{ display: 'flex', gap: 0.25, mt: 0.5 }}>
      {activities.slice(-14).map((act, i) => (
        <Box
          key={act.date}
          sx={{
            width: 8,
            height: 8,
            borderRadius: '20%',
            bgcolor: act.count > 0 
              ? `rgba(34,197,94,${Math.min(0.3 + (act.count / maxCount) * 0.7, 1)})`
              : 'rgba(255,255,255,0.08)',
            transition: 'background-color 0.2s',
          }}
          title={`${act.date}: ${act.count} activities`}
        />
      ))}
    </Box>
  );
};

export default ActivityGraph;