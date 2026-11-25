// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Fact } from '../../shared/schemas.js';
import { expectNoA11yViolations } from '../../test/a11y.js';
import { I18nProvider } from '../i18n/index.js';
import { GroundedText, resetUnknownFactWarnings } from './GroundedText.js';

const sampleFacts: Fact[] = [
  {
    id: 'act_a1_best_window',
    label: 'Cleanest window',
    value: '14:00–15:00 IST',
    display: '14:00–15:00 IST',
    kind: 'forecast',
    provenance: 'Open-Meteo (CAMS model)',
  },
  {
    id: 'act_a1_best_pm25',
    label: 'Cleanest PM2.5',
    value: 95,
    unit: 'µg/m³',
    display: '95 µg/m³',
    kind: 'forecast',
    provenance: 'Open-Meteo (CAMS model)',
  },
];

function renderGrounded(text: string, facts: readonly Fact[] = sampleFacts) {
  return render(
    <I18nProvider>
      <GroundedText text={text} facts={facts} />
    </I18nProvider>,
  );
}

describe('GroundedText', () => {
  beforeEach(() => {
    resetUnknownFactWarnings();
  });

  it('replaces known placeholders with FactValue including kind and provenance', async () => {
    const { container } = renderGrounded(
      'Move park play to {{act_a1_best_window}} when PM2.5 is {{act_a1_best_pm25}}.',
    );

    expect(screen.getByText('14:00–15:00 IST')).toBeInTheDocument();
    expect(screen.getByText('95 µg/m³')).toBeInTheDocument();
    expect(screen.getAllByText('(Forecast (model))')).toHaveLength(2);
    expect(screen.getAllByText('Forecast (model): Open-Meteo (CAMS model)')).toHaveLength(2);

    await expectNoA11yViolations(container);
  });

  it('handles adjacent placeholders cleanly', () => {
    renderGrounded('{{act_a1_best_window}}{{act_a1_best_pm25}}');

    expect(screen.getByText('14:00–15:00 IST')).toBeInTheDocument();
    expect(screen.getByText('95 µg/m³')).toBeInTheDocument();
  });

  it('renders em-dash and warns once for unknown fact ids', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderGrounded('Value is {{missing_fact}} and again {{missing_fact}}.');

    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('Unknown fact placeholder: {{missing_fact}}');

    warnSpy.mockRestore();
  });

  it('renders <script> tags as literal plain text without executing', () => {
    const { container } = renderGrounded('Hello <script>alert(1)</script> {{act_a1_best_pm25}}');

    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(screen.getByText('95 µg/m³')).toBeInTheDocument();
  });
});
