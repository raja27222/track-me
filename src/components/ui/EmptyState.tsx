import { Plus, Sparkles } from 'lucide-react';
import { NeumorphicCard } from './NeumorphicCard';

interface EmptyStateProps {
  title: string;
  description: string;
  onCreateHabit: () => void;
  onLoadStarterPack?: () => void;
  loadingStarter?: boolean;
}

export function EmptyState({
  title,
  description,
  onCreateHabit,
  onLoadStarterPack,
  loadingStarter = false,
}: EmptyStateProps) {
  return (
    <NeumorphicCard className="flex flex-col items-center justify-center p-8 text-center">
      <div className="neu-inset mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-[#12C5DF]">
        <Sparkles size={28} />
      </div>
      <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onCreateHabit}
          className="flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#12C5DF] px-5 py-2.5 text-sm font-semibold text-[#0F1318] shadow-[0_6px_20px_rgba(18,197,223,0.3)] transition-transform active:scale-[0.98]"
        >
          <Plus size={18} />
          <span>Create First Habit</span>
        </button>

        {onLoadStarterPack && (
          <button
            type="button"
            onClick={onLoadStarterPack}
            disabled={loadingStarter}
            className="neu-button min-h-[44px] rounded-2xl px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] disabled:opacity-60"
          >
            {loadingStarter ? 'Adding Habits...' : 'Add Starter Habits'}
          </button>
        )}
      </div>
    </NeumorphicCard>
  );
}
