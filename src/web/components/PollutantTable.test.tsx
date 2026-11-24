// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MeasuredAir } from '../../shared/schemas.js';
import { expectNoA11yViolations } from '../../test/a11y.js';
import { I18nProvider } from '../i18n/index.js';
import { PollutantTable } from './PollutantTable.js';

describe('PollutantTable', () => {
  it('renders latest and 24-h average values for PM2.5 and PM10', async () => {
    const fetchedAtUtc = '2026-11-24T12:00:00.000Z';
    const pm25Series = Array.from({ length: 16 }, (_, idx) => ({
      timeUtc: new Date(Date.parse(fetchedAtUtc) - idx * 3600_000).toISOString(),
      value: 100,
    }));

    const measured: MeasuredAir = {
      source: {
        name: 'OpenAQ',
        provider: 'CPCB',
        url: 'https://openaq.org',
        kind: 'measured',
        fetchedAtUtc,
      },
      station: { id: 1, name: 'Mandir Marg', distanceKm: 2.1, isMonitor: true },
      latest: {
        pm25: { value: 120.4, unit: 'µg/m³', atUtc: '2026-11-24T11:30:00.000Z' },
        pm10: { value: 210.2, unit: 'µg/m³', atUtc: '2026-11-24T11:30:00.000Z' },
      },
      series24h: { pm25: pm25Series, pm10: [] },
      freshness: 'fresh',
    };

    const { container } = render(
      <I18nProvider>
        <PollutantTable measured={measured} fetchedAtUtc={fetchedAtUtc} />
      </I18nProvider>,
    );

    expect(screen.getByRole('rowheader', { name: 'PM2.5' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'PM10' })).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('210')).toBeInTheDocument();
    expect(screen.getByText('Insufficient (< 16 h)')).toBeInTheDocument();
    expect(screen.getAllByText('17:00 IST')).toHaveLength(2);

    await expectNoA11yViolations(container);
  });
});
