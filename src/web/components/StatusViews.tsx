import type { ReactElement } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { WarningCode } from '../../shared/schemas.js';
import { useI18n } from '../i18n/index.js';

export function LoadingSkeleton(): ReactElement {
  const { t } = useI18n();

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t.status.loadingLabel}
      className="space-y-4"
    >
      <div className="h-16 rounded-lg bg-surface-2 animate-pulse motion-reduce:animate-none" />
      <div className="h-40 rounded-lg bg-surface-2 animate-pulse motion-reduce:animate-none" />
      <div className="h-32 rounded-lg bg-surface-2 animate-pulse motion-reduce:animate-none" />
      <span className="sr-only">{t.status.loadingLabel}</span>
    </div>
  );
}

export interface ErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps): ReactElement {
  const { t } = useI18n();

  return (
    <section
      role="alert"
      className="rounded-lg border border-danger bg-surface p-5 space-y-3"
    >
      <h2 className="text-base font-bold text-danger">{t.status.errorTitle}</h2>
      <p className="text-sm text-ink">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 px-4 py-2 rounded-md bg-accent text-surface text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{t.status.retry}</span>
      </button>
    </section>
  );
}

export interface WarningBannersProps {
  readonly warnings: readonly { readonly code: WarningCode; readonly message: string }[];
}

export function WarningBanners({ warnings }: WarningBannersProps): ReactElement | null {
  const { t } = useI18n();

  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {warnings.map((w) => (
        <div
          key={w.code}
          role="note"
          className="rounded-md border border-ink-muted bg-surface-2 px-4 py-3 flex items-start gap-2.5 text-sm text-warning-ink"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>{t.status.warnings[w.code]}</p>
        </div>
      ))}
    </div>
  );
}
