import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Box } from '@mui/material';

interface DayActivity {
  date: string;
  count: number;
  dayIndex: number;
}

interface ContributionGraphProps {
  userId?: string;
  height?: number;
  width?: number;
}

const ContributionGraph: React.FC<ContributionGraphProps> = ({ userId, height = 40, width = 140 }) => {
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
            dayIndex: i,
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

  const today = new Date().toISOString().slice(0, 10);
  const todayIndex = weekData.findIndex((d) => d.date === today);

  // Generate SVG path for the line chart
  const generatePath = () => {
    if (weekData.length === 0) return '';

    const padding = 2;
    const graphHeight = height - padding * 2;
    const graphWidth = width - padding * 2;
    const pointSpacing = graphWidth / 6; // 6 intervals for 7 points

    const points = weekData.map((day, index) => {
      const x = padding + index * pointSpacing;
      const y = padding + graphHeight - (day.count / maxCount) * graphHeight;
      return `${x},${y}`;
    });

    return points.join(' ');
  };

  // Generate area fill path (from line down to bottom)
  const generateAreaPath = () => {
    if (weekData.length === 0) return '';

    const padding = 2;
    const graphHeight = height - padding * 2;
    const graphWidth = width - padding * 2;
    const pointSpacing = graphWidth / 6;

    const linePoints = weekData.map((day, index) => {
      const x = padding + index * pointSpacing;
      const y = padding + graphHeight - (day.count / maxCount) * graphHeight;
      return `${x},${y}`;
    });

    const firstX = padding;
    const lastX = padding + 6 * pointSpacing;
    const bottomY = padding + graphHeight;

    return `M ${firstX},${bottomY} L ${linePoints.join(' L ')} L ${lastX},${bottomY} Z`;
  };

  const isToday = (index: number) => index === todayIndex;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        width: width,
        height: height,
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Gradient definition */}
        <defs>
          <linearGradient id="activityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Area fill under the line */}
        <path
          d={generateAreaPath()}
          fill="url(#activityGradient)"
          stroke="none"
        />

        {/* Line chart */}
        <polyline
          points={generatePath()}
          fill="none"
          stroke="#F59E0B"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {weekData.map((day, index) => {
          const padding = 2;
          const graphHeight = height - padding * 2;
          const graphWidth = width - padding * 2;
          const pointSpacing = graphWidth / 6;
          const x = padding + index * pointSpacing;
          const y = padding + graphHeight - (day.count / maxCount) * graphHeight;

          return (
            <circle
              key={day.date}
              cx={x}
              cy={y}
              r={isToday(index) ? 3 : 2}
              fill={isToday(index) ? '#FCD34D' : '#1A1F2E'}
              stroke="#F59E0B"
              strokeWidth={isToday(index) ? 2 : 1.5}
            />
          );
        })}
      </svg>
    </Box>
  );
};

export default ContributionGraph;
