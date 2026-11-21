import { BarChart3, Calendar, Home, Plus, User } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

export type NavTab = 'home' | 'statistics' | 'calendar' | 'profile';

interface AppLayoutProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAddHabit: () => void;
  children: React.ReactNode;
}

export function AppLayout({
  activeTab,
  onSelectTab,
  onOpenAddHabit,
  children,
}: AppLayoutProps) {
  const navButtonClass = (tab: NavTab) => {
    const isActive = activeTab === tab;
    return `flex min-h-[48px] min-w-[52px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
      isActive
        ? 'text-[#12C5DF]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
    }`;
  };

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        {children}
      </main>

      {/* Bottom 5-Item Navigation Dock with Central Floating Plus Button */}
      <nav
        aria-label="Primary navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:bottom-5 md:left-1/2 md:right-auto md:w-full md:max-w-md md:-translate-x-1/2"
      >
        <div className="neu-card relative grid grid-cols-5 items-center rounded-t-3xl px-2 py-2 md:rounded-3xl md:px-4">
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            aria-current={activeTab === 'home' ? 'page' : undefined}
            className={navButtonClass('home')}
          >
            <Home size={20} strokeWidth={activeTab === 'home' ? 2.4 : 1.9} />
            <span className="text-[10px] font-semibold">Home</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('statistics')}
            aria-current={activeTab === 'statistics' ? 'page' : undefined}
            className={navButtonClass('statistics')}
          >
            <BarChart3 size={20} strokeWidth={activeTab === 'statistics' ? 2.4 : 1.9} />
            <span className="text-[10px] font-semibold">Statistics</span>
          </button>

          {/* Central Floating Plus Button */}
          <div className="flex items-center justify-center">
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={onOpenAddHabit}
              aria-label="Create new habit"
              className="neu-fab -mt-7 flex h-14 w-14 items-center justify-center rounded-2xl text-[#0D1117] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#12C5DF]"
            >
              <Plus size={26} strokeWidth={2.8} />
            </motion.button>
          </div>

          <button
            type="button"
            onClick={() => onSelectTab('calendar')}
            aria-current={activeTab === 'calendar' ? 'page' : undefined}
            className={navButtonClass('calendar')}
          >
            <Calendar size={20} strokeWidth={activeTab === 'calendar' ? 2.4 : 1.9} />
            <span className="text-[10px] font-semibold">Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            aria-current={activeTab === 'profile' ? 'page' : undefined}
            className={navButtonClass('profile')}
          >
            <User size={20} strokeWidth={activeTab === 'profile' ? 2.4 : 1.9} />
            <span className="text-[10px] font-semibold">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
