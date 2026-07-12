function getAppMiniName() {
  const app = typeof getApp === "function" ? getApp() : null;
  return (app && app.globalData && app.globalData.appMiniName) || "做T交易计算器";
}

function compactLines(lines) {
  return lines.filter((line) => line !== undefined && line !== null && String(line).trim() !== "");
}

function appendSource(lines) {
  return compactLines(lines).concat(`来自「${getAppMiniName()}」小程序`).join("\n");
}

function rowMap(result) {
  const map = {};
  ((result && result.rows) || []).forEach((row) => {
    map[row.label] = row.value;
  });
  return map;
}

function buildGenericResultCopy({ title, form, inputs, result }) {
  const rows = rowMap(result);
  const lines = [`【${title}】`];

  (inputs || []).forEach((item) => {
    const value = form && form[item.key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      lines.push(`${item.label}：${value}${item.suffix || ""}`);
    }
  });

  Object.keys(rows).forEach((label) => {
    lines.push(`${label}：${rows[label]}`);
  });

  if (result && Array.isArray(result.gridRows) && result.gridRows.length) {
    lines.push("网格明细：");
    result.gridRows.forEach((row) => {
      lines.push(`${row.level || ""}：买入 ${row.buyPrice || "-"}，卖出 ${row.sellPrice || "-"}，单档净收益 ${row.netProfit || "-"}`);
    });
  }

  return appendSource(lines);
}

function copyText(text) {
  if (!text) {
    wx.showToast({ title: "请先完成测算", icon: "none" });
    return;
  }

  wx.setClipboardData({
    data: text,
    success() {
      wx.showToast({ title: "已复制测算结果", icon: "success" });
    },
    fail() {
      wx.showToast({ title: "复制失败，请重试", icon: "none" });
    }
  });
}

module.exports = {
  appendSource,
  buildGenericResultCopy,
  copyText,
  rowMap
};
