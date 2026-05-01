import { useRef, useState } from 'react';
import { totalItemizedExpenses } from '../lib/financials.js';
import { filterComps } from '../lib/comps.js';
import { fmtCurrency } from '../lib/format.js';

const ASSET_CLASSES = ['multifamily', 'office', 'retail', 'industrial', 'coworking'];

const ITEMIZED_FIELDS = [
  ['contracts', 'Contracts'],
  ['payroll', 'Payroll'],
  ['repairsAndMaintenance', 'Repairs & Maintenance'],
  ['administrative', 'Administrative'],
  ['management', 'Management'],
  ['utilities', 'Utilities'],
  ['reTaxes', 'RE Taxes'],
  ['insurance', 'Insurance'],
  ['marketing', 'Marketing'],
  ['turnover', 'Turnover'],
];

export default function DealForm({ deal, setDeal, suggestedExitCap }) {
  const update = (patch) => setDeal({ ...deal, ...patch });
  // Side-aware updaters: side is 't12' or 'yearOne'
  const updateSide = (side, patch) =>
    setDeal({ ...deal, [side]: { ...deal[side], ...patch } });
  const updateSideOpex = (side, patch) =>
    setDeal({
      ...deal,
      [side]: {
        ...deal[side],
        opex: { ...(deal[side]?.opex || {}), ...patch },
      },
    });
  const updateSideItemized = (side, patch) =>
    setDeal({
      ...deal,
      [side]: {
        ...deal[side],
        opex: {
          ...(deal[side]?.opex || {}),
          itemized: { ...(deal[side]?.opex?.itemized || {}), ...patch },
        },
      },
    });
  const updateValueAdd = (patch) =>
    setDeal({ ...deal, valueAdd: { ...deal.valueAdd, ...patch } });

  const updateComp = (idx, patch) => {
    const next = [...(deal.salesComps || [])];
    next[idx] = { ...next[idx], ...patch };
    setDeal({ ...deal, salesComps: next });
  };
  const addComp = () =>
    setDeal({
      ...deal,
      salesComps: [
        ...(deal.salesComps || []),
        {
          address: '',
          dateSold: '',
          price: 0,
          units: 0,
          yearBuilt: 0,
          distance: 0,
          buyer: '',
          seller: '',
        },
      ],
    });
  const removeComp = (idx) =>
    setDeal({
      ...deal,
      salesComps: (deal.salesComps || []).filter((_, i) => i !== idx),
    });
  const updateFilter = (patch) =>
    setDeal({ ...deal, compsFilter: { ...deal.compsFilter, ...patch } });

  const isMultifamily = deal.assetClass === 'multifamily';
  return (
    <div className="space-y-6">
      <Section title="Property">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Property Name">
            <input
              className="rvc-input"
              value={deal.propertyName}
              onChange={(e) => update({ propertyName: e.target.value })}
              placeholder="e.g. The Heights at Crown"
            />
          </Field>
          <Field label="Address">
            <input
              className="rvc-input"
              value={deal.address}
              onChange={(e) => update({ address: e.target.value })}
              placeholder="123 Main St, City, ST"
            />
          </Field>
          <Field label="Asset Class">
            <select
              className="rvc-input"
              value={deal.assetClass}
              onChange={(e) => update({ assetClass: e.target.value })}
            >
              {ASSET_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          {isMultifamily ? (
            <Field label="Units">
              <NumberInput value={deal.units} onChange={(v) => update({ units: v })} />
            </Field>
          ) : (
            <Field label="Square Footage">
              <NumberInput
                value={deal.squareFootage}
                onChange={(v) => update({ squareFootage: v })}
              />
            </Field>
          )}
          <Field label="Year Built">
            <NumberInput
              value={deal.yearBuilt}
              onChange={(v) => update({ yearBuilt: Math.max(0, v || 0) })}
              placeholder="1990"
            />
          </Field>
          <Field label="Year Renovated">
            <NumberInput
              value={deal.yearRenovated}
              onChange={(v) => update({ yearRenovated: Math.max(0, v || 0) })}
              placeholder="—"
            />
          </Field>
          <Field label="Number of Buildings">
            <NumberInput
              value={deal.numBuildings}
              onChange={(v) => update({ numBuildings: Math.max(0, v || 0) })}
              placeholder="1"
            />
          </Field>
          <Field label="Number of Stories">
            <NumberInput
              value={deal.numStories}
              onChange={(v) => update({ numStories: Math.max(0, v || 0) })}
              placeholder="6"
            />
          </Field>
          <Field label="Lot Size (SF)">
            <NumberInput
              value={deal.lotSizeSF}
              onChange={(v) => update({ lotSizeSF: Math.max(0, v || 0) })}
            />
          </Field>
          <Field label="Gross Building Area (SF)">
            <NumberInput
              value={deal.grossBuildingSF}
              onChange={(v) => update({ grossBuildingSF: Math.max(0, v || 0) })}
            />
          </Field>
          <Field label="Parking Spaces">
            <NumberInput
              value={deal.parkingSpaces}
              onChange={(v) => update({ parkingSpaces: Math.max(0, v || 0) })}
            />
          </Field>
          <Field label="Last Sale Price ($)">
            <CurrencyInput
              value={deal.lastSalePrice}
              onChange={(v) => update({ lastSalePrice: v })}
            />
          </Field>
          <Field label="Last Sale Date">
            <input
              type="date"
              className="rvc-input"
              value={deal.lastSaleDate || ''}
              onChange={(e) => update({ lastSaleDate: e.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <label className="rvc-label">Amenities</label>
            <textarea
              className="rvc-input"
              rows="2"
              value={deal.amenities || ''}
              onChange={(e) => update({ amenities: e.target.value })}
              placeholder="e.g. fitness center, roof deck, parking garage, in-unit W/D"
            />
          </div>
        </div>
      </Section>

      <Section title="Financials">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FinancialsColumn
            side="t12"
            label="In-Place / T12"
            sublabel="Trailing 12 months — actual current operating data"
            data={deal.t12}
            updateSide={updateSide}
            updateSideOpex={updateSideOpex}
            updateSideItemized={updateSideItemized}
            mergeExtracted={(patch) => setDeal({ ...deal, ...patch })}
            showUpload
          />
          <FinancialsColumn
            side="yearOne"
            label="Year 1 Projection"
            sublabel="Your projected first ownership year — drives the multi-year forecast when enabled"
            data={deal.yearOne}
            updateSide={updateSide}
            updateSideOpex={updateSideOpex}
            updateSideItemized={updateSideItemized}
            disabled={!deal.useProjectedYearOne}
            toggleNode={
              <select
                className="rvc-input max-w-[140px]"
                value={deal.useProjectedYearOne ? 'yes' : 'no'}
                onChange={(e) =>
                  setDeal({ ...deal, useProjectedYearOne: e.target.value === 'yes' })
                }
              >
                <option value="no">Skip (use T12)</option>
                <option value="yes">Add Year One</option>
              </select>
            }
          />
        </div>
      </Section>

      <Section title="Loan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Loan Amount ($)">
            <CurrencyInput
              value={deal.loanAmount}
              onChange={(v) => update({ loanAmount: v })}
            />
          </Field>
          <Field label="Interest Rate (%)">
            <NumberInput
              value={pctToInput(deal.interestRate)}
              onChange={(v) => update({ interestRate: inputToPct(v) })}
              placeholder="6.5"
              step="0.05"
            />
          </Field>
          <Field label="Amortization (years)">
            <NumberInput
              value={deal.amortYears}
              onChange={(v) => update({ amortYears: v })}
            />
          </Field>
          <Field label="Interest Only Period (years)">
            <NumberInput
              value={deal.ioPeriodYears}
              onChange={(v) => update({ ioPeriodYears: Math.max(0, v || 0) })}
              placeholder="0"
            />
          </Field>
        </div>
      </Section>

      <Section title="Assumptions">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Purchase Price ($)">
            <CurrencyInput
              value={deal.purchasePrice}
              onChange={(v) => update({ purchasePrice: v })}
            />
          </Field>
          <Field label="Closing Costs (%)">
            <NumberInput
              value={pctToInput(deal.closingCostsPct)}
              onChange={(v) => update({ closingCostsPct: inputToPct(v) })}
              placeholder="2"
              step="0.1"
            />
          </Field>
          <Field label="Capital Improvements ($)">
            <CurrencyInput
              value={deal.capitalImprovements}
              onChange={(v) => update({ capitalImprovements: v })}
            />
          </Field>
          <Field label="Working Capital ($)">
            <CurrencyInput
              value={deal.workingCapital}
              onChange={(v) => update({ workingCapital: v })}
            />
          </Field>
          <Field label="Rent Growth (% / yr)">
            <NumberInput
              value={pctToInput(deal.rentGrowth)}
              onChange={(v) => update({ rentGrowth: inputToPct(v) })}
              placeholder="3"
              step="0.1"
            />
          </Field>
          <Field label="Expense Increase Rate (% / yr)">
            <NumberInput
              value={pctToInput(deal.expenseGrowth)}
              onChange={(v) => update({ expenseGrowth: inputToPct(v) })}
              placeholder="2.5"
              step="0.1"
            />
          </Field>
          <Field label="Hold Period (years)">
            <NumberInput
              value={deal.holdPeriod}
              onChange={(v) => update({ holdPeriod: Math.max(1, Math.min(10, v || 1)) })}
            />
          </Field>
          <Field
            label={`Exit Cap Rate (%)${
              suggestedExitCap ? ` — suggested ${(suggestedExitCap * 100).toFixed(2)}%` : ''
            }`}
          >
            <NumberInput
              value={pctToInput(deal.exitCapRate)}
              onChange={(v) => update({ exitCapRate: inputToPct(v) })}
              placeholder="6"
              step="0.05"
            />
          </Field>
        </div>
      </Section>

      <Section title="Value-Add Plan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Value-Add Plan?">
            <select
              className="rvc-input"
              value={deal.valueAdd?.enabled ? 'yes' : 'no'}
              onChange={(e) => updateValueAdd({ enabled: e.target.value === 'yes' })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
        </div>

        {deal.valueAdd?.enabled && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Units to Upgrade">
              <NumberInput
                value={deal.valueAdd.unitsToUpgrade}
                onChange={(v) => updateValueAdd({ unitsToUpgrade: Math.max(0, v || 0) })}
                placeholder="30"
              />
            </Field>
            <Field label="Units Renovated per Month">
              <NumberInput
                value={deal.valueAdd.unitsPerMonth}
                onChange={(v) => updateValueAdd({ unitsPerMonth: Math.max(0, v || 0) })}
                placeholder="4"
              />
            </Field>
            <Field label="Avg Cost per Unit ($)">
              <CurrencyInput
                value={deal.valueAdd.costPerUnit}
                onChange={(v) => updateValueAdd({ costPerUnit: Math.max(0, v || 0) })}
                placeholder="15,000"
              />
            </Field>
            <Field label="Avg Rent Premium per Unit ($/mo)">
              <CurrencyInput
                value={deal.valueAdd.premiumPerUnit}
                onChange={(v) => updateValueAdd({ premiumPerUnit: Math.max(0, v || 0) })}
                placeholder="200"
              />
            </Field>
            <div className="md:col-span-2 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              <span className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
                Total Value-Add Capex
              </span>
              <span className="font-serif text-base text-navy tabular-nums">
                {fmtCurrency(
                  (deal.valueAdd.unitsToUpgrade || 0) * (deal.valueAdd.costPerUnit || 0)
                )}
              </span>
            </div>
          </div>
        )}
      </Section>

      <Section title="Sales Comps">
        <p className="text-xs text-slate-500 mb-3">
          Paste comps from your CoStar pull. The filters below control which appear in
          the report — they don't delete anything.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 bg-slate-50 border border-slate-200 rounded-md p-3">
          <Field label="Proximity (miles)">
            <select
              className="rvc-input"
              value={deal.compsFilter?.proximityMiles ?? 25}
              onChange={(e) => updateFilter({ proximityMiles: Number(e.target.value) })}
            >
              <option value="5">Within 5 mi</option>
              <option value="10">Within 10 mi</option>
              <option value="25">Within 25 mi</option>
              <option value="50">Within 50 mi</option>
            </select>
          </Field>
          <Field label="Vintage (± years)">
            <select
              className="rvc-input"
              value={deal.compsFilter?.vintageYears ?? 10}
              onChange={(e) => updateFilter({ vintageYears: Number(e.target.value) })}
            >
              <option value="5">± 5 years</option>
              <option value="10">± 10 years</option>
              <option value="15">± 15 years</option>
              <option value="20">± 20 years</option>
            </select>
          </Field>
          <Field label="Sold Within">
            <select
              className="rvc-input"
              value={deal.compsFilter?.soldWithinYears ?? 3}
              onChange={(e) => updateFilter({ soldWithinYears: Number(e.target.value) })}
            >
              <option value="1">Last 1 year</option>
              <option value="2">Last 2 years</option>
              <option value="3">Last 3 years</option>
              <option value="4">Last 4 years</option>
              <option value="5">Last 5 years</option>
            </select>
          </Field>
        </div>

        {(() => {
          const all = deal.salesComps || [];
          const matching = filterComps(all, deal.compsFilter, deal.yearBuilt);
          return (
            <p className="text-xs text-slate-600 mb-3">
              {all.length === 0
                ? 'No comps added yet — click "+ Add Comp" to start, or paste from CoStar.'
                : `Showing ${matching.length} of ${all.length} comps matching the filter criteria.`}
            </p>
          );
        })()}

        <div className="space-y-3">
          {(deal.salesComps || []).map((comp, idx) => {
            const ppu = comp.units > 0 ? comp.price / comp.units : 0;
            const matching = filterComps([comp], deal.compsFilter, deal.yearBuilt).length > 0;
            return (
              <div
                key={idx}
                className={`grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-md p-3 ${
                  matching ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <div className="md:col-span-6">
                  <label className="rvc-label">Address</label>
                  <input
                    className="rvc-input"
                    value={comp.address || ''}
                    onChange={(e) => updateComp(idx, { address: e.target.value })}
                    placeholder="100 Park Ave, City, ST"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="rvc-label">Year Built</label>
                  <NumberInput
                    value={comp.yearBuilt}
                    onChange={(v) => updateComp(idx, { yearBuilt: Math.max(0, v || 0) })}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="rvc-label">Distance (mi)</label>
                  <NumberInput
                    value={comp.distance}
                    onChange={(v) => updateComp(idx, { distance: Math.max(0, v || 0) })}
                    step="0.1"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="rvc-label">Date Sold</label>
                  <input
                    type="date"
                    className="rvc-input"
                    value={comp.dateSold || ''}
                    onChange={(e) => updateComp(idx, { dateSold: e.target.value })}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="rvc-label">Price ($)</label>
                  <CurrencyInput
                    value={comp.price}
                    onChange={(v) => updateComp(idx, { price: v })}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="rvc-label">Units</label>
                  <NumberInput
                    value={comp.units}
                    onChange={(v) => updateComp(idx, { units: v })}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="rvc-label">$/Unit</label>
                  <div className="text-sm text-slate-ink tabular-nums py-2">
                    {fmtCurrency(ppu)}
                  </div>
                </div>

                <div className="md:col-span-5">
                  <label className="rvc-label">Seller</label>
                  <input
                    className="rvc-input"
                    value={comp.seller || ''}
                    onChange={(e) => updateComp(idx, { seller: e.target.value })}
                    placeholder="Seller name"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="rvc-label">Buyer</label>
                  <input
                    className="rvc-input"
                    value={comp.buyer || ''}
                    onChange={(e) => updateComp(idx, { buyer: e.target.value })}
                    placeholder="Buyer name"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeComp(idx)}
                    className="text-xs uppercase tracking-wide text-red-700 hover:text-red-900"
                    title="Remove comp"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={addComp} className="rvc-btn-secondary mt-3">
          + Add Comp
        </button>
      </Section>
    </div>
  );
}

function FinancialsColumn({
  side,
  label,
  sublabel,
  data,
  updateSide,
  updateSideOpex,
  updateSideItemized,
  disabled = false,
  toggleNode,
  showUpload = false,
  mergeExtracted,
}) {
  const opex = data?.opex || { mode: 'itemized', percent: 0, itemized: {} };
  const itemizedTotal = totalItemizedExpenses(opex.itemized);

  return (
    <div
      className={`border rounded-md p-4 ${
        disabled ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-300 bg-white'
      }`}
    >
      <div className="flex items-start justify-between mb-3 border-b border-slate-200 pb-2">
        <div>
          <h3 className="font-serif text-base text-navy">{label}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{sublabel}</p>
        </div>
        {toggleNode}
      </div>

      {showUpload && <DocumentUploadBar mergeExtracted={mergeExtracted} />}

      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Gross Rental Income ($/yr)">
            <CurrencyInput
              value={data?.grossRent || 0}
              onChange={(v) => updateSide(side, { grossRent: v })}
            />
          </Field>
          <Field label="Vacancy Rate (%)">
            <NumberInput
              value={pctToInput(data?.vacancyRate)}
              onChange={(v) => updateSide(side, { vacancyRate: inputToPct(v) })}
              placeholder="5"
              step="0.1"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Operating Expenses Mode">
              <select
                className="rvc-input"
                value={opex.mode}
                onChange={(e) => updateSideOpex(side, { mode: e.target.value })}
              >
                <option value="itemized">Itemized</option>
                <option value="percent">% of EGI</option>
              </select>
            </Field>
          </div>
        </div>

        {opex.mode === 'percent' ? (
          <Field label="OpEx % of EGI">
            <NumberInput
              value={pctToInput(opex.percent)}
              onChange={(v) => updateSideOpex(side, { percent: inputToPct(v) })}
              placeholder="35"
              step="0.5"
            />
          </Field>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-2">
              {ITEMIZED_FIELDS.map(([key, lbl]) => (
                <Field key={key} label={`${lbl} ($)`}>
                  <CurrencyInput
                    value={opex.itemized?.[key] ?? 0}
                    onChange={(v) => updateSideItemized(side, { [key]: v })}
                  />
                </Field>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-600 font-semibold">
                Total Expenses
              </span>
              <span className="font-serif text-base text-navy tabular-nums">
                {fmtCurrency(itemizedTotal)}
              </span>
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}

function DocumentUploadBar({ mergeExtracted }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const t12Ref = useRef(null);
  const omRef = useRef(null);

  const upload = async (kind, file) => {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      mergeExtracted(data.fields || {});
      const keys = Object.keys(data.fields || {});
      setStatus({
        ok: true,
        msg: `Extracted ${keys.length} field${keys.length === 1 ? '' : 's'} from your ${kind === 't12' ? 'T12' : 'OM'}.`,
      });
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 bg-navy-deep/5 border border-navy/20 rounded-md p-3">
      <p className="text-[11px] uppercase tracking-wide text-navy font-semibold mb-2">
        Auto-Fill from Documents
      </p>
      <p className="text-xs text-slate-600 mb-3">
        Drop a T12 (Excel) and/or an OM (PDF). The tool reads the documents and fills the
        T12 inputs and property details below. Verify everything before relying on it.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="rvc-btn-secondary cursor-pointer text-center">
          <input
            ref={t12Ref}
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              upload('t12', e.target.files?.[0]);
              if (t12Ref.current) t12Ref.current.value = '';
            }}
          />
          {busy ? 'Reading…' : 'Upload T12 (Excel)'}
        </label>
        <label className="rvc-btn-secondary cursor-pointer text-center">
          <input
            ref={omRef}
            type="file"
            accept=".pdf"
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              upload('om', e.target.files?.[0]);
              if (omRef.current) omRef.current.value = '';
            }}
          />
          {busy ? 'Reading…' : 'Upload OM (PDF)'}
        </label>
      </div>
      {status && (
        <p
          className={`text-xs mt-2 ${
            status.ok ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {status.msg}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rvc-card p-5">
      <h2 className="font-serif text-lg text-navy mb-4 border-b border-slate-200 pb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="rvc-label">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, placeholder, step = '1' }) {
  return (
    <input
      type="number"
      className="rvc-input text-right tabular-nums"
      value={value ?? ''}
      step={step}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? 0 : Number(v));
      }}
      placeholder={placeholder}
    />
  );
}

// Currency input: live $ and comma formatting. Stores a plain number in state;
// only the displayed string carries the $ and commas. Stripping non-digits in
// onChange keeps cursor behaviour predictable on right-aligned numerals.
function CurrencyInput({ value, onChange, placeholder }) {
  const display =
    !value || !Number.isFinite(Number(value))
      ? ''
      : '$' + Math.round(Number(value)).toLocaleString('en-US');
  return (
    <input
      type="text"
      inputMode="numeric"
      className="rvc-input text-right tabular-nums"
      value={display}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, '');
        onChange(raw === '' ? 0 : Number(raw));
      }}
      placeholder={placeholder ? '$' + placeholder : '$0'}
    />
  );
}

function pctToInput(decimal) {
  if (decimal === null || decimal === undefined || !Number.isFinite(decimal)) return '';
  return Number((decimal * 100).toFixed(4));
}

function inputToPct(v) {
  return (v || 0) / 100;
}
