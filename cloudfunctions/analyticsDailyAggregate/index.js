const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const PAGE_SIZE = 100;

function pad(value) {
  return value < 10 ? "0" + value : String(value);
}

function formatChinaDate(date) {
  const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return [
    chinaTime.getUTCFullYear(),
    pad(chinaTime.getUTCMonth() + 1),
    pad(chinaTime.getUTCDate())
  ].join("-");
}

function getDefaultAggregateDate() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return formatChinaDate(yesterday);
}

function createEmptyDaily(date, calculatorType, calculatorName) {
  return {
    date,
    calculatorType,
    calculatorName,
    timezone: "Asia/Shanghai",
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
    proJumpErrorCount: 0,
    updatedAt: db.serverDate()
  };
}

function getUserKey(eventDoc) {
  return eventDoc.openid || eventDoc.clientId || "";
}

function ensureBucket(buckets, eventDoc) {
  const calculatorType = eventDoc.calculatorType || "unknown";
  const key = [eventDoc.date, calculatorType].join("_");
  if (!buckets[key]) {
    buckets[key] = {
      data: createEmptyDaily(eventDoc.date, calculatorType, eventDoc.calculatorName || calculatorType),
      users: {
        view: {},
        entryClick: {},
        resultGenerated: {},
        saveOperation: {},
        export: {},
        proExpose: {},
        proClick: {},
        proJumpSuccess: {},
        proArrive: {}
      }
    };
  }
  return buckets[key];
}

function addUser(bucket, userType, eventDoc) {
  const userKey = getUserKey(eventDoc);
  if (!userKey) return;
  bucket.users[userType][userKey] = true;
}

function collectEvent(buckets, eventDoc) {
  const bucket = ensureBucket(buckets, eventDoc);
  const daily = bucket.data;
  const eventName = eventDoc.eventName;

  if (eventName === "calculator_view") {
    daily.viewCount += 1;
    addUser(bucket, "view", eventDoc);
  } else if (eventName === "calculator_entry_click") {
    daily.entryClickCount += 1;
    addUser(bucket, "entryClick", eventDoc);
  } else if (eventName === "calculator_result_generated") {
    daily.resultGeneratedCount += 1;
    addUser(bucket, "resultGenerated", eventDoc);
  } else if (eventName === "calculator_result_save") {
    daily.saveOperationCount += 1;
    addUser(bucket, "saveOperation", eventDoc);
  } else if (eventName === "calculator_export_click") {
    daily.exportCount += 1;
    addUser(bucket, "export", eventDoc);
  } else if (eventName === "pro_guide_expose") {
    daily.proExposeCount += 1;
    addUser(bucket, "proExpose", eventDoc);
  } else if (eventName === "pro_guide_click") {
    daily.proClickCount += 1;
    addUser(bucket, "proClick", eventDoc);
  } else if (eventName === "pro_jump_success") {
    daily.proJumpSuccessCount += 1;
    addUser(bucket, "proJumpSuccess", eventDoc);
  } else if (eventName === "calculator_source_arrive") {
    daily.proArriveCount += 1;
    addUser(bucket, "proArrive", eventDoc);
  } else if (eventName === "pro_jump_fail") {
    if (eventDoc.properties && eventDoc.properties.isUserCancel) {
      daily.proJumpCancelCount += 1;
    } else {
      daily.proJumpErrorCount += 1;
    }
  }
}

function finalizeBucket(bucket) {
  const daily = bucket.data;
  daily.viewUserCount = Object.keys(bucket.users.view).length;
  daily.entryClickUserCount = Object.keys(bucket.users.entryClick).length;
  daily.resultGeneratedUserCount = Object.keys(bucket.users.resultGenerated).length;
  daily.saveOperationUserCount = Object.keys(bucket.users.saveOperation).length;
  daily.exportUserCount = Object.keys(bucket.users.export).length;
  daily.proExposeUserCount = Object.keys(bucket.users.proExpose).length;
  daily.proClickUserCount = Object.keys(bucket.users.proClick).length;
  daily.proJumpSuccessUserCount = Object.keys(bucket.users.proJumpSuccess).length;
  daily.proArriveUserCount = Object.keys(bucket.users.proArrive).length;
  daily.updatedAt = db.serverDate();
  return daily;
}

async function fetchEventsByDate(date) {
  const events = [];
  let offset = 0;
  while (true) {
    const res = await db.collection("calculator_analytics_events")
      .where({ date })
      .skip(offset)
      .limit(PAGE_SIZE)
      .get();
    const rows = res.data || [];
    events.push.apply(events, rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return events;
}

exports.main = async (event) => {
  const date = event && event.date ? String(event.date) : getDefaultAggregateDate();
  const events = await fetchEventsByDate(date);
  const buckets = {};

  events.forEach((eventDoc) => {
    collectEvent(buckets, eventDoc);
  });

  const keys = Object.keys(buckets);
  for (let i = 0; i < keys.length; i += 1) {
    await db.collection("calculator_analytics_daily").doc(keys[i]).set({
      data: finalizeBucket(buckets[keys[i]])
    });
  }

  return {
    ok: true,
    date,
    eventCount: events.length,
    dailyCount: keys.length
  };
};
