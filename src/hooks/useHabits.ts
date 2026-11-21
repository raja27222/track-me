import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { EXAMPLE_HABIT_TEMPLATES, MILESTONE_DAYS } from '../lib/constants';
import { offlineDb } from '../lib/offlineDb';
import {
  type DatabaseSetupIssue,
  detectDatabaseSetupIssue,
  formatSupabaseError,
} from '../lib/supabase';
import { completionService } from '../services/completionService';
import { habitService } from '../services/habitService';
import { isNetworkOfflineError, syncService } from '../services/syncService';
import type {
  DailySummary,
  Habit,
  HabitCompletion,
  HabitFormInput,
  HabitStatus,
} from '../types/database';
import { calculateStreakMetrics, computeLiveDayStats } from '../utils/streakUtils';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useHabits() {
  const {
    user,
    profile,
    settings,
    todayStr,
    isOnline,
    isLocalMode,
    refreshSyncCount,
  } = useAuth();
  const { showToast } = useToast();

  const [habits, setHabitsState] = useState<Habit[]>([]);
  const [completions, setCompletionsState] = useState<HabitCompletion[]>([]);
  const [summaries, setSummariesState] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupIssue, setSetupIssue] = useState<DatabaseSetupIssue>(null);
  const [celebratedMilestone, setCelebratedMilestone] = useState<number | null>(null);

  const habitsRef = useRef<Habit[]>([]);
  const completionsRef = useRef<HabitCompletion[]>([]);
  const summariesRef = useRef<DailySummary[]>([]);

  const setHabits = useCallback((next: Habit[]) => {
    habitsRef.current = next;
    setHabitsState(next);
  }, []);

  const setCompletions = useCallback((next: HabitCompletion[]) => {
    completionsRef.current = next;
    setCompletionsState(next);
  }, []);

  const setSummaries = useCallback((next: DailySummary[]) => {
    summariesRef.current = next;
    setSummariesState(next);
  }, []);

  const persistLocalSnapshot = useCallback(
    async (
      nextHabits: Habit[],
      nextCompletions: HabitCompletion[],
      nextSummaries: DailySummary[]
    ) => {
      if (!user) return;
      await offlineDb.patchSnapshot(user.id, (prev) => ({
        userId: user.id,
        email: user.email || prev?.email || '',
        isLocalOnly: isLocalMode,
        profile: prev?.profile ?? profile,
        settings: prev?.settings ?? settings,
        habits: nextHabits,
        completions: nextCompletions,
        summaries: nextSummaries,
        updatedAt: new Date().toISOString(),
      }));
    },
    [user, isLocalMode, profile, settings]
  );

  const lastFetchedKeyRef = useRef<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setHabits([]);
      setCompletions([]);
      setSummaries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const cached = await offlineDb.getSnapshot(user.id);
    if (cached) {
      setHabits(cached.habits ?? []);
      setCompletions(cached.completions ?? []);
      setSummaries(cached.summaries ?? []);
    }

    if (isLocalMode || !isOnline) {
      setSetupIssue(null);
      setLoading(false);
      return;
    }

    try {
      await syncService.flushQueue(user.id);
      await refreshSyncCount();

      const pendingAfterFlush = await offlineDb.listSyncQueue(user.id);
      if (pendingAfterFlush.length > 0 && cached) {
        setLoading(false);
        return;
      }

      const [h, c, s] = await Promise.all([
        habitService.listHabits(user.id),
        completionService.listCompletions(user.id),
        completionService.listDailySummaries(user.id),
      ]);
      setHabits(h);
      setCompletions(c);
      setSummaries(s);
      setSetupIssue(null);
      await persistLocalSnapshot(h, c, s);
    } catch (err) {
      if (isNetworkOfflineError(err)) {
        setLoading(false);
        return;
      }
      const issue = detectDatabaseSetupIssue(err);
      if (issue) {
        setSetupIssue(issue);
      } else {
        const msg = formatSupabaseError(err, 'Unable to load your habits');
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [
    user,
    isLocalMode,
    isOnline,
    persistLocalSnapshot,
    refreshSyncCount,
    setHabits,
    setCompletions,
    setSummaries,
  ]);

  useEffect(() => {
    const uid = user?.id ?? 'anon';
    const modeKey = `${uid}:${isLocalMode ? 'local' : 'cloud'}`;
    const prevKey = lastFetchedKeyRef.current;

    // Skip re-fetching when going offline or flipping online inside local-only mode
    if (prevKey === modeKey && (!isOnline || isLocalMode)) {
      return;
    }
    lastFetchedKeyRef.current = modeKey;
    fetchAll();
  }, [user?.id, isLocalMode, isOnline, fetchAll]);

  const streakMetrics = useMemo(
    () => calculateStreakMetrics(habits, completions, summaries, settings, todayStr),
    [habits, completions, summaries, settings, todayStr]
  );

  const computeAndAttachSummary = useCallback(
    (
      targetDate: string,
      nextHabits: Habit[],
      nextCompletions: HabitCompletion[],
      baseSummaries: DailySummary[]
    ): DailySummary[] => {
      if (!user) return baseSummaries;
      const stats = computeLiveDayStats(
        nextHabits,
        nextCompletions,
        targetDate,
        settings
      );
      const existing = baseSummaries.find((s) => s.summary_date === targetDate);
      const now = new Date().toISOString();
      const updatedSummary: DailySummary = existing
        ? {
            ...existing,
            scheduled_count: stats.scheduledCount,
            completed_count: stats.completedCount,
            completion_percentage: stats.completionPercentage,
            is_successful_day: stats.isSuccessful,
            updated_at: now,
          }
        : {
            id: generateUuid(),
            user_id: user.id,
            summary_date: targetDate,
            scheduled_count: stats.scheduledCount,
            completed_count: stats.completedCount,
            completion_percentage: stats.completionPercentage,
            is_successful_day: stats.isSuccessful,
            created_at: now,
            updated_at: now,
          };

      return [
        updatedSummary,
        ...baseSummaries.filter((s) => s.summary_date !== targetDate),
      ];
    },
    [user, settings]
  );

  const syncTodaySummary = useCallback(
    async (
      nextHabits: Habit[],
      nextCompletions: HabitCompletion[],
      nextSummaries: DailySummary[]
    ) => {
      if (!user || isLocalMode || !isOnline) return;
      try {
        const saved = await completionService.upsertDailySummary(
          user.id,
          todayStr,
          nextHabits,
          nextCompletions,
          settings
        );
        const merged = [
          saved,
          ...nextSummaries.filter((s) => s.summary_date !== todayStr),
        ];
        setSummaries(merged);
        await persistLocalSnapshot(nextHabits, nextCompletions, merged);
      } catch (err) {
        if (!isNetworkOfflineError(err)) {
          console.error('Failed to sync today summary:', err);
        }
      }
    },
    [user, isLocalMode, isOnline, todayStr, settings, persistLocalSnapshot, setSummaries]
  );

  const toggleCompletion = useCallback(
    async (habitId: string, dateStr: string, notes = '') => {
      if (!user) return;
      if (dateStr > todayStr) {
        showToast('Future dates cannot be marked complete.', 'info');
        return;
      }

      const currentHabits = habitsRef.current;
      const prevCompletions = completionsRef.current;
      const prevSummaries = summariesRef.current;
      const prevStreak = calculateStreakMetrics(
        currentHabits,
        prevCompletions,
        prevSummaries,
        settings,
        todayStr
      ).currentStreak;

      const existing = prevCompletions.find(
        (c) => c.habit_id === habitId && c.completion_date === dateStr
      );
      const nextCompleted = existing ? !existing.completed : true;
      const now = new Date().toISOString();

      const optimisticRow: HabitCompletion = existing
        ? {
            ...existing,
            completed: nextCompleted,
            completed_at: nextCompleted ? now : null,
            notes: notes || existing.notes,
            updated_at: now,
          }
        : {
            id: generateUuid(),
            habit_id: habitId,
            user_id: user.id,
            completion_date: dateStr,
            completed: true,
            completed_at: now,
            notes,
            created_at: now,
            updated_at: now,
          };

      const nextCompletions = existing
        ? prevCompletions.map((c) =>
            c.habit_id === habitId && c.completion_date === dateStr ? optimisticRow : c
          )
        : [optimisticRow, ...prevCompletions];

      const nextSummaries = computeAndAttachSummary(
        dateStr,
        currentHabits,
        nextCompletions,
        prevSummaries
      );

      setCompletions(nextCompletions);
      setSummaries(nextSummaries);
      await persistLocalSnapshot(currentHabits, nextCompletions, nextSummaries);

      const nextMetrics = calculateStreakMetrics(
        currentHabits,
        nextCompletions,
        nextSummaries,
        settings,
        todayStr
      );
      const hitMilestone =
        nextMetrics.currentStreak > prevStreak &&
        (MILESTONE_DAYS as readonly number[]).includes(nextMetrics.currentStreak)
          ? nextMetrics.currentStreak
          : null;

      if (hitMilestone) {
        setCelebratedMilestone(hitMilestone);
      }

      if (isLocalMode) return;

      if (!isOnline) {
        await offlineDb.enqueueSync(user.id, 'TOGGLE_COMPLETION', {
          habitId,
          completionDate: dateStr,
          completed: nextCompleted,
          notes,
          habits: currentHabits,
          nextCompletions,
          settings,
        });
        await refreshSyncCount();
        return;
      }

      try {
        await completionService.toggleCompletionWithSummary({
          userId: user.id,
          habitId,
          completionDate: dateStr,
          completed: nextCompleted,
          notes,
          habits: currentHabits,
          nextCompletions,
          settings,
        });
      } catch (err) {
        if (isNetworkOfflineError(err)) {
          await offlineDb.enqueueSync(user.id, 'TOGGLE_COMPLETION', {
            habitId,
            completionDate: dateStr,
            completed: nextCompleted,
            notes,
            habits: currentHabits,
            nextCompletions,
            settings,
          });
          await refreshSyncCount();
          return;
        }
        setCompletions(prevCompletions);
        setSummaries(prevSummaries);
        await persistLocalSnapshot(currentHabits, prevCompletions, prevSummaries);
        const issue = detectDatabaseSetupIssue(err);
        if (issue) setSetupIssue(issue);
        showToast(formatSupabaseError(err, 'Could not save habit completion'), 'error');
      }
    },
    [
      user,
      todayStr,
      settings,
      computeAndAttachSummary,
      persistLocalSnapshot,
      isLocalMode,
      isOnline,
      refreshSyncCount,
      showToast,
      setCompletions,
      setSummaries,
    ]
  );

  const createHabit = useCallback(
    async (input: HabitFormInput, silentToast = false) => {
      if (!user) return;
      const now = new Date().toISOString();
      const localHabit: Habit = {
        id: generateUuid(),
        user_id: user.id,
        name: input.name.trim(),
        description: input.description.trim(),
        icon: input.icon,
        category: input.category,
        color: input.color,
        target_value: Number(input.target_value) || 1,
        target_unit: input.target_unit.trim() || 'times',
        frequency: input.frequency,
        scheduled_days:
          input.frequency === 'daily'
            ? [0, 1, 2, 3, 4, 5, 6]
            : [...new Set(input.scheduled_days)].sort(),
        start_date: input.start_date,
        end_date: input.end_date || null,
        status: input.status || 'active',
        created_at: now,
        updated_at: now,
      };

      const currentHabits = habitsRef.current;
      const currentCompletions = completionsRef.current;
      const currentSummaries = summariesRef.current;

      if (isLocalMode || !isOnline) {
        const nextHabits = [...currentHabits, localHabit];
        const nextSummaries = computeAndAttachSummary(
          todayStr,
          nextHabits,
          currentCompletions,
          currentSummaries
        );
        setHabits(nextHabits);
        setSummaries(nextSummaries);
        await persistLocalSnapshot(nextHabits, currentCompletions, nextSummaries);

        if (!isLocalMode) {
          await offlineDb.enqueueSync(
            user.id,
            'CREATE_HABIT',
            localHabit as unknown as Record<string, unknown>
          );
          await refreshSyncCount();
        }
        if (!silentToast) {
          showToast(`Created "${localHabit.name}"`, 'success');
        }
        return localHabit;
      }

      try {
        const created = await habitService.createHabit(user.id, input);
        const latestHabits = habitsRef.current;
        const latestCompletions = completionsRef.current;
        const latestSummaries = summariesRef.current;
        const nextHabits = [...latestHabits, created];
        const nextSummaries = computeAndAttachSummary(
          todayStr,
          nextHabits,
          latestCompletions,
          latestSummaries
        );
        setHabits(nextHabits);
        setSummaries(nextSummaries);
        await persistLocalSnapshot(nextHabits, latestCompletions, nextSummaries);
        await syncTodaySummary(nextHabits, latestCompletions, nextSummaries);
        if (!silentToast) {
          showToast(`Created "${created.name}"`, 'success');
        }
        return created;
      } catch (err) {
        if (isNetworkOfflineError(err)) {
          const nextHabits = [...habitsRef.current, localHabit];
          const nextSummaries = computeAndAttachSummary(
            todayStr,
            nextHabits,
            completionsRef.current,
            summariesRef.current
          );
          setHabits(nextHabits);
          setSummaries(nextSummaries);
          await persistLocalSnapshot(nextHabits, completionsRef.current, nextSummaries);
          await offlineDb.enqueueSync(
            user.id,
            'CREATE_HABIT',
            localHabit as unknown as Record<string, unknown>
          );
          await refreshSyncCount();
          if (!silentToast) {
            showToast(`Created "${localHabit.name}" (saved offline)`, 'success');
          }
          return localHabit;
        }
        const issue = detectDatabaseSetupIssue(err);
        if (issue) setSetupIssue(issue);
        const msg = formatSupabaseError(err, 'Failed to create habit');
        showToast(msg, 'error');
        throw err;
      }
    },
    [
      user,
      todayStr,
      isLocalMode,
      isOnline,
      computeAndAttachSummary,
      persistLocalSnapshot,
      syncTodaySummary,
      refreshSyncCount,
      showToast,
      setHabits,
      setSummaries,
    ]
  );

  const createStarterPack = useCallback(async () => {
    if (!user) return;
    try {
      if (isLocalMode || !isOnline) {
        const now = new Date().toISOString();
        const createdBatch: Habit[] = EXAMPLE_HABIT_TEMPLATES.map((tpl) => ({
          id: generateUuid(),
          user_id: user.id,
          name: tpl.name.trim(),
          description: tpl.description.trim(),
          icon: tpl.icon,
          category: tpl.category,
          color: tpl.color,
          target_value: Number(tpl.target_value) || 1,
          target_unit: tpl.target_unit.trim() || 'times',
          frequency: tpl.frequency,
          scheduled_days:
            tpl.frequency === 'daily'
              ? [0, 1, 2, 3, 4, 5, 6]
              : [...new Set(tpl.scheduled_days)].sort(),
          start_date: todayStr,
          end_date: null,
          status: 'active',
          created_at: now,
          updated_at: now,
        }));

        const nextHabits = [...habitsRef.current, ...createdBatch];
        const nextSummaries = computeAndAttachSummary(
          todayStr,
          nextHabits,
          completionsRef.current,
          summariesRef.current
        );
        setHabits(nextHabits);
        setSummaries(nextSummaries);
        await persistLocalSnapshot(nextHabits, completionsRef.current, nextSummaries);

        if (!isLocalMode) {
          for (const h of createdBatch) {
            await offlineDb.enqueueSync(
              user.id,
              'CREATE_HABIT',
              h as unknown as Record<string, unknown>
            );
          }
          await refreshSyncCount();
        }
        showToast('Starter habits added to your daily routine', 'success');
        return;
      }

      let addedCount = 0;
      for (const tpl of EXAMPLE_HABIT_TEMPLATES) {
        const created = await createHabit(
          {
            ...tpl,
            start_date: todayStr,
            end_date: null,
            status: 'active',
          },
          true
        );
        if (created) addedCount += 1;
      }
      if (addedCount > 0) {
        showToast('Starter habits added to your daily routine', 'success');
      }
    } catch (err) {
      showToast(formatSupabaseError(err, 'Failed to add starter habits'), 'error');
    }
  }, [
    user,
    todayStr,
    isLocalMode,
    isOnline,
    computeAndAttachSummary,
    persistLocalSnapshot,
    refreshSyncCount,
    createHabit,
    showToast,
    setHabits,
    setSummaries,
  ]);

  const updateHabit = useCallback(
    async (habitId: string, updates: Partial<HabitFormInput>) => {
      if (!user) return;
      const prevHabits = habitsRef.current;
      const currentCompletions = completionsRef.current;
      const currentSummaries = summariesRef.current;
      const now = new Date().toISOString();

      const optimisticHabits = prevHabits.map((h) =>
        h.id === habitId
          ? {
              ...h,
              ...updates,
              name: typeof updates.name === 'string' ? updates.name.trim() : h.name,
              description:
                typeof updates.description === 'string'
                  ? updates.description.trim()
                  : h.description,
              scheduled_days:
                updates.frequency === 'daily'
                  ? [0, 1, 2, 3, 4, 5, 6]
                  : updates.scheduled_days ?? h.scheduled_days,
              updated_at: now,
            }
          : h
      );
      const nextSummaries = computeAndAttachSummary(
        todayStr,
        optimisticHabits,
        currentCompletions,
        currentSummaries
      );

      setHabits(optimisticHabits);
      setSummaries(nextSummaries);
      await persistLocalSnapshot(optimisticHabits, currentCompletions, nextSummaries);

      if (isLocalMode || !isOnline) {
        if (!isLocalMode) {
          await offlineDb.enqueueSync(user.id, 'UPDATE_HABIT', {
            habitId,
            updates,
          });
          await refreshSyncCount();
        }
        showToast('Habit updated', 'success');
        return optimisticHabits.find((h) => h.id === habitId);
      }

      try {
        const updated = await habitService.updateHabit(user.id, habitId, updates);
        const nextHabits = habitsRef.current.map((h) =>
          h.id === habitId ? updated : h
        );
        setHabits(nextHabits);
        await persistLocalSnapshot(nextHabits, currentCompletions, nextSummaries);
        await syncTodaySummary(nextHabits, currentCompletions, nextSummaries);
        showToast(`Updated "${updated.name}"`, 'success');
        return updated;
      } catch (err) {
        if (isNetworkOfflineError(err)) {
          await offlineDb.enqueueSync(user.id, 'UPDATE_HABIT', {
            habitId,
            updates,
          });
          await refreshSyncCount();
          showToast('Habit updated (saved offline)', 'success');
          return optimisticHabits.find((h) => h.id === habitId);
        }
        setHabits(prevHabits);
        setSummaries(currentSummaries);
        await persistLocalSnapshot(prevHabits, currentCompletions, currentSummaries);
        const issue = detectDatabaseSetupIssue(err);
        if (issue) setSetupIssue(issue);
        showToast(formatSupabaseError(err, 'Failed to update habit'), 'error');
        throw err;
      }
    },
    [
      user,
      todayStr,
      isLocalMode,
      isOnline,
      computeAndAttachSummary,
      persistLocalSnapshot,
      syncTodaySummary,
      refreshSyncCount,
      showToast,
      setHabits,
      setSummaries,
    ]
  );

  const changeHabitStatus = useCallback(
    async (habitId: string, status: HabitStatus) => {
      await updateHabit(habitId, { status });
    },
    [updateHabit]
  );

  const deleteHabit = useCallback(
    async (habitId: string) => {
      if (!user) return;
      const prevHabits = habitsRef.current;
      const prevCompletions = completionsRef.current;
      const prevSummaries = summariesRef.current;

      const nextHabits = prevHabits.filter((h) => h.id !== habitId);
      const nextCompletions = prevCompletions.filter((c) => c.habit_id !== habitId);
      const nextSummaries = computeAndAttachSummary(
        todayStr,
        nextHabits,
        nextCompletions,
        prevSummaries
      );

      setHabits(nextHabits);
      setCompletions(nextCompletions);
      setSummaries(nextSummaries);
      await persistLocalSnapshot(nextHabits, nextCompletions, nextSummaries);

      if (isLocalMode || !isOnline) {
        if (!isLocalMode) {
          await offlineDb.enqueueSync(user.id, 'DELETE_HABIT', { habitId });
          await refreshSyncCount();
        }
        showToast('Habit deleted', 'success');
        return;
      }

      try {
        await habitService.deleteHabit(user.id, habitId);
        await syncTodaySummary(nextHabits, nextCompletions, nextSummaries);
        showToast('Habit deleted', 'success');
      } catch (err) {
        if (isNetworkOfflineError(err)) {
          await offlineDb.enqueueSync(user.id, 'DELETE_HABIT', { habitId });
          await refreshSyncCount();
          showToast('Habit deleted (saved offline)', 'success');
          return;
        }
        setHabits(prevHabits);
        setCompletions(prevCompletions);
        setSummaries(prevSummaries);
        await persistLocalSnapshot(prevHabits, prevCompletions, prevSummaries);
        showToast(formatSupabaseError(err, 'Failed to delete habit'), 'error');
      }
    },
    [
      user,
      todayStr,
      isLocalMode,
      isOnline,
      computeAndAttachSummary,
      persistLocalSnapshot,
      syncTodaySummary,
      refreshSyncCount,
      showToast,
      setHabits,
      setCompletions,
      setSummaries,
    ]
  );

  const applyImportedData = useCallback(
    (imported: {
      habits: Habit[];
      completions: HabitCompletion[];
      summaries: DailySummary[];
    }) => {
      setHabits(imported.habits);
      setCompletions(imported.completions);
      setSummaries(imported.summaries);
    },
    [setHabits, setCompletions, setSummaries]
  );

  return {
    habits,
    completions,
    summaries,
    streakMetrics,
    loading,
    error,
    schemaMissing: setupIssue !== null,
    setupIssue,
    celebratedMilestone,
    dismissMilestone: () => setCelebratedMilestone(null),
    refresh: fetchAll,
    toggleCompletion,
    createHabit,
    createStarterPack,
    updateHabit,
    changeHabitStatus,
    deleteHabit,
    applyImportedData,
  };
}
