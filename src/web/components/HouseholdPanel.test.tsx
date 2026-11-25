// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { HOUSEHOLD_PRESETS } from '../../domain/data/presets.js';
import type { HouseholdProfile, UploadedSeries } from '../../shared/schemas.js';
import { expectNoA11yViolations } from '../../test/a11y.js';
import { I18nProvider } from '../i18n/index.js';
import { HouseholdPanel } from './HouseholdPanel.js';

function Harness({
  initialProfile = HOUSEHOLD_PRESETS[0]!,
  onUploadedAirSpy,
}: {
  readonly initialProfile?: HouseholdProfile;
  readonly onUploadedAirSpy?: (s: UploadedSeries | null) => void;
}) {
  const [profile, setProfile] = useState<HouseholdProfile>(initialProfile);
  const [uploadedAir, setUploadedAir] = useState<UploadedSeries | null>(null);

  return (
    <I18nProvider>
      <HouseholdPanel
        profile={profile}
        onChange={setProfile}
        uploadedAir={uploadedAir}
        onUploadedAir={(s) => {
          setUploadedAir(s);
          onUploadedAirSpy?.(s);
        }}
      />
    </I18nProvider>
  );
}

describe('HouseholdPanel', () => {
  it('renders six preset cards and updates the editable summary on Select', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    const presetButtons = screen.getAllByRole('button', { name: /select|selected/i });
    expect(presetButtons).toHaveLength(6);
    expect(presetButtons[0]).toHaveAttribute('aria-pressed', 'true');

    await user.click(presetButtons[2]!);
    expect(presetButtons[2]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByDisplayValue('Morning run')).toBeInTheDocument();

    await expectNoA11yViolations(container);
  });

  it('updates notes live character counter and shows privacy helper', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const textarea = screen.getByLabelText(/additional notes/i);
    expect(screen.getByText(/Don't include names or addresses/i)).toBeInTheDocument();

    await user.clear(textarea);
    await user.type(textarea, 'Prefer morning');

    expect(screen.getByText('14 / 300')).toBeInTheDocument();
  });

  it('handles valid and invalid household JSON uploads from samples', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const jsonInput = screen.getByLabelText(/upload household \(json\)/i);

    const validJsonText = readFileSync(
      resolve(process.cwd(), 'samples/household-custom.json'),
      'utf8',
    );
    const validFile = new File([validJsonText], 'household-custom.json', {
      type: 'application/json',
    });
    await user.upload(jsonInput, validFile);

    await waitFor(() =>
      expect(
        screen.getByText(/Loaded household: Chennai — coastal family with school kids/i),
      ).toBeInTheDocument(),
    );

    const invalidJsonText = readFileSync(
      resolve(process.cwd(), 'samples/household-invalid.json'),
      'utf8',
    );
    const invalidFile = new File([invalidJsonText], 'household-invalid.json', {
      type: 'application/json',
    });
    await user.upload(jsonInput, invalidFile);

    await waitFor(() =>
      expect(screen.getByText(/Upload could not be loaded:/i)).toBeInTheDocument(),
    );
  });

  it('handles valid and invalid air CSV uploads and clears with Use live data', async () => {
    const user = userEvent.setup();
    const onUploadedAirSpy = vi.fn();
    render(<Harness onUploadedAirSpy={onUploadedAirSpy} />);

    const csvInput = screen.getByLabelText(/upload air data \(csv\)/i);

    const validCsvText = readFileSync(
      resolve(process.cwd(), 'samples/air-severe-episode.csv'),
      'utf8',
    );
    const validCsvFile = new File([validCsvText], 'air-severe-episode.csv', {
      type: 'text/csv',
    });
    await user.upload(csvInput, validCsvFile);

    await waitFor(() =>
      expect(screen.getByText(/Loaded 48 readings from air-severe-episode\.csv/i)).toBeInTheDocument(),
    );
    expect(onUploadedAirSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ fileName: 'air-severe-episode.csv' }),
    );

    const clearBtn = screen.getByRole('button', { name: /use live data/i });
    await user.click(clearBtn);
    expect(onUploadedAirSpy).toHaveBeenLastCalledWith(null);

    const malformedCsvText = readFileSync(
      resolve(process.cwd(), 'samples/air-malformed.csv'),
      'utf8',
    );
    const malformedCsvFile = new File([malformedCsvText], 'air-malformed.csv', {
      type: 'text/csv',
    });
    await user.upload(csvInput, malformedCsvFile);

    await waitFor(() =>
      expect(screen.getByText(/Upload could not be loaded:/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/negative PM2\.5 value/i)).toBeInTheDocument();
  });

  it('is fully keyboard-operable across presets and form controls', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const presetButtons = screen.getAllByRole('button', { name: /select|selected/i });
    presetButtons[1]!.focus();
    expect(document.activeElement).toBe(presetButtons[1]);

    await user.keyboard('{Enter}');
    expect(presetButtons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByDisplayValue('Morning walk')).toBeInTheDocument();
  });
});
