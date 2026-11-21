export type HabitFrequency = 'daily' | 'custom';
export type HabitStatus = 'active' | 'paused' | 'archived';
export type StreakRule = 'all' | 'custom_percentage';
export type AppTheme = 'dark' | 'light';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  color: string;
  target_value: number;
  target_unit: string;
  frequency: HabitFrequency;
  scheduled_days: number[]; // 0 = Sun ... 6 = Sat
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  status: HabitStatus;
  created_at: string;
  updated_at: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completion_date: string; // YYYY-MM-DD
  completed: boolean;
  completed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface DailySummary {
  id: string;
  user_id: string;
  summary_date: string; // YYYY-MM-DD
  scheduled_count: number;
  completed_count: number;
  completion_percentage: number;
  is_successful_day: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  streak_rule: StreakRule;
  custom_completion_percentage: number;
  timezone: string;
  notifications_enabled: boolean;
  theme: AppTheme;
  created_at: string;
  updated_at: string;
}

export interface HabitFormInput {
  name: string;
  description: string;
  icon: string;
  category: string;
  color: string;
  target_value: number;
  target_unit: string;
  frequency: HabitFrequency;
  scheduled_days: number[];
  start_date: string;
  end_date: string | null;
  status: HabitStatus;
}

export interface DayEvaluation {
  date: string;
  scheduledCount: number;
  completedCount: number;
  completionPercentage: number;
  isSuccessful: boolean;
  status: 'success' | 'missed' | 'unscheduled' | 'future';
}

export interface StreakInterval {
  startDate: string;
  endDate: string;
  length: number;
}

export interface StreakMetrics {
  currentStreak: number;
  longestStreak: number;
  totalSuccessfulDays: number;
  reachedMilestones: number[];
  nextMilestone: number | null;
  streakHistory: StreakInterval[];
  dayMap: Record<string, DayEvaluation>;
}

export interface HabitConsistencyStat {
  habit: Habit;
  scheduledDays: number;
  completedDays: number;
  consistencyRate: number;
}

export interface WeeklyActivityPoint {
  date: string;
  dayShort: string;
  dayLabel: string;
  scheduledCount: number;
  completedCount: number;
  completionPercentage: number;
  isSelected: boolean;
  isToday: boolean;
}

export interface MonthlyAnalytics {
  year: number;
  month: number; // 0-11
  monthLabel: string;
  completionPercentage: number;
  previousMonthPercentage: number;
  deltaFromPreviousMonth: number;
  totalCompletedGoals: number;
  totalScheduledGoals: number;
  missedGoals: number;
  successfulDaysCount: number;
  bestHabit: HabitConsistencyStat | null;
  leastConsistentHabit: HabitConsistencyStat | null;
  heatmapDays: DayEvaluation[];
}
