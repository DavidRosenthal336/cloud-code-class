// Filter comps by proximity, vintage similarity, and recency.
// Missing data on a comp doesn't disqualify it — the relevant filter is simply
// skipped. This keeps the UX forgiving when CoStar paste data is incomplete.
export function filterComps(comps, filter, subjectYearBuilt, today = new Date()) {
  if (!Array.isArray(comps)) return [];
  const f = filter || {};
  return comps.filter((c) => {
    if (!c) return false;

    if (f.proximityMiles && c.distance && c.distance > f.proximityMiles) {
      return false;
    }

    if (f.vintageYears && c.yearBuilt && subjectYearBuilt) {
      if (Math.abs(c.yearBuilt - subjectYearBuilt) > f.vintageYears) return false;
    }

    if (f.soldWithinYears && c.dateSold) {
      const sold = new Date(c.dateSold);
      if (!Number.isNaN(sold.getTime())) {
        const yearsAgo =
          (today.getTime() - sold.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (yearsAgo > f.soldWithinYears) return false;
      }
    }

    return true;
  });
}
