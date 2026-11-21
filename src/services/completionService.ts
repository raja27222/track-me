import { supabase } from '../lib/supabase';
import type {
  DailySummary,
  Habit,
  HabitCompletion,
  UserSettings,
} from '../types/database';
import { computeLiveDayStats } from '../utils/streakUtils';

export const completionService = {
  async listCompletions(userId: string): Promise<HabitCompletion[]> {
    const { data, error } = await supabase
      .from('habit_completions')
      .select('*')
      .eq('user_id', userId)
      .order('completion_date', { ascending: false });

    if (error) throw error;
    return (data ?? []) as HabitCompletion[];
  },

  async listDailySummaries(userId: string): Promise<DailySummary[]> {
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('summary_date', { ascending: false });

    if (error) throw error;
    return (data ?? []) as DailySummary[];
  },

  async upsertDailySummary(
    userId: string,
    dateStr: string,
    habits: Habit[],
    completions: HabitCompletion[],
    settings: Pick<UserSettings, 'streak_rule' | 'custom_completion_percentage'> | null
  ): Promise<DailySummary> {
    const stats = computeLiveDayStats(habits, completions, dateStr, settings);

    const { data, error } = await supabase
      .from('daily_summaries')
      .upsert(
        {
          user_id: userId,
          summary_date: dateStr,
          scheduled_count: stats.scheduledCount,
          completed_count: stats.completedCount,
          completion_percentage: stats.completionPercentage,
          is_successful_day: stats.isSuccessful,
        },
        { onConflict: 'user_id,summary_date' }
      )
      .select('*')
      .single();

    if (error) throw error;
    return data as DailySummary;
  },

  async toggleCompletionWithSummary(params: {
    userId: string;
    habitId: string;
    completionDate: string;
    completed: boolean;
    notes?: string;
    habits: Habit[];
    nextCompletions: HabitCompletion[];
    settings: Pick<UserSettings, 'streak_rule' | 'custom_completion_percentage'> | null;
  }): Promise<void> {
    const {
      userId,
      habitId,
      completionDate,
      completed,
      notes = '',
      habits,
      nextCompletions,
      settings,
    } = params;

    const stats = computeLiveDayStats(habits, nextCompletions, completionDate, settings);

    // Try atomic PostgreSQL RPC first
    const { error: rpcError } = await supabase.rpc('toggle_habit_completion_tx', {
      p_habit_id: habitId,
      p_completion_date: completionDate,
      p_completed: completed,
      p_scheduled_count: stats.scheduledCount,
      p_completed_count: stats.completedCount,
      p_completion_percentage: stats.completionPercentage,
      p_is_successful_day: stats.isSuccessful,
      p_notes: notes,
    });

    if (!rpcError) return;

    // If RPC is missing from schema cache, fall back cleanly to paired upserts
    const code = (rpcError as { code?: string }).code;
    if (code !== 'PGRST202' && code !== '42883') {
      throw rpcError;
    }

    const { error: compError } = await supabase.from('habit_completions').upsert(
      {
        habit_id: habitId,
        user_id: userId,
        completion_date: completionDate,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        notes,
      },
      { onConflict: 'habit_id,completion_date' }
    );
    if (compError) throw compError;

    const { error: sumError } = await supabase.from('daily_summaries').upsert(
      {
        user_id: userId,
        summary_date: completionDate,
        scheduled_count: stats.scheduledCount,
        completed_count: stats.completedCount,
        completion_percentage: stats.completionPercentage,
        is_successful_day: stats.isSuccessful,
      },
      { onConflict: 'user_id,summary_date' }
    );
    if (sumError) throw sumError;
  },
};
