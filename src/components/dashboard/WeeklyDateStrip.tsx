import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DayEvaluation } from '../../types/database';
import {
  addDaysToDateString,
  formatShortWeekdayAndDay,
  formatWeekRangeLabel,
  getWeekDateStrings,
} from '../../utils/dateUtils';
import { NeumorphicCard } from '../ui/NeumorphicCard';

interface WeeklyDateStripProps {
  selectedDate: string;
  todayStr: string;
  dayMap: Record<string, DayEvaluation>;
  onSelectDate: (dateStr: string) => void;
}

export function WeeklyDateStrip({
  selectedDate,
  todayStr,
  dayMap,
  onSelectDate,
}: WeeklyDateStripProps) {
  const weekDates = getWeekDateStrings(selectedDate);
  const weekRangeLabel = formatWeekRangeLabel(weekDates);

  return (
    <NeumorphicCard className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          {weekRangeLabel}
        </span>

        <div className="flex items-center gap-2">
          {selectedDate !== todayStr && (
            <button
              type="button"
              onClick={() => onSelectDate(todayStr)}
              className="neu-button min-h-[36px] rounded-xl px-3 text-xs font-semibold text-[#12C5DF]"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelectDate(addDaysToDateString(selectedDate, -7))}
            aria-label="Previous week"
            className="neu-button flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onSelectDate(addDaysToDateString(selectedDate, 7))}
            aria-label="Next week"
            className="neu-button flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekDates.map((dateStr) => {
          const { weekdayShort, dayNumber } = formatShortWeekdayAndDay(dateStr);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const ev = dayMap[dateStr];

          let indicatorColor = 'bg-transparent';
          if (!isFuture && ev && ev.scheduledCount > 0) {
            indicatorColor = ev.isSuccessful ? 'bg-[#12C5DF]' : 'bg-[#F43F5E]';
          }

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              aria-pressed={isSelected}
              aria-label={`Select ${dateStr}`}
              className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-all ${
                isSelected
                  ? 'bg-[#12C5DF] text-[#0D1117] shadow-[0_6px_18px_rgba(18,197,223,0.35)]'
                  : isToday
                    ? 'neu-inset text-[#12C5DF]'
                    : 'neu-card-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className={`text-[11px] font-medium ${
                  isSelected ? 'text-[#0D1117]/80' : 'text-[var(--text-muted)]'
                }`}
              >
                {weekdayShort}
              </span>
              <span className="font-display text-sm font-bold tabular-nums">
                {dayNumber}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isSelected ? 'bg-[#0D1117]/70' : indicatorColor
                }`}
              />
            </button>
          );
        })}
      </div>
    </NeumorphicCard>
  );
}
