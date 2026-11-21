import { Flame, Moon, Plus, Sun, Target } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { CircularProgressRing } from '../components/dashboard/CircularProgressRing';
import { HabitRow } from '../components/dashboard/HabitRow';
import { WeeklyDateStrip } from '../components/dashboard/WeeklyDateStrip';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import { NeumorphicCard } from '../components/ui/NeumorphicCard';
import { useAuth } from '../contexts/AuthContext';
import { PRESET_AVATARS } from '../lib/constants';
import type { Habit, HabitCompletion, StreakMetrics } from '../types/database';
import { formatReadableDate } from '../utils/dateUtils';
import { computeLiveDayStats, isHabitScheduledOnDate } from '../utils/streakUtils';

interface DashboardPageProps {
  habits: Habit[];
  completions: HabitCompletion[];
  streakMetrics: StreakMetrics;
  loading: boolean;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onToggleCompletion: (habitId: string, dateStr: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (habit: Habit) => void;
  onPauseToggle: (habit: Habit) => void;
  onDeleteHabit: (habitId: string) => Promise<void>;
  onCreateStarterPack: () => Promise<void>;
  onGoToProfile: () => void;
}

export function DashboardPage({
  habits,
  completions,
  streakMetrics,
  loading,
  selectedDate,
  onSelectDate,
  onToggleCompletion,
  onOpenCreateModal,
  onOpenEditModal,
  onPauseToggle,
  onDeleteHabit,
  onCreateStarterPack,
  onGoToProfile,
}: DashboardPageProps) {
  const { profile, settings, todayStr, theme, setThemePreview } = useAuth();
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addingStarter, setAddingStarter] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  const displayName = profile?.full_name || 'Habit Builder';
  const firstName = displayName.split(' ')[0];
  const avatarSrc = profile?.avatar_url || PRESET_AVATARS[0].url;

  useEffect(() => {
    setAvatarLoadError(false);
  }, [avatarSrc]);
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isFutureDate = selectedDate > todayStr;
  const dayStats = computeLiveDayStats(habits, completions, selectedDate, settings);
  const scheduledHabits = habits.filter((h) =>
    isHabitScheduledOnDate(h, selectedDate)
  );
  const pausedHabits = habits.filter((h) => h.status === 'paused');

  const completedHabitIds = new Set(
    completions
      .filter((c) => c.completion_date === selectedDate && c.completed)
      .map((c) => c.habit_id)
  );

