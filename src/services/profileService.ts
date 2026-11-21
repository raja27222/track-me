import { PRESET_AVATARS } from '../lib/constants';
import { supabase } from '../lib/supabase';
import type { AppTheme, Profile, StreakRule, UserSettings } from '../types/database';
import { getBrowserTimezone } from '../utils/dateUtils';

export const profileService = {
  async ensureProfileAndSettings(
    userId: string,
    fallbackName?: string
  ): Promise<{ profile: Profile; settings: UserSettings }> {
    const detectedTz = getBrowserTimezone();

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      const { data: created, error: insertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            full_name: fallbackName || 'Habit Builder',
            avatar_url: PRESET_AVATARS[0].url,
            timezone: detectedTz,
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single();
      if (insertError) throw insertError;
      profile = created;
    }

    let { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (!settings) {
      const { data: createdSettings, error: insertSettingsError } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            streak_rule: 'all',
            custom_completion_percentage: 80,
            timezone: profile.timezone || detectedTz,
            notifications_enabled: true,
            theme: 'dark',
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .single();
      if (insertSettingsError) throw insertSettingsError;
      settings = createdSettings;
    }

    return {
      profile: profile as Profile,
      settings: settings as UserSettings,
    };
  },

  async updateProfile(
    userId: string,
    updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'timezone'>>
  ): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return data as Profile;
  },

  async uploadAvatar(
    userId: string,
    blob: Blob,
    dataUrl: string
  ): Promise<Profile> {
    let finalAvatarUrl = dataUrl;

    // Attempt Supabase Storage upload first if an 'avatars' bucket is configured
    try {
      const filePath = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          finalAvatarUrl = publicUrlData.publicUrl;
        }
      }
    } catch {
      // Fall back to compressed Data URL persisted in profiles.avatar_url
    }

    return profileService.updateProfile(userId, { avatar_url: finalAvatarUrl });
  },

  async updateSettings(
    userId: string,
    updates: Partial<{
      streak_rule: StreakRule;
      custom_completion_percentage: number;
      timezone: string;
      notifications_enabled: boolean;
      theme: AppTheme;
    }>
  ): Promise<UserSettings> {
    const { data, error } = await supabase
      .from('user_settings')
      .update(updates)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;

    // Keep timezone synced on profile if changed
    if (updates.timezone) {
      await supabase
        .from('profiles')
        .update({ timezone: updates.timezone })
        .eq('id', userId);
    }

    return data as UserSettings;
  },
};
