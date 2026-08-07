const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

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

// 这里放需要排除的测试 openid / from_openid。不要放 FROM_APPID，否则会过滤所有计算器用户。
const IGNORED_OPENIDS = [
  "oo1kc5Aw2pE-EZD3VZVLdlnCedWo"
];

const COUNT_FIELD_MAP = {
  calculator_view: "viewCount",
  calculator_entry_click: "entryClickCount",
  calculator_result_generated: "resultGeneratedCount",
  calculator_result_save: "saveOperationCount",
  calculator_export_click: "exportCount",
  pro_guide_expose: "proExposeCount",
  pro_guide_click: "proClickCount",
  pro_jump_success: "proJumpSuccessCount",
  calculator_source_arrive: "proArriveCount"
};

function pad(value) {
  return value < 10 ? "0" + value : String(value);
}

function getChinaDateParts(now) {
  const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = chinaTime.getUTCFullYear();
  const month = pad(chinaTime.getUTCMonth() + 1);
  const day = pad(chinaTime.getUTCDate());
  return {
    date: [year, month, day].join("-"),
    hour: chinaTime.getUTCHours()
  };
}

function normalizeText(value, maxLength) {
  const text = value === undefined || value === null ? "" : String(value);
  return text.slice(0, maxLength || 200);
}

function getCallerOpenid(wxContext) {
  return (wxContext && (wxContext.OPENID || wxContext.FROM_OPENID)) || "";
}

