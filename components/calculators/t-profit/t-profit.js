const { getFeeSettings } = require("../../../utils/fee");
const { calcTradeFee } = require("../../../utils/fee");
const {
  safeNumber,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  roundTo,
  formatMoney,
  formatNumber
} = require("../../../utils/math");
const { getSavedState, saveState, makeTimeText } = require("../../../utils/pageState");
const { getShareMessage, getShareTimelineMessage } = require("../../../utils/share");
const { applyExternalFormPreset } = require("../../../utils/externalEntry");
const { appendSource, copyText, rowMap } = require("../../../utils/resultCopy");
const { buildFeeSummary } = require("../../../utils/feeSummary");

const PAGE_KEY = "t-profit-ledger";

const DEFAULT_FORM = {
  initialPrice: "",
  initialShares: "",
  direction: "SELL",
  tradePrice: "",
  tradeShares: "",
  tradeAmount: "",
  convertUnit: "100",
  roundLot: true,
  includeFee: true
};

function resultClass(value) {
  const num = safeNumber(value);
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "";
}

function getConvertUnit(form) {
  if (form.convertUnit) return safeNumber(form.convertUnit) || 100;
  return form.roundLot === false ? 1 : 100;
}

function calcSharesByAmount(amount, price, convertUnit) {
  const rawShares = safeDivide(safeNumber(amount), safeNumber(price));
  const unit = safeNumber(convertUnit) || 100;
  return Math.max(0, Math.floor(rawShares / unit) * unit);
}

