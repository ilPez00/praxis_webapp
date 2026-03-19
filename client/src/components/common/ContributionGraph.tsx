import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Box, Tooltip } from '@mui/material';

interface DayActivity {
  date: string;
  count: number;
  dayIndex: number;
  dayName: string;
}

interface ContributionGraphProps {
  userId?: string;
  height?: number;
  width?: number;
  showTooltip?: boolean;
}

const ContributionGraph: React.FC<ContributionGraphProps> = ({ 
  userId, 
  height = 60, 
  width = 280,
  showTooltip = true 
}) => {
  const [monthData, setMonthData] = useState<DayActivity[]>([]);
  const [maxCount, setMaxCount] = useState(1);

  useEffect(() => {
    if (!userId) return;

    const fetchMonthActivity = async () => {
      try {
        // Get the start of this month (30 days ago for rolling view)
        const now = new Date();
        const startOfMonth = new Date(now);
        startOfMonth.setDate(now.getDate() - 29); // 30 days total including today
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(now);
        endOfMonth.setHours(23, 59, 59, 999);

        const startStr = startOfMonth.toISOString();
        const endStr = endOfMonth.toISOString();

        // Fetch ALL notebook entries for this month
        const { data: entries, error } = await supabase
          .from('notebook_entries')
          .select('created_at, entry_type')
          .eq('user_id', userId)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        if (error) {
          console.error('Error fetching notebook entries:', error);
          return;
        }

        // Count entries per day
        const dayCounts: Record<string, number> = {};
        const days: DayActivity[] = [];

        // Initialize all 30 days
        for (let i = 0; i < 30; i++) {
          const date = new Date(startOfMonth);
          date.setDate(startOfMonth.getDate() + i);
          const dateStr = date.toISOString().slice(0, 10);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          dayCounts[dateStr] = 0;
          days.push({
            date: dateStr,
            count: 0,
            dayIndex: i,
            dayName,
          });
        }

        // Count ALL entries (notes, trackers, goals, achievements, etc.)
        entries?.forEach((entry) => {
          const dateStr = entry.created_at.slice(0, 10);
          if (dayCounts.hasOwnProperty(dateStr)) {
            dayCounts[dateStr]++;
          }
        });

        // Update days with counts
        days.forEach((day) => {
          day.count = dayCounts[day.date] || 0;
        });

        setMonthData(days);
        setMaxCount(Math.max(1, ...days.map((d) => d.count)));
      } catch (error) {
        console.error('Failed to fetch month activity:', error);
      }
    };

    fetchMonthActivity();
  }, [userId]);

  const today = new Date().toISOString().slice(0, 10);
  const todayIndex = monthData.findIndex((d) => d.date === today);

  // Generate SVG path for the line chart
  const generatePath = () => {
    if (monthData.length === 0) return '';

    const padding = 4;
    const graphHeight = height - padding * 2;
    const graphWidth = width - padding * 2;
    const pointSpacing = graphWidth / 29; // 29 intervals for 30 points

    const points = monthData.map((day, index) => {
      const x = padding + index * pointSpacing;
      const y = padding + graphHeight - (day.count / maxCount) * graphHeight;
      return `${x},${y}`;
    });

    return points.join(' ');
  };

  // Generate area fill path (from line down to bottom)
  const generateAreaPath = () => {
    if (monthData.length === 0) return '';

    const padding = 4;
    const graphHeight = height - padding * 2;
    const graphWidth = width - padding * 2;
    const pointSpacing = graphWidth / 29;

    const linePoints = monthData.map((day, index) => {
      const x = padding + index * pointSpacing;
      const y = padding + graphHeight - (day.count / maxCount) * graphHeight;
      return `${x},${y}`;
    });

    const firstX = padding;
    const lastX = padding + 29 * pointSpacing;
    const bottomY = padding + graphHeight;

    return `M ${firstX},${bottomY} L ${linePoints.join(' L ')} L ${lastX},${bottomY} Z`;
  };

  const isToday = (index: number) => index === todayIndex;

  // Get tooltip title
  const getTooltipTitle = (day: DayActivity) => {
    const date = new Date(day.date + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

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

        {/* Data points with tooltips */}
        {monthData.map((day, index) => {
          const padding = 4;
          const graphHeight = height - padding * 2;
          const graphWidth = width - padding * 2;
          const pointSpacing = graphWidth / 29;
          const x = padding + index * pointSpacing;
          const y = padding + graphHeight - (day.count / maxCount) * graphHeight;

          const point = (
            <circle
              key={day.date}
              cx={x}
              cy={y}
              r={isToday(index) ? 4 : 2.5}
              fill={isToday(index) ? '#FCD34D' : '#1A1F2E'}
              stroke="#F59E0B"
              strokeWidth={isToday(index) ? 2.5 : 1.5}
              style={{
                cursor: showTooltip ? 'pointer' : 'default',
                transition: 'r 0.2s ease',
              }}
            />
          );

          if (showTooltip) {
            return (
              <Tooltip
                key={day.date}
                title={
                  <Box sx={{ textAlign: 'center' }}>
                    <Box sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {getTooltipTitle(day)}
                    </Box>
                    <Box sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#F59E0B', mt: 0.5 }}>
                      {day.count} {day.count === 1 ? 'entry' : 'entries'}
                    </Box>
                  </Box>
                }
                arrow
                placement="top"
              >
                {point}
              </Tooltip>
            );
          }

          return point;
        })}
      </svg>
    </Box>
  );
};

export default ContributionGraph;
