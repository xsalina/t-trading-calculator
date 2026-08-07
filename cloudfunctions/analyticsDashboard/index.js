const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const PAGE_SIZE = 100;

const RANGE_LABELS = {
  today: "今日",
  yesterday: "昨日",
  last7: "近7天",
  last15: "近15天",
  last30: "近30天"
};

const RANGE_DAYS = {
  today: 1,
  yesterday: 1,
  last7: 7,
  last15: 15,
  last30: 30
};

// 把管理员 openid 填到这里即可，例如：["oAbcxxxxxxxxxxxx"]
const ADMIN_OPENIDS = ['oo1kc5Aw2pE-EZD3VZVLdlnCedWo'];

function pad(value) {
  return value < 10 ? "0" + value : String(value);
}

function getChinaDate(offsetDays) {
  const now = new Date();
  const target = new Date(now.getTime() + 8 * 60 * 60 * 1000 - offsetDays * 24 * 60 * 60 * 1000);
  return [
    target.getUTCFullYear(),
    pad(target.getUTCMonth() + 1),
    pad(target.getUTCDate())
  ].join("-");
}

function buildDateRange(range) {
  if (range === "yesterday") return [getChinaDate(1)];
  const days = RANGE_DAYS[range] || RANGE_DAYS.today;
  const dates = [];
  for (let i = 0; i < days; i += 1) {
    dates.push(getChinaDate(i));
  }
  return dates;
}

