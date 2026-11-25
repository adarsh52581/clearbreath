import type { ReactElement } from 'react';
import { cfmToM3h, m3hToCfm } from '../../domain/indoor.js';
import type { Home, WindowState } from '../../shared/schemas.js';
import { useI18n } from '../i18n/index.js';

const WINDOW_STATES: readonly WindowState[] = ['sealed', 'closed', 'partly_open', 'open'];
const inputCls =
  'w-full min-h-11 rounded-md border border-ink-muted bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const checkboxCls =
  'h-5 w-5 rounded border-ink-muted text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export type CadrUnit = 'm3h' | 'cfm';

export interface IndoorControlsProps {
  readonly home: Home;
  readonly cadrUnit: CadrUnit;
  readonly onUpdateHome: (patch: Partial<Home>) => void;
  readonly onChangeCadrUnit: (unit: CadrUnit) => void;
}

function DimensionsInputs({
  home,
  onUpdateHome,
}: {
  readonly home: Home;
  readonly onUpdateHome: (patch: Partial<Home>) => void;
}): ReactElement {
  const { t } = useI18n();
  const areaInvalid = !Number.isFinite(home.roomAreaM2) || home.roomAreaM2 < 6 || home.roomAreaM2 > 80;
  const heightInvalid =
    !Number.isFinite(home.ceilingHeightM) || home.ceilingHeightM < 2.2 || home.ceilingHeightM > 4.5;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label htmlFor="sim-room-area" className="block text-xs font-semibold text-ink-muted mb-1">
          {t.indoor.roomAreaLabel}
        </label>
        <input
          id="sim-room-area"
          type="number"
          min={6}
          max={80}
          value={home.roomAreaM2}
          aria-invalid={areaInvalid || undefined}
          aria-describedby={areaInvalid ? 'sim-room-area-err' : undefined}
          onChange={(e) => onUpdateHome({ roomAreaM2: Number(e.target.value) })}
          className={inputCls}
        />
        {areaInvalid && (
          <p id="sim-room-area-err" className="text-xs text-danger mt-1">
            {t.household.validation.rangePrefix} 6 {t.household.validation.andWord} 80.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="sim-ceiling-height" className="block text-xs font-semibold text-ink-muted mb-1">
          {t.indoor.ceilingHeightLabel}
        </label>
        <input
          id="sim-ceiling-height"
          type="number"
          min={2.2}
          max={4.5}
          step={0.1}
          value={home.ceilingHeightM}
          aria-invalid={heightInvalid || undefined}
          aria-describedby={heightInvalid ? 'sim-ceiling-height-err' : undefined}
          onChange={(e) => onUpdateHome({ ceilingHeightM: Number(e.target.value) })}
          className={inputCls}
        />
        {heightInvalid && (
          <p id="sim-ceiling-height-err" className="text-xs text-danger mt-1">
            {t.household.validation.rangePrefix} 2.2 {t.household.validation.andWord} 4.5.
          </p>
        )}
      </div>
    </div>
  );
}

function PurifierCadrInput({
  cadrM3h,
  cadrUnit,
  onUpdateHome,
  onChangeCadrUnit,
}: {
  readonly cadrM3h: number;
  readonly cadrUnit: CadrUnit;
  readonly onUpdateHome: (patch: Partial<Home>) => void;
  readonly onChangeCadrUnit: (unit: CadrUnit) => void;
}): ReactElement {
  const { t } = useI18n();
  const displayCadr = cadrUnit === 'cfm' ? Math.round(m3hToCfm(cadrM3h)) : Math.round(cadrM3h);
  const cadrInvalid = !Number.isFinite(cadrM3h) || cadrM3h < 0 || cadrM3h > 1500;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="sim-cadr" className="block text-xs font-semibold text-ink-muted mb-1">
            {t.indoor.cadrLabel} ({cadrUnit === 'cfm' ? t.indoor.unitCfm : t.indoor.unitM3h})
          </label>
          <input
            id="sim-cadr"
            type="number"
            min={0}
            max={cadrUnit === 'cfm' ? 883 : 1500}
            value={displayCadr}
            aria-invalid={cadrInvalid || undefined}
            aria-describedby={cadrInvalid ? 'sim-cadr-err' : undefined}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const nextM3h = cadrUnit === 'cfm' ? cfmToM3h(Math.max(0, raw)) : raw;
              onUpdateHome({ purifier: { present: true, cadrM3h: nextM3h } });
            }}
            className={inputCls}
          />
        </div>
        <div className="flex rounded-md border border-ink-muted overflow-hidden" role="group" aria-label={t.indoor.unitToggleLabel}>
          <button
            type="button"
            aria-pressed={cadrUnit === 'm3h'}
            onClick={() => onChangeCadrUnit('m3h')}
            className={`min-h-11 px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              cadrUnit === 'm3h' ? 'bg-accent text-surface' : 'bg-surface text-ink'
            }`}
          >
            {t.indoor.unitM3h}
          </button>
          <button
            type="button"
            aria-pressed={cadrUnit === 'cfm'}
            onClick={() => onChangeCadrUnit('cfm')}
            className={`min-h-11 px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              cadrUnit === 'cfm' ? 'bg-accent text-surface' : 'bg-surface text-ink'
            }`}
          >
            {t.indoor.unitCfm}
          </button>
        </div>
      </div>
      {cadrInvalid && (
        <p id="sim-cadr-err" className="text-xs text-danger">
          {t.household.validation.rangePrefix} 0 {t.household.validation.andWord} 1500.
        </p>
      )}
    </div>
  );
}

