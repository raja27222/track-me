import { supabase } from '../lib/supabase';
import type { Habit, HabitFormInput, HabitStatus } from '../types/database';

export const habitService = {
  async listHabits(userId: string): Promise<Habit[]> {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Habit[];
  },

  async createHabit(userId: string, input: HabitFormInput): Promise<Habit> {
    const payload = {
      user_id: userId,
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
    };

    const { data, error } = await supabase
      .from('habits')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as Habit;
  },

  async updateHabit(
    userId: string,
    habitId: string,
    updates: Partial<HabitFormInput>
  ): Promise<Habit> {
    const cleanUpdates: Record<string, unknown> = { ...updates };
    if (typeof updates.name === 'string') cleanUpdates.name = updates.name.trim();
    if (typeof updates.description === 'string') {
      cleanUpdates.description = updates.description.trim();
    }
    if (typeof updates.target_unit === 'string') {
      cleanUpdates.target_unit = updates.target_unit.trim() || 'times';
    }
    if (updates.frequency === 'daily') {
      cleanUpdates.scheduled_days = [0, 1, 2, 3, 4, 5, 6];
    } else if (updates.scheduled_days) {
      cleanUpdates.scheduled_days = [...new Set(updates.scheduled_days)].sort();
    }

    const { data, error } = await supabase
      .from('habits')
      .update(cleanUpdates)
      .eq('id', habitId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return data as Habit;
  },

  async updateHabitStatus(
    userId: string,
    habitId: string,
    status: HabitStatus
  ): Promise<Habit> {
    return habitService.updateHabit(userId, habitId, { status });
  },

  async deleteHabit(userId: string, habitId: string): Promise<void> {
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId)
      .eq('user_id', userId);

    if (error) throw error;
  },
};
