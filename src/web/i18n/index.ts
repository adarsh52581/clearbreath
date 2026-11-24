import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { Language } from '../../shared/schemas.js';
import { en, type Messages } from './en.js';
import { hi } from './hi.js';

export type { Messages };

interface I18nContextValue {
  readonly lang: Language;
  readonly setLang: (lang: Language) => void;
  readonly t: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  readonly initialLang?: Language;
  readonly children: ReactNode;
}

export function I18nProvider({
  initialLang = 'en',
  children,
}: I18nProviderProps): ReactElement {
  const [lang, setLangState] = useState<Language>(initialLang);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const value: I18nContextValue = {
    lang,
    setLang,
    t: lang === 'hi' ? hi : en,
  };

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside an I18nProvider');
  }
  return ctx;
}

export function LanguageToggle(): ReactElement {
  const { lang, setLang, t } = useI18n();
  const nextLang: Language = lang === 'en' ? 'hi' : 'en';
  const buttonText = lang === 'en' ? t.app.switchToHindi : t.app.switchToEnglish;

  return createElement(
    'button',
    {
      type: 'button',
      onClick: () => setLang(nextLang),
      'aria-label': `${t.app.languageLabel}: ${buttonText}`,
      className:
        'min-h-11 min-w-11 px-4 py-2 rounded-md border border-ink-muted bg-surface text-ink text-sm font-semibold hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
    },
    buttonText,
  );
}
