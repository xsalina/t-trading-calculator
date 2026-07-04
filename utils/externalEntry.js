function hasValue(value) {
  return value !== undefined && value !== null && String(value) !== "";
}

function pick(query, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = query[keys[i]];
    if (hasValue(value)) return String(value);
  }
  return "";
}

function normalizeType(value) {
  return String(value || "")
    .replace(/_/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeQuery(query) {
  const source = pick(query, ["source"]);
  const direction = pick(query, ["direction"]).toUpperCase();
  return Object.assign({}, query || {}, {
    source,
    direction
  });
}

function isExternalEntry(query) {
  const data = normalizeQuery(query);
  return data.source === "tradeDetail" || data.source === "account" || hasValue(data.avgCost) || hasValue(data.currentPrice);
}

function buildQueryString(query) {
  return Object.keys(query || {})
    .filter((key) => hasValue(query[key]))
    .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(String(query[key])))
    .join("&");
}

function getPageByType(type) {
  const normalizedType = normalizeType(type);
  const map = {
    "t-profit": "/pages/t-profit/t-profit",
    "tprofit": "/pages/t-profit/t-profit",
    "t": "/pages/t-profit/t-profit",
    "dot": "/pages/t-profit/t-profit",
    "do-t": "/pages/t-profit/t-profit",
    "trade": "/pages/t-profit/t-profit",
    "break-even": "/pages/break-even/break-even",
    "breakeven": "/pages/break-even/break-even",
    "reverse-t": "/pages/reverse-t/reverse-t",
    "reverse": "/pages/reverse-t/reverse-t",
    "take-profit": "/pages/take-profit/take-profit",
    "takeprofit": "/pages/take-profit/take-profit",
    "average-down": "/pages/average-down/average-down",
    "averagedown": "/pages/average-down/average-down",
    "sell-estimate": "/pages/sell-estimate/sell-estimate",
    "sellestimate": "/pages/sell-estimate/sell-estimate",
    "grid": "/pages/grid/grid",
    "price-projection": "/pages/price-projection/price-projection",
    "priceprojection": "/pages/price-projection/price-projection"
  };

  return map[normalizedType] || "";
}

function getEntryRedirectUrl(query) {
  const data = normalizeQuery(query);
  if (!isExternalEntry(data) || data.source === "account") return "";

  const page = getPageByType(data.type) || (data.direction === "REVERSE_T"
    ? "/pages/reverse-t/reverse-t"
    : "/pages/t-profit/t-profit");
  const queryString = buildQueryString(data);
  return queryString ? page + "?" + queryString : page;
}

function withValue(target, key, value) {
  if (hasValue(value)) {
    target[key] = String(value);
  }
}

function getAmount(price, shares) {
  const priceNumber = Number(price);
  const sharesNumber = Number(shares);
  if (!priceNumber || !sharesNumber) return "";
  return String(Math.round(priceNumber * sharesNumber * 100) / 100);
}

function applyExternalFormPreset(pageKey, baseForm, query) {
  const data = normalizeQuery(query);
  const form = Object.assign({}, baseForm);
  if (!isExternalEntry(data) || data.source === "account") {
    return { applied: false, form };
  }

  const avgCost = pick(data, ["avgCost"]);
  const quantity = pick(data, ["quantity"]);
  const currentPrice = pick(data, ["currentPrice", "price"]) || avgCost;
  const direction = data.direction;
  let applied = false;

  if (pageKey === "t-profit" || pageKey === "t-profit-ledger") {
    withValue(form, "initialPrice", avgCost);
    withValue(form, "initialShares", quantity);
    form.direction = direction === "REVERSE_T" ? "BUY" : "SELL";
    withValue(form, "tradePrice", currentPrice);
    withValue(form, "tradeShares", quantity);
    applied = true;
  } else if (pageKey === "reverse-t") {
    withValue(form, "sellPrice", avgCost);
    withValue(form, "coverPrice", currentPrice);
    withValue(form, "shares", quantity);
    withValue(form, "coverAmount", getAmount(currentPrice, quantity));
    applied = true;
  } else if (pageKey === "break-even") {
    withValue(form, "costPrice", avgCost);
    withValue(form, "currentPrice", currentPrice);
    withValue(form, "shares", quantity);
    applied = true;
  } else if (pageKey === "average-down") {
    withValue(form, "originalCost", avgCost);
    withValue(form, "originalShares", quantity);
    withValue(form, "buyPrice", currentPrice);
    applied = true;
  } else if (pageKey === "sell-estimate") {
    withValue(form, "costPrice", avgCost);
    withValue(form, "sellPrice", currentPrice);
    withValue(form, "totalShares", quantity);
    withValue(form, "sellShares", quantity);
    applied = true;
  } else if (pageKey === "take-profit") {
    withValue(form, "costPrice", avgCost);
    withValue(form, "shares", quantity);
    applied = true;
  } else if (pageKey === "grid") {
    withValue(form, "currentPrice", currentPrice);
    withValue(form, "shares", quantity);
    applied = true;
  } else if (pageKey === "price-projection") {
    withValue(form, "startPrice", currentPrice);
    withValue(form, "shares", quantity);
    applied = true;
  }

  return { applied, form };
}

module.exports = {
  applyExternalFormPreset,
  getEntryRedirectUrl,
  isExternalEntry,
  normalizeQuery
};
