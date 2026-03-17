import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Box, Typography, Stack } from '@mui/material';

interface DayActivity {
  date: string;
  count: number;
  dayOfWeek: number;
}

interface ContributionGraphProps {
  userId?: string;
  height?: number;
}

const ContributionGraph: React.FC<ContributionGraphProps> = ({ userId, height = 80 }) => {
  const [weekData, setWeekData] = useState<DayActivity[]>([]);
  const [maxCount, setMaxCount] = useState(1);

  useEffect(() => {
    if (!userId) return;

    const fetchWeekActivity = async () => {
      try {
        // Get the start of this week (Sunday)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const startStr = startOfWeek.toISOString().slice(0, 10);
        const endStr = endOfWeek.toISOString().slice(0, 10);

        // Fetch notebook entries for this week
        const { data: entries } = await supabase
          .from('notebook_entries')
          .select('occurred_at')
          .eq('user_id', userId)
          .gte('occurred_at', `${startStr}T00:00:00`)
          .lte('occurred_at', `${endStr}T23:59:59`);

        // Count entries per day
        const dayCounts: Record<string, number> = {};
        const days: DayActivity[] = [];

        // Initialize all 7 days
        for (let i = 0; i < 7; i++) {
          const date = new Date(startOfWeek);
          date.setDate(startOfWeek.getDate() + i);
          const dateStr = date.toISOString().slice(0, 10);
          dayCounts[dateStr] = 0;
          days.push({
            date: dateStr,
            count: 0,
            dayOfWeek: i,
          });
        }

        // Count entries
        entries?.forEach((entry) => {
          const dateStr = entry.occurred_at.slice(0, 10);
          if (dayCounts.hasOwnProperty(dateStr)) {
            dayCounts[dateStr]++;
          }
        });

        // Update days with counts
        days.forEach((day) => {
          day.count = dayCounts[day.date] || 0;
        });

        setWeekData(days);
        setMaxCount(Math.max(1, ...days.map((d) => d.count)));
      } catch (error) {
        console.error('Failed to fetch week activity:', error);
      }
    };

    fetchWeekActivity();
  }, [userId]);

  const getColor = (count: number, isToday: boolean): string => {
    if (count === 0) return 'rgba(255,255,255,0.05)';
    const ratio = count / maxCount;
    if (ratio >= 0.75) return isToday ? '#FCD34D' : '#F59E0B';
    if (ratio >= 0.5) return isToday ? '#FBBF24' : '#FBBF24';
    if (ratio >= 0.25) return isToday ? '#F59E0B' : '#D97706';
    return isToday ? '#D97706' : '#B45309';
  };

  const getDayLabel = (dayOfWeek: number): string => {
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return labels[dayOfWeek];
  };

  const getDateLabel = (date: string): string => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* Day labels */}
      <Stack spacing={0.5} sx={{ display: { xs: 'none', sm: 'flex' } }}>
        {weekData.map((day) => (
          <Typography
            key={`label-${day.date}`}
            variant="caption"
            sx={{
              height: 12,
              fontSize: '0.55rem',
              color: 'text.disabled',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {getDayLabel(day.dayOfWeek)}
          </Typography>
        ))}
      </Stack>

      {/* Contribution squares */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(1, 1fr)',
          gap: 0.5,
        }}
      >
        {weekData.map((day) => {
          const isToday = day.date === today;
          return (
            <Box
              key={day.date}
              sx={{
                width: 12,
                height: 12,
                borderRadius: '2px',
                bgcolor: getColor(day.count, isToday),
                border: isToday ? '1px solid #FCD34D' : 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.15s ease',
                '&:hover': {
                  transform: 'scale(1.2)',
                  zIndex: 1,
                },
              }}
              title={`${day.count} entries on ${getDateLabel(day.date)}`}
            />
          );
        })}
      </Stack>
    </Box>
  );
};

export default ContributionGraph;
