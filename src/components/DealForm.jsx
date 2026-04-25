const ASSET_CLASSES = ['multifamily', 'office', 'retail', 'industrial', 'coworking'];

export default function DealForm({ deal, setDeal, suggestedExitCap }) {
  const update = (patch) => setDeal({ ...deal, ...patch });
  const updateOpex = (patch) => setDeal({ ...deal, opex: { ...deal.opex, ...patch } });
  const updateItemized = (patch) =>
    setDeal({
      ...deal,
      opex: { ...deal.opex, itemized: { ...deal.opex.itemized, ...patch } },
    });

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
              <NumberInput
                value={deal.units}
                onChange={(v) => update({ units: v })}
                placeholder="50"
              />
            </Field>
          ) : (
            <Field label="Square Footage">
              <NumberInput
                value={deal.squareFootage}
                onChange={(v) => update({ squareFootage: v })}
                placeholder="50000"
              />
            </Field>
          )}
        </div>
      </Section>

      <Section title="Financials">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Asking Price ($)">
            <NumberInput
              value={deal.askingPrice}
              onChange={(v) => update({ askingPrice: v })}
              placeholder="10000000"
            />
          </Field>
          <Field label="Gross Rental Income ($/yr)">
            <NumberInput
              value={deal.grossRent}
              onChange={(v) => update({ grossRent: v })}
              placeholder="1200000"
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
          <Field label="Operating Expenses">
            <select
              className="rvc-input"
              value={deal.opex.mode}
              onChange={(e) => updateOpex({ mode: e.target.value })}
            >
              <option value="percent">% of EGI</option>
              <option value="itemized">Itemized</option>
            </select>
          </Field>

          {deal.opex.mode === 'percent' ? (
            <Field label="OpEx % of EGI">
              <NumberInput
                value={pctToInput(deal.opex.percent)}
                onChange={(v) => updateOpex({ percent: inputToPct(v) })}
                placeholder="35"
                step="0.5"
              />
            </Field>
          ) : (
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                ['taxes', 'Taxes'],
                ['insurance', 'Insurance'],
                ['management', 'Management'],
                ['maintenance', 'Maintenance'],
                ['utilities', 'Utilities'],
                ['reserves', 'Reserves'],
              ].map(([key, label]) => (
                <Field key={key} label={`${label} ($)`}>
                  <NumberInput
                    value={deal.opex.itemized?.[key] ?? 0}
                    onChange={(v) => updateItemized({ [key]: v })}
                  />
                </Field>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Financing & Assumptions">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Loan Amount ($)">
            <NumberInput
              value={deal.loanAmount}
              onChange={(v) => update({ loanAmount: v })}
              placeholder="7000000"
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
              placeholder="30"
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
          <Field label="Hold Period (years)">
            <NumberInput
              value={deal.holdPeriod}
              onChange={(v) => update({ holdPeriod: Math.max(1, Math.min(10, v || 1)) })}
              placeholder="5"
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
