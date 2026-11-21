import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { MilestoneModal } from './components/dashboard/MilestoneModal';
import { HabitFormModal } from './components/habits/HabitFormModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { DatabaseSetupBanner } from './components/setup/DatabaseSetupBanner';
import { ToastContainer } from './components/ui/ToastContainer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { useHabits } from './hooks/useHabits';
import { AppLayout, type NavTab } from './layouts/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { CalendarPage } from './pages/CalendarPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { StatisticsPage } from './pages/StatisticsPage';
import type { Habit, HabitFormInput } from './types/database';

function AuthenticatedShell() {
  const {
    setupIssue: authSetupIssue,
    refreshProfile,
    todayStr,
    isPasswordRecovery,
  } = useAuth();
  const {
    habits,
    completions,
    streakMetrics,
    loading,
    setupIssue: habitsSetupIssue,
    celebratedMilestone,
    dismissMilestone,
    refresh,
    toggleCompletion,
    createHabit,
    createStarterPack,
    updateHabit,
    changeHabitStatus,
    deleteHabit,
    applyImportedData,
  } = useHabits();

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedDashboardDate, setSelectedDashboardDate] = useState(todayStr);
  const [calendarFocusDate, setCalendarFocusDate] = useState<string | undefined>(
    undefined
  );
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  useEffect(() => {
    setSelectedDashboardDate(todayStr);
  }, [todayStr]);

  if (isPasswordRecovery) {
    return <AuthPage />;
  }

  const activeSetupIssue = authSetupIssue || habitsSetupIssue;

  const handleVerifySchema = async () => {
    await refreshProfile();
    await refresh();
  };

  const handleOpenCreate = () => {
    setEditingHabit(null);
    setHabitModalOpen(true);
  };

  const handleOpenEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setHabitModalOpen(true);
  };

  const handleSubmitHabit = async (input: HabitFormInput) => {
    if (editingHabit) {
      await updateHabit(editingHabit.id, input);
    } else {
      await createHabit(input);
    }
  };

  const handlePauseToggle = async (habit: Habit) => {
    const nextStatus = habit.status === 'paused' ? 'active' : 'paused';
    await changeHabitStatus(habit.id, nextStatus);
  };

  return (
    <AppLayout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onOpenAddHabit={handleOpenCreate}
    >
      {activeSetupIssue && (
        <DatabaseSetupBanner issue={activeSetupIssue} onVerify={handleVerifySchema} />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
        >
          {activeTab === 'home' && (
            <DashboardPage
              habits={habits}
              completions={completions}
              streakMetrics={streakMetrics}
              loading={loading}
              selectedDate={selectedDashboardDate}
              onSelectDate={setSelectedDashboardDate}
              onToggleCompletion={toggleCompletion}
              onOpenCreateModal={handleOpenCreate}
              onOpenEditModal={handleOpenEdit}
              onPauseToggle={handlePauseToggle}
              onDeleteHabit={deleteHabit}
              onCreateStarterPack={createStarterPack}
              onGoToProfile={() => setActiveTab('profile')}
            />
          )}

          {activeTab === 'statistics' && (
            <StatisticsPage
              habits={habits}
              completions={completions}
              streakMetrics={streakMetrics}
              loading={loading}
              onSelectCalendarDate={(dateStr) => {
                setCalendarFocusDate(dateStr);
                setActiveTab('calendar');
              }}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarPage
              habits={habits}
              completions={completions}
              streakMetrics={streakMetrics}
              initialSelectedDate={calendarFocusDate}
              onToggleCompletion={toggleCompletion}
            />
          )}

          {activeTab === 'profile' && (
            <ProfilePage
              habits={habits}
              onEditHabit={handleOpenEdit}
              onChangeHabitStatus={changeHabitStatus}
              onDeleteHabit={deleteHabit}
              onApplyImportedData={applyImportedData}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <HabitFormModal
        open={habitModalOpen}
        initialHabit={editingHabit}
        defaultStartDate={todayStr}
        onClose={() => setHabitModalOpen(false)}
        onSubmit={handleSubmitHabit}
      />

      <MilestoneModal
        milestoneDays={celebratedMilestone}
        onClose={dismissMilestone}
      />
    </AppLayout>
  );
}

function RootRouter() {
  const { user, loading, isPasswordRecovery } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-canvas)]">
        <div className="neu-card flex h-20 w-20 items-center justify-center rounded-3xl">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#12C5DF] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!user || isPasswordRecovery) {
    return <AuthPage />;
  }

  return <AuthenticatedShell />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ToastContainer />
        <OfflineIndicator />
        <RootRouter />
      </AuthProvider>
    </ToastProvider>
  );
}
