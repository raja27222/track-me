import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  X as XIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DayHistorySheet } from '../components/calendar/DayHistorySheet';
import { NeumorphicCard } from '../components/ui/NeumorphicCard';
import { useAuth } from '../contexts/AuthContext';
import type {
  DayEvaluation,
  Habit,
  HabitCompletion,
  StreakMetrics,
} from '../types/database';
import {
  formatMonthYear,
  getMonthDateStrings,
  getMonthGridOffsetMondayFirst,
} from '../utils/dateUtils';

interface CalendarPageProps {
  habits: Habit[];
  completions: HabitCompletion[];
  streakMetrics: StreakMetrics;
  initialSelectedDate?: string;
  onToggleCompletion: (habitId: string, dateStr: string) => void;
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarPage({
  habits,
  completions,
  streakMetrics,
  initialSelectedDate,
  onToggleCompletion,
}: CalendarPageProps) {
  const { todayStr } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    initialSelectedDate || todayStr
  );

  const [initY, initM] = (initialSelectedDate || todayStr).split('-').map(Number);
  const [viewYear, setViewYear] = useState(initY);
  const [viewMonth, setViewMonth] = useState((initM || 1) - 1);

  const monthDates = useMemo(
    () => getMonthDateStrings(viewYear, viewMonth),
    [viewYear, viewMonth]
  );
  const leadingEmpty = useMemo(
    () => getMonthGridOffsetMondayFirst(viewYear, viewMonth),
    [viewYear, viewMonth]
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

  const handleJumpToday = () => {
    const [ty, tm] = todayStr.split('-').map(Number);
    setViewYear(ty);
    setViewMonth((tm || 1) - 1);
    setSelectedDate(todayStr);
  };

  const selectedEval: DayEvaluation | undefined = streakMetrics.dayMap[selectedDate];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Historical Timeline
          </p>
          <h1 className="font-display mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Calendar
          </h1>
        </div>

        <button
          type="button"
          onClick={handleJumpToday}
          className="neu-button min-h-[40px] rounded-2xl px-4 py-2 text-xs font-semibold text-[#12C5DF]"
        >
          Jump to Today
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Monthly Calendar Grid */}
        <div className="lg:col-span-7">
          <NeumorphicCard className="p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                {formatMonthYear(viewYear, viewMonth)}
              </h2>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                  className="neu-button flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                  className="neu-button flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Weekday Header */}
            <div className="mb-2 grid grid-cols-7 gap-2 text-center">
              {WEEKDAY_HEADERS.map((wd) => (
                <span
                  key={wd}
                  className="text-xs font-semibold text-[var(--text-muted)]"
                >
                  {wd}
                </span>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: leadingEmpty }).map((_, idx) => (
                <div key={`blank-${idx}`} className="h-12 sm:h-14" />
              ))}

              {monthDates.map((dateStr) => {
                const dayNum = Number(dateStr.split('-')[2]);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const isFuture = dateStr > todayStr;
                const ev = streakMetrics.dayMap[dateStr];

                let status: DayEvaluation['status'] = 'unscheduled';
                if (isFuture) {
                  status = 'future';
                } else if (ev) {
                  status = ev.status;
                }

                let cellStyle =
                  'neu-card-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]';
                if (status === 'success') {
                  cellStyle =
                    'bg-[#12C5DF]/18 border border-[#12C5DF]/45 text-[#12C5DF]';
                } else if (status === 'missed') {
                  cellStyle =
                    'bg-[#F43F5E]/15 border border-[#F43F5E]/40 text-[#F43F5E]';
                } else if (status === 'future') {
                  cellStyle = 'neu-inset opacity-50 text-[var(--text-muted)]';
                }

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    aria-pressed={isSelected}
                    aria-label={`${dateStr}, ${status}`}
                    className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl transition-all sm:h-14 ${cellStyle} ${
                      isSelected
                        ? 'ring-2 ring-[#12C5DF] ring-offset-2 ring-offset-[var(--bg-canvas)] scale-[1.03]'
                        : ''
                    } ${isToday && !isSelected ? 'ring-1 ring-[var(--text-primary)]/60' : ''}`}
                  >
                    <span className="font-display text-sm font-bold tabular-nums">
                      {dayNum}
                    </span>

                    {status === 'success' && <Check size={11} strokeWidth={3} />}
                    {status === 'missed' && <XIcon size={11} strokeWidth={2.5} />}
                    {(status === 'unscheduled' || status === 'future') && (
                      <Minus size={10} className="opacity-50" />
                    )}

                    {isToday && (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--text-primary)]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Accessible Legend (Icon + Text) */}
            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[var(--border-hairline)] pt-4 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#12C5DF]/20 text-[#12C5DF]">
                  <Check size={12} strokeWidth={3} />
                </span>
                Successful day
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#F43F5E]/20 text-[#F43F5E]">
                  <XIcon size={12} strokeWidth={2.5} />
                </span>
                Missed / incomplete
              </span>
              <span className="flex items-center gap-1.5">
                <span className="neu-inset flex h-5 w-5 items-center justify-center rounded-md text-[var(--text-muted)]">
                  <Minus size={11} />
                </span>
                No scheduled habits
              </span>
            </div>
          </NeumorphicCard>
        </div>

        {/* Selected Day Habit History Drawer */}
        <div className="lg:col-span-5">
          <DayHistorySheet
            dateStr={selectedDate}
            evaluation={selectedEval}
            habits={habits}
            completions={completions}
            todayStr={todayStr}
            onToggleCompletion={onToggleCompletion}
          />
        </div>
      </div>
    </div>
  );
}
