import { useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useI18n } from '../i18n/index.js';
import { parseHouseholdJson, parseAirCsv } from '../lib/parseUpload.js';
import type { HouseholdProfile, UploadedSeries } from '../../shared/schemas.js';
import type { UploadFeedback } from '../components/HouseholdPanel.js';

export interface UseHouseholdPanelLogicDeps {
  readonly profile: HouseholdProfile;
  readonly onChange: (next: HouseholdProfile) => void;
  readonly onSelectPreset?: (preset: HouseholdProfile) => void;
  readonly onUploadedAir: (series: UploadedSeries | null) => void;
}

export interface UseHouseholdPanelLogicResult {
  readonly t: ReturnType<typeof useI18n>['t'];
  readonly jsonStatus: UploadFeedback;
  readonly csvStatus: UploadFeedback;
  readonly handlePresetSelect: (preset: HouseholdProfile) => void;
  readonly handleHouseholdUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  readonly handleAirUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function useHouseholdPanelLogic({
  onChange,
  onSelectPreset,
  onUploadedAir,
}: UseHouseholdPanelLogicDeps): UseHouseholdPanelLogicResult {
  const { t } = useI18n();
  const [jsonStatus, setJsonStatus] = useState<UploadFeedback>({ kind: 'idle' });
  const [csvStatus, setCsvStatus] = useState<UploadFeedback>({ kind: 'idle' });

  const handlePresetSelect = useCallback(
    (preset: HouseholdProfile) => {
      const copy = JSON.parse(JSON.stringify(preset)) as HouseholdProfile;
      if (onSelectPreset) onSelectPreset(copy);
      else onChange(copy);
      setJsonStatus({ kind: 'idle' });
    },
    [onSelectPreset, onChange],
  );

  const handleHouseholdUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const res = parseHouseholdJson(await readFileAsText(file));
      if (res.ok) {
        onChange(res.value);
        setJsonStatus({ kind: 'success', message: `${t.household.uploadHouseholdSuccess} ${res.value.title}` });
      } else {
        setJsonStatus({ kind: 'error', errors: res.errors });
      }
      e.target.value = '';
    },
    [onChange, t],
  );

  const handleAirUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const res = parseAirCsv(await readFileAsText(file), file.name);
      if (res.ok) {
        onUploadedAir(res.value);
        setCsvStatus({
          kind: 'success',
          message: `${t.household.uploadAirSuccessPrefix} ${res.value.points.length} ${t.household.uploadAirSuccessMiddle} ${res.value.fileName}`,
        });
      } else {
        setCsvStatus({ kind: 'error', errors: res.errors });
      }
      e.target.value = '';
    },
    [onUploadedAir, t],
  );

  return { t, jsonStatus, csvStatus, handlePresetSelect, handleHouseholdUpload, handleAirUpload };
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}
