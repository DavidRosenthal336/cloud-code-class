import { describe, it, expect } from 'vitest';
import {
  mortgagePayment,
  annualDebtServiceForYear,
  loanBalanceAfterYears,
  effectiveGrossIncome,
  operatingExpenses,
  totalItemizedExpenses,
  noi,
  capRate,
  dscr,
  totalEquity,
  valueAddTotalCost,
  valueAddPremiumForYear,
  projectYears,
  exitValue,
  saleProceeds,
  irr,
  equityMultiple,
  runUnderwrite,
} from './financials.js';

const sampleItemized = {
  contracts: 30_000,
  payroll: 60_000,
  repairsAndMaintenance: 50_000,
  administrative: 25_000,
  management: 50_000,
  utilities: 30_000,
  reTaxes: 120_000,
  insurance: 25_000,
  marketing: 15_000,
  turnover: 20_000,
};

const sampleDeal = {
  propertyName: 'Test Property',
  address: '123 Main St',
  assetClass: 'multifamily',
  units: 50,
  purchasePrice: 10_000_000,
  t12: {
    grossRent: 1_200_000,
    vacancyRate: 0.05,
    opex: { mode: 'itemized', percent: 0.35, itemized: sampleItemized },
  },
  useProjectedYearOne: false,
  yearOne: {
    grossRent: 1_200_000,
    vacancyRate: 0.05,
    opex: { mode: 'itemized', percent: 0.35, itemized: sampleItemized },
  },
  loanAmount: 7_000_000,
  interestRate: 0.065,
  amortYears: 30,
  ioPeriodYears: 0,
  closingCostsPct: 0.02,
  capitalImprovements: 250_000,
  workingCapital: 150_000,
  rentGrowth: 0.03,
  expenseGrowth: 0.025,
  holdPeriod: 5,
  exitCapRate: 0.06,
};

describe('mortgagePayment', () => {
  it('matches textbook formula for a 30-yr loan', () => {
    const p = mortgagePayment(7_000_000, 0.065, 30);
    expect(p).toBeCloseTo(44244.76, 1);
  });

  it('handles zero interest rate', () => {
    expect(mortgagePayment(360_000, 0, 30)).toBeCloseTo(1000, 5);
  });

  it('returns 0 for zero loan', () => {
    expect(mortgagePayment(0, 0.05, 30)).toBe(0);
  });
});

describe('annualDebtServiceForYear (interest-only handling)', () => {
  it('returns interest-only payment during IO period', () => {
    const ds = annualDebtServiceForYear({ ...sampleDeal, ioPeriodYears: 3 }, 1);
    expect(ds).toBeCloseTo(7_000_000 * 0.065, 0);
  });

  it('switches to amortizing after IO ends', () => {
    const deal = { ...sampleDeal, ioPeriodYears: 3 };
    const dsIO = annualDebtServiceForYear(deal, 3);
    const dsAfter = annualDebtServiceForYear(deal, 4);
    expect(dsAfter).toBeGreaterThan(dsIO);
  });

  it('matches standard amortizing payment when ioPeriodYears is 0', () => {
    const ds = annualDebtServiceForYear(sampleDeal, 1);
    expect(ds).toBeCloseTo(mortgagePayment(7_000_000, 0.065, 30) * 12, 1);
  });
});

describe('loanBalanceAfterYears (with IO)', () => {
  it('keeps balance at full principal during IO years', () => {
    const deal = { ...sampleDeal, ioPeriodYears: 3 };
    expect(loanBalanceAfterYears(deal, 1)).toBe(7_000_000);
    expect(loanBalanceAfterYears(deal, 3)).toBe(7_000_000);
  });

  it('amortizes after IO ends', () => {
    const deal = { ...sampleDeal, ioPeriodYears: 3 };
    const b4 = loanBalanceAfterYears(deal, 4);
    expect(b4).toBeLessThan(7_000_000);
  });

  it('returns full principal at year 0', () => {
    expect(loanBalanceAfterYears(sampleDeal, 0)).toBe(7_000_000);
  });

  it('decreases monotonically without IO', () => {
    const b1 = loanBalanceAfterYears(sampleDeal, 1);
    const b5 = loanBalanceAfterYears(sampleDeal, 5);
    expect(b1).toBeLessThan(7_000_000);
    expect(b5).toBeLessThan(b1);
  });
});

