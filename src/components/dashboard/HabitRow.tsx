import { Check, Edit3, Pause, Play, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { Habit } from '../../types/database';
import { HabitIcon } from '../ui/HabitIcon';

interface HabitRowProps {
  habit: Habit;
  completed: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onPauseToggle: () => void;
  onDelete: () => void;
}

export function HabitRow({
  habit,
  completed,
  disabled = false,
  onToggle,
  onEdit,
  onPauseToggle,
  onDelete,
}: HabitRowProps) {
  const accentColor = habit.color || '#12C5DF';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={`group flex items-center justify-between gap-3 rounded-3xl p-4 transition-all ${
        completed ? 'neu-inset opacity-95' : 'neu-card'
      }`}
    >
      {/* Left: Completion Toggle + Habit Details */}
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={completed}
        aria-label={`Mark ${habit.name} as ${completed ? 'incomplete' : 'complete'}`}
        className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus-visible:outline-none"
      >
        {/* Icon container */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all ${
            completed ? 'neu-card-sm' : 'neu-inset'
          }`}
          style={{
            color: completed ? '#12C5DF' : accentColor,
          }}
        >
          <HabitIcon name={habit.icon} size={22} />
        </div>

        {/* Name + Target + Category metadata (unboxed text) */}
        <div className="min-w-0 flex-1">
          <p
            className={`truncate font-display text-base font-semibold transition-colors ${
              completed
                ? 'text-[var(--text-secondary)] line-through decoration-[#12C5DF]/60'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {habit.name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span className="tabular-nums font-medium text-[var(--text-secondary)]">
              {habit.target_value} {habit.target_unit}
            </span>
            <span aria-hidden="true">·</span>
            <span>{habit.category}</span>
            {habit.description && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden truncate sm:inline max-w-[200px]">
                  {habit.description}
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      {/* Right: Action buttons + Checkmark Toggle */}
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="flex items-center gap-1 opacity-100 sm:opacity-75 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${habit.name}`}
            title="Edit habit"
            className="neu-button flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <Edit3 size={15} />
          </button>
          <button
            type="button"
            onClick={onPauseToggle}
            aria-label={habit.status === 'paused' ? `Resume ${habit.name}` : `Pause ${habit.name}`}
            title={habit.status === 'paused' ? 'Resume habit' : 'Pause habit'}
            className="neu-button flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[#A64BEA]"
          >
            {habit.status === 'paused' ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${habit.name}`}
            title="Delete habit"
            className="neu-button flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[#F43F5E]"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Tactile Checkmark Circle */}
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={`Toggle ${habit.name}`}
          className={`ml-1 flex h-11 w-11 items-center justify-center rounded-2xl transition-all active:scale-95 ${
            completed
              ? 'bg-[#12C5DF] text-[#0D1117] shadow-[0_4px_16px_rgba(18,197,223,0.4)]'
              : 'neu-inset text-transparent hover:border-[#12C5DF]/40'
          }`}
        >
          <motion.div
            initial={false}
            animate={completed ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 450, damping: 24 }}
          >
            <Check size={20} strokeWidth={3} />
          </motion.div>
        </button>
      </div>
    </motion.div>
  );
}
