import {
  Archive,
  Bell,
  Camera,
  Clock,
  Download,
  HardDrive,
  LogOut,
  Moon,
  Pause,
  Play,
  RefreshCw,
  Sliders,
  Sun,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { HabitIcon } from '../components/ui/HabitIcon';
import { NeumorphicCard } from '../components/ui/NeumorphicCard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { COMMON_TIMEZONES, PRESET_AVATARS } from '../lib/constants';
import { offlineDb } from '../lib/offlineDb';
import { formatSupabaseError } from '../lib/supabase';
import { profileService } from '../services/profileService';
import { isNetworkOfflineError, syncService } from '../services/syncService';
import type {
  AppTheme,
  DailySummary,
  Habit,
  HabitCompletion,
  HabitStatus,
  StreakRule,
} from '../types/database';
import { getBrowserTimezone } from '../utils/dateUtils';
import { processAvatarFile } from '../utils/imageUtils';

interface ProfilePageProps {
  habits: Habit[];
  onEditHabit: (habit: Habit) => void;
  onChangeHabitStatus: (habitId: string, status: HabitStatus) => Promise<void>;
  onDeleteHabit: (habitId: string) => Promise<void>;
  onApplyImportedData: (imported: {
    habits: Habit[];
    completions: HabitCompletion[];
    summaries: DailySummary[];
  }) => void;
}

export function ProfilePage({
  habits,
  onEditHabit,
  onChangeHabitStatus,
  onDeleteHabit,
  onApplyImportedData,
}: ProfilePageProps) {
  const {
    user,
    profile,
    settings,
    uploadedPhotos,
    theme: activeTheme,
    isOnline,
    isLocalMode,
    pendingSyncCount,
    syncing,
    setThemePreview,
    addUploadedPhoto,
    removeUploadedPhoto,
    refreshSyncCount,
    syncNow,
    setLocalProfile,
    setLocalSettings,
    signOut,
  } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(
    profile?.avatar_url || PRESET_AVATARS[0].url
  );
  const [timezone, setTimezone] = useState(
    settings?.timezone || profile?.timezone || getBrowserTimezone()
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    settings?.notifications_enabled ?? true
  );
  const [streakRule, setStreakRule] = useState<StreakRule>(
    settings?.streak_rule ?? 'all'
  );
  const [customPct, setCustomPct] = useState<number>(
    settings?.custom_completion_percentage ?? 80
  );
  const [theme, setTheme] = useState<AppTheme>(activeTheme);

  const [savingAccount, setSavingAccount] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [habitFilter, setHabitFilter] = useState<'all' | HabitStatus>('all');
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setAvatarUrl(profile.avatar_url || PRESET_AVATARS[0].url);
    }
    if (settings) {
      setTimezone(settings.timezone);
      setNotificationsEnabled(settings.notifications_enabled);
      setStreakRule(settings.streak_rule);
      setCustomPct(settings.custom_completion_percentage);
      setTheme(settings.theme);
    }
  }, [profile, settings]);

  const timezoneOptions = Array.from(
    new Set([getBrowserTimezone(), ...COMMON_TIMEZONES])
  );

  const persistProfileUpdates = async (updates: {
    full_name?: string;
    avatar_url?: string;
  }) => {
    if (!user || !profile) return;
    const optimistic = {
      ...profile,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    setLocalProfile(optimistic);

    if (isLocalMode || !isOnline) {
      if (!isLocalMode) {
        await offlineDb.enqueueSync(user.id, 'UPDATE_PROFILE', updates);
        await refreshSyncCount();
      }
      return optimistic;
    }

    try {
      const updated = await profileService.updateProfile(user.id, updates);
      setLocalProfile(updated);
      return updated;
    } catch (err) {
      if (isNetworkOfflineError(err)) {
        await offlineDb.enqueueSync(user.id, 'UPDATE_PROFILE', updates);
        await refreshSyncCount();
        return optimistic;
      }
      throw err;
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    setSavingAccount(true);
    try {
      await persistProfileUpdates({
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim() || PRESET_AVATARS[0].url,
      });
      showToast('Profile saved', 'success');
    } catch (err) {
      showToast(formatSupabaseError(err, 'Failed to save profile'), 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;

    setUploadingPhoto(true);
    try {
      const { blob, dataUrl } = await processAvatarFile(file, 256);

      // 1. Permanently store in local IndexedDB Photo Vault so backups/sync never disable it
      await addUploadedPhoto(dataUrl);
      setAvatarUrl(dataUrl);

      if (profile) {
        setLocalProfile({
          ...profile,
          avatar_url: dataUrl,
          updated_at: new Date().toISOString(),
        });
      }

      if (isLocalMode || !isOnline) {
        if (!isLocalMode) {
          await offlineDb.enqueueSync(user.id, 'UPDATE_PROFILE', {
            avatar_url: dataUrl,
          });
          await refreshSyncCount();
        }
        showToast('Photo stored permanently on device', 'success');
        return;
      }

      try {
        const updated = await profileService.uploadAvatar(user.id, blob, dataUrl);
        setLocalProfile(updated);
        if (updated.avatar_url) {
          setAvatarUrl(updated.avatar_url);
        }
        showToast('Profile photo saved', 'success');
      } catch (err) {
        if (isNetworkOfflineError(err)) {
          await offlineDb.enqueueSync(user.id, 'UPDATE_PROFILE', {
            avatar_url: dataUrl,
          });
          await refreshSyncCount();
          showToast('Photo saved locally & queued for cloud sync', 'success');
        } else {
          // Even if remote profile update fails (e.g. pending DB permissions), local stored photo stays intact
          showToast('Photo stored locally; run DB permission SQL to sync to cloud', 'info');
        }
      }
    } catch (err) {
      showToast(formatSupabaseError(err, 'Failed to process photo'), 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSelectStoredPhoto = async (photoUrl: string) => {
    setAvatarUrl(photoUrl);
    try {
      await persistProfileUpdates({ avatar_url: photoUrl });
      showToast('Active profile photo updated', 'success');
    } catch {
      // Kept selected locally
    }
  };

  const handleSavePreferences = async (
    overrideUpdates?: Partial<{
      timezone: string;
      notifications_enabled: boolean;
      streak_rule: StreakRule;
      custom_completion_percentage: number;
      theme: AppTheme;
    }>
  ) => {
    if (!user) return;
    setSavingPrefs(true);
    const payload = {
      timezone: overrideUpdates?.timezone ?? timezone,
      notifications_enabled:
        overrideUpdates?.notifications_enabled ?? notificationsEnabled,
      streak_rule: overrideUpdates?.streak_rule ?? streakRule,
      custom_completion_percentage:
        overrideUpdates?.custom_completion_percentage ?? customPct,
      theme: overrideUpdates?.theme ?? theme,
    };

    const now = new Date().toISOString();
    if (settings) {
      setLocalSettings({
        ...settings,
        ...payload,
        updated_at: now,
      });
    }

    if (isLocalMode || !isOnline) {
      if (!isLocalMode) {
        await offlineDb.enqueueSync(user.id, 'UPDATE_SETTINGS', payload);
        await refreshSyncCount();
      }
      setSavingPrefs(false);
      showToast('Preferences saved', 'success');
      return;
    }

    try {
      const updated = await profileService.updateSettings(user.id, payload);
      setLocalSettings(updated);
      showToast('Preferences updated', 'success');
    } catch (err) {
      if (isNetworkOfflineError(err)) {
        await offlineDb.enqueueSync(user.id, 'UPDATE_SETTINGS', payload);
        await refreshSyncCount();
        showToast('Preferences saved offline', 'success');
      } else {
        showToast(formatSupabaseError(err, 'Failed to update preferences'), 'error');
      }
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleExportBackup = async () => {
    if (!user) return;
    setExportingBackup(true);
    try {
      const bundle = await syncService.exportBackup(user.id);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `track-me-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Backup exported with your habits & uploaded photos', 'success');
    } catch (err) {
      showToast(formatSupabaseError(err, 'Backup export failed'), 'error');
    } finally {
      setExportingBackup(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;

    setImportingBackup(true);
    try {
      const raw = await file.text();
      const restored = await syncService.importBackup(
        user.id,
        user.email || '',
        isLocalMode,
        raw
      );
      if (restored.profile) {
        setLocalProfile(restored.profile);
        setFullName(restored.profile.full_name);
        if (restored.profile.avatar_url) {
          setAvatarUrl(restored.profile.avatar_url);
        }
      }
      if (restored.settings) {
        setLocalSettings(restored.settings);
      }
      onApplyImportedData({
        habits: restored.habits,
        completions: restored.completions,
        summaries: restored.summaries,
      });
      await refreshSyncCount();
      showToast('Backup restored with all uploaded photos intact', 'success');
    } catch (err) {
      showToast(formatSupabaseError(err, 'Could not restore backup file'), 'error');
    } finally {
      setImportingBackup(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      showToast('Signed out', 'info');
    } catch (err) {
      showToast(formatSupabaseError(err, 'Failed to sign out'), 'error');
      setLoggingOut(false);
    }
  };

  const filteredHabits = habits.filter((h) =>
    habitFilter === 'all' ? true : h.status === habitFilter
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            {isLocalMode ? 'Offline Desktop Profile' : 'Account & Preferences'}
          </p>
          <h1 className="font-display mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Profile &amp; Settings
          </h1>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="neu-button flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold text-[#F43F5E]"
        >
          <LogOut size={16} />
          <span>{loggingOut ? 'Signing Out...' : isLocalMode ? 'Switch Account' : 'Log Out'}</span>
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Account Editing & Photo Vault */}
        <div className="space-y-6 lg:col-span-6">
          <NeumorphicCard className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="neu-inset flex h-10 w-10 items-center justify-center rounded-xl text-[#12C5DF]">
                <UserIcon size={18} />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                  Account Details
                </h2>
                <p className="text-xs text-[var(--text-muted)]">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleSaveAccount} className="mt-5 space-y-4">
              {/* Profile Photo Preview + Upload + Stored Photo Vault */}
              <div>
                <span className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]">
                  Profile Photo
                </span>

                <div className="neu-inset mb-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-3.5">
                  <div className="flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      aria-label="Upload profile photo"
                      className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-2 ring-[#12C5DF]/60"
                    >
                      <img
                        src={avatarUrl}
                        alt={fullName || 'Profile photo'}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera size={18} className="text-white" />
                      </span>
                    </button>

                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {fullName || 'Your Photo'}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Stored locally &amp; in backups
                      </p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="neu-button flex min-h-[42px] items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold text-[#12C5DF] disabled:opacity-60"
                  >
                    <Upload size={15} />
                    <span>{uploadingPhoto ? 'Saving...' : 'Upload Photo'}</span>
                  </button>
                </div>

                {/* User's Saved Uploaded Photos Gallery */}
                {uploadedPhotos.length > 0 && (
                  <div className="mb-3">
                    <span className="mb-2 block text-[11px] font-medium text-[var(--text-muted)]">
                      Your Uploaded Photos ({uploadedPhotos.length})
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      {uploadedPhotos.map((photo) => {
                        const selected = avatarUrl === photo.dataUrl;
                        return (
                          <div key={photo.id} className="relative">
                            <button
                              type="button"
                              onClick={() => handleSelectStoredPhoto(photo.dataUrl)}
                              aria-label="Select uploaded photo"
                              className={`h-14 w-14 overflow-hidden rounded-2xl transition-all ${
                                selected
                                  ? 'ring-2 ring-[#12C5DF] ring-offset-2 ring-offset-[var(--bg-canvas)] scale-105'
                                  : 'neu-card-sm opacity-85 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={photo.dataUrl}
                                alt="Uploaded avatar"
                                className="h-full w-full object-cover"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeUploadedPhoto(photo.id)}
                              aria-label="Remove saved photo"
                              title="Remove from saved photos"
                              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#202328] text-white shadow ring-1 ring-white/20 hover:bg-[#F43F5E]"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <span className="mb-2 block text-[11px] font-medium text-[var(--text-muted)]">
                  Or choose a studio avatar
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {PRESET_AVATARS.map((av) => {
                    const selected = avatarUrl === av.url;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => handleSelectStoredPhoto(av.url)}
                        aria-label={`Choose ${av.label} avatar`}
                        className={`h-14 w-14 overflow-hidden rounded-2xl transition-all ${
                          selected
                            ? 'ring-2 ring-[#12C5DF] ring-offset-2 ring-offset-[var(--bg-canvas)] scale-105'
                            : 'neu-card-sm opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={av.url}
                          alt={av.label}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="profile-name"
                  className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Display Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="neu-inset w-full rounded-2xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#12C5DF]/60"
                />
              </div>

              <button
                type="submit"
                disabled={savingAccount}
                className="min-h-[44px] w-full rounded-2xl bg-[#12C5DF] px-5 py-2.5 text-sm font-semibold text-[#0D1117] shadow-[0_6px_18px_rgba(18,197,223,0.3)] transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {savingAccount ? 'Saving...' : 'Save Account'}
              </button>
            </form>
          </NeumorphicCard>

          {/* Desktop App, Offline Sync & Backup */}
          <NeumorphicCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="neu-inset flex h-10 w-10 items-center justify-center rounded-xl text-[#12C5DF]">
                  <HardDrive size={18} />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                    Desktop Offline &amp; Backup
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {isLocalMode
                      ? 'Offline desktop storage active'
                      : isOnline
                        ? pendingSyncCount > 0
                          ? `${pendingSyncCount} changes queued for sync`
                          : 'Cloud & local storage in sync'
                        : 'Offline — changes queued locally'}
                  </p>
                </div>
              </div>

              <PWAInstallButton />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!isLocalMode && (
                <button
                  type="button"
                  onClick={syncNow}
                  disabled={!isOnline || syncing}
                  className="neu-button flex min-h-[42px] items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold text-[#12C5DF] disabled:opacity-50"
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportBackup}
                disabled={exportingBackup}
                className="neu-button flex min-h-[42px] items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-60"
              >
                <Download size={14} />
                <span>{exportingBackup ? 'Exporting...' : 'Export Backup'}</span>
              </button>

              <input
                ref={backupInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportBackup}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                disabled={importingBackup}
                className="neu-button flex min-h-[42px] items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-60"
              >
                <Upload size={14} />
                <span>{importingBackup ? 'Restoring...' : 'Restore Backup'}</span>
              </button>
            </div>
          </NeumorphicCard>

          {/* Theme & Notifications */}
          <NeumorphicCard className="p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Appearance &amp; Notifications
            </h2>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="neu-inset flex h-10 w-10 items-center justify-center rounded-xl text-[#A64BEA]">
                    {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Theme Mode
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Dark or light neumorphic surface
                    </p>
                  </div>
                </div>

                <div className="neu-inset grid grid-cols-2 gap-1 rounded-2xl p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('dark');
                      setThemePreview('dark');
                      handleSavePreferences({ theme: 'dark' });
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      theme === 'dark'
                        ? 'bg-[#12C5DF] text-[#0D1117]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('light');
                      setThemePreview('light');
                      handleSavePreferences({ theme: 'light' });
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      theme === 'light'
                        ? 'bg-[#12C5DF] text-[#0D1117]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    Light
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="neu-inset flex h-10 w-10 items-center justify-center rounded-xl text-[#12C5DF]">
                    <Bell size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Daily Reminders
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Receive streak &amp; goal reminders
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationsEnabled}
                  onClick={() => {
                    const next = !notificationsEnabled;
                    setNotificationsEnabled(next);
                    handleSavePreferences({ notifications_enabled: next });
                  }}
                  className={`flex h-8 w-14 items-center rounded-full p-1 transition-colors ${
                    notificationsEnabled
                      ? 'bg-[#12C5DF] justify-end'
                      : 'neu-inset justify-start'
                  }`}
                >
                  <span className="h-6 w-6 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </div>
          </NeumorphicCard>
        </div>

        {/* Streak Rules, Timezone & Habit Archive Manager */}
        <div className="space-y-6 lg:col-span-6">
          <NeumorphicCard className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="neu-inset flex h-10 w-10 items-center justify-center rounded-xl text-[#A64BEA]">
                <Sliders size={18} />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                  Streak &amp; Timezone Rules
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Controls how daily streaks are evaluated
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="settings-timezone"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  <Clock size={14} />
                  <span>Local Timezone</span>
                </label>
                <select
                  id="settings-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="neu-inset w-full rounded-2xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#12C5DF]/60"
                >
                  {timezoneOptions.map((tz) => (
                    <option
                      key={tz}
                      value={tz}
                      className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    >
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]">
                  Successful Day Requirement
                </span>
                <div className="neu-inset grid grid-cols-2 gap-1.5 rounded-2xl p-1.5">
                  <button
                    type="button"
                    onClick={() => setStreakRule('all')}
                    className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold transition-all ${
                      streakRule === 'all'
                        ? 'bg-[#12C5DF] text-[#0D1117]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    100% (All Scheduled)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreakRule('custom_percentage')}
                    className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold transition-all ${
                      streakRule === 'custom_percentage'
                        ? 'bg-[#12C5DF] text-[#0D1117]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Custom Percentage
                  </button>
                </div>

                {streakRule === 'custom_percentage' && (
                  <div className="neu-inset mt-3 rounded-2xl p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">
                        Minimum daily completion
                      </span>
                      <span className="font-mono-num font-bold text-[#12C5DF]">
                        {customPct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={customPct}
                      onChange={(e) => setCustomPct(Number(e.target.value))}
                      className="mt-3 w-full accent-[#12C5DF]"
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={savingPrefs}
                onClick={() => handleSavePreferences()}
                className="min-h-[44px] w-full rounded-2xl bg-[#A64BEA] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(166,75,234,0.3)] transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {savingPrefs ? 'Applying...' : 'Save Streak & Timezone Rules'}
              </button>
            </div>
          </NeumorphicCard>

          {/* Manage All Habits (Active / Paused / Archived) */}
          <NeumorphicCard className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                Habit Library ({habits.length})
              </h2>

              <div className="neu-inset flex items-center gap-1 rounded-xl p-1 text-xs">
                {(['all', 'active', 'paused', 'archived'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setHabitFilter(tab)}
                    className={`rounded-lg px-2.5 py-1 capitalize font-medium ${
                      habitFilter === tab
                        ? 'bg-[#12C5DF] text-[#0D1117]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {filteredHabits.length === 0 ? (
                <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                  No habits match this filter.
                </p>
              ) : (
                filteredHabits.map((h) => (
                  <div
                    key={h.id}
                    className="neu-inset flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => onEditHabit(h)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)]"
                        style={{ color: h.color }}
                      >
                        <HabitIcon name={h.icon} size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {h.name}
                        </p>
                        <p className="text-[11px] capitalize text-[var(--text-muted)]">
                          {h.status} · {h.target_value} {h.target_unit}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onChangeHabitStatus(
                            h.id,
                            h.status === 'active' ? 'paused' : 'active'
                          )
                        }
                        title={h.status === 'active' ? 'Pause' : 'Activate'}
                        className="neu-button flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)]"
                      >
                        {h.status === 'active' ? (
                          <Pause size={14} />
                        ) : (
                          <Play size={14} />
                        )}
                      </button>

                      {h.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => onChangeHabitStatus(h.id, 'archived')}
                          title="Archive"
                          className="neu-button flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)]"
                        >
                          <Archive size={14} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setHabitToDelete(h)}
                        title="Delete"
                        className="neu-button flex h-8 w-8 items-center justify-center rounded-xl text-[#F43F5E]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </NeumorphicCard>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(habitToDelete)}
        title="Delete Habit"
        description={`Delete "${habitToDelete?.name ?? ''}" permanently? Historical daily summaries will remain intact.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!habitToDelete) return;
          await onDeleteHabit(habitToDelete.id);
          setHabitToDelete(null);
        }}
        onCancel={() => setHabitToDelete(null)}
      />
    </div>
  );
}
