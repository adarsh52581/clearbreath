// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HOUSEHOLD_PRESETS } from '../../domain/data/presets.js';
import type { PlanResponse, ResponseMeta } from '../../shared/schemas.js';
import { expectNoA11yViolations } from '../../test/a11y.js';
import { I18nProvider } from '../i18n/index.js';
import PlanView from './PlanView.js';

const profile = HOUSEHOLD_PRESETS[0]!;

function makeResponse(origin: ResponseMeta['origin']): PlanResponse {
  return {
    air: {
      location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
      measured: null,
      naqi: null,
      forecast: null,
      warnings: [],
      fetchedAtUtc: '2026-11-24T06:00:00.000Z',
    },
    facts: [
      {
        id: 'air_category_now',
        label: 'Current AQI category',
        value: 'very_poor',
        display: 'Very Poor',
        kind: 'computed',
        provenance: 'CPCB category classification',
      },
      {
        id: 'opt_a1_best_label',
        label: 'Cleanest window choice',
        value: '14:00–15:00 IST',
        display: '14:00–15:00 IST',
        kind: 'computed',
        provenance: 'Clean window finder',
      },
      {
        id: 'act_a1_best_window',
        label: 'Cleanest window',
        value: '14:00–15:00 IST',
        display: '14:00–15:00 IST',
        kind: 'forecast',
        provenance: 'Open-Meteo (CAMS model)',
      },
      {
        id: 'act_a1_dose_change',
        label: 'Exposure reduction',
        value: -32,
        display: '32% lower',
        kind: 'computed',
        provenance: 'Inhaled dose model',
      },
      {
        id: 'opt_c1_metro_label',
        label: 'Commute mode label',
        value: 'metro',
        display: 'metro',
        kind: 'reference',
        provenance: 'Commute mode list',
      },
      {
        id: 'com_c1_metro_vehicle_km_avoided_week',
        label: 'Weekly vehicle-km avoided',
        value: 140,
        unit: 'km',
        display: '140 km',
        kind: 'computed',
        provenance: 'Vehicle distance computation',
      },
      {
        id: 'led_m1_usual',
        label: 'Parent usual intake',
        value: 410,
        display: '410 µg',
        kind: 'computed',
        provenance: 'Daily inhaled dose model',
      },
      {
        id: 'led_m1_plan',
        label: 'Parent plan intake',
        value: 290,
        display: '290 µg',
        kind: 'computed',
        provenance: 'Plan exposure optimization',
      },
      {
        id: 'led_m1_change',
        label: 'Parent intake change',
        value: -29,
        display: '29% lower',
        kind: 'computed',
        provenance: 'Intake ledger comparison',
      },
      {
        id: 'led_m2_usual',
        label: 'Child usual intake',
        value: 320,
        display: '320 µg',
        kind: 'computed',
        provenance: 'Daily inhaled dose model',
      },
      {
        id: 'led_m2_plan',
        label: 'Child plan intake',
        value: 210,
        display: '210 µg',
        kind: 'computed',
        provenance: 'Plan exposure optimization',
      },
      {
        id: 'led_m2_change',
        label: 'Child intake change',
        value: -34,
        display: '34% lower',
        kind: 'computed',
        provenance: 'Intake ledger comparison',
      },
      {
        id: 'led_household_co2_saved_week',
        label: 'Household weekly CO2 saved',
        value: 18.5,
        unit: 'kg',
        display: '18.5 kg CO2',
        kind: 'computed',
        provenance: 'Commute mode substitution model',
      },
      {
        id: 'in_close_windows_change',
        label: 'Indoor change',
        value: -20,
        display: '20% lower',
        kind: 'computed',
        provenance: 'Indoor mass balance model',
      },
      {
        id: 'ev_carpool_note',
        label: 'Carpool note',
        value: 'Sharing rides cuts vehicles',
        display: 'Sharing rides cuts vehicles',
        kind: 'guidance',
        provenance: 'CPCB guidance',
      },
    ],
    candidates: {
      activities: [
        {
          itemId: 'a1',
          label: 'Evening park play',
          memberIds: ['m2'],
          options: [
            {
              optionId: 'a1_best',
              label: 'Cleanest forecast window',
              recommended: true,
              factIds: ['act_a1_best_window', 'act_a1_dose_change'],
            },
          ],
        },
      ],
      commutes: [
        {
          itemId: 'c1',
          label: 'Office commute',
          memberIds: ['m1'],
          options: [
            {
              optionId: 'c1_metro',
              label: 'Metro train',
              recommended: true,
              factIds: ['com_c1_metro_vehicle_km_avoided_week'],
            },
          ],
        },
      ],
      indoor: [
        {
          actionId: 'close_windows',
          label: 'Close external windows',
          cost: 'free',
          factIds: ['in_close_windows_change'],
        },
      ],
      community: [
        {
          actionId: 'carpool_pod',
          label: 'Share school or office rides',
          factIds: ['ev_carpool_note'],
        },
      ],
    },
    plan: {
      summary: 'Air quality is {{air_category_now}} today.',
      routine: [
        {
          itemId: 'a1',
          chosenOptionId: 'a1_best',
          headline: 'Move play to {{act_a1_best_window}}',
          why: 'Exposure is {{act_a1_dose_change}} than usual.',
          tradeoff: 'Earlier than usual.',
          priority: 'high',
        },
      ],
      indoor: [
        {
          actionId: 'close_windows',
          headline: 'Close windows',
          why: 'Cuts indoor PM2.5 by {{in_close_windows_change}}.',
          priority: 'high',
        },
      ],
      community: [
        {
          actionId: 'carpool_pod',
          headline: 'Carpool pod',
          why: '{{ev_carpool_note}}',
        },
      ],
      caveats: ['Not medical advice.'],
    },
    meta: {
      origin,
      attempts: origin === 'fallback' ? 0 : 1,
      generatedAtUtc: '2026-11-24T09:00:00.000Z',
      warnings: [],
    },
  };
}

