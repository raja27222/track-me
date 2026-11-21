import { AlertCircle, Check, CheckCircle2, MinusCircle, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { DayEvaluation, Habit, HabitCompletion } from '../../types/database';
import { formatReadableDate } from '../../utils/dateUtils';
import { isHabitScheduledOnDate } from '../../utils/streakUtils';
import { HabitIcon } from '../ui/HabitIcon';
import { NeumorphicCard } from '../ui/NeumorphicCard';

interface DayHistorySheetProps {
  dateStr: string;
  evaluation: DayEvaluation | undefined;
  habits: Habit[];
  completions: HabitCompletion[];
  todayStr: string;
  onToggleCompletion: (habitId: string, dateStr: string) => void;
  onClose?: () => void;
}

export function DayHistorySheet({
  dateStr,
  evaluation,
  habits,
  completions,
  todayStr,
  onToggleCompletion,
  onClose,
}: DayHistorySheetProps) {
  const isFuture = dateStr > todayStr;
  const scheduledHabits = habits.filter((h) =>
    isHabitScheduledOnDate(h, dateStr, true)
  );
  const completedIds = new Set(
    completions
      .filter((c) => c.completion_date === dateStr && c.completed)
      .map((c) => c.habit_id)
  );

  const pct = evaluation?.completionPercentage ?? 0;
  const status = isFuture ? 'future' : evaluation?.status ?? 'unscheduled';

  return (
    <motion.div
      key={dateStr}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <NeumorphicCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">
              Completion History
            </p>
            <h3 className="font-display mt-0.5 text-lg font-semibold text-[var(--text-primary)]">
              {formatReadableDate(dateStr)}
            </h3>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close day details"
              className="neu-button flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] lg:hidden"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Summary Status Banner (Icon + Text, never color-only) */}
        <div className="neu-inset mt-4 flex items-center justify-between rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            {status === 'success' && (
              <>
                <CheckCircle2 size={18} className="text-[#12C5DF]" />
                <span className="text-sm font-semibold text-[#12C5DF]">
                  Successful Day
                </span>
              </>
            )}
            {status === 'missed' && (
              <>
                <AlertCircle size={18} className="text-[#F43F5E]" />
                <span className="text-sm font-semibold text-[#F43F5E]">
                  Incomplete Day
                </span>
              </>
            )}
            {status === 'unscheduled' && (
              <>
                <MinusCircle size={18} className="text-[var(--text-muted)]" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  No Scheduled Habits
                </span>
              </>
            )}
            {status === 'future' && (
              <>
                <MinusCircle size={18} className="text-[var(--text-muted)]" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  Upcoming Date
                </span>
              </>
            )}
          </div>

          <span className="font-mono-num text-base font-bold text-[var(--text-primary)]">
            {isFuture ? '—' : `${Math.round(pct)}%`}
          </span>
        </div>

        {/* Progress Bar */}
        {!isFuture && (evaluation?.scheduledCount ?? 0) > 0 && (
          <div className="neu-inset mt-3 h-2.5 w-full overflow-hidden rounded-full p-0.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.round(pct))}%` }}
              transition={{ duration: 0.35 }}
              className="h-full rounded-full bg-gradient-to-r from-[#12C5DF] to-[#A64BEA]"
            />
          </div>
        )}

        {/* Habits List for Date */}
        <div className="mt-5 space-y-2.5">
          {scheduledHabits.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">
              No habits were scheduled for this date.
            </p>
          ) : (
            scheduledHabits.map((habit) => {
              const isDone = completedIds.has(habit.id);
              return (
                <button
                  key={habit.id}
                  type="button"
                  disabled={isFuture}
                  onClick={() => onToggleCompletion(habit.id, dateStr)}
                  className={`flex w-full min-h-[56px] items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-all disabled:opacity-50 ${
                    isDone ? 'neu-inset' : 'neu-card-sm'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="neu-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ color: isDone ? '#12C5DF' : habit.color }}
                    >
                      <HabitIcon name={habit.icon} size={17} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-semibold ${
                          isDone
                            ? 'text-[var(--text-secondary)] line-through decoration-[#12C5DF]/60'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {habit.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] tabular-nums">
                        {habit.target_value} {habit.target_unit}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      isDone
                        ? 'bg-[#12C5DF] text-[#0D1117]'
                        : 'neu-inset text-transparent'
                    }`}
                  >
                    <Check size={16} strokeWidth={3} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </NeumorphicCard>
    </motion.div>
  );
}
