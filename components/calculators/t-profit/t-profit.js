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
  formatNumber,
  formatPrice,
} = require("../../../utils/math");
const {
  getSavedState,
  saveState,
  makeTimeText,
} = require("../../../utils/pageState");
const {
  getShareMessage,
  getShareTimelineMessage,
} = require("../../../utils/share");
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
  includeFee: true,
  baseInitialized: false,
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

function formatSignedMoney(value) {
  const num = safeNumber(value);
  if (num > 0) return "+ " + formatMoney(num);
  if (num < 0) return "- " + formatMoney(Math.abs(num));
  return " 0.00";
}

Component({
  properties: {
    entryQuery: {
      type: Object,
      value: {},
      observer() {
        this.initCalculator();
      },
    },
    embedded: {
      type: Boolean,
      value: false,
    },
    isDefaultCalculator: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    form: DEFAULT_FORM,
    feeSettings: {},
    feeSummary: "",
    rememberData: true,
    operations: [],
    summary: null,
    preview: null,
    baseInfo: null,
    showEmbeddedAmountPanel: false,
    showBaseDetail: false,
  },

  lifetimes: {
    attached() {
      this.initCalculator();
    },
  },

  pageLifetimes: {
    show() {
      this.initCalculator();
    },
  },

  methods: {
    initCalculator() {
      const feeSettings = getFeeSettings();
      const saved = getSavedState(PAGE_KEY);
      const rememberData = saved.rememberData !== false;
      let form = rememberData
        ? Object.assign({}, DEFAULT_FORM, saved.form || {}, {
            includeFee:
              typeof (saved.form || {}).includeFee === "boolean"
                ? saved.form.includeFee
                : feeSettings.useFee,
          })
        : Object.assign({}, this.data.form, { includeFee: feeSettings.useFee });
      form.convertUnit = String(getConvertUnit(form));
      const operations = rememberData ? saved.operations || [] : [];
      form.baseInitialized = Boolean(form.baseInitialized || operations.length);
      const externalPreset = applyExternalFormPreset(
        PAGE_KEY,
        form,
        this.data.entryQuery || {},
      );
      form = externalPreset.form;

      this.setData(
        {
          feeSettings,
          feeSummary: buildFeeSummary(feeSettings, form.includeFee),
          rememberData,
          form,
          operations,
        },
        () => {
          if (operations.length) {
            this.setData(
              { operations: this.rebuildOperations(operations) },
              () => {
                this.refreshAll();
                if (externalPreset.applied) {
                  this.persistState();
                }
              },
            );
            return;
          }

          this.refreshAll();
          if (externalPreset.applied) {
            this.persistState();
          }
        },
      );
    },

    onInput(event) {
      const key = event.currentTarget.dataset.key;
      this.updateForm({ [key]: event.detail.value }, key);
    },

    onSwitchChange(event) {
      const key = event.currentTarget.dataset.key || event.detail.key;
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
      const updates = { direction };
      if (direction === "SELL") {
        this.setData({ showEmbeddedAmountPanel: false });
      }
      this.updateForm(updates, "direction");
    },

    toggleEmbeddedAmountPanel() {
      this.setData({
        showEmbeddedAmountPanel: !this.data.showEmbeddedAmountPanel,
      });
    },

    toggleBaseDetail() {
      this.setData({
        showBaseDetail: !this.data.showBaseDetail,
      });
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

      this.updateForm(
        {
          [key]: Number.isInteger(nextValue)
            ? String(nextValue)
            : String(nextValue),
        },
        key,
      );
    },

    updateForm(updates, key) {
      const form = Object.assign({}, this.data.form, updates);
      this.applyAutoShares(form, key);
      this.setData(
        {
          form,
          feeSummary:
            key === "includeFee"
              ? buildFeeSummary(this.data.feeSettings, form.includeFee)
              : this.data.feeSummary,
        },
        () => {
          this.refreshAll();
          this.persistState();
        },
      );
    },

    applyAutoShares(form, key) {
      if (form.direction !== "BUY") return;
      if (
        key !== "tradeAmount" &&
        key !== "tradePrice" &&
        key !== "convertUnit"
      )
        return;
      const tradeAmount = safeNumber(form.tradeAmount);
      const tradePrice = safeNumber(form.tradePrice);
      if (!tradeAmount || !tradePrice) return;

      form.tradeShares = String(
        calcSharesByAmount(tradeAmount, tradePrice, getConvertUnit(form)),
      );
    },

    refreshAll() {
      this.setData({
        summary: this.buildSummary(),
        preview: this.buildPreview(),
        baseInfo: this.buildBaseInfo(),
      });
    },

    buildBaseInfo() {
      const initialPrice = safeNumber(this.data.form.initialPrice);
      const initialShares = safeNumber(this.data.form.initialShares);
      if (!initialPrice || !initialShares) return null;

      const amount = safeMultiply(initialPrice, initialShares);
      const fee = calcTradeFee({
        amount,
        direction: "BUY",
        feeSettings: this.data.feeSettings,
        includeFee: this.data.form.includeFee,
      });
      const cashFlow = -safeAdd(amount, fee.totalFee);
      const totalCost = safeAdd(amount, fee.totalFee);

      return {
        title: "初始化底仓",
        tag: "已锁定",
        theme: "buy",
        mainItems: [
          { label: "成本价", value: " " + formatPrice(initialPrice, this.data.form.initialPrice) },
          { label: "数量", value: formatNumber(initialShares, 0) + " 股" },
        ],
        detailItems: [
          { label: "持仓成本", value: " " + formatMoney(totalCost) },
          { label: "手续费", value: " " + formatMoney(fee.totalFee) },
          {
            label: "初始资金流",
            value: formatSignedMoney(cashFlow),
            className: "negative",
          },
        ],
        priceText: " " + formatPrice(initialPrice, this.data.form.initialPrice),
        sharesText: formatNumber(initialShares, 0) + " 股",
        totalCostText: " " + formatMoney(totalCost),
        feeText: " " + formatMoney(fee.totalFee),
        cashFlowText: formatSignedMoney(cashFlow),
        cashFlowClass: "negative",
        rawCashFlow: cashFlow,
      };
    },

    buildBaseState() {
      const initialPrice = safeNumber(this.data.form.initialPrice);
      const initialShares = safeNumber(this.data.form.initialShares);
      const amount = safeMultiply(initialPrice, initialShares);
      const fee = calcTradeFee({
        amount,
        direction: "BUY",
        feeSettings: this.data.feeSettings,
        includeFee: this.data.form.includeFee,
      });
      const initialCost = safeAdd(amount, fee.totalFee);
      return {
        shares: initialShares,
        totalCost: initialCost,
        avgCost: initialShares ? safeDivide(initialCost, initialShares) : 0,
        realizedProfit: 0,
        cashFlow: 0,
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
          cashFlow: safeSubtract(state.cashFlow, buyCost),
        };
      }

      const sellIncome = safeSubtract(amount, fee.totalFee);
      const soldCost = safeMultiply(state.avgCost, shares);
      const profit = safeSubtract(sellIncome, soldCost);
      const nextShares = Math.max(0, safeSubtract(state.shares, shares));
      const nextTotalCost = nextShares
        ? safeSubtract(state.totalCost, sellIncome)
        : 0;

      return {
        shares: nextShares,
        totalCost: nextTotalCost,
        avgCost: nextShares ? safeDivide(nextTotalCost, nextShares) : 0,
        realizedProfit: safeAdd(state.realizedProfit, profit),
        cashFlow: safeAdd(state.cashFlow, sellIncome),
      };
    },

    getCurrentState() {
      return this.data.operations.reduce(
        (state, operation) => this.applyOperation(state, operation),
        this.buildBaseState(),
      );
    },

    rebuildOperations(operations) {
      let state = this.buildBaseState();
      return operations.map((operation, index) => {
        const nextOperation = this.buildOperationDisplay(operation, state, index);
        state = this.applyOperation(state, nextOperation);
        return nextOperation;
      });
    },

    buildOperationDisplay(operation, beforeState, index) {
      const direction = operation.direction;
      const price = safeNumber(operation.price);
      const shares = safeNumber(operation.shares);
      const amount = safeMultiply(price, shares);
      const fee =
        operation.fee ||
        calcTradeFee({
          amount,
          direction,
          feeSettings: this.data.feeSettings,
          includeFee: this.data.form.includeFee,
        });
      const afterState = this.applyOperation(beforeState, {
        direction,
        price,
        shares,
        fee,
      });
      const isBuy = direction === "BUY";
      const tradeCash = isBuy
        ? safeAdd(amount, fee.totalFee)
        : safeSubtract(amount, fee.totalFee);
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
        priceText: formatPrice(price, operation.price || this.data.form.tradePrice),
        sharesText: formatNumber(shares, 0),
        amountText: formatMoney(amount),
        feeText: formatMoney(fee.totalFee),
        cashText: (isBuy ? " -" : " ") + formatMoney(tradeCash),
        cashDisplayText: formatSignedMoney(isBuy ? -tradeCash : tradeCash),
        cashClass: isBuy ? "negative" : "positive",
        profitText: isBuy ? "-" : " " + formatMoney(profit),
        profitDisplayText: isBuy ? "买入不计算收益" : formatSignedMoney(profit),
      profitClass: isBuy ? "" : resultClass(profit),
      afterSharesText: formatNumber(afterState.shares, 0) + " 股",
      afterAvgCostText: " " + formatPrice(afterState.avgCost, this.data.form.initialPrice),
      afterTotalCostText: " " + formatMoney(afterState.totalCost),
      resultTitle: "第 " + ((index || 0) + 1) + " 笔",
      resultTimeText: operation.timeText,
      resultTagText: isBuy ? "买入" : "卖出",
      resultTheme: isBuy ? "buy" : "sell",
      mainItems: [
        { label: "交易后成本价", value: " " + formatPrice(afterState.avgCost, this.data.form.initialPrice) },
        { label: "交易后持仓", value: formatNumber(afterState.shares, 0) + " 股" }
      ],
      detailItems: [
        { label: "成交价", value: " " + formatPrice(price, operation.price || this.data.form.tradePrice) },
        { label: "成交数量", value: formatNumber(shares, 0) + " 股" },
        { label: "成交金额", value: " " + formatMoney(amount) },
        { label: "手续费", value: " " + formatMoney(fee.totalFee) },
        { label: "资金流", value: formatSignedMoney(isBuy ? -tradeCash : tradeCash), className: isBuy ? "negative" : "positive" },
        { label: "本次收益", value: isBuy ? "买入不计算收益" : formatSignedMoney(profit), className: isBuy ? "" : resultClass(profit) }
      ]
    });
  },

    buildSummary() {
      const state = this.getCurrentState();
      const baseInfo = this.data.form.baseInitialized
        ? this.buildBaseInfo()
        : null;
      const totalCashFlow = safeAdd(
        state.cashFlow,
        baseInfo ? baseInfo.rawCashFlow : 0,
      );
      const rows = [
        {
          label: "累计已实现收益",
          value: " " + formatMoney(state.realizedProfit),
          className: resultClass(state.realizedProfit),
        },
        { label: "最新成本价", value: " " + formatPrice(state.avgCost, this.data.form.initialPrice) },
        { label: "剩余持仓", value: formatNumber(state.shares, 0) + " 股" },
        { label: "持仓成本", value: " " + formatMoney(state.totalCost) },
        {
          label: "累计资金流",
          value: formatSignedMoney(totalCashFlow),
          className: resultClass(totalCashFlow),
        },
      ];
      return {
        rows,
        main: rows[0],
        details: rows.slice(1),
      };
    },

    buildPreview() {
      const direction = this.data.form.direction;
      const price = safeNumber(this.data.form.tradePrice);
      const shares = safeNumber(this.data.form.tradeShares);
      if (!price || !shares) return null;

      const isBuy = direction === "BUY";
      const beforeState = this.getCurrentState();
      const amount = safeMultiply(price, shares);

      const fee = calcTradeFee({
        amount,
        direction,
        feeSettings: this.data.feeSettings,
        includeFee: this.data.form.includeFee,
      });

      const afterState = this.applyOperation(beforeState, {
        direction,
        price,
        shares,
        fee,
      });

      if (isBuy) {
        const totalPay = safeAdd(amount, fee.totalFee);

        const rows = [
          { label: "买入金额", value: " " + formatMoney(amount) },
          { label: "预计手续费", value: " " + formatMoney(fee.totalFee) },
          {
            label: "本次资金",
            value: formatSignedMoney(-totalPay),
            className: "negative",
          },
          {
            label: "买入后股数",
            value: formatNumber(afterState.shares, 0) + " 股",
          },
          {
            label: "买入后成本价",
            value: " " + formatPrice(afterState.avgCost, this.data.form.initialPrice),
          },
          {
            label: "买入后持仓成本",
            value: " " + formatMoney(afterState.totalCost),
          },
        ];

        return {
          rows,
          view: {
            actionText: "买入后",
            theme: "buy",
            mainItems: [
              { label: "操作后成本价", value: " " + formatPrice(afterState.avgCost, this.data.form.initialPrice) },
              { label: "操作后股数", value: formatNumber(afterState.shares, 0) + " 股" }
            ],
            detailItems: [
              { label: "本次收益", value: "买入不计算" },
              { label: "本次资金", value: formatSignedMoney(-totalPay), className: "negative" },
              { label: "成交金额", value: " " + formatMoney(amount) },
              { label: "预计手续费", value: " " + formatMoney(fee.totalFee) },
              { label: "操作后持仓成本", value: " " + formatMoney(afterState.totalCost) }
            ],

            cashFlowText: formatSignedMoney(-totalPay),
            cashFlowClass: "negative",

            profitText: "买入不计算",
            profitClass: "neutral",

            afterSharesLabel: "买入后股数",
            afterSharesText: formatNumber(afterState.shares, 0) + " 股",

            afterAvgCostLabel: "买入后成本价",
            afterAvgCostText: " " + formatPrice(afterState.avgCost, this.data.form.initialPrice),

            amountText: " " + formatMoney(amount),
            feeText: " " + formatMoney(fee.totalFee),

            afterCostLabel: "买入后持仓成本",
            afterCostText: " " + formatMoney(afterState.totalCost),
          },
        };
      }

      const income = safeSubtract(amount, fee.totalFee);
      const soldCost = safeMultiply(beforeState.avgCost, shares);
      const profit = safeSubtract(income, soldCost);

      const rows = [
        { label: "卖出金额", value: " " + formatMoney(amount) },
        { label: "预计手续费", value: " " + formatMoney(fee.totalFee) },
        {
          label: "本次资金",
          value: formatSignedMoney(income),
          className: "positive",
        },
        {
          label: "本次收益",
          value: formatSignedMoney(profit),
          className: resultClass(profit),
        },
        {
          label: "卖出后股数",
          value: formatNumber(afterState.shares, 0) + " 股",
        },
        {
          label: "卖出后成本价",
          value: " " + formatPrice(afterState.avgCost, this.data.form.initialPrice),
        },
        {
          label: "卖出后持仓成本",
          value: " " + formatMoney(afterState.totalCost),
        },
      ];

      return {
        rows,
        view: {
          actionText: "卖出后",
          theme: "sell",
          mainItems: [
            { label: "操作后成本价", value: " " + formatPrice(afterState.avgCost, this.data.form.initialPrice) },
            { label: "操作后股数", value: formatNumber(afterState.shares, 0) + " 股" }
          ],
          detailItems: [
            { label: "本次收益", value: formatSignedMoney(profit), className: resultClass(profit) },
            { label: "本次资金", value: formatSignedMoney(income), className: "positive" },
            { label: "成交金额", value: " " + formatMoney(amount) },
            { label: "预计手续费", value: " " + formatMoney(fee.totalFee) },
            { label: "操作后持仓成本", value: " " + formatMoney(afterState.totalCost) }
          ],

          cashFlowText: formatSignedMoney(income),
          cashFlowClass: "positive",

          profitText: formatSignedMoney(profit),
          profitClass: resultClass(profit),

          afterSharesLabel: "卖出后股数",
          afterSharesText: formatNumber(afterState.shares, 0) + " 股",

          afterAvgCostLabel: "卖出后成本价",
          afterAvgCostText: " " + formatPrice(afterState.avgCost, this.data.form.initialPrice),

          amountText: " " + formatMoney(amount),
          feeText: " " + formatMoney(fee.totalFee),

          afterCostLabel: "卖出后持仓成本",
          afterCostText: " " + formatMoney(afterState.totalCost),
        },
      };
    },

    saveOperation() {
      if (!this.data.form.baseInitialized) {
        this.initializeBase();
        return;
      }

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
        includeFee: this.data.form.includeFee,
      });
      const operationBase = {
        id: Date.now() + "-" + this.data.operations.length,
        timeText: makeTimeText(),
        direction,
        price,
        shares,
        amount,
        fee,
        beforeAvgCost: beforeState.avgCost,
      };
      const operation = this.buildOperationDisplay(
        operationBase,
        beforeState,
        this.data.operations.length,
      );

      this.setData({
        operations: this.data.operations.concat(operation),
        "form.tradePrice": "",
        "form.tradeShares": "",
        "form.tradeAmount": "",
      });
      this.refreshAll();
      this.persistState();
    },

    undoOperation(event) {
      const id =
        (event.detail && event.detail.id) || event.currentTarget.dataset.id;
      wx.showModal({
        title: "确认撤销这笔操作？",
        content: "撤销后会重新计算后续持仓、成本和收益。",
        confirmText: "撤销",
        confirmColor: "#00b894",
        success: (res) => {
          if (!res.confirm) return;
          const remainingOperations = this.data.operations.filter(
            (operation) => operation.id !== id,
          );
          const operations = this.rebuildOperations(remainingOperations);
          this.setData({ operations });
          this.refreshAll();
          this.persistState();
          wx.showToast({ title: "已撤销本笔并重新计算", icon: "none" });
        },
      });
    },

    initializeBase() {
      const initialPrice = safeNumber(this.data.form.initialPrice);
      const initialShares = safeNumber(this.data.form.initialShares);
      if (!initialPrice || !initialShares) {
        wx.showToast({ title: "请填写初始持仓价格和数量", icon: "none" });
        return;
      }

      this.updateForm({ baseInitialized: true }, "baseInitialized");
    },

    clearAll() {
      this.setData({
        form: Object.assign({}, DEFAULT_FORM, {
          includeFee: this.data.feeSettings.useFee,
        }),
        operations: [],
        showEmbeddedAmountPanel: false,
        showBaseDetail: false,
        summary: null,
        preview: null,
        baseInfo: null,
      }, () => {
        this.refreshAll();
        this.persistState();
      });
    },

    persistState() {
      if (!this.data.rememberData) return;
      saveState(PAGE_KEY, {
        rememberData: true,
        form: this.data.form,
        operations: this.data.operations,
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
        appId: "wx253309efe732b547",
      });
    },

    onDefaultCalculatorTap() {
      this.triggerEvent("setdefaultcalculator");
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
        summaryRows["最新成本价"]
          ? `最新成本价：${summaryRows["最新成本价"]}`
          : "",
        summaryRows["持仓成本"] ? `持仓成本：${summaryRows["持仓成本"]}` : "",
        summaryRows["累计已实现收益"]
          ? `累计已实现收益：${summaryRows["累计已实现收益"]}`
          : "",
      ];

      copyText(appendSource(lines));
    },
  },
});
