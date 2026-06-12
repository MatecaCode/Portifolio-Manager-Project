export const fmt = (n, opts = {}) => {
  const sign = n < 0 ? '-' : (opts.plus && n > 0 ? '+' : '');
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: opts.dec ?? 2, maximumFractionDigits: opts.dec ?? 2 });
};
export const fmt0 = (n, opts = {}) => fmt(n, { ...opts, dec: 0 });
