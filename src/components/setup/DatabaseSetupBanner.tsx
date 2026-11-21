import { Check, Copy, Database, RefreshCw, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import migrationSql from '../../../database/migrations/001_initial_schema.sql?raw';
import permissionsSql from '../../../database/migrations/002_grant_permissions.sql?raw';
import { useToast } from '../../contexts/ToastContext';
import type { DatabaseSetupIssue } from '../../lib/supabase';
import { NeumorphicCard } from '../ui/NeumorphicCard';

interface DatabaseSetupBannerProps {
  issue?: DatabaseSetupIssue;
  onVerify: () => Promise<void>;
}

export function DatabaseSetupBanner({
  issue = 'missing_tables',
  onVerify,
}: DatabaseSetupBannerProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const isPermissionIssue = issue === 'permission_denied';
  const sqlToCopy = isPermissionIssue ? permissionsSql : migrationSql;

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(sqlToCopy);
      setCopied(true);
      showToast(
        isPermissionIssue
          ? 'Permission & backfill SQL copied to clipboard'
          : 'Schema migration SQL copied to clipboard',
        'success'
      );
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Copy the SQL from database/migrations/ in the project.', 'info');
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await onVerify();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <NeumorphicCard className="mb-6 border border-[#F43F5E]/40 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="neu-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#F43F5E]">
            {isPermissionIssue ? <ShieldAlert size={22} /> : <Database size={22} />}
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
              {isPermissionIssue
                ? 'Grant Supabase Table Permissions (42501 Fix)'
                : 'Initialize Supabase Database Tables'}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              {isPermissionIssue
                ? 'Your tables exist in Supabase, but the authenticated role does not yet have table privileges granted. Copy the GRANT & backfill SQL below, run it once in Supabase SQL Editor, then click Verify.'
                : 'Your Supabase project is connected, but the PostgreSQL tables have not been created yet. Copy the SQL migration and run it once in your Supabase SQL Editor.'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopySql}
            className="neu-button flex min-h-[42px] items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold text-[var(--text-primary)]"
          >
            {copied ? <Check size={15} className="text-[#12C5DF]" /> : <Copy size={15} />}
            <span>
              {copied
                ? 'Copied SQL'
                : isPermissionIssue
                  ? 'Copy Permission Fix SQL'
                  : 'Copy Migration SQL'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="flex min-h-[42px] items-center gap-2 rounded-2xl bg-[#12C5DF] px-4 py-2 text-xs font-semibold text-[#0D1117] shadow-[0_4px_16px_rgba(18,197,223,0.3)] disabled:opacity-60"
          >
            <RefreshCw size={15} className={verifying ? 'animate-spin' : ''} />
            <span>{verifying ? 'Checking...' : 'Verify'}</span>
          </button>
        </div>
      </div>
    </NeumorphicCard>
  );
}
