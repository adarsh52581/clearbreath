import type { ReactElement, ReactNode } from 'react';
import { LanguageToggle, useI18n } from '../i18n/index.js';

export interface LayoutProps {
  readonly children: ReactNode;
}

export function Layout({ children }: LayoutProps): ReactElement {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-surface focus:text-accent focus:ring-2 focus:ring-focus rounded-md"
      >
        {t.app.skipToContent}
      </a>
      <header className="border-b border-surface-2 px-4 sm:px-6 py-3 bg-surface">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <span className="text-xl font-bold tracking-tight text-ink">{t.app.name}</span>
          <LanguageToggle />
        </div>
      </header>
      <main id="main" className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full">
        {children}
      </main>
      <footer className="border-t border-surface-2 px-4 sm:px-6 py-6 bg-surface-2 text-ink-muted text-sm">
        <div className="max-w-4xl mx-auto grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-ink mb-2">
              {t.footer.dataSourcesHeading}
            </h2>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>{t.footer.openAqAttribution}</li>
              <li>{t.footer.forecastAttribution}</li>
              <li>{t.footer.aqiMethod}</li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink mb-2">
              {t.footer.howNumbersHeading}
            </h2>
            <p className="leading-relaxed">{t.footer.howNumbersNote}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