  const handleConfirmDelete = async () => {
    if (!habitToDelete) return;
    setDeleting(true);
    try {
      await onDeleteHabit(habitToDelete.id);
      setHabitToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleStarter = async () => {
    setAddingStarter(true);
    try {
      await onCreateStarterPack();
    } finally {
      setAddingStarter(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Top Greeting Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            {formatReadableDate(selectedDate)}
          </p>
          <h1 className="font-display mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Hello, {firstName}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <PWAInstallButton compact />

          <button
            type="button"
            onClick={() => setThemePreview(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="neu-button flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[var(--text-primary)]"
          >
            {theme === 'dark' ? (
              <Sun size={18} className="text-[#12C5DF]" />
            ) : (
              <Moon size={18} className="text-[#A64BEA]" />
            )}
          </button>

          <button
            type="button"
            onClick={onGoToProfile}
            aria-label="Open profile and settings"
            className="neu-card-sm flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl p-0.5 transition-transform active:scale-95"
          >
            {!avatarLoadError ? (
              <img
                src={avatarSrc}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarLoadError(true)}
                className="h-full w-full rounded-[14px] object-cover"
              />
            ) : (
              <span className="font-display text-sm font-bold text-[#12C5DF]">
                {initials}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Responsive 2-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Weekly Calendar + Progress Ring + Streak Summary */}
        <div className="space-y-6 lg:col-span-5">
          <WeeklyDateStrip
            selectedDate={selectedDate}
            todayStr={todayStr}
            dayMap={streakMetrics.dayMap}
            onSelectDate={onSelectDate}
          />

          <NeumorphicCard className="flex flex-col items-center justify-between gap-6 p-6">
            <CircularProgressRing
              percentage={isFutureDate ? 0 : dayStats.completionPercentage}
              completedCount={isFutureDate ? 0 : dayStats.completedCount}
              scheduledCount={dayStats.scheduledCount}
              isSuccessfulDay={!isFutureDate && dayStats.isSuccessful}
            />

            {/* Streak & Completed Count Row */}
            <div className="grid w-full grid-cols-2 gap-3">
              <div className="neu-inset flex items-center gap-3 rounded-2xl px-4 py-3">
                <motion.div
                  animate={
                    streakMetrics.currentStreak > 0
                      ? { scale: [1, 1.12, 1] }
                      : undefined
                  }
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    streakMetrics.currentStreak > 0
                      ? 'text-[#12C5DF]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  <Flame
                    size={22}
                    fill={streakMetrics.currentStreak > 0 ? 'currentColor' : 'none'}
                  />
                </motion.div>
                <div>
                  <p className="font-mono-num text-lg font-bold text-[var(--text-primary)]">
                    {streakMetrics.currentStreak}d
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Current Streak
                  </p>
                </div>
              </div>

              <div className="neu-inset flex items-center gap-3 rounded-2xl px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#A64BEA]">
                  <Target size={21} />
                </div>
                <div>
                  <p className="font-mono-num text-lg font-bold text-[var(--text-primary)]">
                    {isFutureDate ? 0 : dayStats.completedCount}/{dayStats.scheduledCount}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Daily Goals
                  </p>
                </div>
              </div>
            </div>
          </NeumorphicCard>
        </div>

        {/* Right Column: Daily Goals Checklist */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                {selectedDate === todayStr ? "Today's Goals" : 'Scheduled Goals'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {isFutureDate
                  ? 'Preview of upcoming habits'
                  : 'Tap a habit card or checkmark to log progress'}
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenCreateModal}
              className="neu-button flex min-h-[42px] items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold text-[#12C5DF]"
            >
              <Plus size={16} />
              <span>Add Habit</span>
            </button>
          </div>

          {habits.length === 0 ? (
            <EmptyState
              title="No habits created yet"
              description="Start building consistency by creating your first daily habit or adding a curated starter set."
              onCreateHabit={onOpenCreateModal}
              onLoadStarterPack={handleStarter}
              loadingStarter={addingStarter}
            />
          ) : scheduledHabits.length === 0 ? (
            <NeumorphicCard className="p-7 text-center">
              <p className="font-display text-base font-semibold text-[var(--text-primary)]">
                No habits scheduled for this day
              </p>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                Enjoy your rest day, or create a new habit for this weekday schedule.
              </p>
            </NeumorphicCard>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {scheduledHabits.map((habit) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    completed={!isFutureDate && completedHabitIds.has(habit.id)}
                    disabled={isFutureDate}
                    onToggle={() => onToggleCompletion(habit.id, selectedDate)}
                    onEdit={() => onOpenEditModal(habit)}
                    onPauseToggle={() => onPauseToggle(habit)}
                    onDelete={() => setHabitToDelete(habit)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {pausedHabits.length > 0 && (
            <NeumorphicCard variant="inset" className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Paused Habits ({pausedHabits.length})
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Excluded from daily targets
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pausedHabits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => onPauseToggle(h)}
                    className="neu-button min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]"
                  >
                    Resume {h.name}
                  </button>
                ))}
              </div>
            </NeumorphicCard>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(habitToDelete)}
        title="Delete Habit"
        description={`Are you sure you want to delete "${habitToDelete?.name ?? ''}"? Past daily completion summaries remain preserved in your history, while this habit will be removed from your active schedule.`}
        confirmLabel="Delete Habit"
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setHabitToDelete(null)}
      />
    </div>
  );
}
