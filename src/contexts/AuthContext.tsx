import type { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PRESET_AVATARS } from '../lib/constants';
import { offlineDb, type StoredUploadedPhoto } from '../lib/offlineDb';
import {
  type DatabaseSetupIssue,
  detectDatabaseSetupIssue,
  formatSupabaseError,
  supabase,
} from '../lib/supabase';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';
import { isNetworkOfflineError, syncService } from '../services/syncService';
import type { AppTheme, Profile, UserSettings } from '../types/database';
import { getBrowserTimezone, getLocalDateString } from '../utils/dateUtils';

const THEME_STORAGE_KEY = 'cadence_theme_preview';
const LOCAL_MODE_STORAGE_KEY = 'cadence_local_desktop_mode';
const LAST_CLOUD_USER_KEY = 'cadence_last_cloud_user';
export const LOCAL_DESKTOP_USER_ID = 'local-desktop-user';

function buildLocalUser(name = 'Desktop User'): User {
  return {
    id: LOCAL_DESKTOP_USER_ID,
    app_metadata: {},
    user_metadata: { full_name: name },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'offline@cadence.local',
  } as User;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  settings: UserSettings | null;
  uploadedPhotos: StoredUploadedPhoto[];
  loading: boolean;
  schemaMissing: boolean;
  setupIssue: DatabaseSetupIssue;
  isPasswordRecovery: boolean;
  isOnline: boolean;
  isLocalMode: boolean;
  pendingSyncCount: number;
  syncing: boolean;
  timezone: string;
  todayStr: string;
  theme: AppTheme;
  setThemePreview: (theme: AppTheme) => void;
  enterLocalMode: (name?: string) => Promise<void>;
  addUploadedPhoto: (dataUrl: string) => Promise<void>;
  removeUploadedPhoto: (photoId: string) => Promise<void>;
  refreshSyncCount: () => Promise<void>;
  syncNow: () => Promise<void>;
  clearPasswordRecovery: () => void;
  refreshProfile: () => Promise<void>;
  setLocalProfile: (profile: Profile) => void;
  setLocalSettings: (settings: UserSettings) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus();

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<StoredUploadedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupIssue, setSetupIssue] = useState<DatabaseSetupIssue>(null);
  const [isLocalMode, setIsLocalMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_MODE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.search.includes('mode=reset-password') ||
      window.location.hash.includes('type=recovery')
    );
  });

  const activeUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  const setThemePreview = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore
    }
    setSettings((prev) => {
      if (!prev || prev.theme === nextTheme) return prev;
      return { ...prev, theme: nextTheme };
    });
    const uid = activeUserIdRef.current;
    if (uid) {
      offlineDb.getSnapshot(uid).then((prev) => {
        if (!prev?.settings) return;
        return offlineDb.saveSnapshot({
          ...prev,
          settings: { ...prev.settings, theme: nextTheme },
          updatedAt: new Date().toISOString(),
        });
      });
    }
  }, []);

  const refreshSyncCountForUser = useCallback(async (uid: string) => {
    const queue = await offlineDb.listSyncQueue(uid);
    setPendingSyncCount(queue.length);
  }, []);

  const ensureLocalProfileInDb = useCallback(
    async (uid: string, fallbackName: string, email: string, localOnly: boolean) => {
      const tz = getBrowserTimezone();
      const now = new Date().toISOString();
      const existing = await offlineDb.getSnapshot(uid);
      const photos = await offlineDb.listUploadedPhotos(uid);
      setUploadedPhotos(photos);

      if (existing?.profile && existing?.settings) {
        // Preserve uploaded photo if profile avatar was ever cleared
        const preservedAvatar =
          existing.profile.avatar_url || photos[0]?.dataUrl || PRESET_AVATARS[0].url;
        const p = { ...existing.profile, avatar_url: preservedAvatar };
        setProfile(p);
        setSettings(existing.settings);
        setThemePreview(existing.settings.theme);
        return { profile: p, settings: existing.settings };
      }

      let activeTheme: AppTheme = 'dark';
      try {
        if (localStorage.getItem(THEME_STORAGE_KEY) === 'light') {
          activeTheme = 'light';
        }
      } catch {
        // ignore
      }

      const defaultProfile: Profile = {
        id: uid,
        full_name: fallbackName,
        avatar_url: photos[0]?.dataUrl || PRESET_AVATARS[0].url,
        timezone: tz,
        created_at: now,
        updated_at: now,
      };
      const defaultSettings: UserSettings = {
        id: `local-settings-${uid}`,
        user_id: uid,
        streak_rule: 'all',
        custom_completion_percentage: 80,
        timezone: tz,
        notifications_enabled: true,
        theme: activeTheme,
        created_at: now,
        updated_at: now,
      };

      await offlineDb.saveSnapshot({
        userId: uid,
        email,
        isLocalOnly: localOnly,
        profile: defaultProfile,
        settings: defaultSettings,
        habits: existing?.habits ?? [],
        completions: existing?.completions ?? [],
        summaries: existing?.summaries ?? [],
        updatedAt: now,
      });

      setProfile(defaultProfile);
      setSettings(defaultSettings);
      return { profile: defaultProfile, settings: defaultSettings };
    },
    [setThemePreview]
  );

  const loadUserRecords = useCallback(
    async (authUser: User) => {
      const fallbackName =
        (authUser.user_metadata?.full_name as string | undefined) ||
        authUser.email?.split('@')[0] ||
        'Habit Builder';

      try {
        localStorage.setItem(
          LAST_CLOUD_USER_KEY,
          JSON.stringify({
            id: authUser.id,
            email: authUser.email || '',
            fullName: fallbackName,
          })
        );
      } catch {
        // ignore
      }

      // 1. Load cached offline snapshot & uploaded photos immediately
      const cached = await offlineDb.getSnapshot(authUser.id);
      const photos = await offlineDb.listUploadedPhotos(authUser.id);
      setUploadedPhotos(photos);

      if (cached?.profile) setProfile(cached.profile);
      if (cached?.settings) {
        setSettings(cached.settings);
        setThemePreview(cached.settings.theme);
      }
      await refreshSyncCountForUser(authUser.id);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await ensureLocalProfileInDb(
          authUser.id,
          fallbackName,
          authUser.email || '',
          false
        );
        return;
      }

      // 2. Online: flush queued offline changes first, then sync from Supabase
      try {
        await syncService.flushQueue(authUser.id);
        await refreshSyncCountForUser(authUser.id);

        const data = await profileService.ensureProfileAndSettings(
          authUser.id,
          fallbackName
        );

        // Preserve any locally uploaded photo so remote sync/backup never disables it
        let finalProfile = data.profile;
        const latestLocalPhoto = photos[0]?.dataUrl || cached?.profile?.avatar_url;
        const isRemoteDefaultOrEmpty =
          !finalProfile.avatar_url ||
          PRESET_AVATARS.some((a) => a.url === finalProfile.avatar_url);

        if (
          latestLocalPhoto &&
          latestLocalPhoto.startsWith('data:image/') &&
          isRemoteDefaultOrEmpty
        ) {
          try {
            finalProfile = await profileService.updateProfile(authUser.id, {
              avatar_url: latestLocalPhoto,
            });
          } catch {
            finalProfile = { ...finalProfile, avatar_url: latestLocalPhoto };
          }
        } else if (finalProfile.avatar_url?.startsWith('data:image/')) {
          await offlineDb.saveUploadedPhoto(authUser.id, finalProfile.avatar_url);
          setUploadedPhotos(await offlineDb.listUploadedPhotos(authUser.id));
        }

        setProfile(finalProfile);
        setSettings(data.settings);
        if (data.settings?.theme === 'light' || data.settings?.theme === 'dark') {
          setThemePreview(data.settings.theme);
        }
        setSetupIssue(null);

        await offlineDb.patchSnapshot(authUser.id, (prev) => ({
          userId: authUser.id,
          email: authUser.email || prev?.email || '',
          isLocalOnly: false,
          profile: finalProfile,
          settings: data.settings,
          habits: prev?.habits ?? [],
          completions: prev?.completions ?? [],
          summaries: prev?.summaries ?? [],
          updatedAt: new Date().toISOString(),
        }));
      } catch (err) {
        if (isNetworkOfflineError(err)) {
          await ensureLocalProfileInDb(
            authUser.id,
            fallbackName,
            authUser.email || '',
            false
          );
          return;
        }
        const issue = detectDatabaseSetupIssue(err);
        if (issue) {
          setSetupIssue(issue);
          await ensureLocalProfileInDb(
            authUser.id,
            fallbackName,
            authUser.email || '',
            false
          );
        } else {
          console.error('Failed to load profile/settings:', formatSupabaseError(err));
        }
      }
    },
    [ensureLocalProfileInDb, refreshSyncCountForUser, setThemePreview]
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        if (localStorage.getItem(LOCAL_MODE_STORAGE_KEY) === 'true') {
          const localUser = buildLocalUser();
          if (!mounted) return;
          setIsLocalMode(true);
          setUser(localUser);
          await ensureLocalProfileInDb(
            LOCAL_DESKTOP_USER_ID,
            'Desktop User',
            'offline@cadence.local',
            true
          );
          return;
        }

        const currentSession = await authService.getSession();
        if (!mounted) return;
        setSession(currentSession);
        if (currentSession?.user) {
          setUser(currentSession.user);
          await loadUserRecords(currentSession.user);
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // If offline and user previously logged into cloud, restore cached offline snapshot
          const lastRaw = localStorage.getItem(LAST_CLOUD_USER_KEY);
          if (lastRaw) {
            const last = JSON.parse(lastRaw) as {
              id: string;
              email: string;
              fullName: string;
            };
            const offlineUser = {
              id: last.id,
              email: last.email,
              app_metadata: {},
              aud: 'authenticated',
              created_at: new Date().toISOString(),
              user_metadata: { full_name: last.fullName },
            } as User;
            setUser(offlineUser);
            await ensureLocalProfileInDb(last.id, last.fullName, last.email, false);
          }
        }
      } catch (err) {
        console.error('Session initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!mounted) return;
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
        if (nextSession?.user) {
          try {
            localStorage.removeItem(LOCAL_MODE_STORAGE_KEY);
          } catch {
            // ignore
          }
          setIsLocalMode(false);
          setSession(nextSession);
          setUser(nextSession.user);
          await loadUserRecords(nextSession.user);
        } else if (localStorage.getItem(LOCAL_MODE_STORAGE_KEY) !== 'true') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setSettings(null);
          setUploadedPhotos([]);
          setSetupIssue(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [ensureLocalProfileInDb, loadUserRecords]);

  // Automatic background sync when connectivity returns
  useEffect(() => {
    if (!isOnline || !user || isLocalMode) return;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const res = await syncService.flushQueue(user.id);
        if (!cancelled) {
          setPendingSyncCount(res.remaining);
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnline, user, isLocalMode]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const timezone = settings?.timezone || profile?.timezone || getBrowserTimezone();
  const todayStr = useMemo(() => getLocalDateString(new Date(), timezone), [timezone]);

  const enterLocalMode = useCallback(
    async (name = 'Desktop User') => {
      try {
        localStorage.setItem(LOCAL_MODE_STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
      setIsLocalMode(true);
      setSetupIssue(null);
      const localUser = buildLocalUser(name);
      setUser(localUser);
      await ensureLocalProfileInDb(
        LOCAL_DESKTOP_USER_ID,
        name,
        'offline@cadence.local',
        true
      );
    },
    [ensureLocalProfileInDb]
  );

  const addUploadedPhoto = useCallback(
    async (dataUrl: string) => {
      if (!user) return;
      await offlineDb.saveUploadedPhoto(user.id, dataUrl);
      const list = await offlineDb.listUploadedPhotos(user.id);
      setUploadedPhotos(list);
    },
    [user]
  );

  const removeUploadedPhoto = useCallback(
    async (photoId: string) => {
      if (!user) return;
      await offlineDb.deleteUploadedPhoto(user.id, photoId);
      const list = await offlineDb.listUploadedPhotos(user.id);
      setUploadedPhotos(list);
    },
    [user]
  );

  const syncNow = useCallback(async () => {
    if (!user || isLocalMode || !isOnline) return;
    setSyncing(true);
    try {
      const res = await syncService.flushQueue(user.id);
      setPendingSyncCount(res.remaining);
      await loadUserRecords(user);
    } finally {
      setSyncing(false);
    }
  }, [user, isLocalMode, isOnline, loadUserRecords]);

  const refreshProfile = useCallback(async () => {
    if (!user || isLocalMode) return;
    await loadUserRecords(user);
  }, [user, isLocalMode, loadUserRecords]);

  const signOut = useCallback(async () => {
    if (isLocalMode) {
      try {
        localStorage.removeItem(LOCAL_MODE_STORAGE_KEY);
      } catch {
        // ignore
      }
      setIsLocalMode(false);
    } else {
      try {
        await authService.signOut();
      } catch {
        // Allow sign out even when offline
      }
    }
    try {
      localStorage.removeItem(LAST_CLOUD_USER_KEY);
    } catch {
      // ignore
    }
    setProfile(null);
    setSettings(null);
    setSession(null);
    setUser(null);
    setUploadedPhotos([]);
    setPendingSyncCount(0);
  }, [isLocalMode]);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
    if (window.location.search.includes('mode=reset-password')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const setLocalProfilePersisted = useCallback(
    (nextProfile: Profile) => {
      setProfile(nextProfile);
      if (user) {
        offlineDb.patchSnapshot(user.id, (prev) => ({
          userId: user.id,
          email: user.email || prev?.email || '',
          isLocalOnly: isLocalMode,
          profile: nextProfile,
          settings: prev?.settings ?? settings,
          habits: prev?.habits ?? [],
          completions: prev?.completions ?? [],
          summaries: prev?.summaries ?? [],
          updatedAt: new Date().toISOString(),
        }));
      }
    },
    [user, isLocalMode, settings]
  );

  const setLocalSettingsWithTheme = useCallback(
    (nextSettings: UserSettings) => {
      setSettings(nextSettings);
      if (nextSettings.theme === 'light' || nextSettings.theme === 'dark') {
        setThemePreview(nextSettings.theme);
      }
      if (user) {
        offlineDb.patchSnapshot(user.id, (prev) => ({
          userId: user.id,
          email: user.email || prev?.email || '',
          isLocalOnly: isLocalMode,
          profile: prev?.profile ?? profile,
          settings: nextSettings,
          habits: prev?.habits ?? [],
          completions: prev?.completions ?? [],
          summaries: prev?.summaries ?? [],
          updatedAt: new Date().toISOString(),
        }));
      }
    },
    [setThemePreview, user, isLocalMode, profile]
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        settings,
        uploadedPhotos,
        loading,
        schemaMissing: setupIssue !== null,
        setupIssue,
        isPasswordRecovery,
        isOnline,
        isLocalMode,
        pendingSyncCount,
        syncing,
        timezone,
        todayStr,
        theme,
        setThemePreview,
        enterLocalMode,
        addUploadedPhoto,
        removeUploadedPhoto,
        refreshSyncCount: () =>
          user ? refreshSyncCountForUser(user.id) : Promise.resolve(),
        syncNow,
        clearPasswordRecovery,
        refreshProfile,
        setLocalProfile: setLocalProfilePersisted,
        setLocalSettings: setLocalSettingsWithTheme,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
