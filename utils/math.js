const MONEY_PRECISION = 10000;

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function safeAdd(a, b, precision = MONEY_PRECISION) {
  return (Math.round(safeNumber(a) * precision) + Math.round(safeNumber(b) * precision)) / precision;
}

function safeSubtract(a, b, precision = MONEY_PRECISION) {
  return (Math.round(safeNumber(a) * precision) - Math.round(safeNumber(b) * precision)) / precision;
}

function safeMultiply(a, b, precision = MONEY_PRECISION) {
  return Math.round(safeNumber(a) * precision) * Math.round(safeNumber(b) * precision) / (precision * precision);
}

function safeDivide(a, b) {
  const divisor = safeNumber(b);
  if (!divisor) return 0;
  return safeNumber(a) / divisor;
}

function roundTo(value, digits = 4) {
  const factor = Math.pow(10, digits);
  return Math.round(safeNumber(value) * factor) / factor;
}

function formatMoney(value) {
  return roundTo(value, 2).toFixed(2);
}

function formatRate(value) {
  return roundTo(value, 2).toFixed(2) + "%";
}

function formatNumber(value, digits = 4) {
  return roundTo(value, digits).toFixed(digits);
}

module.exports = {
  MONEY_PRECISION,
  safeNumber,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  roundTo,
  formatMoney,
  formatRate,
  formatNumber
};
