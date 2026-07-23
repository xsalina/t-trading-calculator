const { createWorkbook } = require("./xlsx");
const { calcTradeFee } = require("./fee");
const {
  safeNumber,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  formatMoney,
  formatNumber,
  formatPrice,
  formatRate
} = require("./math");

const MINI_PROGRAM_NAME = "做T交易计算器";

function dash(value) {
  if (value === undefined || value === null || value === "") return "—";
  return value;
}

function groupName(group, index) {
  return group.customName || group.defaultName || ("第" + (index + 1) + "组");
}

function todayText() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function signed(value) {
  const num = safeNumber(value);
  if (num > 0) return formatMoney(num);
  if (num < 0) return "-" + formatMoney(Math.abs(num));
  return "0.00";
}

function hasBase(form, priceKey, sharesKey) {
  return Boolean(safeNumber(form && form[priceKey]) && safeNumber(form && form[sharesKey]));
}

function buildTProfitRows({ groups, feeSettings, includeFee }) {
  const rows = [[
    "分组", "序号", "交易后成本", "交易后持仓", "操作类型", "成交价格", "成交数量", "成交金额", "手续费", "本次收益", "累计收益", "实际资金流"
  ]];

  (groups || []).forEach((group, groupIndex) => {
    const form = group.form || {};
    const initialPrice = safeNumber(form.initialPrice);
    const initialShares = safeNumber(form.initialShares);
    if (!initialPrice || !initialShares) return;

    const baseAmount = safeMultiply(initialPrice, initialShares);
    const baseFee = calcTradeFee({ amount: baseAmount, direction: "BUY", feeSettings, includeFee });
    let state = {
      shares: initialShares,
      totalCost: safeAdd(baseAmount, baseFee.totalFee),
      avgCost: safeDivide(safeAdd(baseAmount, baseFee.totalFee), initialShares),
      realizedProfit: 0
    };

    rows.push([
      groupName(group, groupIndex),
      "0",
      formatPrice(state.avgCost, form.initialPrice),
      formatNumber(state.shares, 0),
      "初始化",
      formatPrice(initialPrice, form.initialPrice),
      formatNumber(initialShares, 0),
      formatMoney(baseAmount),
      formatMoney(baseFee.totalFee),
      "—",
      "0.00",
      signed(-safeAdd(baseAmount, baseFee.totalFee))
    ]);

    (group.operations || []).forEach((operation, index) => {
      const direction = operation.direction;
      const isBuy = direction === "BUY";
      const price = safeNumber(operation.price);
      const shares = safeNumber(operation.shares);
      const amount = safeMultiply(price, shares);
      const fee = calcTradeFee({ amount, direction, feeSettings, includeFee });
      let profit = 0;
      let cashFlow = 0;
      if (isBuy) {
        const buyCost = safeAdd(amount, fee.totalFee);
        state.shares = safeAdd(state.shares, shares);
        state.totalCost = safeAdd(state.totalCost, buyCost);
        state.avgCost = state.shares ? safeDivide(state.totalCost, state.shares) : 0;
        cashFlow = -buyCost;
      } else {
        const income = safeSubtract(amount, fee.totalFee);
        profit = safeSubtract(income, safeMultiply(state.avgCost, shares));
        state.shares = Math.max(0, safeSubtract(state.shares, shares));
        state.totalCost = state.shares ? safeSubtract(state.totalCost, income) : 0;
        state.avgCost = state.shares ? safeDivide(state.totalCost, state.shares) : 0;
        state.realizedProfit = safeAdd(state.realizedProfit, profit);
        cashFlow = income;
      }

      rows.push([
        "",
        String(index + 1),
        formatPrice(state.avgCost, form.initialPrice),
        formatNumber(state.shares, 0),
        isBuy ? "买入" : "卖出",
        formatPrice(price, operation.price || form.initialPrice),
        formatNumber(shares, 0),
        formatMoney(amount),
        formatMoney(fee.totalFee),
        isBuy ? "—" : formatMoney(profit),
        formatMoney(state.realizedProfit),
        signed(cashFlow)
      ]);
    });
  });
  return rows;
}

function getReverseBaseShares(form) {
  return safeNumber(form.basePendingShares) || safeNumber(form.shares);
}

function calcAllocatedSellFee({ sellPrice, shares, basePendingShares, feeSettings, includeFee, externalSellFee }) {
  if (externalSellFee !== undefined && externalSellFee !== null && String(externalSellFee).trim() !== "") {
    if (!basePendingShares || !shares) return 0;
    return safeMultiply(safeNumber(externalSellFee), safeDivide(shares, basePendingShares));
  }
  const totalSellAmount = safeMultiply(safeNumber(sellPrice), safeNumber(basePendingShares));
  if (!totalSellAmount || !basePendingShares || !shares) return 0;
  const totalSellFee = calcTradeFee({ amount: totalSellAmount, direction: "SELL", feeSettings, includeFee }).totalFee;
  return safeMultiply(totalSellFee, safeDivide(shares, basePendingShares));
}

