// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WarningCode } from '../../shared/schemas.js';
import { expectNoA11yViolations } from '../../test/a11y.js';
import { I18nProvider } from '../i18n/index.js';
import { ErrorState, LoadingSkeleton, WarningBanners } from './StatusViews.js';

describe('StatusViews', () => {
  it('renders LoadingSkeleton with aria-busy', async () => {
    const { container } = render(
      <I18nProvider>
        <LoadingSkeleton />
      </I18nProvider>,
    );

    const status = screen.getByRole('status', { name: /Loading air quality data/i });
    expect(status).toHaveAttribute('aria-busy', 'true');
    await expectNoA11yViolations(container);
  });

  it('renders ErrorState and triggers retry callback', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    const { container } = render(
      <I18nProvider>
        <ErrorState message="Network error." onRetry={onRetry} />
      </I18nProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Network error.');
    await user.click(screen.getByRole('button', { name: /Retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await expectNoA11yViolations(container);
  });

  it('renders plain-language banners for all warning codes', async () => {
    const codes: WarningCode[] = [
      'NO_STATION',
      'STALE_STATION',
      'FORECAST_FALLBACK',
      'FORECAST_UNAVAILABLE',
      'INDICATIVE_AQI',
      'UPLOADED_DATA',
      'UNIT_MISMATCH',
    ];

    const { container } = render(
      <I18nProvider>
        <WarningBanners warnings={codes.map((code) => ({ code, message: code }))} />
      </I18nProvider>,
    );

    expect(screen.getAllByRole('note')).toHaveLength(7);
    expect(screen.getByText(/No active monitoring station was found/i)).toBeInTheDocument();
    expect(screen.getByText(/uploaded air quality data/i)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
