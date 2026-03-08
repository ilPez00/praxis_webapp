import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, TextField, Chip, CircularProgress,
  Tooltip, IconButton, Stack, Collapse, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import VerifiedIcon from '@mui/icons-material/Verified';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FlagIcon from '@mui/icons-material/Flag';
import GlassCard from '../../../components/common/GlassCard';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';

// ── Shared types ───────────────────────────────────────────────────────────────

interface GoalNode { id: string; name: string; domain?: string; category?: string; progress?: number }
interface TrackerEntry { tracker_id: string; data: Record<string, any>; logged_at: string }
interface Tracker { id: string; type: string; goal: Record<string, any>; entries: TrackerEntry[] }
interface ActiveBet { id: string; goal_node_id: string; stake_points: number; deadline: string }
interface ActiveChallenge { id: string; title: string; description?: string; domain?: string; end_date?: string }
interface Props {
  userId: string;
  allNodes: GoalNode[];
  activeBets?: ActiveBet[];
  activeChallenges?: ActiveChallenge[];
}

interface FieldConfig {
  key: string; label: string; type: 'number' | 'text';
  placeholder?: string; min?: number; max?: number; step?: number; unit?: string;
}

interface ObjectiveField {
  key: string; label: string; unit: string; placeholder: string; type: 'number' | 'text';
}

interface WidgetConfig {
  type: string;
  label: string;
  emoji: string;
  color: string;
  fields: FieldConfig[];
  chartKey: string;
  chartUnit: string;
  objectives: ObjectiveField[];
  domains: string[];  // which domains this widget appears for
}

// ── All subcategory widget configs ─────────────────────────────────────────────
// Covers every entry in DOMAIN_CATEGORIES from GoalSelectionPage

