import {
  type HabitBackupBundle,
  offlineDb,
  type StoredUploadedPhoto,
} from '../lib/offlineDb';
import { supabase } from '../lib/supabase';
import { completionService } from './completionService';
import { habitService } from './habitService';
import { profileService } from './profileService';
import type {
  DailySummary,
  Habit,
  HabitCompletion,
  HabitFormInput,
  Profile,
  UserSettings,
} from '../types/database';

export function isNetworkOfflineError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!err || typeof err !== 'object') return false;
  const msg = String((err as { message?: string }).message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  );
}

export const syncService = {
  async flushQueue(userId: string): Promise<{ synced: number; remaining: number }> {
    if (!userId || userId === 'local-desktop-user') {
      return { synced: 0, remaining: 0 };
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const pending = await offlineDb.listSyncQueue(userId);
      return { synced: 0, remaining: pending.length };
    }

    const queue = await offlineDb.listSyncQueue(userId);
    let synced = 0;

    for (const item of queue) {
      try {
        switch (item.type) {
          case 'CREATE_HABIT': {
            const habitPayload = item.payload as unknown as Habit;
            const { error } = await supabase.from('habits').upsert(
              {
                id: habitPayload.id,
                user_id: userId,
                name: habitPayload.name,
                description: habitPayload.description,
                icon: habitPayload.icon,
                category: habitPayload.category,
                color: habitPayload.color,
                target_value: habitPayload.target_value,
                target_unit: habitPayload.target_unit,
                frequency: habitPayload.frequency,
                scheduled_days: habitPayload.scheduled_days,
                start_date: habitPayload.start_date,
                end_date: habitPayload.end_date,
                status: habitPayload.status,
              },
              { onConflict: 'id' }
            );
            if (error) throw error;
            break;
          }
          case 'UPDATE_HABIT': {
            const { habitId, updates } = item.payload as {
              habitId: string;
              updates: Partial<HabitFormInput>;
            };
            await habitService.updateHabit(userId, habitId, updates);
            break;
          }
          case 'DELETE_HABIT': {
            const { habitId } = item.payload as { habitId: string };
            await habitService.deleteHabit(userId, habitId);
            break;
          }
          case 'TOGGLE_COMPLETION': {
            const p = item.payload as {
              habitId: string;
              completionDate: string;
              completed: boolean;
              notes?: string;
              habits: Habit[];
              nextCompletions: HabitCompletion[];
              settings: Pick<
                UserSettings,
                'streak_rule' | 'custom_completion_percentage'
              > | null;
            };
            await completionService.toggleCompletionWithSummary({
              userId,
              habitId: p.habitId,
              completionDate: p.completionDate,
              completed: p.completed,
              notes: p.notes || '',
              habits: p.habits,
              nextCompletions: p.nextCompletions,
              settings: p.settings,
            });
            break;
          }
          case 'UPDATE_PROFILE': {
            const updates = item.payload as Partial<
              Pick<Profile, 'full_name' | 'avatar_url' | 'timezone'>
            >;
            await profileService.updateProfile(userId, updates);
            break;
          }
          case 'UPDATE_SETTINGS': {
            const updates = item.payload as Parameters<
              typeof profileService.updateSettings
            >[1];
            await profileService.updateSettings(userId, updates);
            break;
          }
        }

        await offlineDb.removeSyncItem(userId, item.id);
        synced += 1;
      } catch (err) {
        if (isNetworkOfflineError(err)) {
          break;
        }
        // Keep queue intact if permissions/schema are pending; do not drop user data silently
        console.warn('Sync item deferred:', item.type, err);
        break;
      }
    }

    const remainingList = await offlineDb.listSyncQueue(userId);
    return { synced, remaining: remainingList.length };
  },

  async exportBackup(userId: string): Promise<HabitBackupBundle> {
    const snapshot = await offlineDb.getSnapshot(userId);
    const uploadedPhotos = await offlineDb.listUploadedPhotos(userId);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: snapshot?.profile ?? null,
      settings: snapshot?.settings ?? null,
      habits: snapshot?.habits ?? [],
      completions: snapshot?.completions ?? [],
      summaries: snapshot?.summaries ?? [],
      uploadedPhotos,
    };
  },

  async importBackup(
    userId: string,
    email: string,
    isLocalOnly: boolean,
    rawJson: string
  ): Promise<{
    profile: Profile | null;
    settings: UserSettings | null;
    habits: Habit[];
    completions: HabitCompletion[];
    summaries: DailySummary[];
    uploadedPhotos: StoredUploadedPhoto[];
  }> {
    const parsed = JSON.parse(rawJson) as Partial<HabitBackupBundle>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.habits)) {
      throw new Error('Invalid backup file format.');
    }

    const existingPhotos = await offlineDb.listUploadedPhotos(userId);
    const existingSnapshot = await offlineDb.getSnapshot(userId);

    // Restore all uploaded photos from backup without deleting existing local uploaded photos
    const importedPhotos = Array.isArray(parsed.uploadedPhotos)
      ? parsed.uploadedPhotos
      : [];
    for (const photo of importedPhotos) {
      if (photo?.dataUrl) {
        await offlineDb.saveUploadedPhoto(userId, photo.dataUrl);
      }
    }
    // Also preserve profile avatar if it is a custom uploaded photo
    if (
      parsed.profile?.avatar_url &&
      parsed.profile.avatar_url.startsWith('data:image/')
    ) {
      await offlineDb.saveUploadedPhoto(userId, parsed.profile.avatar_url);
    }

    const allPhotos = await offlineDb.listUploadedPhotos(userId);

    // Preserve active uploaded photo rather than letting backup disable it
    const preservedAvatar =
      parsed.profile?.avatar_url ||
      existingSnapshot?.profile?.avatar_url ||
      existingPhotos[0]?.dataUrl ||
      null;

    const restoredProfile: Profile | null = parsed.profile
      ? {
          ...parsed.profile,
          id: userId,
          avatar_url: preservedAvatar,
        }
      : existingSnapshot?.profile ?? null;

    const restoredSettings: UserSettings | null = parsed.settings
      ? {
          ...parsed.settings,
          user_id: userId,
        }
      : existingSnapshot?.settings ?? null;

    const habits: Habit[] = (parsed.habits ?? []).map((h) => ({
      ...h,
      user_id: userId,
    }));
    const completions: HabitCompletion[] = (parsed.completions ?? []).map((c) => ({
      ...c,
      user_id: userId,
    }));
    const summaries: DailySummary[] = (parsed.summaries ?? []).map((s) => ({
      ...s,
      user_id: userId,
    }));

    await offlineDb.saveSnapshot({
      userId,
      email,
      isLocalOnly,
      profile: restoredProfile,
      settings: restoredSettings,
      habits,
      completions,
      summaries,
      updatedAt: new Date().toISOString(),
    });

    if (!isLocalOnly) {
      for (const h of habits) {
        await offlineDb.enqueueSync(userId, 'CREATE_HABIT', h as unknown as Record<string, unknown>);
      }
      if (restoredProfile) {
        await offlineDb.enqueueSync(userId, 'UPDATE_PROFILE', {
          full_name: restoredProfile.full_name,
          avatar_url: restoredProfile.avatar_url,
          timezone: restoredProfile.timezone,
        });
      }
      if (restoredSettings) {
        await offlineDb.enqueueSync(userId, 'UPDATE_SETTINGS', {
          streak_rule: restoredSettings.streak_rule,
          custom_completion_percentage: restoredSettings.custom_completion_percentage,
          timezone: restoredSettings.timezone,
          notifications_enabled: restoredSettings.notifications_enabled,
          theme: restoredSettings.theme,
        });
      }
      await syncService.flushQueue(userId);
    }

    return {
      profile: restoredProfile,
      settings: restoredSettings,
      habits,
      completions,
      summaries,
      uploadedPhotos: allPhotos,
    };
  },
};
