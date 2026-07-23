const CALCULATOR_NAME_MAP = {
  "t-profit": "做T计算器",
  "reverse-t": "反T回补计算器",
  "average-down": "补仓降本计算器",
  "break-even": "回本计算器",
  "take-profit": "止盈目标价计算器",
  "sell-estimate": "卖出测算计算器",
  grid: "网格区间计算器",
  "price-projection": "涨跌幅推演计算器"
};

function safeReport(eventName, params) {
  if (typeof wx.reportEvent !== "function") return;
  try {
    wx.reportEvent(eventName, params);
  } catch (error) {
    // 埋点失败不影响用户继续计算。
  }
}

function getCalculatorName(calculatorType) {
  return CALCULATOR_NAME_MAP[calculatorType] || calculatorType || "";
}

function reportCalculatorResult(params) {
  const calculatorType = params.calculatorType || "";
  safeReport("calculator_result_save", Object.assign({}, params, {
    calculatorType,
    calculatorName: params.calculatorName || getCalculatorName(calculatorType)
  }));
}

function reportCalculatorExport(params) {
  const calculatorType = params.calculatorType || "";
  safeReport("calculator_export_click", Object.assign({}, params, {
    calculatorType,
    calculatorName: params.calculatorName || getCalculatorName(calculatorType)
  }));
}

function getMiniProgramJumpFailReason(error) {
  const errorMessage = (error && error.errMsg) || "";
  const lowerMessage = String(errorMessage).toLowerCase();
  const isUserCancel = lowerMessage.indexOf("cancel") >= 0 || errorMessage.indexOf("取消") >= 0;
  return {
    errorMessage,
    failReason: isUserCancel ? "user_cancel" : "other",
    failCategory: isUserCancel ? "cancel" : "error",
    isUserCancel
  };
}

function reportProJumpSuccess(params) {
  safeReport("pro_jump_success", params || {});
}

function reportProJumpFail(params, error) {
  safeReport("pro_jump_fail", Object.assign({}, params || {}, getMiniProgramJumpFailReason(error)));
}

function reportCalculatorEntryClick(params) {
  const calculatorType = params.calculatorType || "";
  safeReport("calculator_entry_click", Object.assign({}, params, {
    calculatorType,
    calculatorName: params.calculatorName || getCalculatorName(calculatorType)
  }));
}

module.exports = {
  getMiniProgramJumpFailReason,
  getCalculatorName,
  reportCalculatorEntryClick,
  reportCalculatorExport,
  reportCalculatorResult,
  reportProJumpFail,
  reportProJumpSuccess
};
