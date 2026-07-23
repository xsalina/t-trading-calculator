const { getFeeSettings, getCurrentIncludeFee, setCurrentIncludeFee, calcTradeFee } = require("../../../utils/fee");
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
  clearState,
  makeTimeText,
} = require("../../../utils/pageState");
const {
  setCalculatorShareContext,
} = require("../../../utils/share");
const { applyExternalFormPreset, isExternalEntry } = require("../../../utils/externalEntry");
const { appendSource, copyText, rowMap } = require("../../../utils/resultCopy");
const { buildFeeSummary } = require("../../../utils/feeSummary");
const {
  reportCalculatorExport,
  reportCalculatorResult,
  reportProJumpFail,
  reportProJumpSuccess,
} = require("../../../utils/analytics");
const { exportCalculatorGroups } = require("../../../utils/exportCalculators");
const {
  MAX_GROUP_COUNT,
  stripRuntimeForm,
  createGroup,
  buildGroupedState,
  getActiveGroup,
  getActiveTabId,
  getNextGroupIndex,
} = require("../../../utils/calculatorGroups");

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
    calculatorKey: {
      type: String,
      value: "t-profit",
    },
    isDefaultCalculator: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    form: DEFAULT_FORM,
    includeFee: true,
    feeSettings: {},
    feeSummary: "",
    rememberData: true,
    operations: [],
    displayOperations: [],
    latestFirst: true,
    summary: null,
    preview: null,
    baseInfo: null,
    showEmbeddedAmountPanel: false,
    showBaseDetail: false,
    groups: [],
    activeGroupId: "",
    activeGroupTabId: "",
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
      const rememberData = this.data.rememberData === false ? false : saved.rememberData !== false;
      const includeFee = rememberData && saved.version === 2 && typeof saved.includeFee === "boolean"
        ? saved.includeFee
        : getCurrentIncludeFee();
      const entryQuery = this.data.entryQuery || {};
      const hasExternalEntry = isExternalEntry(entryQuery);
      const groupedState = hasExternalEntry
        ? buildGroupedState({}, DEFAULT_FORM, "operations")
        : rememberData
        ? buildGroupedState(saved, DEFAULT_FORM, "operations")
        : {
          groups: this.data.groups && this.data.groups.length
            ? this.data.groups
            : buildGroupedState({}, DEFAULT_FORM, "operations").groups,
          activeGroupId: this.data.activeGroupId,
        };
      let groups = groupedState.groups;
      let activeGroupId = groupedState.activeGroupId || (groups[0] && groups[0].id);
      let activeGroup = getActiveGroup(groups, activeGroupId);
      let form = Object.assign({}, DEFAULT_FORM, activeGroup ? activeGroup.form : {}, { includeFee });
      form.convertUnit = String(getConvertUnit(form));
      const operations = hasExternalEntry ? [] : (activeGroup && activeGroup.operations) || [];
      form.baseInitialized = Boolean(form.baseInitialized || operations.length);
      const externalPreset = applyExternalFormPreset(
        PAGE_KEY,
        form,
        entryQuery,
      );
      form = externalPreset.form;
      if (externalPreset.applied && activeGroup) {
        const nextActiveGroup = Object.assign({}, activeGroup, {
          form: stripRuntimeForm(form),
          operations: [],
        });
        groups = groups.map((group) => group.id === activeGroup.id ? nextActiveGroup : group);
        activeGroup = nextActiveGroup;
        activeGroupId = nextActiveGroup.id;
      }

      this.setData(
        {
          includeFee,
          feeSettings,
          feeSummary: buildFeeSummary(feeSettings, includeFee),
          rememberData,
          groups,
          activeGroupId,
          activeGroupTabId: getActiveTabId(activeGroupId),
          form,
          operations,
          latestFirst: activeGroup ? activeGroup.latestFirst !== false : true,
          showEmbeddedAmountPanel: hasExternalEntry ? false : Boolean(activeGroup && activeGroup.showEmbeddedAmountPanel),
          showBaseDetail: hasExternalEntry ? false : Boolean(activeGroup && activeGroup.showBaseDetail),
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
      if (key === "includeFee") {
        const includeFee = setCurrentIncludeFee(event.detail.value);
        this.setData({
          includeFee,
          "form.includeFee": includeFee,
          feeSummary: buildFeeSummary(this.data.feeSettings, includeFee),
        }, () => {
          this.recalculateCurrentGroup();
          this.persistState();
        });
        return;
      }
      const value = event.detail.value;
      this.updateForm({ [key]: value }, key);
    },

    onRememberSwitch(event) {
      const rememberData = event.detail.value;
      this.setData({ rememberData });
      if (rememberData) {
        this.persistState();
      } else {
        clearState(PAGE_KEY);
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
      }, () => this.persistState());
    },

    toggleBaseDetail() {
      this.setData({
        showBaseDetail: !this.data.showBaseDetail,
      }, () => this.persistState());
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
            this.data.feeSummary,
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
        displayOperations: this.getDisplayOperations(this.data.operations),
      }, () => {
        this.updateShareContext();
        this.emitResultState();
      });
    },

    getDisplayOperations(operations) {
      const list = operations || [];
      return this.data.latestFirst ? list.slice().reverse() : list;
    },

    buildGroupsWithCurrentState() {
      const groups = this.data.groups && this.data.groups.length
        ? this.data.groups
        : buildGroupedState({}, DEFAULT_FORM, "operations").groups;
      return groups.map((group) => {
        if (group.id !== this.data.activeGroupId) return group;
        return Object.assign({}, group, {
          form: stripRuntimeForm(this.data.form),
          operations: this.data.operations || [],
          latestFirst: this.data.latestFirst !== false,
          showEmbeddedAmountPanel: Boolean(this.data.showEmbeddedAmountPanel),
          showBaseDetail: Boolean(this.data.showBaseDetail),
          updatedAt: Date.now(),
        });
      });
    },

    syncCurrentGroup(callback) {
      this.setData({ groups: this.buildGroupsWithCurrentState() }, () => {
        if (typeof callback === "function") callback();
      });
    },

    loadGroup(group) {
      if (!group) return;
      const form = Object.assign({}, DEFAULT_FORM, group.form || {}, {
        includeFee: this.data.includeFee,
      });
      form.convertUnit = String(getConvertUnit(form));
      const operations = group.operations || [];
      this.setData({
        activeGroupId: group.id,
        activeGroupTabId: getActiveTabId(group.id),
        form,
        operations: [],
        displayOperations: [],
        latestFirst: group.latestFirst !== false,
        showEmbeddedAmountPanel: Boolean(group.showEmbeddedAmountPanel),
        showBaseDetail: Boolean(group.showBaseDetail),
        summary: null,
        preview: null,
        baseInfo: null,
      }, () => {
        const rebuiltOperations = operations.length ? this.rebuildOperations(operations) : [];
        this.setData({ operations: rebuiltOperations }, () => {
          this.refreshAll();
          this.persistState();
        });
      });
    },

    switchGroup(event) {
      const id = event.currentTarget.dataset.id;
      if (!id || id === this.data.activeGroupId) return;
      this.syncCurrentGroup(() => {
        this.loadGroup(getActiveGroup(this.data.groups, id));
      });
    },

    addGroup() {
      this.syncCurrentGroup(() => {
        const groups = this.data.groups || [];
        if (groups.length >= MAX_GROUP_COUNT) {
          wx.showToast({ title: "最多保留10组", icon: "none" });
          return;
        }
        const nextIndex = getNextGroupIndex(groups);
        const group = createGroup(nextIndex, DEFAULT_FORM);
        this.setData({ groups: groups.concat(group) }, () => {
          this.loadGroup(group);
          wx.showToast({ title: "已新增第" + (nextIndex + 1) + "组", icon: "none" });
        });
      });
    },

    openGroupManage() {
      wx.showActionSheet({
        itemList: ["修改当前组名称", "清空当前组", "删除当前组"],
        success: (res) => {
          if (res.tapIndex === 0) this.renameCurrentGroup();
          if (res.tapIndex === 1) this.clearAll();
          if (res.tapIndex === 2) this.deleteCurrentGroup();
        },
      });
    },

    exportAllGroups() {
      this.syncCurrentGroup(() => {
        const groups = this.data.groups || [];
        reportCalculatorExport({
          calculatorType: "t-profit",
          sourcePage: this.data.embedded ? "tab" : "detail",
          groupCount: groups.length,
        });
        exportCalculatorGroups({
          type: "t-profit",
          groups,
          feeSettings: this.data.feeSettings,
          includeFee: this.data.includeFee,
        });
      });
    },

    renameCurrentGroup() {
      const group = getActiveGroup(this.data.groups, this.data.activeGroupId);
      if (!group) return;
      wx.showModal({
        title: "修改分组名称",
        editable: true,
        placeholderText: group.customName || group.defaultName,
        success: (res) => {
          if (!res.confirm) return;
          const customName = String(res.content || "").trim().slice(0, 12);
          const groups = (this.data.groups || []).map((item) => item.id === group.id
            ? Object.assign({}, item, { customName, updatedAt: Date.now() })
            : item);
          this.setData({ groups }, () => this.persistState());
        },
      });
    },

    deleteCurrentGroup() {
      wx.showModal({
        title: "确认删除当前组？",
        content: "删除后只移除当前组，其他分组不受影响。",
        confirmText: "确认删除",
        confirmColor: "#D96B6B",
        success: (res) => {
          if (!res.confirm) return;
          const groups = this.data.groups || [];
          const index = groups.findIndex((group) => group.id === this.data.activeGroupId);
          let nextGroups = groups.filter((group) => group.id !== this.data.activeGroupId);
          if (!nextGroups.length) {
            nextGroups = [createGroup(0, DEFAULT_FORM)];
          }
          const nextGroup = nextGroups[Math.max(0, Math.min(index, nextGroups.length - 1))];
          this.setData({ groups: nextGroups }, () => {
            this.loadGroup(nextGroup);
            wx.showToast({ title: "已删除当前组", icon: "none" });
          });
        },
      });
    },

    getActiveGroupReportInfo() {
      const groups = this.data.groups || [];
      const index = groups.findIndex((group) => group.id === this.data.activeGroupId);
      const group = index >= 0 ? groups[index] : null;
      return {
        groupIndex: index >= 0 ? index + 1 : 1,
        groupName: group ? (group.customName || group.defaultName || "") : "",
      };
    },

    reportCalculatorAction(action, extraParams) {
      reportCalculatorResult(Object.assign({
        calculatorType: "t-profit",
        action,
        sourcePage: this.data.embedded ? "tab" : "detail",
        hasResult: Boolean((this.data.operations || []).length),
      }, this.getActiveGroupReportInfo(), extraParams || {}));
    },

    onOperationSortChange(event) {
      const latestFirst = event.detail.value;
      this.setData({
        latestFirst,
        displayOperations: latestFirst ? this.data.operations.slice().reverse() : this.data.operations,
      }, () => this.persistState());
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
        includeFee: this.data.includeFee,
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
        includeFee: this.data.includeFee,
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
      const fee = calcTradeFee({
        amount,
        direction,
        feeSettings: this.data.feeSettings,
        includeFee: this.data.includeFee,
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
        includeFee: this.data.includeFee,
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
      if (this.data.submitting) return;
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
        includeFee: this.data.includeFee,
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

      this.setData({ submitting: true });
      this.setData({
        operations: this.data.operations.concat(operation),
        "form.tradePrice": "",
        "form.tradeShares": "",
        "form.tradeAmount": "",
        submitting: false,
      }, () => {
        this.reportCalculatorAction("save", {
          buttonText: "保存操作",
          direction,
          resultCount: this.data.operations.length,
        });
        this.refreshAll();
        this.persistState();
        this.handleResultPosition("已保存，本次结果已更新");
      });
    },

    undoOperation(event) {
      const id =
        (event.detail && event.detail.id) || event.currentTarget.dataset.id;
      wx.showModal({
        title: "确认撤销这笔操作？",
        content: "撤销后会重新计算后续持仓、成本和收益。",
        confirmText: "确认撤销",
        confirmColor: "#D96B6B",
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

      this.setData({ submitting: true });
      this.updateForm({ baseInitialized: true }, "baseInitialized");
      this.setData({ submitting: false }, () => {
        this.reportCalculatorAction("initialize", {
          buttonText: "初始化底仓",
          resultCount: this.data.operations.length,
        });
        wx.showToast({ title: "初始化完成", icon: "none", duration: 1200 });
      });
    },

    clearAll() {
      wx.showModal({
        title: "确认清空当前组？",
        content: "清空后只重置当前组的底仓和买入/卖出操作记录，其他分组不受影响。",
        confirmText: "确认清除",
        confirmColor: "#D96B6B",
        success: (res) => {
          if (!res.confirm) return;
          this.resetAllData();
        },
      });
    },

    resetAllData() {
      this.setData({
        form: Object.assign({}, DEFAULT_FORM, {
          includeFee: this.data.includeFee,
        }),
        operations: [],
        displayOperations: [],
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

    updateShareContext() {
      if (!this.data.operations.length || !this.data.summary) {
        setCalculatorShareContext(null);
        return;
      }
      setCalculatorShareContext({
        calculatorType: "t-profit",
        form: this.data.form,
        result: this.data.summary,
        summary: this.data.summary,
        record: this.data.operations[this.data.operations.length - 1] || null,
        activeGroupId: this.data.activeGroupId,
      });
    },

    prepareShareResult() {
      this.persistState();
      this.updateShareContext();
    },

    persistState() {
      const groups = this.buildGroupsWithCurrentState();
      this.data.groups = groups;
      if (!this.data.rememberData) return;
      saveState(PAGE_KEY, {
        version: 2,
        rememberData: true,
        includeFee: this.data.includeFee,
        activeGroupId: this.data.activeGroupId,
        groups,
      });
    },

    recalculateCurrentGroup() {
      const operations = this.rebuildOperations(this.data.operations || []);
      this.setData({ operations }, () => {
        this.refreshAll();
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
      const params = {
        calculatorType: "t-profit",
        sourcePage: this.data.embedded ? "tab" : "detail",
        entryPosition: "legacy_calculator",
        guideType: "legacy",
        targetPath: "/pages/index/index",
      };
      wx.navigateToMiniProgram({
        appId: "wx253309efe732b547",
        success: () => reportProJumpSuccess(params),
        fail: (error) => reportProJumpFail(params, error),
      });
    },

    onDefaultCalculatorTap() {
      this.triggerEvent("setdefaultcalculator");
    },

    emitResultState() {
      const resultCount = (this.data.operations || []).length;
      this.triggerEvent("resultstatechange", {
        calculatorKey: this.data.calculatorKey,
        hasResult: resultCount > 0,
        resultCount
      });
    },

    handleResultPosition(toastText) {
      const selector = "#" + this.data.calculatorKey + "-pro-guide-card";
      wx.showToast({ title: toastText, icon: "none", duration: 1200 });
      wx.nextTick(() => {
        this.scrollToResultSelector(selector);
      });
    },

    scrollToResultSelector(selector) {
      this.createSelectorQuery()
        .select(selector)
        .boundingClientRect((rect) => {
          if (!rect) return;
          wx.createSelectorQuery()
            .selectViewport()
            .scrollOffset((viewport) => {
              const scrollTop = Math.max(0, (viewport.scrollTop || 0) + rect.top - 16);
              if (this.data.embedded) {
                this.triggerEvent("resultready", {
                  calculatorKey: this.data.calculatorKey,
                  selector,
                  scrollTop
                });
                return;
              }
              wx.pageScrollTo({
                scrollTop,
                duration: 300
              });
            })
            .exec();
        })
        .exec();
    },

    copyResult() {
      if (!this.data.operations.length || !this.data.summary) {
        wx.showToast({ title: "请先完成测算", icon: "none" });
        return;
      }

      const summaryRows = rowMap(this.data.summary);
      const lines = [
        "【做T计算器】",
        summaryRows["累计已实现收益"]
          ? `累计收益：${summaryRows["累计已实现收益"]}`
          : "",
        summaryRows["最新成本价"]
          ? `当前成本：${summaryRows["最新成本价"]}`
          : "",
        summaryRows["剩余持仓"] ? `剩余持仓：${summaryRows["剩余持仓"]}` : "",
      ];

      copyText(appendSource(lines));
    },
  },
});
