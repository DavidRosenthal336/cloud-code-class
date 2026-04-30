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
  const updateOpex = (patch) => setDeal({ ...deal, opex: { ...deal.opex, ...patch } });
  const updateItemized = (patch) =>
    setDeal({
      ...deal,
      opex: { ...deal.opex, itemized: { ...deal.opex.itemized, ...patch } },
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
  const itemizedTotal = totalItemizedExpenses(deal.opex.itemized);

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
        </div>
      </Section>

      <Section title="Financials (Year 1)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Gross Rental Income ($/yr)">
            <NumberInput
              value={deal.grossRent}
              onChange={(v) => update({ grossRent: v })}
            />
          </Field>
          <Field label="Operating Expenses Mode">
            <select
              className="rvc-input"
              value={deal.opex.mode}
              onChange={(e) => updateOpex({ mode: e.target.value })}
            >
              <option value="itemized">Itemized</option>
              <option value="percent">% of EGI</option>
            </select>
          </Field>
        </div>

        {deal.opex.mode === 'percent' ? (
          <div className="mt-4">
            <Field label="OpEx % of EGI">
              <NumberInput
                value={pctToInput(deal.opex.percent)}
                onChange={(v) => updateOpex({ percent: inputToPct(v) })}
                placeholder="35"
                step="0.5"
              />
            </Field>
          </div>
        ) : (
          <div className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ITEMIZED_FIELDS.map(([key, label]) => (
                <Field key={key} label={`${label} ($)`}>
                  <NumberInput
                    value={deal.opex.itemized?.[key] ?? 0}
                    onChange={(v) => updateItemized({ [key]: v })}
                  />
                </Field>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              <span className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
                Total Expenses
              </span>
              <span className="font-serif text-base text-navy tabular-nums">
                {fmtCurrency(itemizedTotal)}
              </span>
            </div>
          </div>
        )}
      </Section>

      <Section title="Loan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Loan Amount ($)">
            <NumberInput
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
            <NumberInput
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
            <NumberInput
              value={deal.capitalImprovements}
              onChange={(v) => update({ capitalImprovements: v })}
            />
          </Field>
          <Field label="Working Capital ($)">
            <NumberInput
              value={deal.workingCapital}
              onChange={(v) => update({ workingCapital: v })}
            />
          </Field>
          <Field label="Vacancy Rate (%)">
            <NumberInput
              value={pctToInput(deal.vacancyRate)}
              onChange={(v) => update({ vacancyRate: inputToPct(v) })}
              placeholder="5"
              step="0.1"
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
              <NumberInput
                value={deal.valueAdd.costPerUnit}
                onChange={(v) => updateValueAdd({ costPerUnit: Math.max(0, v || 0) })}
                placeholder="15000"
              />
            </Field>
            <Field label="Avg Rent Premium per Unit ($/mo)">
              <NumberInput
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
                  <NumberInput
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

function pctToInput(decimal) {
  if (decimal === null || decimal === undefined || !Number.isFinite(decimal)) return '';
  return Number((decimal * 100).toFixed(4));
}

function inputToPct(v) {
  return (v || 0) / 100;
}