describe('income / expenses', () => {
  it('computes EGI from gross and vacancy', () => {
    expect(effectiveGrossIncome(1_000_000, 0.05)).toBe(950_000);
  });

  it('sums itemized opex across all 10 categories', () => {
    expect(totalItemizedExpenses(sampleItemized)).toBe(425_000);
  });

  it('computes opex as percent of EGI', () => {
    expect(operatingExpenses({ mode: 'percent', percent: 0.4 }, 950_000)).toBe(380_000);
  });

  it('NOI is EGI minus OpEx', () => {
    expect(noi(950_000, 380_000)).toBe(570_000);
  });
});

describe('capRate / dscr', () => {
  it('computes going-in cap rate from purchase price', () => {
    expect(capRate(570_000, 10_000_000)).toBeCloseTo(0.057);
  });

  it('returns 0 for zero purchase price', () => {
    expect(capRate(100_000, 0)).toBe(0);
  });

  it('DSCR returns Infinity for all-cash deal', () => {
    expect(dscr(500_000, 0)).toBe(Infinity);
  });

  it('DSCR computes correctly with debt', () => {
    expect(dscr(570_000, 380_000)).toBeCloseTo(1.5);
  });
});

describe('totalEquity', () => {
  it('sums down payment, closing costs, capex, and working capital', () => {
    const eq = totalEquity(sampleDeal);
    // dp = 3M, cc = 200k, capex = 250k, wc = 150k -> 3.6M
    expect(eq).toBe(3_600_000);
  });

  it('handles all-cash deal (no loan)', () => {
    const eq = totalEquity({ ...sampleDeal, loanAmount: 0 });
    // dp = 10M, cc = 200k, capex = 250k, wc = 150k -> 10.6M
    expect(eq).toBe(10_600_000);
  });
});

describe('projectYears', () => {
  it('projects 10 years with rent and expense growth', () => {
    const p = projectYears(sampleDeal, 10);
    expect(p).toHaveLength(10);
    expect(p[1].grossRent).toBeCloseTo(sampleDeal.t12.grossRent * 1.03);
    // Y2 opex grows at expenseGrowth (2.5%)
    expect(p[1].opex / p[0].opex).toBeCloseTo(1.025, 4);
  });

  it('respects custom expense growth rate', () => {
    const p = projectYears({ ...sampleDeal, expenseGrowth: 0.04 }, 5);
    expect(p[1].opex / p[0].opex).toBeCloseTo(1.04, 4);
  });

  it('reflects IO period in cash flow (higher CF during IO)', () => {
    const ioDeal = { ...sampleDeal, ioPeriodYears: 3 };
    const noIo = projectYears(sampleDeal, 5);
    const withIo = projectYears(ioDeal, 5);
    expect(withIo[0].cashFlow).toBeGreaterThan(noIo[0].cashFlow);
  });
});

describe('saleProceeds', () => {
  it('returns working capital at exit', () => {
    expect(saleProceeds(10_000_000, 6_500_000, 150_000, 0.02)).toBeCloseTo(
      10_000_000 * 0.98 - 6_500_000 + 150_000
    );
  });
});

describe('irr / equityMultiple', () => {
  it('returns null when total cashflows are non-positive', () => {
    expect(irr([-100, 30, 30, 30])).toBe(null);
  });

  it('computes IRR for a simple case', () => {
    expect(irr([-100, 50, 50, 50])).toBeCloseTo(0.2337, 3);
  });

  it('computes equity multiple', () => {
    expect(equityMultiple([100, 100, 100], 1500, 1000)).toBe(1.8);
  });
});

