import type { ReactElement } from 'react';

export default function App(): ReactElement {
  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-surface focus:text-accent focus:ring-2 focus:ring-focus"
      >
        Skip to main content
      </a>
      <header className="border-b border-surface-2 px-6 py-4">
        <span className="text-xl font-bold tracking-tight">ClearBreath</span>
      </header>
      <main id="main" className="flex-1 max-w-4xl mx-auto px-6 py-8 w-full">
        <h1 className="text-3xl font-extrabold tracking-tight mb-4">
          Cleaner-air decisions for your family
        </h1>
        <p className="text-ink-muted text-base leading-relaxed">
          ClearBreath helps families in Indian cities make evidence-backed decisions to reduce air
          pollution exposure.
        </p>
      </main>
      <footer className="border-t border-surface-2 px-6 py-6 bg-surface-2 text-ink-muted text-sm">
        <h2 className="text-sm font-semibold mb-2">Data sources</h2>
        <p>Air quality measurements and forecasts from authoritative providers.</p>
      </footer>
    </div>
  );
}
