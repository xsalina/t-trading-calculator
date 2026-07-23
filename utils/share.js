const SHARE_TITLE = "做T交易计算器";
const INDEX_SHARE_PATH = "/pages/index/index";
const CALCULATOR_SHARE_PATHS = {
  "t-profit": "/pages/t-profit/t-profit",
  "average-down": "/pages/average-down/average-down",
  "break-even": "/pages/break-even/break-even",
  "take-profit": "/pages/take-profit/take-profit",
  "reverse-t": "/pages/reverse-t/reverse-t",
  "sell-estimate": "/pages/sell-estimate/sell-estimate",
  grid: "/pages/grid/grid",
  "price-projection": "/pages/price-projection/price-projection"
};

let calculatorShareContext = null;

function safeNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  const text = String(value).replace(/[¥,%股\s,+]/g, "");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function rowValue(result, label) {
  const row = ((result && result.rows) || []).find((item) => item.label === label);
  return row && row.value ? String(row.value).trim() : "";
}

function detailValue(items, label) {
  const row = (items || []).find((item) => item.label === label);
  return row && row.value ? String(row.value).trim() : "";
}

function compactMoney(value) {
  const num = safeNumber(value);
  if (!num) return "";
  const abs = Math.abs(num);
  if (abs >= 10000) {
    return trimNumber(abs / 10000, 2) + "万";
  }
  return trimNumber(abs, 2);
}

function trimNumber(value, digits) {
  const num = safeNumber(value);
  if (!num) return "";
  return Number(num.toFixed(digits)).toString();
}

function formatPriceText(value) {
  const num = safeNumber(value);
  if (!num) return "";
  return Number(num.toFixed(3)).toString();
}

function formatRateText(value) {
  const num = safeNumber(value);
  if (!num) return "";
  return num.toFixed(2) + "%";
}

function hasText(value) {
  return value !== undefined && value !== null && String(value).trim() !== "" && safeNumber(value) !== 0;
}

function getContextResult(input) {
  return (input && (input.result || input.summary || input.record && input.record.result)) || input || {};
}

function buildTProfitTitle(context) {
  const result = getContextResult(context);
  const form = (context && context.form) || {};
  const rows = result.rows || [];
  const profitValue = detailValue(rows, "累计已实现收益") || (result.main && result.main.value);
  const originalCost = formatPriceText(form.initialPrice);
  const newCost = formatPriceText(detailValue(rows, "最新成本价"));
  const profit = safeNumber(profitValue);
  if (!profit || !originalCost || !newCost) return "";
  if (profit > 0) {
    const dropRate = safeNumber(originalCost) && safeNumber(newCost)
      ? formatRateText((safeNumber(originalCost) - safeNumber(newCost)) / safeNumber(originalCost) * 100)
      : "";
    return "做T赚" + compactMoney(profitValue) + "，成本" + originalCost + "降至" + newCost + (dropRate ? "，降" + dropRate : "");
  }
  return "做T亏" + compactMoney(profitValue) + "，成本" + originalCost + "变为" + newCost;
}

function buildBreakEvenTitle(context) {
  const result = getContextResult(context);
  const form = (context && context.form) || {};
  const currentPrice = formatPriceText(form.currentPrice || rowValue(result, "当前价"));
  const costPrice = formatPriceText(form.costPrice);
  const status = rowValue(result, "状态");
  if (!currentPrice || !costPrice) return "";
  if (status === "已回本") {
    const rate = rowValue(result, "当前盈利比例");
    return rate ? "现价" + currentPrice + "，成本" + costPrice + "，已盈利" + rate : "";
  }
  const rate = rowValue(result, "还需上涨比例");
  return rate ? "现价" + currentPrice + "，成本" + costPrice + "，还需涨" + rate + "回本" : "";
}