describe('T12 vs projected Year 1 starting point', () => {
  it('uses T12 when useProjectedYearOne is false', () => {
    const p = projectYears(sampleDeal, 1);
    expect(p[0].grossRent).toBeCloseTo(sampleDeal.t12.grossRent);
  });

  it('uses Year 1 projection when useProjectedYearOne is true', () => {
    const projected = {
      ...sampleDeal,
      useProjectedYearOne: true,
      yearOne: {
        ...sampleDeal.yearOne,
        grossRent: 1_400_000, // user projects higher than T12
      },
    };
    const p = projectYears(projected, 1);
    expect(p[0].grossRent).toBeCloseTo(1_400_000);
  });

  it('multi-year projection grows from the chosen starting point', () => {
    const projected = {
      ...sampleDeal,
      useProjectedYearOne: true,
      yearOne: { ...sampleDeal.yearOne, grossRent: 1_500_000 },
    };
    const p = projectYears(projected, 3);
    expect(p[1].grossRent).toBeCloseTo(1_500_000 * 1.03);
  });
});

describe('valueAdd', () => {
  const vaDeal = {
    ...sampleDeal,
    valueAdd: {
      enabled: true,
      unitsToUpgrade: 30,
      unitsPerMonth: 4,
      costPerUnit: 15_000,
      premiumPerUnit: 200,
    },
  };

  it('returns 0 cost when disabled', () => {
    expect(valueAddTotalCost({ ...vaDeal, valueAdd: { ...vaDeal.valueAdd, enabled: false } })).toBe(0);
  });

  it('total cost is units × cost per unit', () => {
    expect(valueAddTotalCost(vaDeal)).toBe(30 * 15_000);
  });

  it('premium income ramps based on monthly velocity', () => {
    // Year 1: 0 -> 48 units would be capped at 30 by year-end; avg = 24 (since
    // halfway through the year average is 24), but capped by total of 30
    // start=0, end=min(30, 4*12)=30, avg=15, premium=15*200*12=36000
    expect(valueAddPremiumForYear(vaDeal, 1)).toBeCloseTo(15 * 200 * 12);
  });

  it('premium income stabilizes at full ramp', () => {
    // Year 2 onwards: all 30 units online, avg=30
    expect(valueAddPremiumForYear(vaDeal, 2)).toBeCloseTo(30 * 200 * 12);
    expect(valueAddPremiumForYear(vaDeal, 5)).toBeCloseTo(30 * 200 * 12);
  });

  it('totalEquity includes value-add capex', () => {
    const baseEq = totalEquity(sampleDeal);
    const vaEq = totalEquity(vaDeal);
    expect(vaEq).toBe(baseEq + 30 * 15_000);
  });

  it('value-add lifts NOI in projections', () => {
    const noVa = projectYears(sampleDeal, 5);
    const withVa = projectYears(vaDeal, 5);
    // Year 2 (full ramp) should have meaningfully higher NOI
    expect(withVa[1].noi).toBeGreaterThan(noVa[1].noi);
  });
});

describe('runUnderwrite (integration)', () => {
  it('returns full payload with new fields', () => {
    const r = runUnderwrite(sampleDeal);
    expect(r.metrics.totalEquity).toBe(3_600_000);
    expect(r.metrics.totalExpenses).toBeCloseTo(425_000, 0);
    expect(r.metrics.noi).toBeGreaterThan(0);
    expect(r.metrics.capRate).toBeGreaterThan(0.04);
    expect(r.projections).toHaveLength(10);
    expect(typeof r.metrics.irr).toBe('number');
  });

  it('IO period boosts early-year cash-on-cash', () => {
    const noIo = runUnderwrite(sampleDeal);
    const withIo = runUnderwrite({ ...sampleDeal, ioPeriodYears: 3 });
    expect(withIo.metrics.cashOnCash).toBeGreaterThan(noIo.metrics.cashOnCash);
  });

  it('handles all-cash deal', () => {
    const r = runUnderwrite({ ...sampleDeal, loanAmount: 0 });
    expect(r.metrics.dscr).toBe(Infinity);
    expect(r.metrics.annualDebtService).toBe(0);
  });
});
