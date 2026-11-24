// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Forecast } from '../../shared/schemas.js';
import { expectNoA11yViolations } from '../../test/a11y.js';
import { I18nProvider } from '../i18n/index.js';
import { ForecastChart } from './ForecastChart.js';

function make48hForecast(): Forecast {
  const baseMs = Date.parse('2026-11-24T00:00:00.000Z');
  const points = Array.from({ length: 48 }, (_, i) => ({
    timeUtc: new Date(baseMs + i * 3600_000).toISOString(),
    pm25: i === 5 ? 20 : i === 20 ? 280 : 80 + (i % 10),
    pm10: 120,
  }));

  return {
    source: {
      name: 'Open-Meteo (CAMS model)',
      url: 'https://open-meteo.com',
      kind: 'forecast',
      fetchedAtUtc: '2026-11-24T00:00:00.000Z',
    },
    points,
  };
}

describe('ForecastChart', () => {
  it('renders 48 bars, summary text, and 48 table rows', async () => {
    const { container } = render(
      <I18nProvider>
        <ForecastChart forecast={make48hForecast()} />
      </I18nProvider>,
    );

    const chart = screen.getByRole('img', { name: /48-hour hourly PM2\.5 forecast/i });
    expect(chart).toBeInTheDocument();
    expect(container.querySelectorAll('svg rect')).toHaveLength(48);

    expect(screen.getByText(/Cleanest expected: 10:30 IST/)).toBeInTheDocument();
    expect(screen.getByText(/Worst expected: 01:30 IST/)).toBeInTheDocument();

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(48);

    await expectNoA11yViolations(container);
  });

  it('renders unavailable state when forecast is null', async () => {
    const { container } = render(
      <I18nProvider>
        <ForecastChart forecast={null} />
      </I18nProvider>,
    );

    expect(screen.getByText(/Forecast data is currently unavailable/i)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