const ALL_WIDGETS: WidgetConfig[] = [

  // ── FITNESS ──────────────────────────────────────────────────────────────────
  {
    type: 'lose_weight', label: 'Lose Weight', emoji: '⚖️', color: '#10B981',
    domains: ['Fitness'],
    fields: [
      { key: 'weight_kg', label: 'Body weight', type: 'number', unit: 'kg', step: 0.1, min: 30, max: 300 },
      { key: 'steps', label: 'Steps', type: 'number', unit: 'steps', min: 0 },
      { key: 'calories', label: 'Calories eaten', type: 'number', unit: 'kcal', min: 0 },
    ],
    chartKey: 'weight_kg', chartUnit: 'kg',
    objectives: [
      { key: 'target_weight_kg', label: 'Target weight', unit: 'kg', placeholder: '75', type: 'number' },
      { key: 'daily_steps', label: 'Daily steps goal', unit: 'steps', placeholder: '10000', type: 'number' },
      { key: 'calorie_limit', label: 'Daily calorie limit', unit: 'kcal', placeholder: '1800', type: 'number' },
    ],
  },
  {
    type: 'build_muscle', label: 'Build Muscle', emoji: '🏋️', color: '#F97316',
    domains: ['Fitness'],
    fields: [
      { key: 'exercise', label: 'Exercise', type: 'text', placeholder: 'Bench press' },
      { key: 'sets', label: 'Sets', type: 'number', min: 1, max: 20 },
      { key: 'reps', label: 'Reps', type: 'number', min: 1, max: 200 },
      { key: 'weight_kg', label: 'kg', type: 'number', min: 0, max: 500, step: 0.5 },
    ],
    chartKey: 'weight_kg', chartUnit: 'kg',
    objectives: [
      { key: 'main_lift', label: 'Main lift', unit: '', placeholder: 'Bench press', type: 'text' },
      { key: 'target_weight_kg', label: 'Target weight', unit: 'kg', placeholder: '100', type: 'number' },
      { key: 'target_body_weight_kg', label: 'Target body weight', unit: 'kg', placeholder: '85', type: 'number' },
    ],
  },
  {
    type: 'run_marathon', label: 'Run a Marathon', emoji: '🏃', color: '#3B82F6',
    domains: ['Fitness'],
    fields: [
      { key: 'distance_km', label: 'Distance', type: 'number', unit: 'km', step: 0.1, min: 0 },
      { key: 'duration_min', label: 'Duration', type: 'number', unit: 'min', min: 1 },
    ],
    chartKey: 'distance_km', chartUnit: 'km',
    objectives: [
      { key: 'race_distance_km', label: 'Race distance', unit: 'km', placeholder: '42.2', type: 'number' },
      { key: 'target_time_min', label: 'Finish time target', unit: 'min', placeholder: '240', type: 'number' },
      { key: 'race_date', label: 'Race date', unit: '', placeholder: '2026-09-15', type: 'text' },
    ],
  },
  {
    type: 'yoga_practice', label: 'Yoga Practice', emoji: '🧘', color: '#A78BFA',
    domains: ['Fitness'],
    fields: [
      { key: 'duration_min', label: 'Duration', type: 'number', unit: 'min', min: 5, max: 180 },
      { key: 'style', label: 'Style', type: 'text', placeholder: 'Vinyasa' },
    ],
    chartKey: 'duration_min', chartUnit: 'min',
    objectives: [
      { key: 'sessions_per_week', label: 'Sessions / week', unit: '', placeholder: '5', type: 'number' },
      { key: 'session_length_min', label: 'Session length target', unit: 'min', placeholder: '60', type: 'number' },
    ],
  },
  {
    type: 'sports_training', label: 'Sports Training', emoji: '⚽', color: '#34D399',
    domains: ['Fitness'],
    fields: [
      { key: 'sport', label: 'Sport', type: 'text', placeholder: 'Football' },
      { key: 'duration_min', label: 'Duration', type: 'number', unit: 'min', min: 10, max: 300 },
      { key: 'intensity', label: 'Intensity (1–10)', type: 'number', min: 1, max: 10 },
    ],
    chartKey: 'duration_min', chartUnit: 'min',
    objectives: [
      { key: 'sessions_per_week', label: 'Sessions / week', unit: '', placeholder: '4', type: 'number' },
      { key: 'next_competition', label: 'Next competition date', unit: '', placeholder: '2026-06-01', type: 'text' },
    ],
  },
  {
    type: 'nutrition_plan', label: 'Nutrition Plan', emoji: '🥗', color: '#22C55E',
    domains: ['Fitness'],
    fields: [
      { key: 'calories', label: 'Calories', type: 'number', unit: 'kcal', min: 0 },
      { key: 'protein_g', label: 'Protein', type: 'number', unit: 'g', min: 0 },
      { key: 'meals', label: 'Meals today', type: 'number', min: 1, max: 10 },
    ],
    chartKey: 'calories', chartUnit: 'kcal',
    objectives: [
      { key: 'daily_calories', label: 'Daily calorie target', unit: 'kcal', placeholder: '2000', type: 'number' },
      { key: 'daily_protein_g', label: 'Daily protein target', unit: 'g', placeholder: '150', type: 'number' },
      { key: 'meals_per_day', label: 'Meals per day', unit: '', placeholder: '4', type: 'number' },
    ],
  },

  // ── CAREER ───────────────────────────────────────────────────────────────────
  {
    type: 'get_promoted', label: 'Get Promoted', emoji: '📈', color: '#F59E0B',
    domains: ['Career'],
    fields: [
      { key: 'tasks_completed', label: 'High-impact tasks done', type: 'number', min: 0 },
      { key: 'skills_practiced', label: 'Skills practiced', type: 'text', placeholder: 'Leadership' },
      { key: 'hours_extra', label: 'Extra hours worked', type: 'number', unit: 'h', min: 0, step: 0.5 },
    ],
    chartKey: 'tasks_completed', chartUnit: 'tasks',
    objectives: [
      { key: 'target_role', label: 'Target role / title', unit: '', placeholder: 'Senior Engineer', type: 'text' },
      { key: 'target_date', label: 'Target date', unit: '', placeholder: '2026-12-01', type: 'text' },
      { key: 'skills_needed', label: 'Key skills to master', unit: '', placeholder: 'Python, leadership', type: 'text' },
    ],
  },
  {
    type: 'switch_careers', label: 'Switch Careers', emoji: '🔄', color: '#60A5FA',
    domains: ['Career'],
    fields: [
      { key: 'applications_sent', label: 'Applications sent', type: 'number', min: 0 },
      { key: 'interviews', label: 'Interviews done', type: 'number', min: 0 },
      { key: 'networking_calls', label: 'Networking calls', type: 'number', min: 0 },
    ],
    chartKey: 'applications_sent', chartUnit: 'apps',
    objectives: [
      { key: 'target_industry', label: 'Target industry', unit: '', placeholder: 'Tech / Finance', type: 'text' },
      { key: 'target_role', label: 'Target role', unit: '', placeholder: 'Product Manager', type: 'text' },
      { key: 'applications_goal', label: 'Weekly applications goal', unit: '', placeholder: '5', type: 'number' },
    ],
  },
  {
    type: 'start_business', label: 'Start a Business', emoji: '🚀', color: '#EF4444',
    domains: ['Career'],
    fields: [
      { key: 'hours_worked', label: 'Hours worked', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'revenue', label: 'Revenue today', type: 'number', unit: '€', min: 0 },
      { key: 'tasks_done', label: 'Tasks completed', type: 'number', min: 0 },
    ],
    chartKey: 'hours_worked', chartUnit: 'hrs',
    objectives: [
      { key: 'monthly_revenue_target', label: 'Monthly revenue target', unit: '€', placeholder: '5000', type: 'number' },
      { key: 'launch_date', label: 'Launch date', unit: '', placeholder: '2026-06-01', type: 'text' },
      { key: 'first_customer_goal', label: 'First customer goal', unit: '', placeholder: '10 paying users', type: 'text' },
    ],
  },
  {
    type: 'build_network', label: 'Build Network', emoji: '🤝', color: '#8B5CF6',
    domains: ['Career'],
    fields: [
      { key: 'connections_made', label: 'New connections', type: 'number', min: 0 },
      { key: 'events_attended', label: 'Events attended', type: 'number', min: 0 },
      { key: 'messages_sent', label: 'Outreach messages', type: 'number', min: 0 },
    ],
    chartKey: 'connections_made', chartUnit: 'connections',
    objectives: [
      { key: 'total_connections_target', label: 'Target total connections', unit: '', placeholder: '500', type: 'number' },
      { key: 'weekly_events', label: 'Events / week', unit: '', placeholder: '2', type: 'number' },
    ],
  },
  {
    type: 'learn_new_skills', label: 'Learn New Skills', emoji: '🎓', color: '#06B6D4',
    domains: ['Career'],
    fields: [
      { key: 'hours_studied', label: 'Hours studied', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'skill', label: 'Skill practiced', type: 'text', placeholder: 'TypeScript' },
      { key: 'exercises_done', label: 'Exercises / problems', type: 'number', min: 0 },
    ],
    chartKey: 'hours_studied', chartUnit: 'hrs',
    objectives: [
      { key: 'skills_list', label: 'Skills to learn', unit: '', placeholder: 'Python, SQL, AWS', type: 'text' },
      { key: 'hours_per_week', label: 'Hours / week', unit: 'h', placeholder: '10', type: 'number' },
      { key: 'certification', label: 'Target certification', unit: '', placeholder: 'AWS Solutions Architect', type: 'text' },
    ],
  },
  {
    type: 'freelance_work', label: 'Freelance Work', emoji: '💼', color: '#F97316',
    domains: ['Career'],
    fields: [
      { key: 'hours_billed', label: 'Hours billed', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'revenue', label: 'Revenue earned', type: 'number', unit: '€', min: 0 },
      { key: 'proposals_sent', label: 'Proposals sent', type: 'number', min: 0 },
    ],
    chartKey: 'revenue', chartUnit: '€',
    objectives: [
      { key: 'monthly_revenue_target', label: 'Monthly income target', unit: '€', placeholder: '3000', type: 'number' },
      { key: 'hourly_rate', label: 'Target hourly rate', unit: '€/h', placeholder: '80', type: 'number' },
      { key: 'active_clients', label: 'Active clients target', unit: '', placeholder: '5', type: 'number' },
    ],
  },

  // ── INVESTING / FINANCIAL GROWTH ─────────────────────────────────────────────
  {
    type: 'build_portfolio', label: 'Build Portfolio', emoji: '📊', color: '#F59E0B',
    domains: ['Investing / Financial Growth'],
    fields: [
      { key: 'invested_today', label: 'Invested today', type: 'number', unit: '€', min: 0 },
      { key: 'portfolio_value', label: 'Portfolio value', type: 'number', unit: '€', min: 0 },
    ],
    chartKey: 'invested_today', chartUnit: '€',
    objectives: [
      { key: 'target_portfolio_value', label: 'Target portfolio value', unit: '€', placeholder: '50000', type: 'number' },
      { key: 'monthly_investment', label: 'Monthly investment', unit: '€', placeholder: '500', type: 'number' },
      { key: 'target_date', label: 'Target date', unit: '', placeholder: '2030-01-01', type: 'text' },
    ],
  },
  {
    type: 'learn_trading', label: 'Learn Trading', emoji: '📉', color: '#EF4444',
    domains: ['Investing / Financial Growth'],
    fields: [
      { key: 'hours_studied', label: 'Hours studied', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'trades_made', label: 'Trades made (paper)', type: 'number', min: 0 },
      { key: 'p_and_l', label: 'P&L today', type: 'number', unit: '€', step: 0.01 },
    ],
    chartKey: 'hours_studied', chartUnit: 'hrs',
    objectives: [
      { key: 'strategy', label: 'Strategy focus', unit: '', placeholder: 'Swing trading / Options', type: 'text' },
      { key: 'monthly_return_target', label: 'Monthly return target', unit: '%', placeholder: '5', type: 'number' },
      { key: 'study_hours_per_week', label: 'Study hours / week', unit: 'h', placeholder: '10', type: 'number' },
    ],
  },
  {
    type: 'real_estate', label: 'Real Estate', emoji: '🏠', color: '#10B981',
    domains: ['Investing / Financial Growth'],
    fields: [
      { key: 'properties_viewed', label: 'Properties viewed', type: 'number', min: 0 },
      { key: 'savings_this_month', label: 'Saved this session', type: 'number', unit: '€', min: 0 },
      { key: 'meetings', label: 'Agent / bank meetings', type: 'number', min: 0 },
    ],
    chartKey: 'savings_this_month', chartUnit: '€',
    objectives: [
      { key: 'target_property_value', label: 'Target property value', unit: '€', placeholder: '300000', type: 'number' },
      { key: 'down_payment_target', label: 'Down payment target', unit: '€', placeholder: '60000', type: 'number' },
      { key: 'purchase_date', label: 'Target purchase date', unit: '', placeholder: '2027-01-01', type: 'text' },
    ],
  },
  {
    type: 'retirement_planning', label: 'Retirement Planning', emoji: '🌴', color: '#34D399',
    domains: ['Investing / Financial Growth'],
    fields: [
      { key: 'contribution', label: 'Contribution today', type: 'number', unit: '€', min: 0 },
      { key: 'total_saved', label: 'Total saved', type: 'number', unit: '€', min: 0 },
    ],
    chartKey: 'contribution', chartUnit: '€',
    objectives: [
      { key: 'retirement_target', label: 'Retirement fund target', unit: '€', placeholder: '500000', type: 'number' },
      { key: 'monthly_contribution', label: 'Monthly contribution', unit: '€', placeholder: '400', type: 'number' },
      { key: 'retirement_age', label: 'Target retirement age', unit: '', placeholder: '55', type: 'number' },
    ],
  },
  {
    type: 'passive_income', label: 'Passive Income', emoji: '💸', color: '#8B5CF6',
    domains: ['Investing / Financial Growth'],
    fields: [
      { key: 'income_today', label: 'Income received', type: 'number', unit: '€', min: 0 },
      { key: 'new_stream', label: 'New stream set up', type: 'text', placeholder: 'Dividend ETF' },
    ],
    chartKey: 'income_today', chartUnit: '€',
    objectives: [
      { key: 'monthly_passive_target', label: 'Monthly passive income target', unit: '€', placeholder: '2000', type: 'number' },
      { key: 'income_streams_target', label: 'Number of income streams', unit: '', placeholder: '5', type: 'number' },
    ],
  },
  {
    type: 'budgeting', label: 'Budgeting', emoji: '🧾', color: '#60A5FA',
    domains: ['Investing / Financial Growth'],
    fields: [
      { key: 'spent_today', label: 'Spent today', type: 'number', unit: '€', min: 0, step: 0.01 },
      { key: 'saved_today', label: 'Saved today', type: 'number', unit: '€', min: 0, step: 0.01 },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'Food / Transport' },
    ],
    chartKey: 'saved_today', chartUnit: '€',
    objectives: [
      { key: 'monthly_savings_target', label: 'Monthly savings target', unit: '€', placeholder: '500', type: 'number' },
      { key: 'daily_budget', label: 'Daily spend limit', unit: '€', placeholder: '40', type: 'number' },
      { key: 'savings_rate', label: 'Target savings rate', unit: '%', placeholder: '30', type: 'number' },
    ],
  },

  // ── ACADEMICS ─────────────────────────────────────────────────────────────────
  {
    type: 'get_degree', label: 'Get a Degree', emoji: '🎓', color: '#8B5CF6',
    domains: ['Academics'],
    fields: [
      { key: 'hours_studied', label: 'Hours studied', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'assignments_done', label: 'Assignments completed', type: 'number', min: 0 },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Linear Algebra' },
    ],
    chartKey: 'hours_studied', chartUnit: 'hrs',
    objectives: [
      { key: 'degree_name', label: 'Degree / program', unit: '', placeholder: 'BSc Computer Science', type: 'text' },
      { key: 'graduation_date', label: 'Graduation date', unit: '', placeholder: '2027-06-01', type: 'text' },
      { key: 'target_gpa', label: 'Target GPA', unit: '', placeholder: '3.8', type: 'number' },
    ],
  },
  {
    type: 'learn_language', label: 'Learn a Language', emoji: '🗣️', color: '#EC4899',
    domains: ['Academics'],
    fields: [
      { key: 'minutes_practiced', label: 'Minutes practiced', type: 'number', unit: 'min', min: 0 },
      { key: 'words_learned', label: 'New words learned', type: 'number', min: 0 },
      { key: 'lessons_completed', label: 'Lessons done', type: 'number', min: 0 },
    ],
    chartKey: 'minutes_practiced', chartUnit: 'min',
    objectives: [
      { key: 'language', label: 'Language', unit: '', placeholder: 'Spanish', type: 'text' },
      { key: 'target_level', label: 'Target level', unit: '', placeholder: 'B2 / Conversational', type: 'text' },
      { key: 'daily_minutes', label: 'Daily practice goal', unit: 'min', placeholder: '30', type: 'number' },
    ],
  },
  {
    type: 'research_project', label: 'Research Project', emoji: '🔬', color: '#06B6D4',
    domains: ['Academics'],
    fields: [
      { key: 'hours_worked', label: 'Hours worked', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'pages_written', label: 'Pages written', type: 'number', min: 0 },
      { key: 'papers_read', label: 'Papers / sources read', type: 'number', min: 0 },
    ],
    chartKey: 'hours_worked', chartUnit: 'hrs',
    objectives: [
      { key: 'project_title', label: 'Project title', unit: '', placeholder: 'My thesis', type: 'text' },
      { key: 'deadline', label: 'Deadline', unit: '', placeholder: '2026-09-01', type: 'text' },
      { key: 'word_count_target', label: 'Word count target', unit: 'words', placeholder: '10000', type: 'number' },
    ],
  },
  {
    type: 'online_courses', label: 'Online Courses', emoji: '💻', color: '#F59E0B',
    domains: ['Academics'],
    fields: [
      { key: 'lessons_done', label: 'Lessons completed', type: 'number', min: 0 },
      { key: 'hours_watched', label: 'Hours watched', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'course', label: 'Course name', type: 'text', placeholder: 'Machine Learning' },
    ],
    chartKey: 'hours_watched', chartUnit: 'hrs',
    objectives: [
      { key: 'courses_to_complete', label: 'Courses to complete', unit: '', placeholder: 'ML, Cloud, DevOps', type: 'text' },
      { key: 'courses_per_month', label: 'Courses / month', unit: '', placeholder: '2', type: 'number' },
    ],
  },
  {
    type: 'certifications', label: 'Certifications', emoji: '📜', color: '#10B981',
    domains: ['Academics'],
    fields: [
      { key: 'hours_studied', label: 'Hours studied', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'practice_tests', label: 'Practice tests done', type: 'number', min: 0 },
      { key: 'score_pct', label: 'Practice test score', type: 'number', unit: '%', min: 0, max: 100 },
    ],
    chartKey: 'hours_studied', chartUnit: 'hrs',
    objectives: [
      { key: 'certification_name', label: 'Certification', unit: '', placeholder: 'AWS SAA-C03', type: 'text' },
      { key: 'exam_date', label: 'Exam date', unit: '', placeholder: '2026-07-15', type: 'text' },
      { key: 'target_score', label: 'Target score', unit: '%', placeholder: '90', type: 'number' },
    ],
  },
  {
    type: 'study_group', label: 'Study Group', emoji: '👥', color: '#A78BFA',
    domains: ['Academics'],
    fields: [
      { key: 'sessions_attended', label: 'Sessions attended', type: 'number', min: 0 },
      { key: 'duration_min', label: 'Session duration', type: 'number', unit: 'min', min: 0 },
      { key: 'topics_covered', label: 'Topics covered', type: 'text', placeholder: 'Chapter 5' },
    ],
    chartKey: 'duration_min', chartUnit: 'min',
    objectives: [
      { key: 'sessions_per_week', label: 'Sessions / week', unit: '', placeholder: '3', type: 'number' },
      { key: 'subject', label: 'Subject focus', unit: '', placeholder: 'Statistics', type: 'text' },
    ],
  },

  // ── MENTAL HEALTH ─────────────────────────────────────────────────────────────
  {
    type: 'meditation', label: 'Meditation', emoji: '🧘', color: '#A78BFA',
    domains: ['Mental Health'],
    fields: [
      { key: 'minutes', label: 'Minutes meditated', type: 'number', unit: 'min', min: 1, max: 240 },
      { key: 'technique', label: 'Technique', type: 'text', placeholder: 'Breath focus' },
    ],
    chartKey: 'minutes', chartUnit: 'min',
    objectives: [
      { key: 'daily_minutes', label: 'Daily minutes goal', unit: 'min', placeholder: '20', type: 'number' },
      { key: 'streak_target', label: 'Streak target', unit: 'days', placeholder: '30', type: 'number' },
    ],
  },
  {
    type: 'therapy', label: 'Therapy', emoji: '🛋️', color: '#EC4899',
    domains: ['Mental Health'],
    fields: [
      { key: 'sessions_attended', label: 'Sessions attended', type: 'number', min: 0 },
      { key: 'insights', label: 'Key insight today', type: 'text', placeholder: 'Brief note' },
    ],
    chartKey: 'sessions_attended', chartUnit: 'sessions',
    objectives: [
      { key: 'sessions_per_month', label: 'Sessions / month', unit: '', placeholder: '4', type: 'number' },
      { key: 'focus_area', label: 'Focus area', unit: '', placeholder: 'Anxiety / Self-esteem', type: 'text' },
    ],
  },
  {
    type: 'stress_management', label: 'Stress Management', emoji: '🌊', color: '#06B6D4',
    domains: ['Mental Health'],
    fields: [
      { key: 'stress_level', label: 'Stress level (1–10)', type: 'number', min: 1, max: 10 },
      { key: 'technique_used', label: 'Technique used', type: 'text', placeholder: 'Box breathing' },
      { key: 'duration_min', label: 'Practice duration', type: 'number', unit: 'min', min: 1 },
    ],
    chartKey: 'stress_level', chartUnit: '/ 10',
    objectives: [
      { key: 'target_stress_level', label: 'Target stress level', unit: '/ 10', placeholder: '3', type: 'number' },
      { key: 'techniques', label: 'Techniques to master', unit: '', placeholder: 'CBT, breathing, exercise', type: 'text' },
    ],
  },
  {
    type: 'better_sleep', label: 'Better Sleep', emoji: '😴', color: '#6366F1',
    domains: ['Mental Health'],
    fields: [
      { key: 'hours_slept', label: 'Hours slept', type: 'number', unit: 'h', step: 0.5, min: 0, max: 24 },
      { key: 'quality', label: 'Sleep quality (1–10)', type: 'number', min: 1, max: 10 },
      { key: 'bedtime', label: 'Bedtime', type: 'text', placeholder: '22:30' },
    ],
    chartKey: 'hours_slept', chartUnit: 'hrs',
    objectives: [
      { key: 'target_hours', label: 'Target sleep hours', unit: 'h', placeholder: '8', type: 'number' },
      { key: 'target_bedtime', label: 'Target bedtime', unit: '', placeholder: '22:30', type: 'text' },
      { key: 'target_quality', label: 'Target quality score', unit: '/ 10', placeholder: '8', type: 'number' },
    ],
  },
  {
    type: 'journaling', label: 'Journaling', emoji: '📝', color: '#F59E0B',
    domains: ['Mental Health'],
    fields: [
      { key: 'words_written', label: 'Words written', type: 'number', min: 0 },
      { key: 'mood', label: 'Mood (1–10)', type: 'number', min: 1, max: 10 },
      { key: 'topic', label: 'Main topic', type: 'text', placeholder: 'Gratitude / Goals' },
    ],
    chartKey: 'words_written', chartUnit: 'words',
    objectives: [
      { key: 'entries_per_week', label: 'Entries / week', unit: '', placeholder: '7', type: 'number' },
      { key: 'words_per_entry', label: 'Words per entry', unit: 'words', placeholder: '300', type: 'number' },
    ],
  },
  {
    type: 'mindfulness', label: 'Mindfulness', emoji: '🌿', color: '#10B981',
    domains: ['Mental Health'],
    fields: [
      { key: 'minutes', label: 'Mindful minutes', type: 'number', unit: 'min', min: 1 },
      { key: 'practice', label: 'Practice', type: 'text', placeholder: 'Body scan / Walking' },
    ],
    chartKey: 'minutes', chartUnit: 'min',
    objectives: [
      { key: 'daily_minutes', label: 'Daily minutes goal', unit: 'min', placeholder: '15', type: 'number' },
      { key: 'practices_to_explore', label: 'Practices to explore', unit: '', placeholder: 'MBSR, Vipassana', type: 'text' },
    ],
  },

  // ── PHILOSOPHICAL DEVELOPMENT ─────────────────────────────────────────────────
  {
    type: 'reading_philosophy', label: 'Reading Philosophy', emoji: '📚', color: '#6366F1',
    domains: ['Philosophical Development'],
    fields: [
      { key: 'pages_read', label: 'Pages read', type: 'number', min: 0 },
      { key: 'minutes_read', label: 'Reading time', type: 'number', unit: 'min', min: 0 },
      { key: 'book', label: 'Book / work', type: 'text', placeholder: 'Meditations' },
    ],
    chartKey: 'pages_read', chartUnit: 'pages',
    objectives: [
      { key: 'books_per_year', label: 'Books to read / year', unit: '', placeholder: '24', type: 'number' },
      { key: 'reading_list', label: 'Reading list highlights', unit: '', placeholder: 'Aurelius, Nietzsche, Aristotle', type: 'text' },
    ],
  },
  {
    type: 'ethical_living', label: 'Ethical Living', emoji: '⚖️', color: '#34D399',
    domains: ['Philosophical Development'],
    fields: [
      { key: 'practices_done', label: 'Ethical practices today', type: 'number', min: 0 },
      { key: 'reflection', label: 'Today\'s reflection', type: 'text', placeholder: 'What did I do well?' },
    ],
    chartKey: 'practices_done', chartUnit: 'practices',
    objectives: [
      { key: 'principles', label: 'Core principles to live by', unit: '', placeholder: 'Honesty, courage, kindness', type: 'text' },
      { key: 'weekly_practices', label: 'Practices / week', unit: '', placeholder: '7', type: 'number' },
    ],
  },
  {
    type: 'self_reflection', label: 'Self-Reflection', emoji: '🪞', color: '#A78BFA',
    domains: ['Philosophical Development'],
    fields: [
      { key: 'minutes', label: 'Reflection time', type: 'number', unit: 'min', min: 5 },
      { key: 'entries', label: 'Insights recorded', type: 'number', min: 0 },
      { key: 'theme', label: 'Theme', type: 'text', placeholder: 'Identity / Values' },
    ],
    chartKey: 'minutes', chartUnit: 'min',
    objectives: [
      { key: 'sessions_per_week', label: 'Sessions / week', unit: '', placeholder: '5', type: 'number' },
      { key: 'focus_questions', label: 'Recurring questions', unit: '', placeholder: 'Who am I becoming?', type: 'text' },
    ],
  },
  {
    type: 'stoicism_practice', label: 'Stoicism Practice', emoji: '🏛️', color: '#F59E0B',
    domains: ['Philosophical Development'],
    fields: [
      { key: 'exercises_done', label: 'Exercises done', type: 'number', min: 0 },
      { key: 'minutes', label: 'Practice time', type: 'number', unit: 'min', min: 1 },
      { key: 'exercise', label: 'Exercise', type: 'text', placeholder: 'Negative visualisation' },
    ],
    chartKey: 'exercises_done', chartUnit: 'exercises',
    objectives: [
      { key: 'daily_exercises', label: 'Exercises / day', unit: '', placeholder: '3', type: 'number' },
      { key: 'virtues_focus', label: 'Virtues to focus on', unit: '', placeholder: 'Wisdom, Justice, Courage', type: 'text' },
    ],
  },
  {
    type: 'writing_essays', label: 'Writing Essays', emoji: '✍️', color: '#EC4899',
    domains: ['Philosophical Development'],
    fields: [
      { key: 'words_written', label: 'Words written', type: 'number', min: 0 },
      { key: 'essays_completed', label: 'Essays completed', type: 'number', min: 0 },
      { key: 'topic', label: 'Essay topic', type: 'text', placeholder: 'Free will' },
    ],
    chartKey: 'words_written', chartUnit: 'words',
    objectives: [
      { key: 'essays_per_month', label: 'Essays / month', unit: '', placeholder: '4', type: 'number' },
      { key: 'avg_word_count', label: 'Target word count', unit: 'words', placeholder: '1500', type: 'number' },
    ],
  },
  {
    type: 'discussion_groups', label: 'Discussion Groups', emoji: '💬', color: '#60A5FA',
    domains: ['Philosophical Development'],
    fields: [
      { key: 'sessions_attended', label: 'Sessions attended', type: 'number', min: 0 },
      { key: 'duration_min', label: 'Duration', type: 'number', unit: 'min', min: 10 },
      { key: 'topic', label: 'Topic discussed', type: 'text', placeholder: 'Meaning of justice' },
    ],
    chartKey: 'sessions_attended', chartUnit: 'sessions',
    objectives: [
      { key: 'sessions_per_month', label: 'Sessions / month', unit: '', placeholder: '4', type: 'number' },
    ],
  },

  // ── CULTURE / HOBBIES / CREATIVE PURSUITS ────────────────────────────────────
  {
    type: 'learn_music', label: 'Learn Music', emoji: '🎸', color: '#F59E0B',
    domains: ['Culture / Hobbies / Creative Pursuits'],
    fields: [
      { key: 'minutes_practiced', label: 'Minutes practiced', type: 'number', unit: 'min', min: 0 },
      { key: 'pieces_learned', label: 'Songs / pieces learned', type: 'number', min: 0 },
      { key: 'instrument', label: 'Instrument / skill', type: 'text', placeholder: 'Guitar — chords' },
    ],
    chartKey: 'minutes_practiced', chartUnit: 'min',
    objectives: [
      { key: 'instrument', label: 'Instrument', unit: '', placeholder: 'Guitar', type: 'text' },
      { key: 'daily_minutes', label: 'Daily practice goal', unit: 'min', placeholder: '30', type: 'number' },
      { key: 'milestone', label: 'Milestone goal', unit: '', placeholder: 'Play 10 songs', type: 'text' },
    ],
  },
  {
    type: 'photography', label: 'Photography', emoji: '📷', color: '#6366F1',
    domains: ['Culture / Hobbies / Creative Pursuits'],
    fields: [
      { key: 'photos_taken', label: 'Photos taken', type: 'number', min: 0 },
      { key: 'hours_shooting', label: 'Hours shooting / editing', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'genre', label: 'Genre / subject', type: 'text', placeholder: 'Street / Portrait' },
    ],
    chartKey: 'photos_taken', chartUnit: 'photos',
    objectives: [
      { key: 'shoots_per_month', label: 'Shoots / month', unit: '', placeholder: '8', type: 'number' },
      { key: 'style_goal', label: 'Style / skill goal', unit: '', placeholder: 'Master low-light portraits', type: 'text' },
    ],
  },
  {
    type: 'painting', label: 'Painting', emoji: '🎨', color: '#EC4899',
    domains: ['Culture / Hobbies / Creative Pursuits'],
    fields: [
      { key: 'hours_painted', label: 'Hours painted', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'pieces_completed', label: 'Pieces completed', type: 'number', min: 0 },
      { key: 'medium', label: 'Medium', type: 'text', placeholder: 'Oil / Watercolour' },
    ],
    chartKey: 'hours_painted', chartUnit: 'hrs',
    objectives: [
      { key: 'pieces_per_month', label: 'Pieces / month', unit: '', placeholder: '4', type: 'number' },
      { key: 'skill_goal', label: 'Skill goal', unit: '', placeholder: 'Master chiaroscuro', type: 'text' },
    ],
  },
  {
    type: 'creative_writing', label: 'Creative Writing', emoji: '✍️', color: '#8B5CF6',
    domains: ['Culture / Hobbies / Creative Pursuits'],
    fields: [
      { key: 'words_written', label: 'Words written', type: 'number', min: 0 },
      { key: 'pages_written', label: 'Pages written', type: 'number', min: 0 },
      { key: 'project', label: 'Project', type: 'text', placeholder: 'Novel chapter 3' },
    ],
    chartKey: 'words_written', chartUnit: 'words',
    objectives: [
      { key: 'total_words_target', label: 'Total word count target', unit: 'words', placeholder: '80000', type: 'number' },
      { key: 'daily_words', label: 'Daily word count goal', unit: 'words', placeholder: '500', type: 'number' },
      { key: 'completion_date', label: 'First draft deadline', unit: '', placeholder: '2026-12-01', type: 'text' },
    ],
  },
  {
    type: 'film_making', label: 'Film Making', emoji: '🎬', color: '#EF4444',
    domains: ['Culture / Hobbies / Creative Pursuits'],
    fields: [
      { key: 'footage_hours', label: 'Footage shot', type: 'number', unit: 'h', step: 0.25, min: 0 },
      { key: 'editing_hours', label: 'Editing hours', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'project', label: 'Project', type: 'text', placeholder: 'Short film / Vlog' },
    ],
    chartKey: 'editing_hours', chartUnit: 'hrs',
    objectives: [
      { key: 'projects_per_year', label: 'Projects / year', unit: '', placeholder: '6', type: 'number' },
      { key: 'style_goal', label: 'Style goal', unit: '', placeholder: 'Cinematic documentary', type: 'text' },
    ],
  },
  {
    type: 'cooking', label: 'Cooking', emoji: '👨‍🍳', color: '#F97316',
    domains: ['Culture / Hobbies / Creative Pursuits'],
    fields: [
      { key: 'recipes_tried', label: 'New recipes tried', type: 'number', min: 0 },
      { key: 'meals_cooked', label: 'Meals cooked', type: 'number', min: 0 },
      { key: 'cuisine', label: 'Cuisine', type: 'text', placeholder: 'Italian / Japanese' },
    ],
    chartKey: 'recipes_tried', chartUnit: 'recipes',
    objectives: [
      { key: 'recipes_per_week', label: 'New recipes / week', unit: '', placeholder: '3', type: 'number' },
      { key: 'cuisines_to_master', label: 'Cuisines to master', unit: '', placeholder: 'French, Thai, Mexican', type: 'text' },
    ],
  },

  // ── INTIMACY / ROMANTIC EXPLORATION ─────────────────────────────────────────
  {
    type: 'dating', label: 'Dating', emoji: '💕', color: '#F472B6',
    domains: ['Intimacy / Romantic Exploration'],
    fields: [
      { key: 'dates', label: 'Dates this week', type: 'number', min: 0 },
      { key: 'new_connections', label: 'New people met', type: 'number', min: 0 },
      { key: 'note', label: 'Reflection', type: 'text', placeholder: 'What did I learn?' },
    ],
    chartKey: 'dates', chartUnit: 'dates',
    objectives: [
      { key: 'dates_per_month', label: 'Dates / month target', unit: '', placeholder: '4', type: 'number' },
      { key: 'qualities_seeking', label: 'Qualities seeking', unit: '', placeholder: 'Curious, kind, driven', type: 'text' },
    ],
  },
  {
    type: 'strengthen_relationship', label: 'Strengthen Relationship', emoji: '💑', color: '#EC4899',
    domains: ['Intimacy / Romantic Exploration'],
    fields: [
      { key: 'quality_time_min', label: 'Quality time', type: 'number', unit: 'min', min: 0 },
      { key: 'activities_shared', label: 'Activities shared', type: 'number', min: 0 },
      { key: 'note', label: 'Highlight', type: 'text', placeholder: 'What made today special?' },
    ],
    chartKey: 'quality_time_min', chartUnit: 'min',
    objectives: [
      { key: 'quality_hours_per_week', label: 'Quality time / week', unit: 'h', placeholder: '10', type: 'number' },
      { key: 'monthly_date_nights', label: 'Date nights / month', unit: '', placeholder: '4', type: 'number' },
    ],
  },
  {
    type: 'communication_skills', label: 'Communication Skills', emoji: '🗣️', color: '#60A5FA',
    domains: ['Intimacy / Romantic Exploration'],
    fields: [
      { key: 'difficult_convos', label: 'Difficult conversations had', type: 'number', min: 0 },
      { key: 'practice_min', label: 'Practice / study time', type: 'number', unit: 'min', min: 0 },
      { key: 'technique', label: 'Technique practiced', type: 'text', placeholder: 'Active listening' },
    ],
    chartKey: 'practice_min', chartUnit: 'min',
    objectives: [
      { key: 'books_to_read', label: 'Books to read', unit: '', placeholder: 'Nonviolent Comms, Hold Me Tight', type: 'text' },
      { key: 'skills_to_develop', label: 'Skills to develop', unit: '', placeholder: 'Active listening, assertiveness', type: 'text' },
    ],
  },
  {
    type: 'vulnerability_practice', label: 'Vulnerability Practice', emoji: '🫀', color: '#A78BFA',
    domains: ['Intimacy / Romantic Exploration'],
    fields: [
      { key: 'moments_shared', label: 'Vulnerable moments shared', type: 'number', min: 0 },
      { key: 'note', label: 'What did I share?', type: 'text', placeholder: 'A fear / hope / feeling' },
    ],
    chartKey: 'moments_shared', chartUnit: 'moments',
    objectives: [
      { key: 'per_week', label: 'Target moments / week', unit: '', placeholder: '3', type: 'number' },
    ],
  },
  {
    type: 'shared_activities', label: 'Shared Activities', emoji: '🏄', color: '#34D399',
    domains: ['Intimacy / Romantic Exploration'],
    fields: [
      { key: 'activities_done', label: 'Activities done together', type: 'number', min: 0 },
      { key: 'activity', label: 'What did you do?', type: 'text', placeholder: 'Cooking class / hike' },
    ],
    chartKey: 'activities_done', chartUnit: 'activities',
    objectives: [
      { key: 'per_week', label: 'New activities / week', unit: '', placeholder: '2', type: 'number' },
      { key: 'bucket_list', label: 'Bucket list together', unit: '', placeholder: 'Travel, cook, dance', type: 'text' },
    ],
  },
  {
    type: 'boundaries', label: 'Boundaries', emoji: '🛡️', color: '#F59E0B',
    domains: ['Intimacy / Romantic Exploration'],
    fields: [
      { key: 'boundaries_set', label: 'Boundaries communicated', type: 'number', min: 0 },
      { key: 'context', label: 'Context', type: 'text', placeholder: 'Work / relationship / family' },
    ],
    chartKey: 'boundaries_set', chartUnit: 'moments',
    objectives: [
      { key: 'key_boundaries', label: 'Key boundaries to establish', unit: '', placeholder: 'Work hours, alone time', type: 'text' },
    ],
  },

  // ── FRIENDSHIP / SOCIAL ENGAGEMENT ──────────────────────────────────────────
  {
    type: 'make_new_friends', label: 'Make New Friends', emoji: '🤝', color: '#34D399',
    domains: ['Friendship / Social Engagement'],
    fields: [
      { key: 'new_connections', label: 'New people met', type: 'number', min: 0 },
      { key: 'follow_ups', label: 'Follow-up messages sent', type: 'number', min: 0 },
      { key: 'context', label: 'Where?', type: 'text', placeholder: 'Gym / event / online' },
    ],
    chartKey: 'new_connections', chartUnit: 'connections',
    objectives: [
      { key: 'new_friends_target', label: 'New close friends target', unit: '', placeholder: '5', type: 'number' },
      { key: 'social_contexts', label: 'Social contexts to explore', unit: '', placeholder: 'Sports club, hackathon', type: 'text' },
    ],
  },
  {
    type: 'community_service', label: 'Community Service', emoji: '🌱', color: '#10B981',
    domains: ['Friendship / Social Engagement'],
    fields: [
      { key: 'hours_volunteered', label: 'Hours volunteered', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'people_helped', label: 'People helped', type: 'number', min: 0 },
      { key: 'cause', label: 'Cause / org', type: 'text', placeholder: 'Food bank' },
    ],
    chartKey: 'hours_volunteered', chartUnit: 'hrs',
    objectives: [
      { key: 'hours_per_month', label: 'Volunteer hours / month', unit: 'h', placeholder: '8', type: 'number' },
      { key: 'cause_focus', label: 'Cause focus', unit: '', placeholder: 'Food insecurity / education', type: 'text' },
    ],
  },
  {
    type: 'social_events', label: 'Social Events', emoji: '🎉', color: '#F59E0B',
    domains: ['Friendship / Social Engagement'],
    fields: [
      { key: 'events_attended', label: 'Events attended', type: 'number', min: 0 },
      { key: 'new_people_met', label: 'New people met', type: 'number', min: 0 },
      { key: 'event_type', label: 'Event type', type: 'text', placeholder: 'Dinner / Conference' },
    ],
    chartKey: 'events_attended', chartUnit: 'events',
    objectives: [
      { key: 'events_per_month', label: 'Events / month', unit: '', placeholder: '6', type: 'number' },
    ],
  },
  {
    type: 'reconnect_friends', label: 'Reconnect with Friends', emoji: '👋', color: '#60A5FA',
    domains: ['Friendship / Social Engagement'],
    fields: [
      { key: 'reconnections', label: 'Friends reconnected with', type: 'number', min: 0 },
      { key: 'conversations', label: 'Real conversations had', type: 'number', min: 0 },
      { key: 'medium', label: 'How?', type: 'text', placeholder: 'Call / coffee / message' },
    ],
    chartKey: 'reconnections', chartUnit: 'friends',
    objectives: [
      { key: 'people_to_reconnect', label: 'People to reconnect with', unit: '', placeholder: '10', type: 'number' },
      { key: 'frequency', label: 'Reconnect frequency', unit: '', placeholder: '1 per week', type: 'text' },
    ],
  },
  {
    type: 'group_activities', label: 'Group Activities', emoji: '⛷️', color: '#8B5CF6',
    domains: ['Friendship / Social Engagement'],
    fields: [
      { key: 'activities_attended', label: 'Activities done with group', type: 'number', min: 0 },
      { key: 'activity', label: 'What?', type: 'text', placeholder: 'Climbing / book club' },
    ],
    chartKey: 'activities_attended', chartUnit: 'activities',
    objectives: [
      { key: 'per_week', label: 'Group activities / week', unit: '', placeholder: '2', type: 'number' },
      { key: 'groups_to_join', label: 'Groups to join', unit: '', placeholder: 'Running club, chess', type: 'text' },
    ],
  },
  {
    type: 'mentoring', label: 'Mentoring', emoji: '🧑‍🏫', color: '#EC4899',
    domains: ['Friendship / Social Engagement'],
    fields: [
      { key: 'sessions_given', label: 'Mentoring sessions', type: 'number', min: 0 },
      { key: 'duration_min', label: 'Session duration', type: 'number', unit: 'min', min: 15 },
      { key: 'mentee', label: 'Mentee / topic', type: 'text', placeholder: 'Career advice' },
    ],
    chartKey: 'sessions_given', chartUnit: 'sessions',
    objectives: [
      { key: 'mentees_target', label: 'Active mentees target', unit: '', placeholder: '3', type: 'number' },
      { key: 'sessions_per_month', label: 'Sessions / month', unit: '', placeholder: '8', type: 'number' },
    ],
  },

  // ── PERSONAL GOALS ───────────────────────────────────────────────────────────
  {
    type: 'climb_mountain', label: 'Climb a Mountain', emoji: '🏔️', color: '#6366F1',
    domains: ['Personal Goals'],
    fields: [
      { key: 'training_hours', label: 'Training hours', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'elevation_gain_m', label: 'Elevation gain', type: 'number', unit: 'm', min: 0 },
      { key: 'activity', label: 'Activity', type: 'text', placeholder: 'Hike / gym / climbing wall' },
    ],
    chartKey: 'elevation_gain_m', chartUnit: 'm',
    objectives: [
      { key: 'target_peak', label: 'Target peak', unit: '', placeholder: 'Mont Blanc', type: 'text' },
      { key: 'target_elevation_m', label: 'Target elevation', unit: 'm', placeholder: '4808', type: 'number' },
      { key: 'attempt_date', label: 'Attempt date', unit: '', placeholder: '2026-08-01', type: 'text' },
    ],
  },
  {
    type: 'skydiving', label: 'Go Skydiving', emoji: '🪂', color: '#F97316',
    domains: ['Personal Goals'],
    fields: [
      { key: 'training_sessions', label: 'Training sessions done', type: 'number', min: 0 },
      { key: 'jumps', label: 'Jumps completed', type: 'number', min: 0 },
    ],
    chartKey: 'jumps', chartUnit: 'jumps',
    objectives: [
      { key: 'target_jumps', label: 'Target jumps', unit: '', placeholder: '1', type: 'number' },
      { key: 'target_date', label: 'Target date', unit: '', placeholder: '2026-07-01', type: 'text' },
    ],
  },
  {
    type: 'ultramarathon', label: 'Run an Ultramarathon', emoji: '🏅', color: '#EF4444',
    domains: ['Personal Goals'],
    fields: [
      { key: 'km_run', label: 'km run today', type: 'number', unit: 'km', step: 0.1, min: 0 },
      { key: 'duration_min', label: 'Run duration', type: 'number', unit: 'min', min: 0 },
      { key: 'elevation_m', label: 'Elevation gain', type: 'number', unit: 'm', min: 0 },
    ],
    chartKey: 'km_run', chartUnit: 'km',
    objectives: [
      { key: 'race_distance_km', label: 'Race distance', unit: 'km', placeholder: '100', type: 'number' },
      { key: 'race_date', label: 'Race date', unit: '', placeholder: '2026-10-15', type: 'text' },
      { key: 'weekly_km_target', label: 'Weekly km target', unit: 'km', placeholder: '80', type: 'number' },
    ],
  },
  {
    type: 'write_book', label: 'Write a Book', emoji: '📖', color: '#8B5CF6',
    domains: ['Personal Goals'],
    fields: [
      { key: 'words_written', label: 'Words written', type: 'number', min: 0 },
      { key: 'chapters_done', label: 'Chapters done', type: 'number', min: 0 },
      { key: 'session_min', label: 'Writing session', type: 'number', unit: 'min', min: 0 },
    ],
    chartKey: 'words_written', chartUnit: 'words',
    objectives: [
      { key: 'total_words', label: 'Total word count target', unit: 'words', placeholder: '80000', type: 'number' },
      { key: 'daily_word_goal', label: 'Daily word goal', unit: 'words', placeholder: '1000', type: 'number' },
      { key: 'first_draft_deadline', label: 'First draft deadline', unit: '', placeholder: '2026-12-01', type: 'text' },
    ],
  },
  {
    type: 'learn_to_fly', label: 'Learn to Fly', emoji: '✈️', color: '#60A5FA',
    domains: ['Personal Goals'],
    fields: [
      { key: 'flight_hours', label: 'Flight hours logged', type: 'number', unit: 'h', step: 0.1, min: 0 },
      { key: 'lessons_done', label: 'Lessons completed', type: 'number', min: 0 },
      { key: 'maneuvers_practiced', label: 'Maneuvers practiced', type: 'text', placeholder: 'Crosswind landing' },
    ],
    chartKey: 'flight_hours', chartUnit: 'hrs',
    objectives: [
      { key: 'license_type', label: 'License target', unit: '', placeholder: 'PPL / CPL', type: 'text' },
      { key: 'hours_required', label: 'Hours required', unit: 'h', placeholder: '40', type: 'number' },
      { key: 'checkride_date', label: 'Checkride / exam date', unit: '', placeholder: '2027-01-01', type: 'text' },
    ],
  },
  {
    type: 'travel_continents', label: 'Travel Every Continent', emoji: '🌍', color: '#34D399',
    domains: ['Personal Goals'],
    fields: [
      { key: 'countries_visited', label: 'Countries visited', type: 'number', min: 0 },
      { key: 'country', label: 'Country / place', type: 'text', placeholder: 'Japan' },
      { key: 'savings_today', label: 'Travel fund saved', type: 'number', unit: '€', min: 0 },
    ],
    chartKey: 'countries_visited', chartUnit: 'countries',
    objectives: [
      { key: 'continents_remaining', label: 'Continents remaining', unit: '', placeholder: 'Asia, Africa, South America', type: 'text' },
      { key: 'travel_fund_target', label: 'Travel fund target', unit: '€', placeholder: '20000', type: 'number' },
    ],
  },
  {
    type: 'dream_home', label: 'Build My Dream Home', emoji: '🏡', color: '#F59E0B',
    domains: ['Personal Goals'],
    fields: [
      { key: 'savings_today', label: 'Saved today', type: 'number', unit: '€', min: 0 },
      { key: 'tasks_done', label: 'Planning tasks done', type: 'number', min: 0 },
      { key: 'task', label: 'Task', type: 'text', placeholder: 'Architect meeting' },
    ],
    chartKey: 'savings_today', chartUnit: '€',
    objectives: [
      { key: 'total_savings_target', label: 'Total savings target', unit: '€', placeholder: '200000', type: 'number' },
      { key: 'target_completion', label: 'Target completion date', unit: '', placeholder: '2030-01-01', type: 'text' },
    ],
  },
  {
    type: 'nonprofit', label: 'Start a Non-Profit', emoji: '💛', color: '#10B981',
    domains: ['Personal Goals'],
    fields: [
      { key: 'volunteer_hours', label: 'Hours worked', type: 'number', unit: 'h', step: 0.5, min: 0 },
      { key: 'donations_raised', label: 'Donations raised', type: 'number', unit: '€', min: 0 },
      { key: 'task', label: 'Task completed', type: 'text', placeholder: 'Filed registration' },
    ],
    chartKey: 'volunteer_hours', chartUnit: 'hrs',
    objectives: [
      { key: 'cause', label: 'Cause', unit: '', placeholder: 'Youth education', type: 'text' },
      { key: 'launch_date', label: 'Launch date', unit: '', placeholder: '2026-09-01', type: 'text' },
      { key: 'first_year_budget', label: 'First year budget target', unit: '€', placeholder: '50000', type: 'number' },
    ],
  },
  {
    type: 'speak_conference', label: 'Speak at a Conference', emoji: '🎤', color: '#6366F1',
    domains: ['Personal Goals'],
    fields: [
      { key: 'talks_given', label: 'Talks given', type: 'number', min: 0 },
      { key: 'proposals_submitted', label: 'Proposals submitted', type: 'number', min: 0 },
      { key: 'prep_hours', label: 'Prep hours', type: 'number', unit: 'h', step: 0.5, min: 0 },
    ],
    chartKey: 'talks_given', chartUnit: 'talks',
    objectives: [
      { key: 'target_conference', label: 'Target conference', unit: '', placeholder: 'TEDx / PyCon', type: 'text' },
      { key: 'talks_per_year', label: 'Talks / year goal', unit: '', placeholder: '5', type: 'number' },
      { key: 'topic', label: 'Talk topic', unit: '', placeholder: 'AI in healthcare', type: 'text' },
    ],
  },
  {
    type: 'bucket_list', label: 'Complete a Bucket List', emoji: '🗒️', color: '#A78BFA',
    domains: ['Personal Goals'],
    fields: [
      { key: 'items_completed', label: 'Items completed', type: 'number', min: 0 },
      { key: 'item', label: 'Item completed', type: 'text', placeholder: 'Saw Northern Lights' },
    ],
    chartKey: 'items_completed', chartUnit: 'items',
    objectives: [
      { key: 'total_items', label: 'Total bucket list items', unit: '', placeholder: '100', type: 'number' },
      { key: 'items_per_year', label: 'Items to complete / year', unit: '', placeholder: '10', type: 'number' },
    ],
  },
  {
    type: 'live_abroad', label: 'Live Abroad', emoji: '🌏', color: '#EC4899',
    domains: ['Personal Goals'],
    fields: [
      { key: 'savings_today', label: 'Saved today', type: 'number', unit: '€', min: 0 },
      { key: 'tasks_done', label: 'Prep tasks done', type: 'number', min: 0 },
      { key: 'task', label: 'Task', type: 'text', placeholder: 'Research visa requirements' },
    ],
    chartKey: 'savings_today', chartUnit: '€',
    objectives: [
      { key: 'target_country', label: 'Target country / city', unit: '', placeholder: 'Lisbon, Portugal', type: 'text' },
      { key: 'move_date', label: 'Target move date', unit: '', placeholder: '2027-01-01', type: 'text' },
      { key: 'savings_target', label: 'Savings target', unit: '€', placeholder: '15000', type: 'number' },
    ],
  },
  {
    type: 'become_parent', label: 'Become a Parent', emoji: '👶', color: '#F472B6',
    domains: ['Personal Goals'],
    fields: [
      { key: 'prep_tasks', label: 'Preparation tasks done', type: 'number', min: 0 },
      { key: 'books_read', label: 'Parenting books read', type: 'number', min: 0 },
      { key: 'task', label: 'Task', type: 'text', placeholder: 'Doctor visit / nursery setup' },
    ],
    chartKey: 'prep_tasks', chartUnit: 'tasks',
    objectives: [
      { key: 'timeline', label: 'Timeline', unit: '', placeholder: 'Within 2 years', type: 'text' },
      { key: 'preparation_areas', label: 'Prep areas', unit: '', placeholder: 'Finances, home, health', type: 'text' },
    ],
  },
];