function buildReverseTRows({ groups, feeSettings, includeFee }) {
  const rows = [[
    "分组", "序号", "平均回补价", "剩余待回补", "操作类型", "卖出价格", "回补价格", "回补数量", "手续费", "本次收益", "累计收益"
  ]];

  (groups || []).forEach((group, groupIndex) => {
    const form = group.form || {};
    const sellPrice = safeNumber(form.sellPrice);
    const baseShares = getReverseBaseShares(form);
    if (!sellPrice || !baseShares) return;
    const sellAmount = safeMultiply(sellPrice, baseShares);
    const sellFee = form.externalSellFee !== undefined && form.externalSellFee !== null && String(form.externalSellFee).trim() !== ""
      ? safeNumber(form.externalSellFee)
      : calcTradeFee({ amount: sellAmount, direction: "SELL", feeSettings, includeFee }).totalFee;
    let coveredShares = 0;
    let totalCoverAmount = 0;
    let totalProfit = 0;

    rows.push([
      groupName(group, groupIndex),
      "0",
      "—",
      formatNumber(baseShares, 0),
      "初始化卖出",
      formatPrice(sellPrice, form.sellPrice),
      "—",
      formatNumber(baseShares, 0),
      formatMoney(sellFee),
      "—",
      "0.00"
    ]);

    (group.records || []).forEach((record, index) => {
      const coverPrice = safeNumber(record.coverPrice);
      const shares = safeNumber(record.shares);
      const rowSellPrice = safeNumber(record.sellPrice || form.sellPrice);
      const coverAmount = safeMultiply(coverPrice, shares);
      const allocatedSellFee = calcAllocatedSellFee({
        sellPrice: rowSellPrice,
        shares,
        basePendingShares: baseShares,
        feeSettings,
        includeFee,
        externalSellFee: form.externalSellFee
      });
      const coverFee = calcTradeFee({ amount: coverAmount, direction: "BUY", feeSettings, includeFee });
      const netProfit = safeSubtract(safeMultiply(safeSubtract(rowSellPrice, coverPrice), shares), safeAdd(allocatedSellFee, coverFee.totalFee));
      coveredShares = safeAdd(coveredShares, shares);
      totalCoverAmount = safeAdd(totalCoverAmount, coverAmount);
      totalProfit = safeAdd(totalProfit, netProfit);
      const remainingShares = Math.max(0, safeSubtract(baseShares, coveredShares));
      const avgCoverPrice = coveredShares ? safeDivide(totalCoverAmount, coveredShares) : 0;

      rows.push([
        "",
        String(index + 1),
        avgCoverPrice ? formatPrice(avgCoverPrice, form.sellPrice) : "—",
        formatNumber(remainingShares, 0),
        remainingShares === 0 ? "回补完成" : "回补",
        formatPrice(rowSellPrice, record.sellPrice || form.sellPrice),
        formatPrice(coverPrice, record.coverPrice || form.coverPrice),
        formatNumber(shares, 0),
        formatMoney(coverFee.totalFee),
        formatMoney(netProfit),
        formatMoney(totalProfit)
      ]);
    });
  });
  return rows;
}

function buildAverageDownRows({ groups, feeSettings, includeFee }) {
  const rows = [[
    "分组", "序号", "补仓后成本", "补仓后持仓", "操作类型", "补仓价格", "补仓数量", "补仓金额", "手续费", "成本变化", "变化比例"
  ]];

  (groups || []).forEach((group, groupIndex) => {
    const form = group.form || {};
    const originalCost = safeNumber(form.originalCost);
    const originalShares = safeNumber(form.originalShares);
    if (!originalCost || !originalShares) return;
    let currentAmount = safeMultiply(originalCost, originalShares);
    let currentShares = originalShares;
    let currentCost = originalCost;

    rows.push([
      groupName(group, groupIndex),
      "0",
      formatPrice(originalCost, form.originalCost),
      formatNumber(originalShares, 0),
      "初始化",
      formatPrice(originalCost, form.originalCost),
      formatNumber(originalShares, 0),
      formatMoney(currentAmount),
      "0.00",
      "—",
      "—"
    ]);

    (group.records || []).forEach((record, index) => {
      const buyPrice = safeNumber(record.buyPrice);
      const buyShares = safeNumber(record.buyShares);
      const buyAmount = safeMultiply(buyPrice, buyShares);
      const fee = calcTradeFee({ amount: buyAmount, direction: "BUY", feeSettings, includeFee });
      const nextAmount = safeAdd(currentAmount, safeAdd(buyAmount, fee.totalFee));
      const nextShares = safeAdd(currentShares, buyShares);
      const nextCost = nextShares ? safeDivide(nextAmount, nextShares) : 0;
      const diff = safeSubtract(currentCost, nextCost);
      const directionText = diff > 0 ? "降低" : diff < 0 ? "上升" : "不变";
      const absDiff = Math.abs(diff);
      const rate = currentCost ? safeMultiply(safeDivide(absDiff, currentCost), 100) : 0;

      rows.push([
        "",
        String(index + 1),
        formatPrice(nextCost, form.originalCost),
        formatNumber(nextShares, 0),
        "补仓",
        formatPrice(buyPrice, record.buyPrice || form.buyPrice),
        formatNumber(buyShares, 0),
        formatMoney(buyAmount),
        formatMoney(fee.totalFee),
        directionText + formatMoney(absDiff),
        formatRate(rate)
      ]);

      currentAmount = nextAmount;
      currentShares = nextShares;
      currentCost = nextCost;
    });
  });
  return rows;
}

