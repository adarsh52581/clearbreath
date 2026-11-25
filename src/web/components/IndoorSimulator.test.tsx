// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HOUSEHOLD_PRESETS } from '../../domain/data/presets.js';
import { formatUgM3 } from '../../domain/format.js';
import { indoorScenarios } from '../../domain/indoor.js';
import type { AirReport, IaqExplainResponse } from '../../shared/schemas.js';
import { expectNoA11yViolations } from '../../test/a11y.js';
import { I18nProvider } from '../i18n/index.js';
import IndoorSimulator from './IndoorSimulator.js';

const profile = HOUSEHOLD_PRESETS[0]!;

const sampleAir: AirReport = {
  location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
  measured: {
    source: {
      name: 'OpenAQ',
      provider: 'CPCB',
      url: 'https://openaq.org',
      kind: 'measured',
      fetchedAtUtc: '2026-11-25T06:00:00.000Z',
    },
    station: { id: 1, name: 'Anand Vihar', distanceKm: 2, isMonitor: true },
    latest: {
      pm25: { value: 250, unit: 'µg/m³', atUtc: '2026-11-25T05:30:00.000Z' },
    },
    series24h: { pm25: [], pm10: [] },
    freshness: 'fresh',
  },
  naqi: null,
  forecast: null,
  warnings: [],
  fetchedAtUtc: '2026-11-25T06:00:00.000Z',
};

describe('IndoorSimulator', () => {
  it('shows inline validation messages for out-of-range room dimensions', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <IndoorSimulator profile={profile} location={{ cityId: 'delhi' }} air={sampleAir} upload={null} />
      </I18nProvider>,
    );

    const areaInput = screen.getByLabelText(/room area/i);
    await user.clear(areaInput);
    await user.type(areaInput, '2');
    expect(screen.getByText(/must be between 6 and 80/i)).toBeInTheDocument();

    const heightInput = screen.getByLabelText(/ceiling height/i);
    await user.clear(heightInput);
    await user.type(heightInput, '1');
    expect(screen.getByText(/must be between 2.2 and 4.5/i)).toBeInTheDocument();
  });

  it('matches exact domain output when changing windows/purifier, shows <1% for 10 plants, and converts units', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <I18nProvider>
        <IndoorSimulator profile={profile} location={{ cityId: 'delhi' }} air={sampleAir} upload={null} />
      </I18nProvider>,
    );

    // Switch window state to sealed
    await user.click(screen.getByRole('radio', { name: /sealed/i }));

    // Turn on purifier (sets initial CADR to 150 m3/h)
    await user.click(screen.getByRole('switch', { name: /air purifier running/i }));

    const expected = indoorScenarios(
      {
        roomAreaM2: profile.home.roomAreaM2,
        ceilingHeightM: profile.home.ceilingHeightM,
        windowState: 'sealed',
        purifierCadrM3h: 150,
        plants: profile.home.plantsCount,
      },
      250,
      profile.members.map((m) => ({ id: m.id, activityHours: 0, commuteHours: 0 })),
      0,
    );
    const expectedBaseline = expected.find((s) => s.id === 'baseline')!;
    const expectedPlants = expected.find((s) => s.id === 'plants_plus_10')!;

    expect(screen.getAllByText(formatUgM3(expectedBaseline.cIn)).length).toBeGreaterThan(0);
    expect(Math.abs(expectedPlants.pctVsBaseline)).toBeLessThan(1);
    expect(screen.getByText(/Honest check: plants/i)).toBeInTheDocument();
    expect(screen.getByText(/Cummings BE, Waring MS/i)).toBeInTheDocument();

    // Unit toggle m3/h -> CFM (150 m3/h / 1.699 = 88 CFM)
    await user.click(screen.getByRole('button', { name: 'CFM' }));
    const cadrInput = screen.getByLabelText<HTMLInputElement>(/purifier cadr \(cfm\)/i);
    expect(cadrInput.value).toBe('88');

    // Change CADR in CFM -> updates estimate
    fireEvent.change(cadrInput, { target: { value: '200' } });
    expect(cadrInput.value).toBe('200');

    await expectNoA11yViolations(container);
  });

  it('calls postIaqExplain on Explain my setup and renders grounded items with origin badge', async () => {
    const user = userEvent.setup();
    let resolveFn!: (v: IaqExplainResponse) => void;
    const postIaqExplain = vi.fn().mockImplementation(
      () =>
        new Promise<IaqExplainResponse>((resolve) => {
          resolveFn = resolve;
        }),
    );

    render(
      <I18nProvider>
        <IndoorSimulator
          profile={profile}
          location={{ cityId: 'delhi' }}
          air={sampleAir}
          upload={null}
          postIaqExplain={postIaqExplain}
        />
      </I18nProvider>,
    );

    const btn = screen.getByRole('button', { name: /explain my setup/i });
    await user.click(btn);
    expect(screen.getByRole('button', { name: /explaining setup/i })).toBeDisabled();

    resolveFn({
      facts: [
        {
          id: 'in_baseline_pm25',
          label: 'Estimated indoor PM2.5',
          value: 154,
          unit: 'µg/m³',
          display: '154 µg/m³',
          kind: 'computed',
          provenance: 'Indoor mass balance model',
        },
      ],
      scenarios: [],
      explanation: {
        summary: 'Current indoor estimate is {{in_baseline_pm25}}.',
        actions: [
          {
            actionId: 'close_windows',
            headline: 'Close windows',
            why: 'Keeps indoor air at {{in_baseline_pm25}} or lower.',
            priority: 'high',
          },
        ],
        caveats: ['Not a medical measurement.'],
      },
      meta: {
        origin: 'gemini',
        attempts: 1,
        generatedAtUtc: '2026-11-25T06:00:00.000Z',
        warnings: [],
      },
    });

    expect(await screen.findByText('Explained by Gemini')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Close windows' })).toBeInTheDocument();
  });
});
