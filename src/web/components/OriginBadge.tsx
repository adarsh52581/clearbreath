import type { ReactElement } from 'react';
import { formatIstTime } from '../../domain/format.js';
import type { ResponseMeta } from '../../shared/schemas.js';
import { useI18n } from '../i18n/index.js';

export function OriginBadge({ meta }: { readonly meta: ResponseMeta }): ReactElement {
  const { t } = useI18n();
  if (meta.origin === 'gemini') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-accent bg-surface text-accent text-xs font-semibold">
        {t.plan.origin.gemini}
      </span>
    );
  }
  if (meta.origin === 'cache' || meta.origin === 'last-good') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-ink-muted bg-surface text-ink text-xs font-semibold">
        {t.plan.origin.savedPrefix} {formatIstTime(meta.generatedAtUtc)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-ink-muted bg-surface text-warning-ink text-xs font-semibold">
      {t.plan.origin.fallback}
    </span>
  );
}
