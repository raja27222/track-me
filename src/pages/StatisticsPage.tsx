import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { MonthlyHeatmap } from '../components/statistics/MonthlyHeatmap';
import { WeeklyActivityChart } from '../components/statistics/WeeklyActivityChart';
import { HabitIcon } from '../components/ui/HabitIcon';
import { StatsSkeleton } from '../components/ui/LoadingSkeleton';
import { NeumorphicCard } from '../components/ui/NeumorphicCard';
import { useAuth } from '../contexts/AuthContext';
import { MILESTONE_DAYS } from '../lib/constants';
import { analyticsService } from '../services/analyticsService';
import type { Habit, HabitCompletion, StreakMetrics } from '../types/database';
import {
  addDaysToDateString,
  formatReadableDate,
  getWeekDateStrings,
} from '../utils/dateUtils';

interface StatisticsPageProps {
  habits: Habit[];
  completions: HabitCompletion[];
  streakMetrics: StreakMetrics;
  loading: boolean;
  onSelectCalendarDate?: (dateStr: string) => void;
}

export function StatisticsPage({
  habits,
  completions,
  streakMetrics,
  loading,
  onSelectCalendarDate,
}: StatisticsPageProps) {
  const { todayStr } = useAuth();
  const [selectedWeekDate, setSelectedWeekDate] = useState(todayStr);

  const [todayYear, todayMonth] = todayStr.split('-').map(Number);
  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState((todayMonth || 1) - 1); // 0-11

  const weekDates = useMemo(
    () => getWeekDateStrings(selectedWeekDate),
    [selectedWeekDate]
  );

  const weeklyData = useMemo(
    () =>
      analyticsService.buildWeeklyActivity(
        weekDates,
        streakMetrics,
        selectedWeekDate,
        todayStr
      ),
    [weekDates, streakMetrics, selectedWeekDate, todayStr]
  );

  const monthlyStats = useMemo(
    () =>
      analyticsService.buildMonthlyAnalytics({
        year: viewYear,
        month: viewMonth,
        habits,
        completions,
        streakMetrics,
        todayStr,
      }),
    [viewYear, viewMonth, habits, completions, streakMetrics, todayStr]
  );

  const overallPct = useMemo(
    () => analyticsService.getOverallCompletionPercentage(streakMetrics),
    [streakMetrics]
  );

  const totalCompletedGoals = useMemo(
    () => analyticsService.getTotalCompletedGoals(streakMetrics, completions),
    [streakMetrics, completions]
  );

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  if (loading) {
    return <StatsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium text-[var(--text-secondary)]">
          Performance &amp; Consistency
        </p>
        <h1 className="font-display mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          Statistics
        </h1>
      </header>

      {/* Top 4 KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <NeumorphicCard className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Best Streak
            </span>
            <Trophy size={18} className="text-[#A64BEA]" />
          </div>
          <p className="font-display mt-3 text-3xl font-bold text-[var(--text-primary)] tabular-nums">
            {streakMetrics.longestStreak}
            <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">
              days
            </span>
          </p>
        </NeumorphicCard>

        <NeumorphicCard className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Current Streak
            </span>
            <motion.div
              animate={
                streakMetrics.currentStreak > 0 ? { scale: [1, 1.15, 1] } : undefined
              }
              transition={{ duration: 2, repeat: Infinity }}
              className="text-[#12C5DF]"
            >
              <Flame
                size={19}
                fill={streakMetrics.currentStreak > 0 ? 'currentColor' : 'none'}
              />
            </motion.div>
          </div>
          <p className="font-display mt-3 text-3xl font-bold text-[#12C5DF] tabular-nums">
            {streakMetrics.currentStreak}
            <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">
              days
            </span>
          </p>
        </NeumorphicCard>

        <NeumorphicCard className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Overall Rate
            </span>
            <Award size={18} className="text-[#12C5DF]" />
          </div>
          <p className="font-display mt-3 text-3xl font-bold text-[var(--text-primary)] tabular-nums">
            {overallPct}%
          </p>
        </NeumorphicCard>

        <NeumorphicCard className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Total Completed
            </span>
            <CheckCircle2 size={18} className="text-[#10B981]" />
          </div>
          <p className="font-display mt-3 text-3xl font-bold text-[var(--text-primary)] tabular-nums">
            {totalCompletedGoals}
          </p>
        </NeumorphicCard>
      </div>

      {/* Weekly Chart + Monthly Overview Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <WeeklyActivityChart
            data={weeklyData}
            selectedDate={selectedWeekDate}
            onSelectDate={setSelectedWeekDate}
            onPrevWeek={() =>
              setSelectedWeekDate((d) => addDaysToDateString(d, -7))
            }
            onNextWeek={() =>
              setSelectedWeekDate((d) => addDaysToDateString(d, 7))
            }
          />
        </div>

        {/* Monthly Statistics Summary Card */}
        <div className="lg:col-span-6">
          <NeumorphicCard className="flex h-full flex-col justify-between p-5 sm:p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                    Monthly Breakdown
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {monthlyStats.monthLabel}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    aria-label="Previous month"
                    className="neu-button flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)]"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    aria-label="Next month"
                    className="neu-button flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)]"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Monthly KPIs */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="neu-inset rounded-2xl p-3.5 text-center">
                  <p className="font-display text-2xl font-bold text-[#12C5DF] tabular-nums">
                    {monthlyStats.completionPercentage}%
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Monthly Rate
                  </p>
                </div>
                <div className="neu-inset rounded-2xl p-3.5 text-center">
                  <p className="font-display text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                    {monthlyStats.totalCompletedGoals}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Completed
                  </p>
                </div>
                <div className="neu-inset rounded-2xl p-3.5 text-center">
                  <p className="font-display text-2xl font-bold text-[#F43F5E] tabular-nums">
                    {monthlyStats.missedGoals}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Missed
                  </p>
                </div>
              </div>

              {/* Previous Month Comparison */}
              <div className="neu-inset mt-4 flex items-center justify-between rounded-2xl px-4 py-3 text-xs">
                <span className="text-[var(--text-secondary)]">
                  vs. previous month ({monthlyStats.previousMonthPercentage}%)
                </span>
                <span
                  className={`flex items-center gap-1 font-mono-num font-bold ${
                    monthlyStats.deltaFromPreviousMonth >= 0
                      ? 'text-[#12C5DF]'
                      : 'text-[#F43F5E]'
                  }`}
                >
                  {monthlyStats.deltaFromPreviousMonth >= 0 ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                  {monthlyStats.deltaFromPreviousMonth >= 0 ? '+' : ''}
                  {monthlyStats.deltaFromPreviousMonth}%
                </span>
              </div>
            </div>

            {/* Best & Least Consistent Habit */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="neu-card-sm rounded-2xl p-3.5">
                <p className="text-[11px] font-medium text-[#12C5DF]">
                  Best Performing
                </p>
                {monthlyStats.bestHabit ? (
                  <div className="mt-2 flex items-center gap-2.5">
                    <div
                      className="neu-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ color: monthlyStats.bestHabit.habit.color }}
                    >
                      <HabitIcon name={monthlyStats.bestHabit.habit.icon} size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {monthlyStats.bestHabit.habit.name}
                      </p>
                      <p className="font-mono-num text-xs text-[var(--text-muted)]">
                        {monthlyStats.bestHabit.consistencyRate}% ({monthlyStats.bestHabit.completedDays}/{monthlyStats.bestHabit.scheduledDays})
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    No active data yet
                  </p>
                )}
              </div>

              <div className="neu-card-sm rounded-2xl p-3.5">
                <p className="text-[11px] font-medium text-[#F43F5E]">
                  Needs Attention
                </p>
                {monthlyStats.leastConsistentHabit ? (
                  <div className="mt-2 flex items-center gap-2.5">
                    <div
                      className="neu-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ color: monthlyStats.leastConsistentHabit.habit.color }}
                    >
                      <HabitIcon
                        name={monthlyStats.leastConsistentHabit.habit.icon}
                        size={16}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {monthlyStats.leastConsistentHabit.habit.name}
                      </p>
                      <p className="font-mono-num text-xs text-[var(--text-muted)]">
                        {monthlyStats.leastConsistentHabit.consistencyRate}% ({monthlyStats.leastConsistentHabit.completedDays}/{monthlyStats.leastConsistentHabit.scheduledDays})
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    No active data yet
                  </p>
                )}
              </div>
            </div>
          </NeumorphicCard>
        </div>
      </div>

      {/* Heatmap & Streak Milestones/History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <MonthlyHeatmap
            year={viewYear}
            month={viewMonth}
            days={monthlyStats.heatmapDays}
            todayStr={todayStr}
            onSelectDay={(d) => onSelectCalendarDate?.(d.date)}
          />
        </div>

        <div className="lg:col-span-5">
          <NeumorphicCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                  Streak Milestones
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Total successful days:{' '}
                  <strong className="font-mono-num text-[var(--text-primary)]">
                    {streakMetrics.totalSuccessfulDays}
                  </strong>
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2">
              {MILESTONE_DAYS.map((m) => {
                const unlocked = streakMetrics.longestStreak >= m;
                return (
                  <div
                    key={m}
                    className={`flex flex-col items-center justify-center rounded-2xl py-3 text-center ${
                      unlocked
                        ? 'bg-[#12C5DF]/15 text-[#12C5DF] border border-[#12C5DF]/40'
                        : 'neu-inset text-[var(--text-muted)]'
                    }`}
                  >
                    <Flame
                      size={18}
                      fill={unlocked ? 'currentColor' : 'none'}
                    />
                    <span className="font-mono-num mt-1 text-xs font-bold">
                      {m}d
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
                Recent Streak History
              </h4>
              {streakMetrics.streakHistory.length === 0 ? (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Complete all scheduled daily goals to start your first streak.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {streakMetrics.streakHistory.slice(0, 4).map((interval) => (
                    <div
                      key={`${interval.startDate}-${interval.endDate}`}
                      className="neu-inset flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs"
                    >
                      <span className="text-[var(--text-secondary)]">
                        {formatReadableDate(interval.startDate)} –{' '}
                        {formatReadableDate(interval.endDate)}
                      </span>
                      <span className="font-mono-num font-bold text-[#12C5DF]">
                        {interval.length}d
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </NeumorphicCard>
        </div>
      </div>
    </div>
  );
}
