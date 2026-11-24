// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CITIES } from '../../domain/data/cities.js';
import type { City } from '../../shared/schemas.js';
import { expectNoA11yViolations } from '../../test/a11y.js';
import { I18nProvider } from '../i18n/index.js';
import { LocationPicker, type GeolocationLike } from './LocationPicker.js';

const cities: City[] = CITIES.map((c) => ({ ...c }));

describe('LocationPicker', () => {
  it('allows selecting a city by keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    const { container } = render(
      <I18nProvider>
        <LocationPicker cities={cities} selected={{ cityId: 'delhi' }} onSelect={onSelect} />
      </I18nProvider>,
    );

    const select = screen.getByLabelText('Select city');
    select.focus();
    expect(select).toHaveFocus();
    await user.selectOptions(select, 'mumbai');
    expect(onSelect).toHaveBeenCalledWith({ cityId: 'mumbai' });

    await expectNoA11yViolations(container);
  });

  it('shows friendly message when geolocation is denied', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const geolocation: GeolocationLike = {
      getCurrentPosition: (_ok, err) => {
        err?.({ code: 1, message: 'User denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      },
    };

    render(
      <I18nProvider>
        <LocationPicker
          cities={cities}
          selected={{ cityId: 'delhi' }}
          onSelect={onSelect}
          geolocation={geolocation}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: /use my location/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/denied/i);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows friendly message when coordinates are outside India', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const geolocation: GeolocationLike = {
      getCurrentPosition: (ok) => {
        ok({
          coords: {
            latitude: 51.5074,
            longitude: -0.1278,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        });
      },
    };

    render(
      <I18nProvider>
        <LocationPicker
          cities={cities}
          selected={{ cityId: 'delhi' }}
          onSelect={onSelect}
          geolocation={geolocation}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: /use my location/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/outside India/i);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
