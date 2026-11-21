import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://cnjaeefipoypiisngfgm.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_5ohJ6hSj0jggG3lDPpTBwg_r6vzcEDx';

function cleanEnvValue(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^["']|["']$/g, '').trim();
}

function resolveSupabaseUrl(raw: unknown): string {
  const cleaned = cleanEnvValue(raw);
  if (!cleaned || cleaned.includes('YOUR_') || cleaned.includes('MY_')) {
    return DEFAULT_SUPABASE_URL;
  }

  // If a bare Supabase project ID was provided (e.g. "cnjaeefipoypiisngfgm")
  const candidate = /^[a-z0-9-]+$/i.test(cleaned)
    ? `https://${cleaned}.supabase.co`
    : cleaned;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // Fall through to default URL
  }
  return DEFAULT_SUPABASE_URL;
}

function resolveSupabaseAnonKey(raw: unknown): string {
  const cleaned = cleanEnvValue(raw);
  if (!cleaned || cleaned.includes('YOUR_') || cleaned.includes('MY_')) {
    return DEFAULT_SUPABASE_ANON_KEY;
  }
  return cleaned;
}

const supabaseUrl = resolveSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = resolveSupabaseAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const SUPABASE_PROJECT_URL = supabaseUrl;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type DatabaseSetupIssue = 'missing_tables' | 'permission_denied' | null;

export function detectDatabaseSetupIssue(error: unknown): DatabaseSetupIssue {
  if (!error || typeof error !== 'object') return null;
  const err = error as { code?: string; message?: string };
  if (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    (typeof err.message === 'string' &&
      (err.message.includes('Could not find the table') ||
        err.message.includes('does not exist')))
  ) {
    return 'missing_tables';
  }
  if (
    err.code === '42501' ||
    (typeof err.message === 'string' &&
      err.message.toLowerCase().includes('permission denied'))
  ) {
    return 'permission_denied';
  }
  return null;
}

export function isSchemaMissingError(error: unknown): boolean {
  return detectDatabaseSetupIssue(error) !== null;
}

export function formatSupabaseError(error: unknown, fallback = 'Something went wrong'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    const msg = (error as { message: string }).message;
    if (msg.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (msg.includes('Email not confirmed')) {
      return 'Please confirm your email address using the link sent to your inbox before signing in.';
    }
    if (msg.includes('User already registered')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (msg.toLowerCase().includes('permission denied')) {
      return 'Database permission denied (42501). Run the GRANT permissions SQL script in Supabase SQL Editor.';
    }
    return msg;
  }
  return fallback;
}
