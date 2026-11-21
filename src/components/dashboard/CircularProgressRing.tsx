import { motion } from 'motion/react';

interface CircularProgressRingProps {
  percentage: number;
  completedCount: number;
  scheduledCount: number;
  isSuccessfulDay: boolean;
  size?: number;
}

export function CircularProgressRing({
  percentage,
  completedCount,
  scheduledCount,
  isSuccessfulDay,
  size = 228,
}: CircularProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const strokeWidth = 16;
  const center = size / 2;
  const radius = center - strokeWidth - 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Outer raised neumorphic ring container */}
      <div
        className="neu-card relative flex items-center justify-center rounded-full p-4"
        style={{ width: size + 24, height: size + 24 }}
      >
        {/* Inner inset dial */}
        <div
          className="neu-inset-deep relative flex items-center justify-center rounded-full"
          style={{ width: size - 48, height: size - 48 }}
        >
          <div className="flex flex-col items-center text-center">
            <motion.span
              key={clamped}
              initial={{ scale: 0.92, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="font-display text-4xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums"
            >
              {clamped}%
            </motion.span>
            <span className="mt-1 text-xs font-medium text-[var(--text-secondary)] tabular-nums">
              {scheduledCount === 0
                ? 'No goals scheduled'
                : `${completedCount}/${scheduledCount} goals done`}
            </span>
            {scheduledCount > 0 && (
              <span
                className={`mt-1.5 text-[11px] font-semibold ${
                  isSuccessfulDay ? 'text-[#12C5DF]' : 'text-[var(--text-muted)]'
                }`}
              >
                {isSuccessfulDay ? 'Goal Achieved' : 'In Progress'}
              </span>
            )}
          </div>
        </div>

        {/* SVG Animated Progress Arc */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="pointer-events-none absolute inset-0 m-auto -rotate-90"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="cadenceRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#12C5DF" />
              <stop offset="65%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#A64BEA" />
            </linearGradient>
          </defs>

          {/* Subtle recessed track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--bg-inset)"
            strokeWidth={strokeWidth}
            opacity={0.75}
          />

          {/* Progress stroke */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#cadenceRingGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            style={{
              filter:
                clamped > 0
                  ? 'drop-shadow(0 0 10px rgba(18, 197, 223, 0.45))'
                  : 'none',
            }}
          />
        </svg>
      </div>
    </div>
  );
}