function shouldIgnoreCaller(wxContext) {
  if (!wxContext) return false;
  const openid = wxContext.OPENID || "";
  const fromOpenid = wxContext.FROM_OPENID || "";
  return Boolean(openid && IGNORED_OPENIDS.indexOf(openid) >= 0)
    || Boolean(fromOpenid && IGNORED_OPENIDS.indexOf(fromOpenid) >= 0);
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeCurrentResultCount(properties) {
  if (properties.currentResultCount !== undefined) {
    return normalizeNumber(properties.currentResultCount);
  }
  return normalizeNumber(properties.resultCount);
}

function sanitizeProperties(eventName, source) {
  const properties = source || {};
  if (eventName === "calculator_entry_click") {
    return {
      clickTarget: normalizeText(properties.clickTarget, 80),
      isDefault: normalizeBoolean(properties.isDefault),
      previousCalculatorType: normalizeText(properties.previousCalculatorType, 80)
    };
  }

  if (eventName === "calculator_result_generated") {
    return {
      currentResultCount: normalizeCurrentResultCount(properties),
      market: normalizeText(properties.market, 50),
      hasFee: normalizeBoolean(properties.hasFee)
    };
  }

  if (eventName === "calculator_result_save") {
    return {
      action: normalizeText(properties.action, 40),
      direction: normalizeText(properties.direction, 40),
      groupId: normalizeText(properties.groupId, 80),
      groupIndex: normalizeNumber(properties.groupIndex),
      operationIndex: normalizeNumber(properties.operationIndex),
      currentResultCount: normalizeCurrentResultCount(properties)
    };
  }

  if (eventName === "calculator_export_click") {
    return {
      groupCount: normalizeNumber(properties.groupCount),
      currentResultCount: normalizeCurrentResultCount(properties)
    };
  }

  if (eventName === "pro_guide_expose" || eventName === "pro_guide_click" || eventName === "pro_jump_success") {
    return {
      guideId: normalizeText(properties.guideId, 100),
      guideType: normalizeText(properties.guideType, 80),
      traceId: normalizeText(properties.traceId, 120),
      hasResult: normalizeBoolean(properties.hasResult),
      currentResultCount: normalizeCurrentResultCount(properties),
      targetAction: normalizeText(properties.targetAction, 100),
      targetPath: normalizeText(properties.targetPath, 220),
      direction: normalizeText(properties.direction, 40),
      buttonText: normalizeText(properties.buttonText, 80)
    };
  }

  if (eventName === "pro_jump_fail") {
    return {
      guideId: normalizeText(properties.guideId, 100),
      traceId: normalizeText(properties.traceId, 120),
      failReason: normalizeText(properties.failReason, 80),
      failCategory: normalizeText(properties.failCategory, 80),
      isUserCancel: normalizeBoolean(properties.isUserCancel),
      errorMessage: normalizeText(properties.errorMessage, 500)
    };
  }

  if (eventName === "calculator_source_arrive") {
    return {
      traceId: normalizeText(properties.traceId, 120),
      calculatorType: normalizeText(properties.calculatorType, 80),
      sourcePage: normalizeText(properties.sourcePage, 80),
      entryPosition: normalizeText(properties.entryPosition, 100),
      targetAction: normalizeText(properties.targetAction, 100)
    };
  }

  return {};
}

function sanitizeEvent(rawEvent, openid, now) {
  const eventName = normalizeText(rawEvent.eventName, 80);
  if (!ALLOWED_EVENTS[eventName]) return null;

  const timeParts = getChinaDateParts(now);
  const eventId = normalizeText(rawEvent.eventId, 160) || [
    "evt",
    eventName,
    now.getTime(),
    Math.random().toString(36).slice(2, 10)
  ].join("_");

  return {
    eventId,
    eventName,
    openid,
    clientId: normalizeText(rawEvent.clientId, 120),
    sessionId: normalizeText(rawEvent.sessionId, 120),
    calculatorType: normalizeText(rawEvent.calculatorType, 80),
    calculatorName: normalizeText(rawEvent.calculatorName, 120),
    sourcePage: normalizeText(rawEvent.sourcePage, 80),
    entryPosition: normalizeText(rawEvent.entryPosition, 100),
    eventTime: normalizeNumber(rawEvent.eventTime),
    serverTime: db.serverDate(),
    date: timeParts.date,
    hour: timeParts.hour,
    timezone: "Asia/Shanghai",
    appVersion: normalizeText(rawEvent.appVersion, 60),
    platform: normalizeText(rawEvent.platform, 40),
    properties: sanitizeProperties(eventName, rawEvent.properties || {})
  };
}

async function saveRawEvent(eventDoc) {
  try {
    await db.collection("calculator_analytics_events").add({
      data: Object.assign({
        _id: eventDoc.eventId
      }, eventDoc)
    });
    return true;
  } catch (error) {
    const message = String((error && error.errMsg) || (error && error.message) || "");
    if (message.indexOf("duplicate") >= 0 || message.indexOf("document exist") >= 0 || message.indexOf("already exists") >= 0) {
      return false;
    }
    throw error;
  }
}

async function updateDaily(eventDoc) {
  let countField = COUNT_FIELD_MAP[eventDoc.eventName];
  if (eventDoc.eventName === "pro_jump_fail") {
    countField = eventDoc.properties && eventDoc.properties.isUserCancel ? "proJumpCancelCount" : "proJumpErrorCount";
  }
  if (!countField) return;

  const dailyId = [eventDoc.date, eventDoc.calculatorType || "unknown"].join("_");
  const basePatch = {
    date: eventDoc.date,
    calculatorType: eventDoc.calculatorType,
    calculatorName: eventDoc.calculatorName,
    timezone: "Asia/Shanghai",
    updatedAt: db.serverDate()
  };

  let exists = false;
  try {
    const dailyDoc = await db.collection("calculator_analytics_daily").doc(dailyId).get();
    exists = Boolean(dailyDoc && dailyDoc.data);
  } catch (error) {
    exists = false;
  }

  if (!exists) {
    await db.collection("calculator_analytics_daily").doc(dailyId).set({
      data: Object.assign({
        viewCount: 0,
        viewUserCount: 0,
        entryClickCount: 0,
        entryClickUserCount: 0,
        resultGeneratedCount: 0,
        resultGeneratedUserCount: 0,
        saveOperationCount: 0,
        saveOperationUserCount: 0,
        exportCount: 0,
        exportUserCount: 0,
        proExposeCount: 0,
        proExposeUserCount: 0,
        proClickCount: 0,
        proClickUserCount: 0,
        proJumpSuccessCount: 0,
        proJumpSuccessUserCount: 0,
        proArriveCount: 0,
        proArriveUserCount: 0,
        proJumpCancelCount: 0,
        proJumpErrorCount: 0
      }, basePatch, {
        [countField]: 1
      })
    });
  } else {
    await db.collection("calculator_analytics_daily").doc(dailyId).update({
      data: Object.assign({}, basePatch, {
        [countField]: _.inc(1)
      })
    });
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = getCallerOpenid(wxContext);
  if (shouldIgnoreCaller(wxContext)) {
    return {
      ok: true,
      ignored: true,
      accepted: 0,
      rejected: 0
    };
  }
  const now = new Date();
  const rawEvents = Array.isArray(event.events) ? event.events.slice(0, 10) : [];
  const result = {
    ok: true,
    accepted: 0,
    rejected: 0,
    dailyUpdated: 0,
    dailyFailed: 0
  };

  for (let i = 0; i < rawEvents.length; i += 1) {
    const eventDoc = sanitizeEvent(rawEvents[i] || {}, openid, now);
    if (!eventDoc) {
      result.rejected += 1;
      continue;
    }

    const inserted = await saveRawEvent(eventDoc);
    if (inserted) {
      try {
        await updateDaily(eventDoc);
        result.dailyUpdated += 1;
      } catch (error) {
        result.dailyFailed += 1;
        console.error("calculator_analytics_daily 更新失败", {
          eventId: eventDoc.eventId,
          eventName: eventDoc.eventName,
          calculatorType: eventDoc.calculatorType,
          date: eventDoc.date,
          error
        });
      }
      result.accepted += 1;
    }
  }

  return result;
};
