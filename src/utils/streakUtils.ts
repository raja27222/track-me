import { MILESTONE_DAYS } from '../lib/constants';
import type {
  DailySummary,
  DayEvaluation,
  Habit,
  HabitCompletion,
  StreakInterval,
  StreakMetrics,
  UserSettings,
} from '../types/database';
import {
  addDaysToDateString,
  getAllDatesBetween,
  getDayOfWeekFromDateString,
} from './dateUtils';

export function isHabitScheduledOnDate(
  habit: Habit,
  dateStr: string,
  includeNonActive = false
): boolean {
  if (!includeNonActive && habit.status !== 'active') return false;
  if (dateStr < habit.start_date) return false;
  if (habit.end_date && dateStr > habit.end_date) return false;
  if (habit.frequency === 'daily') return true;
  const dow = getDayOfWeekFromDateString(dateStr);
  return Array.isArray(habit.scheduled_days) && habit.scheduled_days.includes(dow);
}

export function evaluateIsSuccessfulDay(
  scheduledCount: number,
  completionPercentage: number,
  settings?: Pick<UserSettings, 'streak_rule' | 'custom_completion_percentage'> | null
): boolean {
  if (scheduledCount <= 0) return false;
  if (settings?.streak_rule === 'custom_percentage') {
    const threshold = settings.custom_completion_percentage ?? 80;
    return completionPercentage >= threshold;
  }
  return completionPercentage >= 100;
}

export function computeLiveDayStats(
  habits: Habit[],
  completions: HabitCompletion[],
  dateStr: string,
  settings?: Pick<UserSettings, 'streak_rule' | 'custom_completion_percentage'> | null
): {
  scheduledHabits: Habit[];
  scheduledCount: number;
  completedCount: number;
  completionPercentage: number;
  isSuccessful: boolean;
} {
  const scheduledHabits = habits.filter((h) => isHabitScheduledOnDate(h, dateStr));
  const completedHabitIds = new Set(
    completions
      .filter((c) => c.completion_date === dateStr && c.completed)
      .map((c) => c.habit_id)
  );

  const scheduledCount = scheduledHabits.length;
  const completedCount = scheduledHabits.filter((h) => completedHabitIds.has(h.id)).length;
  const completionPercentage =
    scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;
  const isSuccessful = evaluateIsSuccessfulDay(scheduledCount, completionPercentage, settings);

  return {
    scheduledHabits,
    scheduledCount,
    completedCount,
    completionPercentage,
    isSuccessful,
  };
}

