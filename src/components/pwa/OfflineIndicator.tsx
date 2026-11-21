import { RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function OfflineIndicator() {
  const { isOnline, pendingSyncCount, isLocalMode, syncNow, syncing } = useAuth();

  if (isOnline && pendingSyncCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-4 z-40 flex items-center gap-2.5 rounded-2xl border border-[#F59E0B]/40 bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] shadow-lg md:bottom-6">
      {!isOnline ? (
        <>
          <WifiOff size={14} className="shrink-0 text-[#F59E0B]" />
          <span>
            Offline Mode
            {pendingSyncCount > 0 ? ` · ${pendingSyncCount} queued` : ' · Local data active'}
          </span>
        </>
      ) : (
        <>
          <span>
            {isLocalMode
              ? 'Local Offline Profile'
              : `${pendingSyncCount} pending sync`}
          </span>
          {!isLocalMode && (
            <button
              type="button"
              onClick={syncNow}
              disabled={syncing}
              className="flex items-center gap-1 rounded-xl bg-[#12C5DF] px-2.5 py-1 text-[11px] font-semibold text-[#0D1117]"
            >
              <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing' : 'Sync'}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
