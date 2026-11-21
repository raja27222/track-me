import { Download, Monitor, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Install Desktop App"
        title="Install Track me as an offline desktop app"
        className={`neu-button flex items-center gap-2 rounded-2xl text-xs font-semibold text-[#12C5DF] ${
          compact ? 'h-12 px-3.5' : 'min-h-[44px] px-4 py-2.5'
        }`}
      >
        {isInstallable ? <Download size={16} /> : <Monitor size={16} />}
        <span className={compact ? 'hidden sm:inline' : ''}>
          {isInstallable ? 'Install App' : 'Desktop App'}
        </span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="neu-card relative w-full max-w-sm rounded-3xl p-6">
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              aria-label="Close install instructions"
              className="neu-button absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)]"
            >
              <X size={16} />
            </button>

            <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Install Track me Desktop App
            </h3>
            {isIOS ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                1. Tap the <strong>Share</strong> button in Safari.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                To run Track me as a standalone offline desktop window, click the{' '}
                <strong>Install</strong> icon in your browser&apos;s address bar (Chrome / Edge) or open browser menu → <strong>Install Track me</strong>.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 min-h-[44px] w-full rounded-2xl bg-[#12C5DF] px-4 py-2.5 text-sm font-semibold text-[#0D1117]"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
