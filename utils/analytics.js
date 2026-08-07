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
const { callCloudFunction, canCallCloudFunction } = require("./cloud");

const ANALYTICS_QUEUE_KEY = "analyticsEventQueue";
const ANALYTICS_CLIENT_ID_KEY = "analyticsClientId";
const IMMEDIATE_EVENTS = {
  pro_guide_click: true,
  pro_jump_success: true,
  pro_jump_fail: true
};
const ALLOWED_EVENTS = {
  calculator_view: true,
  calculator_entry_click: true,
  calculator_result_generated: true,
  calculator_result_save: true,
  calculator_export_click: true,
  pro_guide_expose: true,
  pro_guide_click: true,
  pro_jump_success: true,
  pro_jump_fail: true,
  calculator_source_arrive: true
};
const MULTI_STEP_CALCULATORS = {
  "t-profit": true,
  "reverse-t": true,
  "average-down": true
};

const sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
const reportedViews = {};
let flushTimer = null;
let isFlushing = false;
let systemInfoCache = null;

function safeReport(eventName, params) {
  if (typeof wx === "undefined" || typeof wx.reportEvent !== "function") return;
  try {
    wx.reportEvent(eventName, params || {});
  } catch (error) {
    // 埋点失败不影响用户继续计算。
  }
}

function getCalculatorName(calculatorType) {
  return CALCULATOR_NAME_MAP[calculatorType] || calculatorType || "";
}

function getSystemInfo() {
  if (systemInfoCache) return systemInfoCache;
  try {
    systemInfoCache = typeof wx.getSystemInfoSync === "function" ? wx.getSystemInfoSync() : {};
  } catch (error) {
    systemInfoCache = {};
  }
  return systemInfoCache;
}

function getAppVersion() {
  try {
    if (typeof wx.getAccountInfoSync === "function") {
      const accountInfo = wx.getAccountInfoSync();
      return (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.version) || "";
    }
  } catch (error) {
    // 低版本基础库可能不可用。
  }
  return "";
}

function getClientId() {
  try {
    let clientId = wx.getStorageSync(ANALYTICS_CLIENT_ID_KEY);
    if (!clientId) {
      clientId = "cli_" + Date.now() + "_" + Math.random().toString(36).slice(2, 12);
      wx.setStorageSync(ANALYTICS_CLIENT_ID_KEY, clientId);
    }
    return clientId;
  } catch (error) {
    return "cli_" + Date.now() + "_" + Math.random().toString(36).slice(2, 12);
  }
}

function createEventId(eventName) {
  return [
    "evt",
    eventName,
    Date.now(),
    Math.random().toString(36).slice(2, 10)
  ].join("_");
}

function readQueue() {
  try {
    return wx.getStorageSync(ANALYTICS_QUEUE_KEY) || [];
  } catch (error) {
    return [];
  }
}

function writeQueue(queue) {
  try {
    wx.setStorageSync(ANALYTICS_QUEUE_KEY, queue || []);
  } catch (error) {
    // 本地队列写入失败时直接放弃，不影响主流程。
  }
}

function pick(source, keys) {
  const result = {};
  keys.forEach((key) => {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      result[key] = source[key];
    }
  });
  return result;
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function normalizeResultCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function getEventProperties(eventName, params) {
  if (eventName === "calculator_entry_click") {
    return pick(params, ["clickTarget", "isDefault", "previousCalculatorType"]);
  }

  if (eventName === "calculator_result_generated") {
    return {
      currentResultCount: normalizeResultCount(params.currentResultCount || params.resultCount),
      market: params.market || "",
      hasFee: normalizeBoolean(params.hasFee || params.includeFee)
    };
  }

  if (eventName === "calculator_result_save") {
    const resultCount = normalizeResultCount(params.resultCount);
    return {
      action: params.action === "initialize" ? "initialize" : "save_operation",
      direction: params.direction || "",
      groupId: params.groupId || "",
      groupIndex: params.groupIndex || 1,
      operationIndex: params.operationIndex || resultCount || "",
      currentResultCount: normalizeResultCount(params.currentResultCount || params.resultCount)
    };
  }

  if (eventName === "calculator_export_click") {
    return {
      groupCount: normalizeResultCount(params.groupCount),
      currentResultCount: normalizeResultCount(params.currentResultCount || params.resultCount)
    };
  }

  if (eventName === "pro_guide_expose" || eventName === "pro_guide_click" || eventName === "pro_jump_success") {
    return {
      guideId: params.guideId || "",
      guideType: params.guideType || "",
      traceId: params.traceId || "",
      hasResult: normalizeBoolean(params.hasResult),
      currentResultCount: normalizeResultCount(params.currentResultCount || params.resultCount),
      targetAction: params.targetAction || "",
      targetPath: params.targetPath || "",
      direction: params.direction || "",
      buttonText: params.buttonText || ""
    };
  }

  if (eventName === "pro_jump_fail") {
    const errorMessage = String(params.errorMessage || "").slice(0, 500);
    return {
      guideId: params.guideId || "",
      traceId: params.traceId || "",
      failReason: params.failReason || "",
      failCategory: params.failCategory || "",
      isUserCancel: normalizeBoolean(params.isUserCancel),
      errorMessage
    };
  }

  if (eventName === "calculator_source_arrive") {
    return {
      traceId: params.traceId || "",
      calculatorType: params.calculatorType || "",
      sourcePage: params.sourcePage || "",
      entryPosition: params.entryPosition || "",
      targetAction: params.targetAction || ""
    };
  }

  return {};
}

