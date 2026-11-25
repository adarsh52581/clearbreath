import { type ReactElement } from 'react';
import { HOUSEHOLD_PRESETS } from '../../domain/data/presets.js';
import type { HouseholdProfile, UploadedSeries } from '../../shared/schemas.js';
import { useI18n } from '../i18n/index.js';
import { useHouseholdPanelLogic } from '../hooks/useHouseholdPanelLogic.js';
import { HouseholdSummaryForm } from './HouseholdSummaryForm.js';

/* ---------- Shared types ---------- */

export type UploadFeedback =
  | { kind: 'idle' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; errors: string[] };

/* ---------- PresetGrid ---------- */

function PresetGrid({
  selectedId,
  onSelect,
}: {
  readonly selectedId: string;
  readonly onSelect: (preset: HouseholdProfile) => void;
}): ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-ink">{t.household.presetsHeading}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {HOUSEHOLD_PRESETS.map((p) => {
          const isSelected = p.id === selectedId;
          return (
            <div
              key={p.id}
              className="rounded-lg border border-surface-2 bg-surface p-3 space-y-2"
            >
              <h4 className="text-sm font-bold text-ink">{p.title}</h4>
              {p.description && (
                <p className="text-xs text-ink-muted leading-relaxed">
                  {p.description}
                </p>
              )}
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(p)}
                className={`min-h-11 px-4 py-2 rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  isSelected
                    ? 'bg-accent text-surface'
                    : 'border border-accent text-accent hover:bg-surface-2'
                }`}
              >
                {isSelected ? t.household.selectedPreset : t.household.selectPreset}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- UploadSection ---------- */

export function UploadSection({
  jsonStatus,
  csvStatus,
  hasUploadedAir,
  onHouseholdUpload,
  onAirUpload,
  onClearAir,
}: {
  readonly jsonStatus: UploadFeedback;
  readonly csvStatus: UploadFeedback;
  readonly hasUploadedAir: boolean;
  readonly onHouseholdUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  readonly onAirUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  readonly onClearAir: () => void;
}): ReactElement {
  const { t } = useI18n();
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold text-ink">{t.household.uploadsHeading}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="upload-household-json"
            className="block text-xs font-semibold text-ink-muted"
          >
            {t.household.uploadHouseholdLabel}
          </label>
          <input
            id="upload-household-json"
            type="file"
            accept=".json,application/json"
            onChange={(e) => void onHouseholdUpload(e)}
            className="block w-full text-sm text-ink file:mr-2 file:min-h-9 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:text-xs file:font-semibold file:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <UploadStatusDisplay status={jsonStatus} />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="upload-air-csv"
            className="block text-xs font-semibold text-ink-muted"
          >
            {t.household.uploadAirLabel}
          </label>
          <input
            id="upload-air-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void onAirUpload(e)}
            className="block w-full text-sm text-ink file:mr-2 file:min-h-9 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:text-xs file:font-semibold file:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <UploadStatusDisplay status={csvStatus} />
          {hasUploadedAir && (
            <button
              type="button"
              onClick={onClearAir}
              className="min-h-9 px-3 py-1 rounded-md border border-ink-muted text-xs font-semibold text-ink hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {t.household.useLiveData}
            </button>
          )}
        </div>
      </div>
    </fieldset>
  );
}

function UploadStatusDisplay({
  status,
}: {
  readonly status: UploadFeedback;
}): ReactElement | null {
  const { t } = useI18n();
  if (status.kind === 'idle') return null;
  if (status.kind === 'success') {
    return (
      <p className="text-xs text-accent font-semibold" role="status">
        {status.message}
      </p>
    );
  }
  return (
    <div role="alert" className="space-y-1">
      <p className="text-xs font-bold text-danger">{t.household.uploadErrorHeading}</p>
      <ul className="list-disc pl-4 text-xs text-danger space-y-0.5">
        {status.errors.map((err, i) => (
          <li key={i}>{err}</li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Main component ---------- */

export interface HouseholdPanelProps {
  readonly profile: HouseholdProfile;
  readonly onChange: (next: HouseholdProfile) => void;
  readonly onSelectPreset?: (preset: HouseholdProfile) => void;
  readonly uploadedAir: UploadedSeries | null;
  readonly onUploadedAir: (series: UploadedSeries | null) => void;
}

export function HouseholdPanel({
  profile,
  onChange,
  onSelectPreset,
  uploadedAir,
  onUploadedAir,
}: HouseholdPanelProps): ReactElement {
  const {
    t,
    jsonStatus,
    csvStatus,
    handlePresetSelect,
    handleHouseholdUpload,
    handleAirUpload,
  } = useHouseholdPanelLogic({ profile, onChange, onSelectPreset, onUploadedAir });

  const notesValue = profile.notes ?? '';

  return (
    <section
      aria-labelledby="household-heading"
      className="rounded-lg border border-surface-2 bg-surface-2 p-4 sm:p-5 space-y-6"
    >
      <h2 id="household-heading" className="text-xl font-bold text-ink">
        {t.household.heading}
      </h2>
      <PresetGrid selectedId={profile.id} onSelect={handlePresetSelect} />
      <HouseholdSummaryForm profile={profile} onChange={onChange} />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="household-notes" className="text-sm font-bold text-ink">
            {t.household.notesLabel}
          </label>
          <span className="text-xs text-ink-muted" aria-live="polite">
            {notesValue.length} {t.household.notesCounterSuffix}
          </span>
        </div>
        <textarea
          id="household-notes"
          maxLength={300}
          rows={2}
          value={notesValue}
          aria-describedby="household-notes-helper"
          onChange={(e) => onChange({ ...profile, notes: e.target.value })}
          className="w-full rounded-md border border-ink-muted bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        <p id="household-notes-helper" className="text-xs text-ink-muted">
          {t.household.notesHelper}
        </p>
      </div>
      <UploadSection
        jsonStatus={jsonStatus}
        csvStatus={csvStatus}
        hasUploadedAir={uploadedAir !== null}
        onHouseholdUpload={handleHouseholdUpload}
        onAirUpload={handleAirUpload}
        onClearAir={() => onUploadedAir(null)}
      />
    </section>
  );
}
