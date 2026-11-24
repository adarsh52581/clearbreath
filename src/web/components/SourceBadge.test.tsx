// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AirReport } from '../../shared/schemas.js';
import { expectNoA11yViolations } from '../../test/a11y.js';
import { I18nProvider } from '../i18n/index.js';
import { SourceBadge } from './SourceBadge.js';

function makeMeasuredReport(freshness: 'fresh' | 'stale' | 'unavailable'): AirReport {
  return {
    location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
    measured: {
      source: {
        name: 'OpenAQ',
        provider: 'CPCB',
        url: 'https://openaq.org',
        kind: 'measured',
        fetchedAtUtc: '2026-11-24T06:00:00.000Z',
        dataTimeUtc: '2026-11-24T05:30:00.000Z',
      },
      station: { id: 1, name: 'Anand Vihar', distanceKm: 3.4, isMonitor: true },
      latest: { pm25: { value: 180, unit: 'µg/m³', atUtc: '2026-11-24T05:30:00.000Z' } },
      series24h: { pm25: [], pm10: [] },
      freshness,
    },
    naqi: null,
    forecast: {
      source: {
        name: 'Google Air Quality API',
        url: 'https://airquality.googleapis.com',
        kind: 'forecast',
        fetchedAtUtc: '2026-11-24T06:00:00.000Z',
      },
      points: [],
    },
    warnings: [],
    fetchedAtUtc: '2026-11-24T06:00:00.000Z',
  };
}

describe('SourceBadge', () => {
  it('shows station, distance, IST time and relative minutes with a fixed clock', async () => {
    const fixedClock = () => Date.parse('2026-11-24T06:15:00.000Z');
    const { container } = render(
      <I18nProvider>
        <SourceBadge report={makeMeasuredReport('fresh')} clock={fixedClock} />
      </I18nProvider>,
    );

    expect(screen.getByText(/CPCB/)).toBeInTheDocument();
    expect(screen.getByText(/Anand Vihar/)).toBeInTheDocument();
    expect(screen.getByText(/3\.4 km away/)).toBeInTheDocument();
    expect(screen.getByText(/Updated 11:00 IST \(45 min ago\)/)).toBeInTheDocument();
    expect(screen.getByText(/Fresh \(< 3 h\)/)).toBeInTheDocument();
    expect(screen.getByText(/Google Air Quality API \(model forecast\)/)).toBeInTheDocument();

    await expectNoA11yViolations(container);
  });

  it('shows stale freshness chip when station is stale', () => {
    const fixedClock = () => Date.parse('2026-11-24T10:00:00.000Z');
    render(
      <I18nProvider>
        <SourceBadge report={makeMeasuredReport('stale')} clock={fixedClock} />
      </I18nProvider>,
    );

    expect(screen.getByText(/Stale \(3–12 h\)/)).toBeInTheDocument();
  });

  it('shows prominent uploaded banner when data is uploaded', async () => {
    const uploadedReport: AirReport = {
      location: { label: 'Delhi', lat: 28.6139, lon: 77.209 },
      measured: {
        source: {
          name: 'delhi-severe.csv',
          url: '',
          kind: 'uploaded',
          fetchedAtUtc: '2026-11-24T06:00:00.000Z',
        },
        station: { id: 0, name: 'Uploaded', distanceKm: 0, isMonitor: false },
        latest: {},
        series24h: { pm25: [], pm10: [] },
        freshness: 'fresh',
      },
      naqi: null,
      forecast: null,
      warnings: [{ code: 'UPLOADED_DATA', message: 'Uploaded' }],
      fetchedAtUtc: '2026-11-24T06:00:00.000Z',
    };

    const { container } = render(
      <I18nProvider>
        <SourceBadge report={uploadedReport} />
      </I18nProvider>,
    );

    expect(screen.getByText('Uploaded — not live data')).toBeInTheDocument();
    expect(screen.getByText(/delhi-severe\.csv/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
