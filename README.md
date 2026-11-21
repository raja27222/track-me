# Track me — Dark Neumorphic Habit & Streak Tracker

A full-stack habit tracking application built with React, TypeScript, Tailwind CSS, Framer Motion, Recharts, and Supabase (PostgreSQL + Auth + Row Level Security).

## Features

- **Dark Neumorphic Design**: Charcoal `#202328` canvas, raised/inset soft-shadow surfaces, electric cyan (`#12C5DF`) and violet (`#A64BEA`) accents, plus an optional Light Neumorphism theme in Settings.
- **Authentication**: Email/password sign up, sign in, password visibility toggle, forgot password, password recovery, persistent sessions, and strict user data isolation via Supabase RLS.
- **Home Dashboard**: User greeting & avatar, interactive weekly date strip, large animated circular daily progress ring, live streak counter, and tactile daily goal list with optimistic UI updates and rollback.
- **Habit Management**: Create, edit, pause, archive, and delete habits with custom icons, categories, colors, daily numeric targets, start dates, and daily or custom-weekday schedules.
- **Timezone-Aware Streak Engine**: Computes current streak, longest streak, total successful days, milestone celebrations (7, 14, 30, 60, 100 days), and streak history from stored daily snapshots (`daily_summaries`) so editing or deleting habits never rewrites historical completion records.
- **Statistics & Calendar**: Top KPI cards, interactive Recharts weekly activity bar chart, monthly breakdown with previous-month comparison, best/least consistent habit rankings, daily activity heatmap, and interactive monthly calendar with per-day completion history.

## Project Structure

- `database/migrations/` — Idempotent PostgreSQL schema, triggers, transactional RPC, indexes, and RLS policies
- `src/components/` — Reusable UI, dashboard, habit form, statistics, calendar, and setup components
- `src/contexts/` — `AuthContext` and `ToastContext`
- `src/hooks/` — `useHabits` hook with optimistic updates and rollback
- `src/layouts/` — `AppLayout` with 5-item bottom navigation and central floating `+` button
- `src/lib/` — Supabase client and domain constants
- `src/pages/` — `AuthPage`, `DashboardPage`, `StatisticsPage`, `CalendarPage`, `ProfilePage`
- `src/services/` — Isolated Supabase API and analytics services
- `src/types/` — Shared TypeScript interfaces
- `src/utils/` — Timezone-aware date utilities and deterministic streak calculation engine

## Setup & Installation

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in your Supabase project URL and public publishable/anon key:

   ```env
   VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
   VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
   ```

3. **Apply the Supabase database migration**

   Open your Supabase project's **SQL Editor**, paste the contents of `database/migrations/001_initial_schema.sql`, and run it. This creates:
   - `profiles`, `habits`, `habit_completions`, `daily_summaries`, and `user_settings`
   - Unique constraints (`(habit_id, completion_date)`, `(user_id, summary_date)`)
   - Indexes and `updated_at` triggers
   - `handle_new_user()` trigger to provision `profiles` and `user_settings` on signup
   - `toggle_habit_completion_tx()` transactional RPC
   - Strict Row Level Security (RLS) policies on every table

   *Note:* In **Authentication -> Providers -> Email** inside your Supabase Dashboard, you can disable "Confirm email" if you want new accounts to sign in immediately without email verification.

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Build for production**

   ```bash
   npm run build
   ```
