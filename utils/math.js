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

function getDecimalLength(value) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  if (!text) return 0;
  const normalized = text.toLowerCase();
  if (normalized.indexOf("e") !== -1) {
    const numberText = Number(text).toFixed(8).replace(/0+$/, "");
    const dotIndex = numberText.indexOf(".");
    return dotIndex === -1 ? 0 : numberText.length - dotIndex - 1;
  }
  const dotIndex = text.indexOf(".");
  return dotIndex === -1 ? 0 : text.length - dotIndex - 1;
}

function clampPriceDigits(digits) {
  return Math.min(4, Math.max(2, digits));
}

function truncateTo(value, digits = 4) {
  const factor = Math.pow(10, digits);
  const num = safeNumber(value);
  return (num < 0 ? Math.ceil(num * factor) : Math.floor(num * factor)) / factor;
}

function formatPrice(value, referenceValue) {
  const hasReference = referenceValue !== undefined && referenceValue !== null && String(referenceValue).trim() !== "";
  const truncated = truncateTo(value, 4);
  const digits = hasReference
    ? clampPriceDigits(getDecimalLength(referenceValue))
    : clampPriceDigits(getDecimalLength(formatNumber(truncated, 4).replace(/0+$/, "").replace(/\.$/, "")));
  return truncated.toFixed(digits);
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
  formatNumber,
  formatPrice
};
