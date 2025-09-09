export const CURRENCY = 'Rs';
export const formatCurrency = (value: number | null | undefined, decimals: number = 2) => {
  const num = Number(value || 0);
  return `${CURRENCY}${num.toFixed(decimals)}`;
};
