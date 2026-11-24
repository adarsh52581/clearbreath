// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, LanguageToggle, useI18n } from './index.js';

function SampleConsumer() {
  const { t } = useI18n();
  return <h1>{t.app.headline}</h1>;
}

describe('i18n and LanguageToggle', () => {
  it('switches UI strings and updates <html lang>', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <LanguageToggle />
        <SampleConsumer />
      </I18nProvider>,
    );

    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Cleaner-air decisions for your family',
    );

    await user.click(screen.getByRole('button', { name: /हिन्दी/i }));
    expect(document.documentElement.lang).toBe('hi');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'आपके परिवार के लिए स्वच्छ हवा के निर्णय',
    );

    await user.click(screen.getByRole('button', { name: /English/i }));
    expect(document.documentElement.lang).toBe('en');
  });
});