function buildReverseTTitle(context) {
  const result = getContextResult(context);
  const form = (context && context.form) || {};
  const record = context && context.record;
  const sellPrice = formatPriceText((record && record.sellPrice) || form.sellPrice);
  const coverPrice = formatPriceText((record && record.coverPrice) || form.coverPrice || detailValue(record && record.detailItems, "回补价"));
  const profitValue = rowValue(result, "累计反T收益") || detailValue(record && record.mainItems, "本次回补收益") || detailValue(record && record.detailItems, "本次回补收益");
  const shares = trimNumber((record && record.shares) || form.basePendingShares || form.shares, 0);
  if (sellPrice && coverPrice && safeNumber(profitValue) > 0) {
    return sellPrice + "卖出，" + coverPrice + "接回，反T赚" + compactMoney(profitValue);
  }
  if (sellPrice && coverPrice && shares) {
    return sellPrice + "卖" + shares + "股，" + coverPrice + "接回，反T" + (safeNumber(profitValue) < 0 ? "亏" + compactMoney(profitValue) : "收益" + compactMoney(profitValue));
  }
  return "";
}

function buildTakeProfitTitle(context) {
  const result = getContextResult(context);
  const form = (context && context.form) || {};
  const costPrice = formatPriceText(form.costPrice);
  const targetPrice = formatPriceText(rowValue(result, "目标卖出价"));
  const targetProfit = compactMoney(form.targetProfit || rowValue(result, "目标收益"));
  if (!costPrice || !targetPrice || !targetProfit) return "";
  return "成本" + costPrice + "，目标赚" + targetProfit + "，卖出价需到" + targetPrice;
}

function buildAverageDownTitle(context) {
  const result = getContextResult(context);
  const form = (context && context.form) || {};
  const record = context && context.record;
  const originalCost = formatPriceText(form.originalCost);
  const buyPrice = formatPriceText((record && record.buyPrice) || form.buyPrice || detailValue(record && record.detailItems, "补仓价"));
  const shares = trimNumber((record && record.buyShares) || form.buyShares || detailValue(record && record.detailItems, "补仓数量"), 0);
  const newCost = formatPriceText(rowValue(result, "补仓后成本价") || detailValue(record && record.mainItems, "补仓后成本价"));
  if (originalCost && buyPrice && shares && newCost) {
    return "原成本" + originalCost + "，" + buyPrice + "补" + shares + "股，新成本" + newCost;
  }
  return "";
}

function buildSellEstimateTitle(context) {
  const result = getContextResult(context);
  const form = (context && context.form) || {};
  const costPrice = formatPriceText(form.costPrice);
  const sellPrice = formatPriceText(form.sellPrice);
  const sellShares = trimNumber(form.sellShares, 0);
  const profit = rowValue(result, "卖出净收益");
  if (costPrice && sellPrice && sellShares && hasText(profit)) {
    return "成本" + costPrice + "，" + sellPrice + "卖" + sellShares + "股，" + (safeNumber(profit) >= 0 ? "赚" : "亏") + compactMoney(profit);
  }
  const amount = rowValue(result, "卖出金额");
  const remainShares = trimNumber(safeNumber(form.totalShares) - safeNumber(form.sellShares), 0);
  return sellPrice && sellShares && amount && remainShares
    ? sellPrice + "卖" + sellShares + "股，回笼" + compactMoney(amount) + "，还剩" + remainShares + "股"
    : "";
}

function buildGridTitle(context) {
  const result = getContextResult(context);
  const form = (context && context.form) || {};
  const currentPrice = formatPriceText(form.currentPrice || rowValue(result, "当前价"));
  const low = rowValue(result, "下跌网格最低价") || detailValue(context && context.record && context.record.detailItems, "下跌网格最低价");
  const high = rowValue(result, "上涨网格最高价") || detailValue(context && context.record && context.record.detailItems, "上涨网格最高价");
  const levels = trimNumber(form.levels || rowValue(result, "网格档数"), 0);
  if (!currentPrice || !low || !high || !levels) return "";
  return "现价" + currentPrice + "，区间" + formatPriceText(low) + "～" + formatPriceText(high) + "，共" + levels + "格";
}

function buildPriceProjectionTitle(context) {
  const result = getContextResult(context);
  const form = (context && context.form) || {};
  const startPrice = formatPriceText(form.startPrice || rowValue(result, "起始价格"));
  const rate = formatRateText(form.changeRate || rowValue(result, "每日涨跌幅"));
  const finalPrice = formatPriceText(rowValue(result, "第50天价格"));
  const profit = rowValue(result, "第50天盈亏");
  if (!startPrice || !rate || !finalPrice) return "";
  const verb = safeNumber(form.changeRate) >= 0 ? "涨" : "跌";
  if (hasText(profit)) {
    return "现价" + startPrice + verb + rate + "到" + finalPrice + "，持仓" + (safeNumber(profit) >= 0 ? "赚" : "亏") + compactMoney(profit);
  }
  return "现价" + startPrice + "，" + verb + rate + "后到" + finalPrice;
}

