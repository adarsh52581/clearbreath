import { Fragment, useId, useMemo, type ReactElement } from 'react';
import {
  Activity,
  BookOpen,
  Calculator,
  Cloud,
  Compass,
  HelpCircle,
  Upload,
} from 'lucide-react';
import type { Fact, FactKind } from '../../shared/schemas.js';
import { useI18n } from '../i18n/index.js';

const PLACEHOLDER_REGEX = /(\{\{[a-z0-9_]+\}\})/g;
const EXACT_PLACEHOLDER_REGEX = /^\{\{([a-z0-9_]+)\}\}$/;

const warnedUnknownFactIds = new Set<string>();

export function resetUnknownFactWarnings(): void {
  warnedUnknownFactIds.clear();
}

function KindIcon({ kind }: { readonly kind: FactKind }): ReactElement {
  const cls = 'inline w-3.5 h-3.5 text-ink-muted shrink-0';
  switch (kind) {
    case 'measured':
      return <Activity className={cls} aria-hidden="true" />;
    case 'forecast':
      return <Cloud className={cls} aria-hidden="true" />;
    case 'computed':
      return <Calculator className={cls} aria-hidden="true" />;
    case 'reference':
      return <BookOpen className={cls} aria-hidden="true" />;
    case 'guidance':
      return <Compass className={cls} aria-hidden="true" />;
    case 'uploaded':
      return <Upload className={cls} aria-hidden="true" />;
    case 'assumption':
    default:
      return <HelpCircle className={cls} aria-hidden="true" />;
  }
}

export interface FactValueProps {
  readonly fact: Fact;
}

export function FactValue({ fact }: FactValueProps): ReactElement {
  const { t } = useI18n();
  const descId = useId();
  const kindLabel = t.facts.kinds[fact.kind];
  const tooltip = `${kindLabel}: ${fact.provenance}`;

  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 font-semibold text-ink border border-surface-2"
      title={tooltip}
      aria-describedby={descId}
    >
      <KindIcon kind={fact.kind} />
      <span>{fact.display}</span>
      <span className="sr-only"> ({kindLabel})</span>
      <span id={descId} className="sr-only">
        {tooltip}
      </span>
    </span>
  );
}

export interface GroundedTextProps {
  readonly text: string;
  readonly facts: readonly Fact[];
  readonly className?: string;
}

export function GroundedText({ text, facts, className }: GroundedTextProps): ReactElement {
  const { t } = useI18n();

  const factMap = useMemo(() => {
    const map = new Map<string, Fact>();
    for (const f of facts) {
      map.set(f.id, f);
    }
    return map;
  }, [facts]);

  const segments = text.split(PLACEHOLDER_REGEX);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (!segment) return null;
        const match = EXACT_PLACEHOLDER_REGEX.exec(segment);
        if (!match) {
          return <Fragment key={index}>{segment}</Fragment>;
        }
        const factId = match[1]!;
        const fact = factMap.get(factId);
        if (!fact) {
          if (!warnedUnknownFactIds.has(factId)) {
            warnedUnknownFactIds.add(factId);
            console.warn(`Unknown fact placeholder: {{${factId}}}`);
          }
          return (
            <span key={index} title={`Unknown fact: ${factId}`}>
              {t.facts.unknownValue}
            </span>
          );
        }
        return <FactValue key={index} fact={fact} />;
      })}
    </span>
  );
}