function hasExportData(type, groups) {
  return (groups || []).some((group) => {
    const form = group.form || {};
    if (type === "t-profit") return hasBase(form, "initialPrice", "initialShares");
    if (type === "reverse-t") return Boolean(safeNumber(form.sellPrice) && getReverseBaseShares(form));
    if (type === "average-down") return hasBase(form, "originalCost", "originalShares");
    return false;
  });
}

function buildExportRows(type, params) {
  const calculatorName = {
    "t-profit": "做T计算器",
    "reverse-t": "反T回补计算器",
    "average-down": "补仓降本计算器"
  }[type] || "计算器";
  const sourceRows = [
    [`数据导出自微信小程序「${MINI_PROGRAM_NAME}」· ${calculatorName}｜仅供个人测算与记录，不构成投资建议`],
    []
  ];
  if (type === "t-profit") return sourceRows.concat(buildTProfitRows(params));
  if (type === "reverse-t") return sourceRows.concat(buildReverseTRows(params));
  if (type === "average-down") return sourceRows.concat(buildAverageDownRows(params));
  return sourceRows;
}

function exportFileName(type) {
  const prefix = {
    "t-profit": "做T交易计算",
    "reverse-t": "反T回补记录",
    "average-down": "补仓计算记录"
  }[type] || "计算记录";
  return prefix + "_" + todayText() + ".xlsx";
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const first = bytes[i];
    const second = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const third = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (first << 16) | (second << 8) | third;
    output += chars[(triplet >> 18) & 63];
    output += chars[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? chars[(triplet >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? chars[triplet & 63] : "=";
  }
  return output;
}

function showExportShareModal(filePath, fileName, onComplete) {
  wx.showModal({
    title: "导出成功",
    content: "文件已生成，可以转发给助手或朋友帮您查看整理。",
    cancelText: "稍后再说",
    confirmText: "转发文件",
    success: (modalRes) => {
      if (!modalRes.confirm) {
        if (typeof onComplete === "function") onComplete(filePath);
        return;
      }
      if (typeof wx.shareFileMessage !== "function") {
        wx.showToast({ title: "当前微信版本暂不支持转发文件", icon: "none" });
        if (typeof onComplete === "function") onComplete(filePath);
        return;
      }
      wx.shareFileMessage({
        filePath,
        fileName,
        success: () => {
          wx.showToast({ title: "已打开转发面板", icon: "none" });
          if (typeof onComplete === "function") onComplete(filePath);
        },
        fail: () => {
          wx.showToast({ title: "转发取消或失败", icon: "none" });
          if (typeof onComplete === "function") onComplete(filePath);
        }
      });
    }
  });
}

function exportCalculatorGroups({ type, groups, feeSettings, includeFee, onComplete }) {
  if (!hasExportData(type, groups)) {
    wx.showToast({ title: "暂无可导出的计算数据", icon: "none" });
    return;
  }
  wx.showModal({
    title: "导出全部数据",
    content: "将导出当前计算器的全部分组和操作明细。",
    confirmText: "确认导出",
    success: (res) => {
      if (!res.confirm) return;
      const rows = buildExportRows(type, { groups, feeSettings, includeFee });
      const buffer = createWorkbook(rows);
      const base64Data = arrayBufferToBase64(buffer);
      const fileName = exportFileName(type);
      const filePath = wx.env.USER_DATA_PATH + "/" + Date.now() + "_" + fileName;
      const fs = wx.getFileSystemManager();
      fs.writeFile({
        filePath,
        data: base64Data,
        encoding: "base64",
        success: () => {
          fs.stat({
            path: filePath,
            success: (statRes) => {
              const size = statRes && statRes.stats && statRes.stats.size;
              if (!size) {
                wx.showToast({ title: "导出文件为空，请重试", icon: "none" });
                return;
              }
              showExportShareModal(filePath, fileName, onComplete);
            },
            fail: () => {
              showExportShareModal(filePath, fileName, onComplete);
            }
          });
        },
        fail: () => {
          wx.showToast({ title: "导出失败，请稍后再试", icon: "none" });
        }
      });
    }
  });
}

module.exports = {
  exportCalculatorGroups
};