function buildCloudEvent(eventName, params) {
  if (!ALLOWED_EVENTS[eventName]) return null;
  const calculatorType = params.calculatorType || "";
  const calculatorName = params.calculatorName || getCalculatorName(calculatorType);
  const systemInfo = getSystemInfo();
  return {
    eventId: params.eventId || createEventId(eventName),
    eventName,
    clientId: getClientId(),
    sessionId,
    calculatorType,
    calculatorName,
    sourcePage: params.sourcePage || "",
    entryPosition: params.entryPosition || "",
    eventTime: Date.now(),
    appVersion: params.appVersion || getAppVersion(),
    platform: params.platform || systemInfo.platform || "",
    properties: getEventProperties(eventName, params)
  };
}

function canUseCloudFunction() {
  return canCallCloudFunction();
}

function callAnalyticsFunction(events, onFail) {
  if (!events || !events.length) return;
  if (!canUseCloudFunction()) {
    if (typeof onFail === "function") onFail();
    return;
  }
  callCloudFunction({
    name: "analyticsReport",
    data: {
      events
    },
    fail() {
      if (typeof onFail === "function") onFail();
    }
  });
}

function flushAnalyticsQueue() {
  if (isFlushing) return;
  const queue = readQueue();
  if (!queue.length) return;
  const batch = queue.slice(0, 10);
  const rest = queue.slice(10);
  writeQueue(rest);
  isFlushing = true;
  callAnalyticsFunction(batch, () => {
    writeQueue(batch.concat(readQueue()));
  });
  setTimeout(() => {
    isFlushing = false;
    if (readQueue().length) {
      scheduleFlush();
    }
  }, 1200);
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushAnalyticsQueue();
  }, 1200);
}

function enqueueCloudEvent(event) {
  const queue = readQueue();
  queue.push(event);
  writeQueue(queue);
  if (queue.length >= 10) {
    flushAnalyticsQueue();
  } else {
    scheduleFlush();
  }
}

function reportAnalyticsEvent(eventName, params, options) {
  const payload = params || {};
  const reportOptions = options || {};
  if (!reportOptions.skipWx) {
    safeReport(eventName, payload);
  }
  const event = buildCloudEvent(eventName, payload);
  if (!event) return;

  if (reportOptions.immediate || IMMEDIATE_EVENTS[eventName]) {
    callAnalyticsFunction([event], () => enqueueCloudEvent(event));
    return;
  }
  enqueueCloudEvent(event);
}

function reportCalculatorView(params) {
  const calculatorType = (params && params.calculatorType) || "";
  const sourcePage = (params && params.sourcePage) || "";
  const viewKey = [calculatorType, sourcePage].join("|");
  if (!calculatorType || reportedViews[viewKey]) return;
  reportedViews[viewKey] = true;
  reportAnalyticsEvent("calculator_view", Object.assign({}, params, {
    calculatorName: (params && params.calculatorName) || getCalculatorName(calculatorType)
  }));
}

function reportCalculatorResult(params) {
  const calculatorType = params.calculatorType || "";
  const payload = Object.assign({}, params, {
    calculatorType,
    calculatorName: params.calculatorName || getCalculatorName(calculatorType)
  });

  safeReport("calculator_result_save", payload);
  reportAnalyticsEvent("calculator_result_generated", payload, { skipWx: true });

  if (MULTI_STEP_CALCULATORS[calculatorType] && (params.action === "initialize" || params.action === "save")) {
    reportAnalyticsEvent("calculator_result_save", payload, { skipWx: true });
  }
}

function reportCalculatorExport(params) {
  const calculatorType = params.calculatorType || "";
  reportAnalyticsEvent("calculator_export_click", Object.assign({}, params, {
    calculatorType,
    calculatorName: params.calculatorName || getCalculatorName(calculatorType)
  }));
}

function getMiniProgramJumpFailReason(error) {
  const errorMessage = (error && error.errMsg) || "";
  const lowerMessage = String(errorMessage).toLowerCase();
  const isUserCancel = lowerMessage.indexOf("cancel") >= 0 || errorMessage.indexOf("取消") >= 0;
  return {
    errorMessage: String(errorMessage).slice(0, 500),
    failReason: isUserCancel ? "user_cancel" : "other",
    failCategory: isUserCancel ? "cancel" : "error",
    isUserCancel
  };
}

function reportProJumpSuccess(params) {
  reportAnalyticsEvent("pro_jump_success", params || {}, { immediate: true });
}

function reportProJumpFail(params, error) {
  reportAnalyticsEvent("pro_jump_fail", Object.assign({}, params || {}, getMiniProgramJumpFailReason(error)), { immediate: true });
}

function reportCalculatorEntryClick(params) {
  const calculatorType = params.calculatorType || "";
  reportAnalyticsEvent("calculator_entry_click", Object.assign({}, params, {
    calculatorType,
    calculatorName: params.calculatorName || getCalculatorName(calculatorType)
  }));
}

function reportCalculatorSourceArrive(params) {
  const calculatorType = (params && params.calculatorType) || "";
  reportAnalyticsEvent("calculator_source_arrive", Object.assign({}, params || {}, {
    calculatorType,
    calculatorName: (params && params.calculatorName) || getCalculatorName(calculatorType)
  }));
}

module.exports = {
  flushAnalyticsQueue,
  getMiniProgramJumpFailReason,
  getCalculatorName,
  reportAnalyticsEvent,
  reportCalculatorEntryClick,
  reportCalculatorExport,
  reportCalculatorResult,
  reportCalculatorSourceArrive,
  reportCalculatorView,
  reportProJumpFail,
  reportProJumpSuccess
};
