// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { expectNoA11yViolations } from '../../test/a11y.js';
import { I18nProvider } from '../i18n/index.js';
import { AqiCard } from './AqiCard.js';

describe('AqiCard', () => {
  it('shows AQI value, category text, 24-hour basis note and PM-only note', async () => {
    const { container } = render(
      <I18nProvider>
        <AqiCard
          naqi={{
            value: 342,
            category: 'very_poor',
            dominant: 'pm25',
            basis: '24h',
            subIndices: { pm25: 342, pm10: 210 },
            note: 'Based on PM2.5 and PM10 only — indicative',
          }}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('342')).toBeInTheDocument();
    expect(screen.getByText('Very Poor')).toBeInTheDocument();
    expect(screen.getByText('24-hour average')).toBeInTheDocument();
    expect(screen.getByText('PM2.5')).toBeInTheDocument();
    expect(screen.getByText(/Based on PM2\.5 and PM10 only/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('shows indicative basis note when basis is indicative-latest', () => {
    render(
      <I18nProvider>
        <AqiCard
          naqi={{
            value: 150,
            category: 'moderate',
            dominant: 'pm10',
            basis: 'indicative-latest',
            subIndices: { pm10: 150 },
            note: 'Based on PM2.5 and PM10 only — indicative',
          }}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Indicative: latest hour')).toBeInTheDocument();
    expect(screen.getByText('PM10')).toBeInTheDocument();
  });

  it('renders unavailable state when naqi is null', async () => {
    const { container } = render(
      <I18nProvider>
        <AqiCard naqi={null} />
      </I18nProvider>,
    );

    expect(screen.getByText('AQI unavailable')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