describe('PlanView', () => {
  it('renders each origin badge correctly', () => {
    const { rerender } = render(
      <I18nProvider>
        <PlanView response={makeResponse('gemini')} profile={profile} />
      </I18nProvider>,
    );
    expect(screen.getByText('Explained by Gemini')).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <PlanView response={makeResponse('cache')} profile={profile} />
      </I18nProvider>,
    );
    expect(screen.getByText('Saved explanation from 14:30 IST')).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <PlanView response={makeResponse('last-good')} profile={profile} />
      </I18nProvider>,
    );
    expect(screen.getByText('Saved explanation from 14:30 IST')).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <PlanView response={makeResponse('fallback')} profile={profile} />
      </I18nProvider>,
    );
    expect(
      screen.getByText("AI explanation unavailable — showing ClearBreath's computed ranking"),
    ).toBeInTheDocument();
  });

  it('renders ledger rows from facts, See the numbers details, and passes axe', async () => {
    const { container } = render(
      <I18nProvider>
        <PlanView response={makeResponse('gemini')} profile={profile} />
      </I18nProvider>,
    );

    const ledgerTable = screen.getByRole('table', {
      name: /estimated with recommended options; not a medical measurement/i,
    });
    expect(within(ledgerTable).getByText('410 µg')).toBeInTheDocument();
    expect(within(ledgerTable).getByText('290 µg')).toBeInTheDocument();
    expect(within(ledgerTable).getByText('210 µg')).toBeInTheDocument();
    expect(screen.getByText('18.5 kg CO2')).toBeInTheDocument();
    expect(screen.getByText('140 km')).toBeInTheDocument();

    expect(screen.getByText('See the numbers')).toBeInTheDocument();
    expect(screen.getByText('Open-Meteo (CAMS model)')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();

    await expectNoA11yViolations(container);
  });
});
