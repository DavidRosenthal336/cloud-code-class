import { totalItemizedExpenses } from '../lib/financials.js';
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
];

export default function DealForm({ deal, setDeal, suggestedExitCap }) {
  const update = (patch) => setDeal({ ...deal, ...patch });
  const updateOpex = (patch) => setDeal({ ...deal, opex: { ...deal.opex, ...patch } });
  const updateItemized = (patch) =>
    setDeal({
      ...deal,
      opex: { ...deal.opex, itemized: { ...deal.opex.itemized, ...patch } },
    });

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