function buildCalculatorShareTitle(calculatorType, result) {
  const builders = {
    "t-profit": buildTProfitTitle,
    "break-even": buildBreakEvenTitle,
    "reverse-t": buildReverseTTitle,
    "take-profit": buildTakeProfitTitle,
    "average-down": buildAverageDownTitle,
    "sell-estimate": buildSellEstimateTitle,
    grid: buildGridTitle,
    "price-projection": buildPriceProjectionTitle
  };
  const builder = builders[calculatorType];
  if (!builder) return SHARE_TITLE;
  const title = builder(result);
  return title || SHARE_TITLE;
}

function getCurrentSharePath() {
  const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
  const currentPage = pages[pages.length - 1];
  return currentPage && currentPage.route ? "/" + currentPage.route : INDEX_SHARE_PATH;
}

function getCalculatorSharePath(calculatorType) {
  // const currentPath = getCurrentSharePath();
  // if (currentPath === INDEX_SHARE_PATH) return INDEX_SHARE_PATH;
  return INDEX_SHARE_PATH;
}

function getDefaultSharePath() {
  // const currentPath = getCurrentSharePath();
  // const calculatorPaths = Object.keys(CALCULATOR_SHARE_PATHS).map((key) => CALCULATOR_SHARE_PATHS[key]);
  // if (calculatorPaths.indexOf(currentPath) !== -1) return currentPath;
  return INDEX_SHARE_PATH;
}

function getShareImageUrl(appOrCalculatorType) {
  if (typeof appOrCalculatorType === "string") {
    const app = getApp();
    if (app && typeof app.prepareShareImage === "function") {
      app.prepareShareImage();
    }
    return getShareImageUrl(app);
  }
  const app = appOrCalculatorType;
  const globalData = app && app.globalData ? app.globalData : {};
  const localImage = globalData.shareImageLocal;
  const shareImage = globalData.shareImage;

  if (localImage) return localImage;
  if (shareImage && String(shareImage).indexOf("cloud://") !== 0) return shareImage;
  return "";
}

function getCurrentShareContext() {
  if (calculatorShareContext) return calculatorShareContext;
  const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
  const currentPage = pages[pages.length - 1];
  return currentPage && currentPage.data ? currentPage.data.calculatorShareContext : null;
}

function setCalculatorShareContext(context) {
  calculatorShareContext = context || null;
  const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
  const currentPage = pages[pages.length - 1];
  if (currentPage && typeof currentPage.setData === "function") {
    currentPage.setData({ calculatorShareContext: calculatorShareContext });
  }
}

function isResultShareEvent(event) {
  const dataset = event && event.target && event.target.dataset ? event.target.dataset : {};
  return dataset.shareKind === "result";
}

function getShareMessage(event) {
  const app = getApp();
  if (app && typeof app.prepareShareImage === "function") {
    app.prepareShareImage();
  }

  const context = isResultShareEvent(event) ? getCurrentShareContext() : null;
  const message = {
    title: context && context.calculatorType
      ? buildCalculatorShareTitle(context.calculatorType, context)
      : SHARE_TITLE,
    path: context && context.calculatorType
      ? getCalculatorSharePath(context.calculatorType)
      : getDefaultSharePath()
  };
  const imageUrl = context && context.calculatorType
    ? getShareImageUrl(context.calculatorType)
    : getShareImageUrl(app);
  if (imageUrl) {
    message.imageUrl = imageUrl;
  }
  return message;
}

function getShareTimelineMessage() {
  const message = getShareMessage();
  const timelineMessage = {
    title: message.title,
    query: ""
  };
  if (message.imageUrl) {
    timelineMessage.imageUrl = message.imageUrl;
  }
  return timelineMessage;
}

module.exports = {
  SHARE_TITLE,
  buildCalculatorShareTitle,
  setCalculatorShareContext,
  getShareMessage,
  getShareTimelineMessage
};
