const { normalizeFeeSettings } = require("./fee");
const { safeNumber, roundTo } = require("./math");

function formatWanRate(rate) {
  return roundTo(safeNumber(rate) * 10000, 3).toString();
}

function formatAmount(value) {
  return roundTo(safeNumber(value), 2).toString();
}

function buildFeeSummary(feeSettings, includeFee) {
  if (!includeFee) return "当前未计入手续费";

  const settings = normalizeFeeSettings(feeSettings);
  const parts = [];
  let commission = "";

  if (settings.commissionEnabled) {
    commission = "万" + formatWanRate(settings.commissionRate);
    if (settings.commissionMinEnabled) {
      commission += "/最低" + formatAmount(settings.commissionMinAmount);
    }
  }

  if (commission) parts.push(commission);

  if (settings.transferFeeEnabled) {
    parts.push("过户万" + formatWanRate(settings.transferFeeRate));
  }

  if (settings.stampDutyEnabled) {
    parts.push(settings.stampDutyOnlySell ? "印花税卖出收" : "印花税双向收");
  }

  return parts.length ? parts.join(" · ") : "当前未启用手续费项目";
}

module.exports = {
  buildFeeSummary
};