// ── Lookup: category string → widget config ────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

// Build a lookup map: category label → config (tries exact match first, then fuzzy)
const CATEGORY_TO_WIDGET: Record<string, WidgetConfig> = {};
for (const w of ALL_WIDGETS) {
  CATEGORY_TO_WIDGET[w.label.toLowerCase()] = w;
  CATEGORY_TO_WIDGET[w.type] = w;
}

function findWidget(node: GoalNode): WidgetConfig | null {
  const cat = (node.category ?? node.name ?? '').toLowerCase();
  // Exact match
  if (CATEGORY_TO_WIDGET[cat]) return CATEGORY_TO_WIDGET[cat];
  // Partial match on widget label
  const match = ALL_WIDGETS.find(w =>
    w.label.toLowerCase().includes(cat) || cat.includes(w.label.toLowerCase())
  );
  if (match) return match;
  // Domain fallback: pick first widget for this domain
  const domain = node.domain ?? '';
  return ALL_WIDGETS.find(w => w.domains.some(d => d === domain)) ?? null;
}

// ── Mini 7-day bar chart ───────────────────────────────────────────────────────

function MiniChart({ entries, chartKey, color, unit }: {
  entries: TrackerEntry[]; chartKey: string; color: string; unit: string;
}) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const label = i === 6 ? 'Today' : d.toLocaleDateString('en', { weekday: 'short' });
    const total = entries.filter(e => e.logged_at.slice(0, 10) === key)
      .reduce((s, e) => s + (Number(e.data[chartKey]) || 0), 0);
    return { label, total };
  });
  const max = Math.max(...days.map(d => d.total), 1);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 40, my: 1.5 }}>
      {days.map((day, i) => (
        <Tooltip key={i} title={`${day.label}: ${day.total} ${unit}`} placement="top">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
            <Box sx={{
              width: '100%', borderRadius: '3px 3px 0 0',
              height: `${Math.max((day.total / max) * 30, day.total > 0 ? 4 : 2)}px`,
              bgcolor: day.total > 0 ? color : 'rgba(255,255,255,0.05)',
              opacity: i === 6 ? 1 : 0.6,
            }} />
            <Typography sx={{ fontSize: '0.52rem', color: 'text.disabled', lineHeight: 1 }}>
              {day.label.slice(0, 3)}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

// ── Objective display / edit inline ───────────────────────────────────────────

function ObjectiveRow({ config, currentGoal, onSave }: {
  config: WidgetConfig;
  currentGoal: Record<string, any>;
  onSave: (goal: Record<string, any>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const hasObjective = config.objectives.some(o => currentGoal[o.key]);

  const startEdit = () => {
    const init: Record<string, string> = {};
    config.objectives.forEach(o => { init[o.key] = currentGoal[o.key] ?? ''; });
    setDraft(init);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const merged: Record<string, any> = { ...currentGoal };
    config.objectives.forEach(o => {
      if (draft[o.key] !== '') {
        merged[o.key] = o.type === 'number' ? Number(draft[o.key]) : draft[o.key];
      }
    });
    await onSave(merged);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <Box sx={{ mb: 1.5, p: 1.5, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block' }}>
          Set your objectives:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          {config.objectives.map(o => (
            <TextField
              key={o.key}
              size="small"
              label={o.label + (o.unit ? ` (${o.unit})` : '')}
              type={o.type}
              placeholder={o.placeholder}
              value={draft[o.key] ?? ''}
              onChange={e => setDraft(prev => ({ ...prev, [o.key]: e.target.value }))}
              sx={{ flex: '1 1 120px', '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.78rem' }, '& .MuiInputLabel-root': { fontSize: '0.74rem' } }}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
          <IconButton size="small" onClick={() => setEditing(false)} sx={{ color: 'text.disabled' }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" onClick={handleSave} disabled={saving} sx={{ color: config.color }}>
            {saving ? <CircularProgress size={12} color="inherit" /> : <CheckIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
      <FlagIcon sx={{ fontSize: 12, color: config.color, opacity: 0.7 }} />
      {hasObjective ? (
        config.objectives
          .filter(o => currentGoal[o.key])
          .map(o => (
            <Chip
              key={o.key}
              label={`${o.label}: ${currentGoal[o.key]}${o.unit ? ' ' + o.unit : ''}`}
              size="small"
              sx={{ height: 16, fontSize: '0.58rem', bgcolor: `${config.color}15`, color: config.color, border: `1px solid ${config.color}25` }}
            />
          ))
      ) : (
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', fontStyle: 'italic' }}>
          No objectives set
        </Typography>
      )}
      <Tooltip title="Edit objectives">
        <IconButton size="small" onClick={startEdit} sx={{ color: 'text.disabled', '&:hover': { color: config.color }, ml: 'auto', width: 20, height: 20 }}>
          <EditIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── Single tracker card ────────────────────────────────────────────────────────

function TrackerCard({ config, tracker, onLogged, onObjectiveSaved }: {
  config: WidgetConfig;
  tracker?: Tracker;
  onLogged: () => void;
  onObjectiveSaved: (type: string, goal: Record<string, any>) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEntries = (tracker?.entries ?? []).filter(e => e.logged_at.slice(0, 10) === todayKey);
  const loggedToday = todayEntries.length > 0;
  const todayTotal = todayEntries.reduce((s, e) => s + (Number(e.data[config.chartKey]) || 0), 0);
  const currentGoal = tracker?.goal ?? {};

  const handleLog = async () => {
    const data: Record<string, any> = {};
    for (const f of config.fields) {
      const val = form[f.key];
      if (val !== undefined && val !== '') data[f.key] = f.type === 'number' ? Number(val) : val;
    }
    if (Object.keys(data).length === 0) { toast.error('Enter at least one value.'); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_URL}/trackers/log`, { type: config.type, data }, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      toast.success(`${config.emoji} ${config.label} logged! +5⚡`);
      setForm({});
      setLogOpen(false);
      onLogged();
    } catch { toast.error('Failed to log. Try again.'); }
    finally { setSaving(false); }
  };

  return (
    <GlassCard sx={{
      p: 2.5, borderRadius: '16px',
      border: `1px solid ${config.color}20`,
      background: `linear-gradient(150deg, ${config.color}07 0%, rgba(13,14,26,0.7) 100%)`,
      '&:hover': { borderColor: `${config.color}38` },
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '1.5rem', lineHeight: 1 }}>{config.emoji}</Typography>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 800, color: config.color, lineHeight: 1.2 }}>
              {config.label}
            </Typography>
            {loggedToday && todayTotal > 0 && (
              <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700, fontSize: '0.62rem' }}>
                ✓ {todayTotal} {config.chartUnit} today
              </Typography>
            )}
            {loggedToday && todayTotal === 0 && (
              <Typography variant="caption" sx={{ color: '#10B981', fontSize: '0.62rem' }}>✓ Logged today</Typography>
            )}
          </Box>
        </Box>
        <Tooltip title={logOpen ? 'Close' : 'Log now'}>
          <IconButton
            size="small"
            onClick={() => setLogOpen(v => !v)}
            sx={{ bgcolor: logOpen ? `${config.color}22` : 'rgba(255,255,255,0.04)', color: config.color, '&:hover': { bgcolor: `${config.color}33` }, width: 28, height: 28 }}
          >
            {logOpen ? <CloseIcon sx={{ fontSize: 14 }} /> : <AddIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Objectives */}
      <ObjectiveRow
        config={config}
        currentGoal={currentGoal}
        onSave={(goal) => onObjectiveSaved(config.type, goal)}
      />

      {/* 7-day chart */}
      {(tracker?.entries ?? []).length > 0 && (
        <MiniChart entries={tracker!.entries} chartKey={config.chartKey} color={config.color} unit={config.chartUnit} />
      )}

      {/* Log form */}
      <Collapse in={logOpen}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 1.5, mt: 0.5 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          {config.fields.map(f => (
            <TextField
              key={f.key}
              size="small"
              label={f.unit ? `${f.label} (${f.unit})` : f.label}
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.key] ?? ''}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              inputProps={{ min: f.min, max: f.max, step: f.step ?? (f.type === 'number' ? 1 : undefined) }}
              sx={{
                flex: f.type === 'text' ? '1 1 130px' : '0 1 80px',
                '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.8rem' },
                '& .MuiInputLabel-root': { fontSize: '0.76rem' },
              }}
            />
          ))}
        </Box>
        <Button
          variant="contained" size="small" onClick={handleLog} disabled={saving}
          endIcon={saving ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: '13px !important' }} />}
          sx={{
            borderRadius: '8px', fontWeight: 800, fontSize: '0.73rem',
            background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}bb 100%)`,
            color: '#0A0B14', float: 'right', px: 2,
          }}
        >
          Log +5⚡
        </Button>
        <Box sx={{ clear: 'both' }} />
      </Collapse>
    </GlassCard>
  );
}

// ── Challenges + Commitments ───────────────────────────────────────────────────

function SideCard({ title, color, icon, children, onNavigate }: {
  title: string; color: string; icon: React.ReactNode;
  children: React.ReactNode; onNavigate: () => void;
}) {
  return (
    <GlassCard sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${color}18`, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon}
          <Typography variant="body2" sx={{ fontWeight: 800, color }}>{title}</Typography>
        </Box>
        <IconButton size="small" onClick={onNavigate} sx={{ color: 'text.disabled', '&:hover': { color }, width: 22, height: 22 }}>
          <OpenInNewIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Box>
      {children}
    </GlassCard>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const GoalWidgets: React.FC<Props> = ({ userId, allNodes, activeBets = [], activeChallenges = [] }) => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrackers = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await axios.get(`${API_URL}/trackers/my`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      setTrackers(Array.isArray(res.data) ? res.data : []);
    } catch { setTrackers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrackers(); }, [fetchTrackers]);

  const handleObjectiveSaved = async (type: string, goal: Record<string, any>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.patch(`${API_URL}/trackers/${type}/objective`, { goal }, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      setTrackers(prev => prev.map(t => t.type === type ? { ...t, goal } : t));
      toast.success('Objective saved!');
    } catch { toast.error('Failed to save objective.'); }
  };

  // Deduplicate: one widget per unique config.type from matched nodes
  const seen = new Set<string>();
  const widgetConfigs: WidgetConfig[] = [];
  for (const node of allNodes) {
    const w = findWidget(node);
    if (w && !seen.has(w.type)) {
      seen.add(w.type);
      widgetConfigs.push(w);
    }
  }

  const trackerMap = Object.fromEntries(trackers.map(t => [t.type, t]));
  const nodeMap = Object.fromEntries(allNodes.map(n => [n.id, n]));

  if (widgetConfigs.length === 0 && activeBets.length === 0 && activeChallenges.length === 0) return null;

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TrendingUpIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="body1" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Today's Tracking
        </Typography>
        <Chip
          label={`${widgetConfigs.length} tracker${widgetConfigs.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
      ) : (
        <Stack spacing={3}>
          {/* Tracker widgets */}
          {widgetConfigs.length > 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
              {widgetConfigs.map(config => (
                <TrackerCard
                  key={config.type}
                  config={config}
                  tracker={trackerMap[config.type]}
                  onLogged={fetchTrackers}
                  onObjectiveSaved={handleObjectiveSaved}
                />
              ))}
            </Box>
          )}

          {/* Challenges + Commitments */}
          {(activeChallenges.length > 0 || activeBets.length > 0) && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
              {activeChallenges.length > 0 && (
                <SideCard title="Active Challenges" color="#F59E0B" icon={<EmojiEventsIcon sx={{ fontSize: 15, color: '#F59E0B' }} />} onNavigate={() => { window.location.href = '/challenges'; }}>
                  <Stack spacing={1}>
                    {activeChallenges.slice(0, 3).map(c => (
                      <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmojiEventsIcon sx={{ fontSize: 15, color: '#F59E0B', flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }} noWrap>{c.title}</Typography>
                          {c.end_date && <Typography variant="caption" color="text.disabled">Ends {new Date(c.end_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</Typography>}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </SideCard>
              )}
              {activeBets.length > 0 && (
                <SideCard title="Commitments" color="#8B5CF6" icon={<VerifiedIcon sx={{ fontSize: 15, color: '#8B5CF6' }} />} onNavigate={() => { window.location.href = '/commitments'; }}>
                  <Stack spacing={1}>
                    {activeBets.slice(0, 3).map(bet => {
                      const node = nodeMap[bet.goal_node_id];
                      const daysLeft = Math.ceil((new Date(bet.deadline).getTime() - Date.now()) / 86400000);
                      const progress = Math.round((node?.progress ?? 0) * 100);
                      return (
                        <Box key={bet.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }} noWrap>{node?.name ?? 'Goal'}</Typography>
                            <Typography variant="caption" sx={{ color: '#8B5CF6', fontWeight: 700, fontSize: '0.62rem', flexShrink: 0, ml: 1 }}>{progress}%</Typography>
                          </Box>
                          <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.07)', overflow: 'hidden', mb: 0.25 }}>
                            <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: '#8B5CF6', borderRadius: 2 }} />
                          </Box>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
                            ⚡ {bet.stake_points} PP · {daysLeft > 0 ? `${daysLeft}d left` : 'Deadline passed'}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                </SideCard>
              )}
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
};

export default GoalWidgets;