Component({
  properties: {
    entryQuery: {
      type: Object,
      value: {},
      observer() {
        this.initCalculator();
      }
    },
    embedded: {
      type: Boolean,
      value: false
    }
  },

  data: {
    form: DEFAULT_FORM,
    feeSettings: {},
    feeSummary: "",
    rememberData: true,
    operations: [],
    summary: null,
    preview: null
  },


  lifetimes: {
    attached() {
      this.initCalculator();
    }
  },

  pageLifetimes: {
    show() {
      this.initCalculator();
    }
  },

  methods: {
    initCalculator() {
    const feeSettings = getFeeSettings();
    const saved = getSavedState(PAGE_KEY);
    const rememberData = saved.rememberData !== false;
    let form = rememberData
      ? Object.assign({}, DEFAULT_FORM, saved.form || {}, {
        includeFee: typeof (saved.form || {}).includeFee === "boolean" ? saved.form.includeFee : feeSettings.useFee
      })
      : Object.assign({}, this.data.form, { includeFee: feeSettings.useFee });
    form.convertUnit = String(getConvertUnit(form));
    const operations = rememberData ? (saved.operations || []) : [];
    const externalPreset = applyExternalFormPreset(PAGE_KEY, form, this.data.entryQuery || {});
    form = externalPreset.form;

    this.setData({
      feeSettings,
      feeSummary: buildFeeSummary(feeSettings, form.includeFee),
      rememberData,
      form,
      operations
    });
    this.refreshAll();
    if (externalPreset.applied) {
      this.persistState();
    }
  },

  onInput(event) {
    const key = event.currentTarget.dataset.key;
    this.updateForm({ [key]: event.detail.value }, key);
  },

  onSwitchChange(event) {
    const key = event.currentTarget.dataset.key;
    this.updateForm({ [key]: event.detail.value }, key);
  },

  onRememberSwitch(event) {
    const rememberData = event.detail.value;
    this.setData({ rememberData });
    if (rememberData) {
      this.persistState();
    } else {
      saveState(PAGE_KEY, { rememberData: false });
    }
  },

  setDirection(event) {
    const direction = event.currentTarget.dataset.direction;
    this.updateForm({ direction }, "direction");
  },

  setConvertUnit(event) {
    const convertUnit = String(event.currentTarget.dataset.unit || "100");
    this.updateForm({ convertUnit }, "convertUnit");
  },

  adjustNumber(event) {
    const key = event.currentTarget.dataset.key;
    const step = safeNumber(event.currentTarget.dataset.step);
    const min = event.currentTarget.dataset.min;
    const minValue = min === undefined ? null : safeNumber(min);
    const currentValue = safeNumber(this.data.form[key]);
    let nextValue = roundTo(currentValue + step, 4);

    if (minValue !== null && nextValue < minValue) {
      nextValue = minValue;
    }

    this.updateForm({ [key]: Number.isInteger(nextValue) ? String(nextValue) : String(nextValue) }, key);
  },

  updateForm(updates, key) {
    const form = Object.assign({}, this.data.form, updates);
    this.applyAutoShares(form, key);
    this.setData({
      form,
      feeSummary: key === "includeFee" ? buildFeeSummary(this.data.feeSettings, form.includeFee) : this.data.feeSummary
    }, () => {
      this.refreshAll();
      this.persistState();
    });
  },

  applyAutoShares(form, key) {
    if (form.direction !== "BUY") return;
    if (key !== "tradeAmount" && key !== "tradePrice" && key !== "convertUnit") return;
    const tradeAmount = safeNumber(form.tradeAmount);
    const tradePrice = safeNumber(form.tradePrice);
    if (!tradeAmount || !tradePrice) return;

    form.tradeShares = String(calcSharesByAmount(tradeAmount, tradePrice, getConvertUnit(form)));
  },

  refreshAll() {
    this.setData({
      summary: this.buildSummary(),
      preview: this.buildPreview()
    });
  },

  buildBaseState() {
    const initialPrice = safeNumber(this.data.form.initialPrice);
    const initialShares = safeNumber(this.data.form.initialShares);
    const initialCost = safeMultiply(initialPrice, initialShares);
    return {
      shares: initialShares,
      totalCost: initialCost,
      avgCost: initialShares ? safeDivide(initialCost, initialShares) : 0,
      realizedProfit: 0,
      cashFlow: 0
    };
  },

  applyOperation(state, operation) {
    const price = safeNumber(operation.price);
    const shares = safeNumber(operation.shares);
    const amount = safeMultiply(price, shares);
    const fee = operation.fee || { totalFee: 0 };

    if (operation.direction === "BUY") {
      const buyCost = safeAdd(amount, fee.totalFee);
      const nextShares = safeAdd(state.shares, shares);
      const nextTotalCost = safeAdd(state.totalCost, buyCost);
      return {
        shares: nextShares,
        totalCost: nextTotalCost,
        avgCost: nextShares ? safeDivide(nextTotalCost, nextShares) : 0,
        realizedProfit: state.realizedProfit,
        cashFlow: safeSubtract(state.cashFlow, buyCost)
      };
    }

    const sellIncome = safeSubtract(amount, fee.totalFee);
    const soldCost = safeMultiply(state.avgCost, shares);
    const profit = safeSubtract(sellIncome, soldCost);
    const nextShares = Math.max(0, safeSubtract(state.shares, shares));
    const nextTotalCost = nextShares ? safeSubtract(state.totalCost, soldCost) : 0;

    return {
      shares: nextShares,
      totalCost: nextTotalCost,
      avgCost: nextShares ? safeDivide(nextTotalCost, nextShares) : 0,
      realizedProfit: safeAdd(state.realizedProfit, profit),
      cashFlow: safeAdd(state.cashFlow, sellIncome)
    };
  },

  getCurrentState() {
    return this.data.operations.reduce((state, operation) => this.applyOperation(state, operation), this.buildBaseState());
  },

  rebuildOperations(operations) {
    let state = this.buildBaseState();
    return operations.map((operation) => {
      const nextOperation = this.buildOperationDisplay(operation, state);
      state = this.applyOperation(state, nextOperation);
      return nextOperation;
    });
  },

  buildOperationDisplay(operation, beforeState) {
    const direction = operation.direction;
    const price = safeNumber(operation.price);
    const shares = safeNumber(operation.shares);
    const amount = safeMultiply(price, shares);
    const fee = operation.fee || calcTradeFee({
      amount,
      direction,
      feeSettings: this.data.feeSettings,
      includeFee: this.data.form.includeFee
    });
    const afterState = this.applyOperation(beforeState, { direction, price, shares, fee });
    const isBuy = direction === "BUY";
    const tradeCash = isBuy ? safeAdd(amount, fee.totalFee) : safeSubtract(amount, fee.totalFee);
    const soldCost = isBuy ? 0 : safeMultiply(beforeState.avgCost, shares);
    const profit = isBuy ? 0 : safeSubtract(tradeCash, soldCost);

    return Object.assign({}, operation, {
      direction,
      price,
      shares,
      amount,
      fee,
      beforeAvgCost: beforeState.avgCost,
      directionText: isBuy ? "买入" : "卖出",
      priceText: formatNumber(price, 4),
      sharesText: formatNumber(shares, 0),
      amountText: formatMoney(amount),
      feeText: formatMoney(fee.totalFee),
      cashText: (isBuy ? "¥-" : "¥") + formatMoney(tradeCash),
      cashClass: isBuy ? "negative" : "positive",
      profitText: isBuy ? "-" : "¥" + formatMoney(profit),
      profitClass: isBuy ? "" : resultClass(profit),
      afterSharesText: formatNumber(afterState.shares, 0) + " 股",
      afterAvgCostText: "¥" + formatNumber(afterState.avgCost, 4),
      afterTotalCostText: "¥" + formatMoney(afterState.totalCost)
    });
  },

  buildSummary() {
    const state = this.getCurrentState();
    return {
      rows: [
        { label: "剩余持仓", value: formatNumber(state.shares, 0) + " 股" },
        { label: "最新成本价", value: "¥" + formatNumber(state.avgCost, 4) },
        { label: "持仓成本", value: "¥" + formatMoney(state.totalCost) },
        { label: "累计已实现收益", value: "¥" + formatMoney(state.realizedProfit), className: resultClass(state.realizedProfit) },
        { label: "累计资金流", value: "¥" + formatMoney(state.cashFlow), className: resultClass(state.cashFlow) }
      ]
    };
  },

  buildPreview() {
    const direction = this.data.form.direction;
    const price = safeNumber(this.data.form.tradePrice);
    const shares = safeNumber(this.data.form.tradeShares);
    if (!price || !shares) return null;

    const beforeState = this.getCurrentState();
    const amount = safeMultiply(price, shares);
    const fee = calcTradeFee({
      amount,
      direction,
      feeSettings: this.data.feeSettings,
      includeFee: this.data.form.includeFee
    });

    if (direction === "BUY") {
      const totalPay = safeAdd(amount, fee.totalFee);
      const afterState = this.applyOperation(beforeState, { direction, price, shares, fee });
      return {
        rows: [
          { label: "买入金额", value: "¥" + formatMoney(amount) },
          { label: "预计手续费", value: "¥" + formatMoney(fee.totalFee) },
          { label: "本次资金", value: "¥-" + formatMoney(totalPay), className: "negative" },
          { label: "买入后股数", value: formatNumber(afterState.shares, 0) + " 股" },
          { label: "买入后成本价", value: "¥" + formatNumber(afterState.avgCost, 4) },
          { label: "买入后持仓成本", value: "¥" + formatMoney(afterState.totalCost) }
        ]
      };
    }

    const income = safeSubtract(amount, fee.totalFee);
    const soldCost = safeMultiply(beforeState.avgCost, shares);
    const profit = safeSubtract(income, soldCost);
    const afterState = this.applyOperation(beforeState, { direction, price, shares, fee });

    return {
      rows: [
        { label: "卖出金额", value: "¥" + formatMoney(amount) },
        { label: "预计手续费", value: "¥" + formatMoney(fee.totalFee) },
        { label: "本次资金", value: "¥" + formatMoney(income), className: "positive" },
        { label: "本次收益", value: "¥" + formatMoney(profit), className: resultClass(profit) },
        { label: "卖出后股数", value: formatNumber(afterState.shares, 0) + " 股" },
        { label: "卖出后成本价", value: "¥" + formatNumber(afterState.avgCost, 4) },
        { label: "卖出后持仓成本", value: "¥" + formatMoney(afterState.totalCost) }
      ]
    };
  },

  saveOperation() {
    const direction = this.data.form.direction;
    const price = safeNumber(this.data.form.tradePrice);
    const shares = safeNumber(this.data.form.tradeShares);
    if (!price || !shares) {
      wx.showToast({ title: "请填写价格和数量", icon: "none" });
      return;
    }

    const beforeState = this.getCurrentState();
    if (direction === "SELL" && shares > beforeState.shares) {
      wx.showToast({ title: "卖出数量不能超过持仓", icon: "none" });
      return;
    }

    const amount = safeMultiply(price, shares);
    const fee = calcTradeFee({
      amount,
      direction,
      feeSettings: this.data.feeSettings,
      includeFee: this.data.form.includeFee
    });
    const operationBase = {
      id: Date.now() + "-" + this.data.operations.length,
      timeText: makeTimeText(),
      direction,
      price,
      shares,
      amount,
      fee,
      beforeAvgCost: beforeState.avgCost
    };
    const operation = this.buildOperationDisplay(operationBase, beforeState);

    this.setData({
      operations: this.data.operations.concat(operation),
      "form.tradePrice": "",
      "form.tradeShares": "",
      "form.tradeAmount": ""
    });
    this.refreshAll();
    this.persistState();
  },

  undoOperation(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: "确认撤销这笔操作？",
      content: "撤销后会重新计算后续持仓、成本和收益。",
      confirmText: "撤销",
      confirmColor: "#00b894",
      success: (res) => {
        if (!res.confirm) return;
        const remainingOperations = this.data.operations.filter((operation) => operation.id !== id);
        const operations = this.rebuildOperations(remainingOperations);
        this.setData({ operations });
        this.refreshAll();
        this.persistState();
      }
    });
  },

  clearAll() {
    this.setData({
      form: Object.assign({}, DEFAULT_FORM, { includeFee: this.data.feeSettings.useFee }),
      operations: []
    });
    this.refreshAll();
    this.persistState();
  },

  persistState() {
    if (!this.data.rememberData) return;
    saveState(PAGE_KEY, {
      rememberData: true,
      form: this.data.form,
      operations: this.data.operations
    });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: "/pages/index/index" });
    }
  },

  openTradeRecordMiniProgram() {
    wx.navigateToMiniProgram({
      appId: "wx253309efe732b547"
    });
  },

  copyResult() {
    if (!this.data.operations.length || !this.data.summary) {
      wx.showToast({ title: "请先完成测算", icon: "none" });
      return;
    }

    const latest = this.data.operations[this.data.operations.length - 1];
    const summaryRows = rowMap(this.data.summary);
    const lines = [
      "【做T计算器】",
      this.data.form.initialShares && this.data.form.initialPrice
        ? `初始持仓：${this.data.form.initialShares}股，成本价 ${this.data.form.initialPrice}`
        : "",
      `最近操作：${latest.directionText} ${latest.sharesText}股，价格 ${latest.priceText}`,
      latest.direction === "SELL" ? `本次卖出收益：${latest.profitText}` : "",
      summaryRows["剩余持仓"] ? `当前持仓：${summaryRows["剩余持仓"]}` : "",
      summaryRows["最新成本价"] ? `最新成本价：${summaryRows["最新成本价"]}` : "",
      summaryRows["持仓成本"] ? `持仓成本：${summaryRows["持仓成本"]}` : "",
      summaryRows["累计已实现收益"] ? `累计已实现收益：${summaryRows["累计已实现收益"]}` : ""
    ];

    copyText(appendSource(lines));
  }
  }
});