function PurifierControl({
  home,
  cadrUnit,
  onUpdateHome,
  onChangeCadrUnit,
}: IndoorControlsProps): ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-2 rounded-md border border-surface-2 bg-surface p-3">
      <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink min-h-11">
        <input
          type="checkbox"
          role="switch"
          checked={home.purifier.present}
          onChange={(e) =>
            onUpdateHome({
              purifier: {
                present: e.target.checked,
                cadrM3h: e.target.checked ? Math.max(150, home.purifier.cadrM3h) : 0,
              },
            })
          }
          className={checkboxCls}
        />
        <span>{t.indoor.purifierSwitchLabel}</span>
      </label>
      {home.purifier.present && (
        <PurifierCadrInput
          cadrM3h={home.purifier.cadrM3h}
          cadrUnit={cadrUnit}
          onUpdateHome={onUpdateHome}
          onChangeCadrUnit={onChangeCadrUnit}
        />
      )}
    </div>
  );
}

function PlantsStepper({
  plantsCount,
  onUpdateHome,
}: {
  readonly plantsCount: number;
  readonly onUpdateHome: (patch: Partial<Home>) => void;
}): ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-md border border-surface-2 bg-surface p-3 space-y-2">
      <label htmlFor="sim-plants" className="block text-sm font-semibold text-ink">
        {t.indoor.plantsLabel}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t.indoor.plantsDecrease}
          disabled={plantsCount <= 0}
          onClick={() => onUpdateHome({ plantsCount: Math.max(0, plantsCount - 1) })}
          className="min-h-11 min-w-11 rounded-md border border-ink-muted bg-surface text-base font-bold text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          −
        </button>
        <input
          id="sim-plants"
          type="number"
          min={0}
          max={20}
          value={plantsCount}
          onChange={(e) => {
            const val = Math.round(Number(e.target.value));
            onUpdateHome({ plantsCount: Number.isFinite(val) ? Math.min(20, Math.max(0, val)) : 0 });
          }}
          className={`${inputCls} text-center`}
        />
        <button
          type="button"
          aria-label={t.indoor.plantsIncrease}
          disabled={plantsCount >= 20}
          onClick={() => onUpdateHome({ plantsCount: Math.min(20, plantsCount + 1) })}
          className="min-h-11 min-w-11 rounded-md border border-ink-muted bg-surface text-base font-bold text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          +
        </button>
      </div>
    </div>
  );
}

function PurifierAndPlants(props: IndoorControlsProps): ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
      <PurifierControl {...props} />
      <PlantsStepper plantsCount={props.home.plantsCount} onUpdateHome={props.onUpdateHome} />
    </div>
  );
}

export function IndoorControls({
  home,
  cadrUnit,
  onUpdateHome,
  onChangeCadrUnit,
}: IndoorControlsProps): ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <DimensionsInputs home={home} onUpdateHome={onUpdateHome} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-ink">{t.indoor.windowStateLegend}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WINDOW_STATES.map((ws) => (
            <div
              key={ws}
              className="flex items-start gap-2.5 rounded-md border border-surface-2 bg-surface p-3 min-h-11"
            >
              <input
                id={`sim-ws-${ws}`}
                type="radio"
                name="sim-window-state"
                value={ws}
                checked={home.windowState === ws}
                onChange={() => onUpdateHome({ windowState: ws })}
                className="mt-0.5 h-5 w-5 text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
              <label htmlFor={`sim-ws-${ws}`} className="cursor-pointer">
                <span className="block text-sm font-semibold text-ink">{t.household.windowStates[ws]}</span>
                <span className="block text-xs text-ink-muted">{t.indoor.windowDescriptions[ws]}</span>
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      <PurifierAndPlants
        home={home}
        cadrUnit={cadrUnit}
        onUpdateHome={onUpdateHome}
        onChangeCadrUnit={onChangeCadrUnit}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-ink">{t.indoor.sourcesLegend}</legend>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-ink min-h-11">
            <input type="checkbox" checked={home.incense} onChange={(e) => onUpdateHome({ incense: e.target.checked })} className={checkboxCls} />
            <span>{t.indoor.sourceIncense}</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink min-h-11">
            <input type="checkbox" checked={home.mosquitoCoil} onChange={(e) => onUpdateHome({ mosquitoCoil: e.target.checked })} className={checkboxCls} />
            <span>{t.indoor.sourceMosquitoCoil}</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink min-h-11">
            <input type="checkbox" checked={!home.kitchenExhaust} onChange={(e) => onUpdateHome({ kitchenExhaust: !e.target.checked })} className={checkboxCls} />
            <span>{t.indoor.sourceCookingNoExhaust}</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink min-h-11">
            <input type="checkbox" checked={home.smokingIndoors} onChange={(e) => onUpdateHome({ smokingIndoors: e.target.checked })} className={checkboxCls} />
            <span>{t.indoor.sourceSmoking}</span>
          </label>
        </div>
      </fieldset>
    </div>
  );
}
