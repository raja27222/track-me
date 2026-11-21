import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeeklyActivityPoint } from '../../types/database';
import { formatWeekRangeLabel } from '../../utils/dateUtils';
import { NeumorphicCard } from '../ui/NeumorphicCard';

interface WeeklyActivityChartProps {
  data: WeeklyActivityPoint[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

export function WeeklyActivityChart({
  data,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
}: WeeklyActivityChartProps) {
  const weekRangeLabel = formatWeekRangeLabel(data.map((d) => d.date));
  const selectedPoint = data.find((d) => d.isSelected) ?? data[0];

  return (
    <NeumorphicCard className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Weekly Activity
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {weekRangeLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevWeek}
            aria-label="Previous week"
            className="neu-button flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            aria-label="Next week"
            className="neu-button flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {selectedPoint && (
        <div className="neu-inset mb-4 flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs">
          <span className="font-medium text-[var(--text-secondary)]">
            Selected: <strong className="text-[var(--text-primary)]">{selectedPoint.dayLabel}</strong>
          </span>
          <span className="font-mono-num font-semibold text-[#12C5DF]">
            {selectedPoint.completionPercentage}% ({selectedPoint.completedCount}/{selectedPoint.scheduledCount})
          </span>
        </div>
      )}

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 6, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="dayShort"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500 }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B7280', fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as WeeklyActivityPoint;
                return (
                  <div className="neu-card rounded-2xl px-3.5 py-2.5 text-xs">
                    <p className="font-semibold text-[var(--text-primary)]">
                      {pt.dayLabel}
                    </p>
                    <p className="mt-1 font-mono-num text-[#12C5DF]">
                      {pt.completionPercentage}% completed
                    </p>
                    <p className="text-[var(--text-muted)] tabular-nums">
                      {pt.completedCount} of {pt.scheduledCount} goals
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="completionPercentage"
              radius={[10, 10, 10, 10]}
              maxBarSize={32}
              animationDuration={550}
              onClick={(_barItem, index) => {
                const pt = data[index];
                if (pt?.date) {
                  onSelectDate(pt.date);
                }
              }}
              className="cursor-pointer"
            >
              {data.map((entry) => {
                const fill = entry.isSelected
                  ? '#12C5DF'
                  : entry.completionPercentage >= 100
                    ? '#A64BEA'
                    : '#64748B';
                return <Cell key={entry.date} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </NeumorphicCard>
  );
}
