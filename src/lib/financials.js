// Pure financial calculations for real estate deal underwriting.
// All functions are pure. All rates are decimals (5% = 0.05). All currency is USD.

const SELLING_COST_PCT = 0.02;

// --- Mortgage primitives ---

export function mortgagePayment(loan, annualRate, amortYears) {
  if (loan <= 0 || amortYears <= 0) return 0;
  const n = amortYears * 12;
  if (annualRate === 0) return loan / n;
  const r = annualRate / 12;
  return (loan * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

// Annual debt service for a given year, accounting for interest-only period.
// During IO years (1..ioYears) borrower pays only interest on the full principal.
// After IO, payments amortize the full principal over the remaining term
// (amortYears - ioYears).
export function annualDebtServiceForYear(deal, year) {
  if (deal.loanAmount <= 0) return 0;
  const ioYears = deal.ioPeriodYears || 0;
  if (year <= ioYears) {
    return deal.loanAmount * deal.interestRate;
  }
  const remainingAmort = Math.max(1, deal.amortYears - ioYears);
  return mortgagePayment(deal.loanAmount, deal.interestRate, remainingAmort) * 12;
}

// Loan balance at the END of year k (after k years of payments).
// During IO the principal is unchanged; afterwards it amortizes over the
// remaining schedule.
export function loanBalanceAfterYears(deal, k) {
  if (deal.loanAmount <= 0 || deal.amortYears <= 0) return 0;
  if (k <= 0) return deal.loanAmount;
  const ioYears = deal.ioPeriodYears || 0;
  if (k <= ioYears) return deal.loanAmount;
  const yearsAmortizing = k - ioYears;
  const remainingAmort = Math.max(1, deal.amortYears - ioYears);
  if (yearsAmortizing >= remainingAmort) return 0;
  const n = remainingAmort * 12;
  const months = yearsAmortizing * 12;
  if (deal.interestRate === 0) {
    const payment = deal.loanAmount / n;
    return Math.max(0, deal.loanAmount - payment * months);
  }
  const r = deal.interestRate / 12;
  const pow = Math.pow(1 + r, n);
  const powK = Math.pow(1 + r, months);
  return deal.loanAmount * ((pow - powK) / (pow - 1));
}

// --- Income / expenses ---

export function effectiveGrossIncome(grossRent, vacancyPct) {
  return grossRent * (1 - vacancyPct);
}

const ITEMIZED_KEYS = [
  'contracts',
  'payroll',
  'repairsAndMaintenance',
  'administrative',
  'management',
  'utilities',
  'reTaxes',
  'insurance',
  'marketing',
  'turnover',
];

export function operatingExpenses(input, egi) {
  if (input.mode === 'percent') {
    return egi * input.percent;
  }
  const i = input.itemized || {};
  return ITEMIZED_KEYS.reduce((sum, key) => sum + (Number(i[key]) || 0), 0);
}

export function totalItemizedExpenses(itemized) {
  return ITEMIZED_KEYS.reduce((sum, key) => sum + (Number(itemized?.[key]) || 0), 0);
}

export function noi(egi, opex) {
  return egi - opex;
}

export function capRate(noiValue, purchasePrice) {
  if (purchasePrice <= 0) return 0;
  return noiValue / purchasePrice;
}

export function dscr(noiValue, debtService) {
  if (debtService <= 0) return Infinity;
  return noiValue / debtService;
}

// --- Value-Add Plan ---

// Total renovation cost: units × cost per unit. Added to total equity at close.
export function valueAddTotalCost(deal) {
  const va = deal.valueAdd;
  if (!va || !va.enabled) return 0;
  return (va.unitsToUpgrade || 0) * (va.costPerUnit || 0);
}

// Annualized premium rent income for a given year, in pre-rent-growth dollars.
// Units come online at the user-specified monthly velocity; premium income
// is computed using the average upgraded-unit count during the year.
export function valueAddPremiumForYear(deal, year) {
  const va = deal.valueAdd;
  if (!va || !va.enabled) return 0;
  const total = va.unitsToUpgrade || 0;
  const perMonth = va.unitsPerMonth || 0;
  const premium = va.premiumPerUnit || 0;
  if (total <= 0 || premium <= 0) return 0;
  const monthsAtStart = (year - 1) * 12;
  const monthsAtEnd = year * 12;
  let unitsAtStart;
  let unitsAtEnd;
  if (perMonth <= 0) {
    unitsAtStart = total;
    unitsAtEnd = total;
  } else {
    unitsAtStart = Math.min(total, perMonth * monthsAtStart);
    unitsAtEnd = Math.min(total, perMonth * monthsAtEnd);
  }
  const avgUnits = (unitsAtStart + unitsAtEnd) / 2;
  return avgUnits * premium * 12;
}

// --- Equity ---

// Total Equity = Down Payment + Closing Costs + Capital Improvements
//              + Working Capital + Value-Add Capex.
// This is the cash an investor must bring to close the deal — used for IRR,
// equity multiple, and cash-on-cash denominators.
export function totalEquity(deal) {
  const downPayment = Math.max(0, deal.purchasePrice - deal.loanAmount);
  const closingCosts = deal.purchasePrice * (deal.closingCostsPct || 0);
  const capex = deal.capitalImprovements || 0;
  const wc = deal.workingCapital || 0;
  const va = valueAddTotalCost(deal);
  return downPayment + closingCosts + capex + wc + va;
}

// Returns the operating snapshot used as the year-1 starting point for the
// multi-year projection. If the user has toggled "Add Year One" on and
// supplied projected first-year numbers, those are used; otherwise we use the
// T12 (trailing-12-months) snapshot.
export function getStartingPoint(deal) {
  if (deal.useProjectedYearOne && deal.yearOne) return deal.yearOne;
  return deal.t12 || {};
}

// --- Projections ---

export function projectYears(deal, years = 10) {
  const out = [];
  let cumulative = 0;
  const start = getStartingPoint(deal);
  const baseRent = start.grossRent || 0;
  const vacancy = start.vacancyRate || 0;
  const opexInput = start.opex || { mode: 'percent', percent: 0 };
  const opexY1 = operatingExpenses(opexInput, effectiveGrossIncome(baseRent, vacancy));
  const expenseGrowth = deal.expenseGrowth ?? 0.025;
  for (let y = 1; y <= years; y++) {
    const growthFactor = Math.pow(1 + (deal.rentGrowth || 0), y - 1);
    const grownBaseRent = baseRent * growthFactor;
    const premiumRent = valueAddPremiumForYear(deal, y) * growthFactor;
    const grossRent = grownBaseRent + premiumRent;
    const egi = effectiveGrossIncome(grossRent, vacancy);
    const opex = opexY1 * Math.pow(1 + expenseGrowth, y - 1);
    const noiY = egi - opex;
    const debtService = annualDebtServiceForYear(deal, y);
    const cashFlow = noiY - debtService;
    cumulative += cashFlow;
    out.push({
      year: y,
      grossRent,
      egi,
      opex,
      noi: noiY,
      debtService,
      cashFlow,
      cumulativeCashFlow: cumulative,
    });
  }
  return out;
}

// T12 snapshot metrics (always computed from deal.t12, regardless of toggle).
// Useful for displaying T12 NOI / cap rate alongside the projection start.
export function t12Snapshot(deal) {
  const t12 = deal.t12 || {};
  const egi = effectiveGrossIncome(t12.grossRent || 0, t12.vacancyRate || 0);
  const opex = operatingExpenses(t12.opex || { mode: 'percent', percent: 0 }, egi);
  return {
    grossRent: t12.grossRent || 0,
    egi,
    opex,
    noi: egi - opex,
    capRate: capRate(egi - opex, deal.purchasePrice),
  };
}

export function exitValue(noiYearAfterExit, exitCapRate) {
  if (exitCapRate <= 0) return 0;
  return noiYearAfterExit / exitCapRate;
}

// At sale: gross proceeds less selling costs, less remaining loan balance,
// plus return of working capital reserve.
export function saleProceeds(exitVal, loanBalance, workingCapital = 0, sellingCostPct = SELLING_COST_PCT) {
  return exitVal * (1 - sellingCostPct) - loanBalance + workingCapital;
}

// IRR via bisection. Returns null if undefined (e.g., no sign change).
export function irr(cashflows) {
  if (!cashflows || cashflows.length < 2) return null;
  const total = cashflows.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  let hasNeg = false;
  let hasPos = false;
  for (const v of cashflows) {
    if (v < 0) hasNeg = true;
    if (v > 0) hasPos = true;
  }
  if (!hasNeg || !hasPos) return null;

  const npv = (rate) => {
    let v = 0;
    for (let i = 0; i < cashflows.length; i++) {
      v += cashflows[i] / Math.pow(1 + rate, i);
    }
    return v;
  };

  let lo = -0.99;
  let hi = 10.0;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (fLo * fHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7 || (hi - lo) / 2 < 1e-9) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export function equityMultiple(annualCashFlows, saleProceedsAtExit, equity) {
  if (equity <= 0) return null;
  const totalIn = annualCashFlows.reduce((s, v) => s + v, 0) + saleProceedsAtExit;
  return totalIn / equity;
}

// --- Orchestrator ---

export function runUnderwrite(deal) {
  const projections = projectYears(deal, 10);
  const y1 = projections[0];
  const equity = totalEquity(deal);
  const goingInCap = capRate(y1.noi, deal.purchasePrice);

  const hold = clamp(deal.holdPeriod, 1, 10);
  const exitProj = projectYears(deal, hold + 1);
  const noiAtExitPlusOne = exitProj[hold].noi;
  const exitVal = exitValue(noiAtExitPlusOne, deal.exitCapRate);
  const loanBalAtExit = loanBalanceAfterYears(deal, hold);
  const proceeds = saleProceeds(exitVal, loanBalAtExit, deal.workingCapital || 0);

  const irrFlows = [-equity];
  for (let y = 1; y <= hold; y++) {
    const cf = projections[y - 1].cashFlow + (y === hold ? proceeds : 0);
    irrFlows.push(cf);
  }
  const irrValue = irr(irrFlows);
  const annualFlows = projections.slice(0, hold).map((p) => p.cashFlow);
  const eqMult = equityMultiple(annualFlows, proceeds, equity);

  const cashOnCash = equity > 0 ? y1.cashFlow / equity : null;

  // Single-axis sensitivity around the input exit cap rate: 9 cells at
  // 0.25% (25bps) increments — 4 below, the input itself, and 4 above.
  const sensitivityDeltas = [-0.01, -0.0075, -0.005, -0.0025, 0, 0.0025, 0.005, 0.0075, 0.01];
  const exitCapAxis = sensitivityDeltas.map((d) => deal.exitCapRate + d);
  const sensitivity = exitCapAxis.map((ec) => {
    const altDeal = { ...deal, exitCapRate: ec };
    return computeIRR(altDeal, hold);
  });

  return {
    inputs: deal,
    metrics: {
      egi: y1.egi,
      noi: y1.noi,
      totalExpenses: y1.opex,
      capRate: goingInCap,
      annualDebtService: y1.debtService,
      cashOnCash,
      dscr: dscr(y1.noi, y1.debtService),
      irr: irrValue,
      equityMultiple: eqMult,
      totalEquity: equity,
      downPayment: Math.max(0, deal.purchasePrice - deal.loanAmount),
      closingCosts: deal.purchasePrice * (deal.closingCostsPct || 0),
      capitalImprovements: deal.capitalImprovements || 0,
      workingCapital: deal.workingCapital || 0,
      valueAddCapex: valueAddTotalCost(deal),
      exitValue: exitVal,
      loanBalanceAtExit: loanBalAtExit,
      saleProceeds: proceeds,
    },
    projections,
    sensitivity,
    sensitivityAxes: { exitCap: exitCapAxis, deltas: sensitivityDeltas },
  };
}

function computeIRR(deal, hold) {
  const equity = totalEquity(deal);
  const proj = projectYears(deal, hold + 1);
  const noiNext = proj[hold].noi;
  const exitVal = exitValue(noiNext, deal.exitCapRate);
  const loanBal = loanBalanceAfterYears(deal, hold);
  const proceeds = saleProceeds(exitVal, loanBal, deal.workingCapital || 0);
  const flows = [-equity];
  for (let y = 1; y <= hold; y++) {
    flows.push(proj[y - 1].cashFlow + (y === hold ? proceeds : 0));
  }
  return irr(flows);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
