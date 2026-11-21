import { ArrowLeft, Eye, EyeOff, Flame, Lock, Mail, Monitor, Moon, Sun, User } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState } from 'react';
import { NeumorphicCard } from '../components/ui/NeumorphicCard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatSupabaseError } from '../lib/supabase';
import { authService } from '../services/authService';

type AuthMode = 'login' | 'signup' | 'forgot' | 'update-password';

export function AuthPage() {
  const {
    isPasswordRecovery,
    clearPasswordRecovery,
    theme,
    setThemePreview,
    enterLocalMode,
  } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<AuthMode>(
    isPasswordRecovery ? 'update-password' : 'login'
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  const activeMode = isPasswordRecovery ? 'update-password' : mode;

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoNotice(null);

    if (activeMode === 'signup') {
      if (fullName.trim().length < 2) {
        setFormError('Please enter your name (at least 2 characters).');
        return;
      }
      if (!validateEmail(email)) {
        setFormError('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setFormError('Password must be at least 6 characters.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await authService.signUp({ fullName, email, password });
        if (res.session) {
          showToast('Welcome to Track me!', 'success');
        } else {
          setInfoNotice(
            'Account created! Please check your email inbox and click the confirmation link before logging in.'
          );
          setMode('login');
        }
      } catch (err) {
        setFormError(formatSupabaseError(err, 'Unable to create account'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (activeMode === 'login') {
      if (!validateEmail(email)) {
        setFormError('Please enter a valid email address.');
        return;
      }
      if (!password) {
        setFormError('Please enter your password.');
        return;
      }
      setSubmitting(true);
      try {
        await authService.signIn({ email, password });
        showToast('Signed in successfully', 'success');
      } catch (err) {
        setFormError(formatSupabaseError(err, 'Invalid credentials'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (activeMode === 'forgot') {
      if (!validateEmail(email)) {
        setFormError('Please enter your account email address.');
        return;
      }
      setSubmitting(true);
      try {
        await authService.resetPasswordForEmail(email);
        setInfoNotice(
          'Password reset instructions have been sent to your email if an account exists.'
        );
      } catch (err) {
        setFormError(formatSupabaseError(err, 'Could not send reset email'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (activeMode === 'update-password') {
      if (password.length < 6) {
        setFormError('New password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
      setSubmitting(true);
      try {
        await authService.updatePassword(password);
        showToast('Password updated successfully', 'success');
        clearPasswordRecovery();
        setMode('login');
      } catch (err) {
        setFormError(formatSupabaseError(err, 'Could not update password'));
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-[var(--bg-canvas)] px-4 py-10">
      <button
        type="button"
        onClick={() => setThemePreview(theme === 'dark' ? 'light' : 'dark')}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        className="neu-button fixed right-4 top-4 z-20 flex min-h-[42px] items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
      >
        {theme === 'dark' ? (
          <>
            <Sun size={15} className="text-[#12C5DF]" />
            <span>Light Mode</span>
          </>
        ) : (
          <>
            <Moon size={15} className="text-[#A64BEA]" />
            <span>Dark Mode</span>
          </>
        )}
      </button>
      <div className="grid w-full max-w-4xl grid-cols-1 items-center gap-8 lg:grid-cols-12">
        {/* Brand Showcase Column */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-6 lg:col-span-6"
        >
          <div className="flex items-center gap-3.5">
            <div className="neu-card flex h-14 w-14 items-center justify-center rounded-2xl text-[#12C5DF]">
              <Flame size={28} fill="currentColor" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                Track me
              </h1>
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Daily Habits · Streaks · Analytics
              </p>
            </div>
          </div>

          <h2 className="font-display text-3xl font-bold leading-tight text-[var(--text-primary)] sm:text-4xl">
            Build unbreakable daily momentum.
          </h2>

          <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
            Track daily rituals with tactile precision, protect your active streaks across timezones, and uncover monthly consistency trends.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <NeumorphicCard variant="raised-sm" className="p-4 text-center">
              <p className="font-display text-xl font-bold text-[#12C5DF] tabular-nums">
                100%
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Daily Rings
              </p>
            </NeumorphicCard>
            <NeumorphicCard variant="raised-sm" className="p-4 text-center">
              <p className="font-display text-xl font-bold text-[#A64BEA] tabular-nums">
                30d+
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Streak Milestones
              </p>
            </NeumorphicCard>
            <NeumorphicCard variant="raised-sm" className="p-4 text-center">
              <p className="font-display text-xl font-bold text-[var(--text-primary)] tabular-nums">
                12 mo
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Heatmaps
              </p>
            </NeumorphicCard>
          </div>
        </motion.div>

        {/* Auth Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="lg:col-span-6"
        >
          <NeumorphicCard className="p-6 sm:p-8">
            {/* Mode Switcher */}
            {(activeMode === 'login' || activeMode === 'signup') && (
              <div className="neu-inset mb-6 grid grid-cols-2 gap-1.5 rounded-2xl p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setFormError(null);
                  }}
                  className={`min-h-[42px] rounded-xl text-sm font-semibold transition-all ${
                    activeMode === 'login'
                      ? 'bg-[#12C5DF] text-[#0D1117] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setFormError(null);
                  }}
                  className={`min-h-[42px] rounded-xl text-sm font-semibold transition-all ${
                    activeMode === 'signup'
                      ? 'bg-[#12C5DF] text-[#0D1117] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            {(activeMode === 'forgot' || activeMode === 'update-password') && (
              <div className="mb-6 flex items-center gap-3">
                {activeMode === 'forgot' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setFormError(null);
                      setInfoNotice(null);
                    }}
                    aria-label="Back to login"
                    className="neu-button flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)]"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                <div>
                  <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                    {activeMode === 'forgot'
                      ? 'Reset Password'
                      : 'Set New Password'}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {activeMode === 'forgot'
                      ? 'Receive a recovery link via email'
                      : 'Choose a strong password for your account'}
                  </p>
                </div>
              </div>
            )}

            {formError && (
              <div
                role="alert"
                className="neu-inset mb-5 rounded-2xl px-4 py-3 text-xs font-medium text-[#F43F5E]"
              >
                {formError}
              </div>
            )}

            {infoNotice && (
              <div
                role="status"
                className="neu-inset mb-5 rounded-2xl px-4 py-3 text-xs font-medium text-[#12C5DF]"
              >
                {infoNotice}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {activeMode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Full Name
                  </label>
                  <div className="neu-inset flex items-center gap-3 rounded-2xl px-4 py-3">
                    <User size={17} className="shrink-0 text-[var(--text-muted)]" />
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Mercer"
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {activeMode !== 'update-password' && (
                <div>
                  <label
                    htmlFor="auth-email"
                    className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Email Address
                  </label>
                  <div className="neu-inset flex items-center gap-3 rounded-2xl px-4 py-3">
                    <Mail size={17} className="shrink-0 text-[var(--text-muted)]" />
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {activeMode !== 'forgot' && (
                <div>
                  <label
                    htmlFor="auth-password"
                    className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    {activeMode === 'update-password' ? 'New Password' : 'Password'}
                  </label>
                  <div className="neu-inset flex items-center gap-3 rounded-2xl px-4 py-3">
                    <Lock size={17} className="shrink-0 text-[var(--text-muted)]" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={
                        activeMode === 'signup' ? 'new-password' : 'current-password'
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
              )}

              {activeMode === 'update-password' && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Confirm New Password
                  </label>
                  <div className="neu-inset flex items-center gap-3 rounded-2xl px-4 py-3">
                    <Lock size={17} className="shrink-0 text-[var(--text-muted)]" />
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {activeMode === 'login' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setFormError(null);
                      setInfoNotice(null);
                    }}
                    className="text-xs font-medium text-[#12C5DF] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-[#12C5DF] to-[#0EA5C6] px-5 py-3 text-sm font-bold text-[#0D1117] shadow-[0_8px_22px_rgba(18,197,223,0.35)] transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {submitting
                  ? 'Please wait...'
                  : activeMode === 'login'
                    ? 'Sign In'
                    : activeMode === 'signup'
                      ? 'Create Account'
                      : activeMode === 'forgot'
                        ? 'Send Reset Link'
                        : 'Update Password'}
              </button>
            </form>

            {(activeMode === 'login' || activeMode === 'signup') && (
              <div className="mt-5 border-t border-[var(--border-hairline)] pt-5">
                <button
                  type="button"
                  onClick={async () => {
                    await enterLocalMode(fullName.trim() || 'Desktop User');
                    showToast('Offline Desktop Mode active — all data saved locally', 'success');
                  }}
                  className="neu-button flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)]"
                >
                  <Monitor size={15} className="text-[#12C5DF]" />
                  <span>Continue Offline (Desktop Mode)</span>
                </button>
              </div>
            )}
          </NeumorphicCard>
        </motion.div>
      </div>
    </div>
  );
}
