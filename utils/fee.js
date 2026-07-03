const {
  safeNumber,
  safeAdd,
  safeMultiply,
  roundTo
} = require("./math");

const FEE_SETTINGS_KEY = "feeSettings";

const DEFAULT_FEE_SETTINGS = {
  useFee: true,
  commissionEnabled: true,
  commissionRate: 0.00025,
  commissionMinEnabled: true,
  commissionMinAmount: 5,
  transferFeeEnabled: true,
  transferFeeRate: 0.00001,
  stampDutyEnabled: true,
  stampDutyRate: 0.0005,
  stampDutyOnlySell: true
};

function normalizeFeeSettings(settings) {
  return Object.assign({}, DEFAULT_FEE_SETTINGS, settings || {});
}

function getFeeSettings() {
  return normalizeFeeSettings(wx.getStorageSync(FEE_SETTINGS_KEY));
}

function saveFeeSettings(settings) {
  const nextSettings = normalizeFeeSettings(settings);
  wx.setStorageSync(FEE_SETTINGS_KEY, nextSettings);
  return nextSettings;
}

function resetFeeSettings() {
  wx.setStorageSync(FEE_SETTINGS_KEY, DEFAULT_FEE_SETTINGS);
  return DEFAULT_FEE_SETTINGS;
}

function calcTradeFee({ amount, direction, feeSettings, includeFee = true }) {
  if (!includeFee) {
    return {
      commissionFee: 0,
      transferFee: 0,
      stampDutyFee: 0,
      totalFee: 0
    };
  }

  const config = normalizeFeeSettings(feeSettings);
  const tradeAmount = safeNumber(amount);
  let commissionFee = 0;
  let transferFee = 0;
  let stampDutyFee = 0;

  if (config.commissionEnabled) {
    commissionFee = safeMultiply(tradeAmount, config.commissionRate);
    if (config.commissionMinEnabled) {
      commissionFee = Math.max(commissionFee, safeNumber(config.commissionMinAmount));
    }
  }

  if (config.transferFeeEnabled) {
    transferFee = safeMultiply(tradeAmount, config.transferFeeRate);
  }

  if (config.stampDutyEnabled) {
    const shouldCalcStampDuty = !config.stampDutyOnlySell || direction === "SELL";
    if (shouldCalcStampDuty) {
      stampDutyFee = safeMultiply(tradeAmount, config.stampDutyRate);
    }
  }

  const totalFee = safeAdd(safeAdd(commissionFee, transferFee), stampDutyFee);

  return {
    commissionFee: roundTo(commissionFee, 4),
    transferFee: roundTo(transferFee, 4),
    stampDutyFee: roundTo(stampDutyFee, 4),
    totalFee: roundTo(totalFee, 4)
  };
}

module.exports = {
  DEFAULT_FEE_SETTINGS,
  FEE_SETTINGS_KEY,
  normalizeFeeSettings,
  getFeeSettings,
  saveFeeSettings,
  resetFeeSettings,
  calcTradeFee
};
