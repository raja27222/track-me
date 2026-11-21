import type {
  DayEvaluation,
  Habit,
  HabitCompletion,
  HabitConsistencyStat,
  MonthlyAnalytics,
  StreakMetrics,
  WeeklyActivityPoint,
} from '../types/database';
import {
  formatMonthYear,
  formatShortWeekdayAndDay,
  getMonthDateStrings,
} from '../utils/dateUtils';
import { isHabitScheduledOnDate } from '../utils/streakUtils';

export const analyticsService = {
  getOverallCompletionPercentage(streakMetrics: StreakMetrics): number {
    const evaluated = Object.values(streakMetrics.dayMap).filter(
      (d) => d.scheduledCount > 0
    );
    if (evaluated.length === 0) return 0;
    const totalScheduled = evaluated.reduce((acc, d) => acc + d.scheduledCount, 0);
    const totalCompleted = evaluated.reduce((acc, d) => acc + d.completedCount, 0);
    if (totalScheduled === 0) return 0;
    return Math.round((totalCompleted / totalScheduled) * 100);
  },

  getTotalCompletedGoals(
    streakMetrics: StreakMetrics,
    completions: HabitCompletion[]
  ): number {
    const summarySum = Object.values(streakMetrics.dayMap).reduce(
      (acc, d) => acc + d.completedCount,
      0
    );
    const rawCompleted = completions.filter((c) => c.completed).length;
    return Math.max(summarySum, rawCompleted);
  },

  buildWeeklyActivity(
    weekDates: string[],
    streakMetrics: StreakMetrics,
    selectedDate: string,
    todayStr: string
  ): WeeklyActivityPoint[] {
    return weekDates.map((date) => {
      const { weekdayShort, dayNumber } = formatShortWeekdayAndDay(date);
      const ev = streakMetrics.dayMap[date];
      const isFuture = date > todayStr;

      return {
        date,
        dayShort: weekdayShort,
        dayLabel: `${weekdayShort} ${dayNumber}`,
        scheduledCount: isFuture ? 0 : ev?.scheduledCount ?? 0,
        completedCount: isFuture ? 0 : ev?.completedCount ?? 0,
        completionPercentage: isFuture ? 0 : Math.round(ev?.completionPercentage ?? 0),
        isSelected: date === selectedDate,
        isToday: date === todayStr,
      };
    });
  },

  buildMonthlyAnalytics(params: {
    year: number;
    month: number;
    habits: Habit[];
    completions: HabitCompletion[];
    streakMetrics: StreakMetrics;
    todayStr: string;
  }): MonthlyAnalytics {
    const { year, month, habits, completions, streakMetrics, todayStr } = params;
    const monthDates = getMonthDateStrings(year, month);
    const monthLabel = formatMonthYear(year, month);

    let totalCompletedGoals = 0;
    let totalScheduledGoals = 0;
    let successfulDaysCount = 0;

    const heatmapDays: DayEvaluation[] = monthDates.map((dateStr) => {
      if (dateStr > todayStr) {
        return {
          date: dateStr,
          scheduledCount: 0,
          completedCount: 0,
          completionPercentage: 0,
          isSuccessful: false,
          status: 'future',
        };
      }
      const ev = streakMetrics.dayMap[dateStr];
      if (!ev) {
        return {
          date: dateStr,
          scheduledCount: 0,
          completedCount: 0,
          completionPercentage: 0,
          isSuccessful: false,
          status: 'unscheduled',
        };
      }
      totalCompletedGoals += ev.completedCount;
      totalScheduledGoals += ev.scheduledCount;
      if (ev.isSuccessful) successfulDaysCount += 1;
      return ev;
    });

    const completionPercentage =
      totalScheduledGoals > 0
        ? Math.round((totalCompletedGoals / totalScheduledGoals) * 100)
        : 0;
    const missedGoals = Math.max(0, totalScheduledGoals - totalCompletedGoals);

    // Previous month comparison
    const prevMonthDate = new Date(Date.UTC(year, month - 1, 1));
    const prevDates = getMonthDateStrings(
      prevMonthDate.getUTCFullYear(),
      prevMonthDate.getUTCMonth()
    );
    let prevScheduled = 0;
    let prevCompleted = 0;
    for (const d of prevDates) {
      if (d > todayStr) continue;
      const ev = streakMetrics.dayMap[d];
      if (!ev) continue;
      prevScheduled += ev.scheduledCount;
      prevCompleted += ev.completedCount;
    }
    const previousMonthPercentage =
      prevScheduled > 0 ? Math.round((prevCompleted / prevScheduled) * 100) : 0;
    const deltaFromPreviousMonth = completionPercentage - previousMonthPercentage;

    // Best performing and least consistent habits in this month
    const completedSet = new Set(
      completions
        .filter((c) => c.completed)
        .map((c) => `${c.habit_id}::${c.completion_date}`)
    );

    const activeElapsedDates = monthDates.filter((d) => d <= todayStr);
    const habitStats: HabitConsistencyStat[] = [];

    for (const habit of habits) {
      if (habit.status === 'archived') continue;
      let scheduledDays = 0;
      let completedDays = 0;

      for (const dateStr of activeElapsedDates) {
        if (isHabitScheduledOnDate(habit, dateStr, true)) {
          scheduledDays += 1;
          if (completedSet.has(`${habit.id}::${dateStr}`)) {
            completedDays += 1;
          }
        }
      }

      if (scheduledDays > 0) {
        habitStats.push({
          habit,
          scheduledDays,
          completedDays,
          consistencyRate: Math.round((completedDays / scheduledDays) * 100),
        });
      }
    }

    habitStats.sort((a, b) => b.consistencyRate - a.consistencyRate);
    const bestHabit = habitStats[0] ?? null;
    const leastConsistentHabit =
      habitStats.length > 1 ? habitStats[habitStats.length - 1] : habitStats[0] ?? null;

    return {
      year,
      month,
      monthLabel,
      completionPercentage,
      previousMonthPercentage,
      deltaFromPreviousMonth,
      totalCompletedGoals,
      totalScheduledGoals,
      missedGoals,
      successfulDaysCount,
      bestHabit,
      leastConsistentHabit,
      heatmapDays,
    };
  },
};
