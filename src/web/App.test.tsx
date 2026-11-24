// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CITIES } from '../domain/data/cities.js';
import type { AirReport, City, LocationRef } from '../shared/schemas.js';
import { expectNoA11yViolations } from '../test/a11y.js';
import { clearAirCache } from './hooks/useAir.js';
import App from './App.js';

const mockCities: City[] = CITIES.map((c) => ({ ...c }));

function makeReport(cityLabel: string, value: number, category: 'very_poor' | 'moderate'): AirReport {
  const baseMs = Date.parse('2026-11-24T06:00:00.000Z');
  const points = Array.from({ length: 48 }, (_, i) => ({
    timeUtc: new Date(baseMs + i * 3600_000).toISOString(),
    pm25: 50 + i,
    pm10: 90 + i,
  }));

  return {
    location: { label: cityLabel, lat: 28.6139, lon: 77.209, cityId: cityLabel.toLowerCase() },
    measured: {
      source: {
        name: 'OpenAQ',
        provider: 'CPCB',
        url: 'https://openaq.org',
        kind: 'measured',
        fetchedAtUtc: '2026-11-24T06:00:00.000Z',
        dataTimeUtc: '2026-11-24T05:45:00.000Z',
      },
      station: { id: 1, name: `${cityLabel} Station`, distanceKm: 2.5, isMonitor: true },
      latest: {
        pm25: { value: 150, unit: 'µg/m³', atUtc: '2026-11-24T05:45:00.000Z' },
      },
      series24h: { pm25: [], pm10: [] },
      freshness: 'fresh',
    },
    naqi: {
      value,
      category,
      dominant: 'pm25',
      basis: 'indicative-latest',
      subIndices: { pm25: value },
      note: 'Based on PM2.5 and PM10 only — indicative',
    },
    forecast: {
      source: {
        name: 'Open-Meteo (CAMS model)',
        url: 'https://open-meteo.com',
        kind: 'forecast',
        fetchedAtUtc: '2026-11-24T06:00:00.000Z',
      },
      points,
    },
    warnings: [],
    fetchedAtUtc: '2026-11-24T06:00:00.000Z',
  };
}

describe('App', () => {
  beforeEach(() => {
    clearAirCache();
  });

  it('renders banner, main and contentinfo landmarks', async () => {
    const fetchAir = vi.fn().mockResolvedValue(makeReport('Delhi', 340, 'very_poor'));
    const fetchCities = vi.fn().mockResolvedValue(mockCities);

    render(<App fetchAir={fetchAir} fetchCities={fetchCities} />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('340')).toBeInTheDocument());
  });

  it('renders skip link pointing to #main', async () => {
    const fetchAir = vi.fn().mockResolvedValue(makeReport('Delhi', 340, 'very_poor'));
    const fetchCities = vi.fn().mockResolvedValue(mockCities);

    render(<App fetchAir={fetchAir} fetchCities={fetchCities} />);

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main');
    await waitFor(() => expect(screen.getByText('340')).toBeInTheDocument());
  });

  it('renders exactly one h1 heading', async () => {
    const fetchAir = vi.fn().mockResolvedValue(makeReport('Delhi', 340, 'very_poor'));
    const fetchCities = vi.fn().mockResolvedValue(mockCities);

    render(<App fetchAir={fetchAir} fetchCities={fetchCities} />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Cleaner-air decisions for your family');
    await waitFor(() => expect(screen.getByText('340')).toBeInTheDocument());
  });

  it('loads Delhi by default and choosing Mumbai fetches Mumbai and updates live region', async () => {
    const user = userEvent.setup();
    const fetchAir = vi.fn().mockImplementation((loc: LocationRef) => {
      if ('cityId' in loc && loc.cityId === 'mumbai') {
        return Promise.resolve(makeReport('Mumbai', 142, 'moderate'));
      }
      return Promise.resolve(makeReport('Delhi', 340, 'very_poor'));
    });
    const fetchCities = vi.fn().mockResolvedValue(mockCities);

    const { container } = render(
      <App
        fetchAir={fetchAir}
        fetchCities={fetchCities}
        clock={() => Date.parse('2026-11-24T06:00:00.000Z')}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Air quality updated for Delhi: Very Poor')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Select city'), 'mumbai');

    await waitFor(() => {
      expect(screen.getByText('Air quality updated for Mumbai: Moderate')).toBeInTheDocument();
    });
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(fetchAir).toHaveBeenCalledWith({ cityId: 'mumbai' });

    await expectNoA11yViolations(container);
  });
});