function unique(values) {
  const map = {};
  const result = [];
  (values || []).forEach((value) => {
    if (!value || map[value]) return;
    map[value] = true;
    result.push(value);
  });
  return result;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function rate(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function formatPercent(value) {
  return (value * 100).toFixed(2) + "%";
}

function emptyTotals() {
  return {
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
  };
}

function addDaily(target, row) {
  Object.keys(emptyTotals()).forEach((key) => {
    target[key] += safeNumber(row[key]);
  });
}

function buildRankingItem(row) {
  const proClickRate = rate(row.proClickUserCount, row.proExposeUserCount);
  const proArriveRate = rate(row.proArriveUserCount, row.proClickUserCount);
  const diversionRate = rate(row.proArriveUserCount, row.resultGeneratedUserCount);
  return Object.assign({}, row, {
    proClickRate,
    proClickRateText: formatPercent(proClickRate),
    proArriveRate,
    proArriveRateText: formatPercent(proArriveRate),
    diversionRate,
    diversionRateText: formatPercent(diversionRate)
  });
}

function normalizeDailyRow(row) {
  return Object.assign({
    calculatorType: "",
    calculatorName: ""
  }, emptyTotals(), row || {});
}

function getCallerOpenid(wxContext) {
  return (wxContext && (wxContext.OPENID || wxContext.FROM_OPENID)) || "";
}

async function isAdmin(openid) {
  if (!openid) return false;
  return ADMIN_OPENIDS.indexOf(openid) >= 0;
}

async function fetchDailyRows(dates) {
  const rows = [];
  for (let i = 0; i < dates.length; i += 10) {
    const batchDates = dates.slice(i, i + 10);
    const res = await db.collection("calculator_analytics_daily")
      .where({
        date: _.in(batchDates)
      })
      .limit(1000)
      .get();
    rows.push.apply(rows, res.data || []);
  }
  return rows;
}

async function fetchEventRowsByDates(dates) {
  const rows = [];
  for (let i = 0; i < dates.length; i += 1) {
    let offset = 0;
    while (true) {
      const res = await db.collection("calculator_analytics_events")
        .where({
          date: dates[i]
        })
        .skip(offset)
        .limit(PAGE_SIZE)
        .get();
      const batch = res.data || [];
      rows.push.apply(rows, batch);
      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  return rows;
}

function createRawBucket(date, calculatorType, calculatorName) {
  return {
    data: normalizeDailyRow({
      date,
      calculatorType,
      calculatorName
    }),
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

function addRawUser(bucket, type, eventDoc) {
  const userKey = eventDoc.openid || eventDoc.clientId || "";
  if (!userKey) return;
  bucket.users[type][userKey] = true;
}

function aggregateRawEvents(events) {
  const buckets = {};
  (events || []).forEach((eventDoc) => {
    const calculatorType = eventDoc.calculatorType || "unknown";
    const key = [eventDoc.date || "", calculatorType].join("_");
    if (!buckets[key]) {
      buckets[key] = createRawBucket(eventDoc.date || "", calculatorType, eventDoc.calculatorName || calculatorType);
    }
    const bucket = buckets[key];
    const row = bucket.data;
    const eventName = eventDoc.eventName || "";

    if (eventName === "calculator_view") {
      row.viewCount += 1;
      addRawUser(bucket, "view", eventDoc);
    } else if (eventName === "calculator_entry_click") {
      row.entryClickCount += 1;
      addRawUser(bucket, "entryClick", eventDoc);
    } else if (eventName === "calculator_result_generated") {
      row.resultGeneratedCount += 1;
      addRawUser(bucket, "resultGenerated", eventDoc);
    } else if (eventName === "calculator_result_save") {
      row.saveOperationCount += 1;
      addRawUser(bucket, "saveOperation", eventDoc);
    } else if (eventName === "calculator_export_click") {
      row.exportCount += 1;
      addRawUser(bucket, "export", eventDoc);
    } else if (eventName === "pro_guide_expose") {
      row.proExposeCount += 1;
      addRawUser(bucket, "proExpose", eventDoc);
    } else if (eventName === "pro_guide_click") {
      row.proClickCount += 1;
      addRawUser(bucket, "proClick", eventDoc);
    } else if (eventName === "pro_jump_success") {
      row.proJumpSuccessCount += 1;
      addRawUser(bucket, "proJumpSuccess", eventDoc);
    } else if (eventName === "calculator_source_arrive") {
      row.proArriveCount += 1;
      addRawUser(bucket, "proArrive", eventDoc);
    } else if (eventName === "pro_jump_fail") {
      if (eventDoc.properties && eventDoc.properties.isUserCancel) {
        row.proJumpCancelCount += 1;
      } else {
        row.proJumpErrorCount += 1;
      }
    }
  });

  return Object.keys(buckets).map((key) => {
    const bucket = buckets[key];
    const row = bucket.data;
    row.viewUserCount = Object.keys(bucket.users.view).length;
    row.entryClickUserCount = Object.keys(bucket.users.entryClick).length;
    row.resultGeneratedUserCount = Object.keys(bucket.users.resultGenerated).length;
    row.saveOperationUserCount = Object.keys(bucket.users.saveOperation).length;
    row.exportUserCount = Object.keys(bucket.users.export).length;
    row.proExposeUserCount = Object.keys(bucket.users.proExpose).length;
    row.proClickUserCount = Object.keys(bucket.users.proClick).length;
    row.proJumpSuccessUserCount = Object.keys(bucket.users.proJumpSuccess).length;
    row.proArriveUserCount = Object.keys(bucket.users.proArrive).length;
    row.updatedAt = new Date();
    return row;
  });
}

function buildDashboard(rows) {
  const totals = emptyTotals();
  const map = {};
  let updatedAt = null;

  rows.forEach((rawRow) => {
    const row = normalizeDailyRow(rawRow);
    addDaily(totals, row);
    const key = row.calculatorType || "unknown";
    if (!map[key]) {
      map[key] = normalizeDailyRow({
        calculatorType: key,
        calculatorName: row.calculatorName || key
      });
    }
    addDaily(map[key], row);
    if (rawRow.updatedAt) updatedAt = rawRow.updatedAt;
  });

  const proClickRate = rate(totals.proClickUserCount, totals.proExposeUserCount);
  const proJumpSuccessRate = rate(totals.proJumpSuccessUserCount, totals.proClickUserCount);
  const proArriveRate = rate(totals.proArriveUserCount, totals.proClickUserCount);
  const diversionRate = rate(totals.proArriveUserCount, totals.resultGeneratedUserCount);
  const ranking = Object.keys(map).map((key) => buildRankingItem(map[key]));
  ranking.sort((a, b) => b.resultGeneratedUserCount - a.resultGeneratedUserCount);

  return {
    totals: Object.assign({}, totals, {
      proClickRate,
      proClickRateText: formatPercent(proClickRate),
      proJumpSuccessRate,
      proJumpSuccessRateText: formatPercent(proJumpSuccessRate),
      proArriveRate,
      proArriveRateText: formatPercent(proArriveRate),
      diversionRate,
      diversionRateText: formatPercent(diversionRate)
    }),
    funnel: [
      { label: "Pro曝光", userCount: totals.proExposeUserCount, count: totals.proExposeCount },
      { label: "Pro点击", userCount: totals.proClickUserCount, count: totals.proClickCount },
      { label: "跳转成功", userCount: totals.proJumpSuccessUserCount, count: totals.proJumpSuccessCount },
      { label: "真实到达", userCount: totals.proArriveUserCount, count: totals.proArriveCount }
    ],
    ranking,
    updatedAt
  };
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = getCallerOpenid(wxContext);
  const admin = await isAdmin(openid);
  if (!admin) {
    return {
      ok: false,
      isAdmin: false,
      message: "数据出错啦！"
    };
  }

  const action = event && event.action ? String(event.action) : "dashboard";
  if (action === "checkAdmin") {
    return {
      ok: true,
      isAdmin: true
    };
  }

  const range = RANGE_LABELS[event && event.range] ? event.range : "today";
  const dates = buildDateRange(range);
  const today = getChinaDate(0);
  const dailyRows = await fetchDailyRows(dates);
  const dailyDates = unique(dailyRows.map((row) => row.date));
  const rawDates = dates.filter((date) => date === today || dailyDates.indexOf(date) < 0);
  let rows = dailyRows.filter((row) => rawDates.indexOf(row.date) < 0);
  let dataSource = "daily";
  if (rawDates.length) {
    const eventRows = await fetchEventRowsByDates(rawDates);
    rows = rows.concat(aggregateRawEvents(eventRows));
    dataSource = dailyRows.length ? "daily_events_mixed" : "events_fallback";
  }
  return Object.assign({
    ok: true,
    isAdmin: true,
    range,
    rangeLabel: RANGE_LABELS[range],
    dates,
    dataSource
  }, buildDashboard(rows));
};
