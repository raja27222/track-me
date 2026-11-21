import { Flame, Trophy, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface MilestoneModalProps {
  milestoneDays: number | null;
  onClose: () => void;
}

export function MilestoneModal({ milestoneDays, onClose }: MilestoneModalProps) {
  return (
    <AnimatePresence>
      {milestoneDays !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="milestone-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="neu-card relative z-10 w-full max-w-sm rounded-3xl p-7 text-center"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close celebration"
              className="neu-button absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)]"
            >
              <X size={16} />
            </button>

            <motion.div
              animate={{
                scale: [1, 1.12, 1],
                rotate: [0, -4, 4, 0],
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="neu-inset mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full text-[#12C5DF] shadow-[0_0_28px_rgba(18,197,223,0.3)]"
            >
              <Flame size={40} fill="currentColor" />
            </motion.div>

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A64BEA]">
              <Trophy size={14} />
              <span>Streak Milestone Reached</span>
            </div>

            <h2
              id="milestone-title"
              className="font-display mt-2 text-3xl font-bold text-[var(--text-primary)] tabular-nums"
            >
              {milestoneDays} Days Strong
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Remarkable consistency. You completed {milestoneDays} consecutive scheduled days without breaking cadence.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full min-h-[46px] rounded-2xl bg-[#12C5DF] px-5 py-3 text-sm font-semibold text-[#0D1117] shadow-[0_6px_20px_rgba(18,197,223,0.35)] transition-transform active:scale-[0.98]"
            >
              Keep Going
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