export function calculateStreakMetrics(
  habits: Habit[],
  completions: HabitCompletion[],
  summaries: DailySummary[],
  settings: Pick<UserSettings, 'streak_rule' | 'custom_completion_percentage'> | null,
  todayStr: string
): StreakMetrics {
  const summaryMap = new Map<string, DailySummary>();
  for (const s of summaries) {
    summaryMap.set(s.summary_date, s);
  }

  const completionsByDate = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!c.completed) continue;
    let set = completionsByDate.get(c.completion_date);
    if (!set) {
      set = new Set<string>();
      completionsByDate.set(c.completion_date, set);
    }
    set.add(c.habit_id);
  }

  // Determine earliest relevant date (never evaluate future dates)
  const candidateStartDates: string[] = [];
  for (const h of habits) {
    if (h.start_date <= todayStr) candidateStartDates.push(h.start_date);
  }
  for (const s of summaries) {
    if (s.summary_date <= todayStr) candidateStartDates.push(s.summary_date);
  }

  if (candidateStartDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalSuccessfulDays: 0,
      reachedMilestones: [],
      nextMilestone: MILESTONE_DAYS[0],
      streakHistory: [],
      dayMap: {},
    };
  }

  candidateStartDates.sort();
  const earliestDate = candidateStartDates[0];
  const timeline = getAllDatesBetween(earliestDate, todayStr);

  const dayMap: Record<string, DayEvaluation> = {};

  for (const dateStr of timeline) {
    const isToday = dateStr === todayStr;
    const summary = summaryMap.get(dateStr);

    let scheduledCount = 0;
    let completedCount = 0;
    let completionPercentage = 0;

    if (!isToday && summary) {
      // Preserve historical snapshot from daily_summaries
      scheduledCount = summary.scheduled_count;
      completedCount = summary.completed_count;
      completionPercentage = Number(summary.completion_percentage);
    } else {
      // Live calculation for today or past dates without a stored snapshot
      const scheduledHabits = habits.filter((h) => isHabitScheduledOnDate(h, dateStr));
      const completedSet = completionsByDate.get(dateStr) || new Set<string>();
      scheduledCount = scheduledHabits.length;
      completedCount = scheduledHabits.filter((h) => completedSet.has(h.id)).length;
      completionPercentage =
        scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;
    }

    const isSuccessful = evaluateIsSuccessfulDay(scheduledCount, completionPercentage, settings);
    const status: DayEvaluation['status'] =
      scheduledCount <= 0 ? 'unscheduled' : isSuccessful ? 'success' : 'missed';

    dayMap[dateStr] = {
      date: dateStr,
      scheduledCount,
      completedCount,
      completionPercentage,
      isSuccessful,
      status,
    };
  }

  // Compute longest streak, total successful days, and streak intervals chronologically
  let totalSuccessfulDays = 0;
  let longestStreak = 0;
  let runningStreak = 0;
  let runningStart: string | null = null;
  let runningEnd: string | null = null;
  const streakHistory: StreakInterval[] = [];

  for (const dateStr of timeline) {
    const ev = dayMap[dateStr];
    if (ev.scheduledCount === 0) {
      // Unscheduled day (e.g. rest day for weekday-specific habits): neither adds nor breaks
      continue;
    }

    if (ev.isSuccessful) {
      totalSuccessfulDays += 1;
      runningStreak += 1;
      if (!runningStart) runningStart = dateStr;
      runningEnd = dateStr;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      // If today is still in progress and incomplete, don't close the previous streak in history until today ends
      if (dateStr !== todayStr && runningStreak > 0 && runningStart && runningEnd) {
        streakHistory.push({
          startDate: runningStart,
          endDate: runningEnd,
          length: runningStreak,
        });
      }
      if (dateStr !== todayStr) {
        runningStreak = 0;
        runningStart = null;
        runningEnd = null;
      }
    }
  }

  if (runningStreak > 0 && runningStart && runningEnd) {
    streakHistory.push({
      startDate: runningStart,
      endDate: runningEnd,
      length: runningStreak,
    });
  }

  // Compute current streak walking backwards from todayStr
  let currentStreak = 0;
  const todayEval = dayMap[todayStr];
  let cursor = todayStr;

  // If today has scheduled habits and isn't completed yet, start checking from yesterday
  if (todayEval && todayEval.scheduledCount > 0 && !todayEval.isSuccessful) {
    cursor = addDaysToDateString(todayStr, -1);
  }

  while (cursor >= earliestDate) {
    const ev = dayMap[cursor];
    if (!ev) break;
    if (ev.scheduledCount === 0) {
      cursor = addDaysToDateString(cursor, -1);
      continue;
    }
    if (ev.isSuccessful) {
      currentStreak += 1;
      cursor = addDaysToDateString(cursor, -1);
    } else {
      break;
    }
  }

  const reachedMilestones = MILESTONE_DAYS.filter((m) => longestStreak >= m);
  const nextMilestone = MILESTONE_DAYS.find((m) => currentStreak < m) ?? null;

  return {
    currentStreak,
    longestStreak,
    totalSuccessfulDays,
    reachedMilestones,
    nextMilestone,
    streakHistory: streakHistory.sort((a, b) => b.endDate.localeCompare(a.endDate)),
    dayMap,
  };
}
