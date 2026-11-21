import type { DayEvaluation } from '../../types/database';
import { getMonthGridOffsetMondayFirst } from '../../utils/dateUtils';
import { NeumorphicCard } from '../ui/NeumorphicCard';

interface MonthlyHeatmapProps {
  year: number;
  month: number;
  days: DayEvaluation[];
  todayStr: string;
  onSelectDay?: (day: DayEvaluation) => void;
}

const HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthlyHeatmap({
  year,
  month,
  days,
  todayStr,
  onSelectDay,
}: MonthlyHeatmapProps) {
  const leadingEmpty = getMonthGridOffsetMondayFirst(year, month);

  return (
    <NeumorphicCard className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Daily Activity Heatmap
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Completion intensity across every day of the month
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#F43F5E]/70" />
            Missed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#A64BEA]/80" />
            Partial
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#12C5DF]" />
            Success
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center">
        {HEADERS.map((h) => (
          <span key={h} className="pb-1 text-[11px] font-medium text-[var(--text-muted)]">
            {h}
          </span>
        ))}

        {Array.from({ length: leadingEmpty }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-9 sm:h-10" />
        ))}

        {days.map((day) => {
          const dayNum = Number(day.date.split('-')[2]);
          const isToday = day.date === todayStr;

          let tileClass = 'neu-inset text-[var(--text-muted)]';
          if (day.status === 'future') {
            tileClass = 'bg-[var(--bg-inset)]/40 text-[var(--text-muted)]/40';
          } else if (day.status === 'success') {
            tileClass =
              'bg-[#12C5DF] text-[#0D1117] font-bold shadow-[0_0_12px_rgba(18,197,223,0.3)]';
          } else if (day.status === 'missed') {
            tileClass =
              day.completionPercentage > 0
                ? 'bg-[#A64BEA]/75 text-white font-semibold'
                : 'bg-[#F43F5E]/25 text-[#F43F5E] border border-[#F43F5E]/40';
          }

          return (
            <button
              key={day.date}
              type="button"
              disabled={day.status === 'future'}
              onClick={() => onSelectDay?.(day)}
              title={`${day.date}: ${day.completionPercentage}% (${day.completedCount}/${day.scheduledCount})`}
              className={`flex h-9 items-center justify-center rounded-xl text-xs tabular-nums transition-transform hover:scale-105 disabled:pointer-events-none sm:h-10 ${tileClass} ${
                isToday
                  ? 'ring-2 ring-[var(--text-primary)] ring-offset-1 ring-offset-[var(--bg-canvas)]'
                  : ''
              }`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </NeumorphicCard>
  );
}
