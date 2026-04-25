// Display formatting helpers.
export function fmtCurrency(n, opts = {}) {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'N/A';
  const { decimals = 0 } = opts;
  return (
    '$' +
    n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  );
}

export function fmtPercent(n, decimals = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'N/A';
  return (n * 100).toFixed(decimals) + '%';
}

export function fmtMultiple(n, decimals = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'N/A';
  return n.toFixed(decimals) + 'x';
}

export function fmtRatio(n, decimals = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'N/A';
  return n.toFixed(decimals);
}
