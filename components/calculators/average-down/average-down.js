const { createCalculatorComponent } = require("../../../utils/calculatorComponent");
const { calcAverageDown } = require("../../../utils/calculators");
const { calcTradeFee } = require("../../../utils/fee");
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
} = require("../../../utils/math");
const { appendSource, rowMap } = require("../../../utils/resultCopy");

function getConvertUnit(form) {
  if (form.convertUnit) return safeNumber(form.convertUnit) || 100;
  return form.roundLot === false ? 1 : 100;
}

function calcSharesByAmount(amount, price, convertUnit) {
  const rawShares = safeDivide(safeNumber(amount), safeNumber(price));
  const unit = safeNumber(convertUnit) || 100;
  return Math.max(0, Math.floor(rawShares / unit) * unit);
}

function makeTimeText() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function resultClass(value) {
  const num = safeNumber(value);
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "";
}

function formatSignedMoney(value) {
  const num = safeNumber(value);
  if (num > 0) return "+ " + formatMoney(num);
  if (num < 0) return "- " + formatMoney(Math.abs(num));
  return " 0.00";
}

function decorateFee(fee) {
  return {
    commissionFee: fee.commissionFee,
    transferFee: fee.transferFee,
    stampDutyFee: fee.stampDutyFee,
    totalFee: fee.totalFee,
    commissionText: formatMoney(fee.commissionFee),
    transferText: formatMoney(fee.transferFee),
    stampDutyText: formatMoney(fee.stampDutyFee),
    totalText: formatMoney(fee.totalFee)
  };
}

function buildCoreResultRows({ nextCost, reduceAmount, reduceRate, nextShares, buyTotalCost, priceReference }) {
  return [
    { label: "补仓后成本价", value: " " + formatPrice(nextCost, priceReference), highlight: true },
    {
      label: "成本降低金额/比例",
      value: " " + formatMoney(reduceAmount) + " / " + formatRate(reduceRate),
      className: resultClass(reduceAmount),
      highlight: true
    },
    { label: "补仓后总股数", value: formatNumber(nextShares, 0) + " 股", highlight: true },
    { label: "本次投入金额", value: " " + formatMoney(buyTotalCost), highlight: true }
  ];
}

Component(createCalculatorComponent({
  pageKey: "average-down",
  defaultForm: {
    originalCost: "",
    originalShares: "",
    buyAmount: "",
    buyPrice: "",
    buyShares: "",
    convertUnit: "100",
    roundLot: true,
    baseInitialized: false
  },
  calculate: calcAverageDown,
  afterInit() {
    if (!this.data.form.baseInitialized) return;
    const basePosition = this.getBasePosition(
      safeNumber(this.data.form.originalCost),
      safeNumber(this.data.form.originalShares)
    );
    if (!basePosition || !safeNumber(basePosition.shares)) return;
    this.setData({
      basePosition,
      basePositionCard: this.buildBasePositionCard(basePosition)
    }, () => this.refreshPreview());
  },
  buildCopy() {
    if (!this.data.result) return "";
    const rows = rowMap(this.data.result);
    const lastRecord = this.data.records[this.data.records.length - 1];
    return appendSource([
      "【补仓降本计算器】",
      this.data.form.originalCost ? `原成本价：${this.data.form.originalCost}` : "",
      this.data.form.originalShares ? `原股数：${this.data.form.originalShares}股` : "",
      lastRecord ? `累计补仓：${formatNumber(safeSubtract(lastRecord.afterShares, this.data.basePosition.shares), 0)}股` : "",
      rows["补仓后成本价"] ? `补仓后成本价：${rows["补仓后成本价"]}` : "",
      rows["成本降低金额/比例"] ? `成本降低：${rows["成本降低金额/比例"]}` : "",
      rows["补仓后总股数"] ? `当前总股数：${rows["补仓后总股数"]}` : "",
      rows["本次投入金额"] ? `本次投入：${rows["本次投入金额"]}` : ""
    ]);
  },
  methods: {
    getDisplayRecords(records) {
      const list = records || [];
      return this.data.latestFirst ? list.slice().reverse() : list;
    },

    onOperationSortChange(event) {
      const latestFirst = event.detail.value;
      this.setData({
        latestFirst,
        displayRecords: latestFirst ? this.data.records.slice().reverse() : this.data.records
      });
    },

    toggleAmountPanel() {
      this.setData({ showAmountPanel: !this.data.showAmountPanel });
    },

    refreshPreview() {
      const preview = this.buildPreview();
      const basePosition = this.data.basePosition || this.getBasePosition(
        safeNumber(this.data.form.originalCost),
        safeNumber(this.data.form.originalShares)
      );
      const result = preview && preview.resultRows
        ? { rows: preview.resultRows }
        : this.buildCumulativeResult(this.data.records || [], basePosition);
      this.setData({ preview, result });
    },

    setConvertUnit(event) {
      const convertUnit = String(event.currentTarget.dataset.unit || "100");
      this.setData({ "form.convertUnit": convertUnit });
      this.afterFormChange("convertUnit");
      this.persistForm();
    },

    calculate() {
      if (this.data.submitting) return;
      if (!this.data.form.baseInitialized) {
        this.initializeBasePosition();
        return;
      }

      const originalCost = safeNumber(this.data.form.originalCost);
      const originalShares = safeNumber(this.data.form.originalShares);
      const buyPrice = safeNumber(this.data.form.buyPrice);
      const buyShares = safeNumber(this.data.form.buyShares);
      if (!originalCost || !originalShares || !buyPrice || !buyShares) {
        wx.showToast({ title: "请填写补仓价和补仓数量", icon: "none" });
        return;
      }

      const basePosition = this.getBasePosition(originalCost, originalShares);
      const operation = {
        id: Date.now() + "-" + this.data.records.length,
        timeText: makeTimeText(),
        buyPrice,
        buyShares,
        includeFee: this.data.form.includeFee
      };
      const records = this.rebuildAverageDownRecords(this.data.records.concat(operation), basePosition);

      this.setData({ submitting: true });
      this.setData({
        basePosition,
        records,
        displayRecords: this.getDisplayRecords(records),
        result: this.buildCumulativeResult(records, basePosition),
        "form.buyPrice": "",
        "form.buyShares": "",
        "form.buyAmount": "",
        submitting: false
      }, () => {
        this.refreshPreview();
        this.persistForm();
        this.handleResultPosition("补仓结果已生成");
      });
    },

    initializeBasePosition() {
      const originalCost = safeNumber(this.data.form.originalCost);
      const originalShares = safeNumber(this.data.form.originalShares);
      if (!originalCost || !originalShares) {
        wx.showToast({ title: "请填写原成本价和原持仓数量", icon: "none" });
        return;
      }

      const basePosition = this.getBasePosition(originalCost, originalShares);
      this.setData({ submitting: true });
      this.setData({
        basePosition,
        basePositionCard: this.buildBasePositionCard(basePosition),
        "form.baseInitialized": true,
        submitting: false
      }, () => {
        this.refreshPreview();
        this.persistForm();
        wx.showToast({ title: "初始化完成", icon: "none", duration: 1200 });
      });
    },

    handleResultPosition(toastText) {
      const selector = "#" + this.data.calculatorKey + "-first-result-card";
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

    getBasePosition(originalCost, originalShares) {
      if (this.data.basePosition && safeNumber(this.data.basePosition.shares)) {
        return this.data.basePosition;
      }
      return {
        costPrice: originalCost,
        shares: originalShares,
        amount: safeMultiply(originalCost, originalShares)
      };
    },

    buildBasePositionCard(basePosition) {
      const amount = safeNumber(basePosition.amount);
      const cashFlow = -amount;
      return {
        title: "原持仓",
        tag: "已锁定",
        theme: "buy",
        mainItems: [
          { label: "原成本价", value: " " + formatPrice(basePosition.costPrice, this.data.form.originalCost) },
          { label: "原持仓数量", value: formatNumber(basePosition.shares, 0) + "股" }
        ],
        detailItems: [
          { label: "持仓成本", value: " " + formatMoney(amount) },
          { label: "手续费", value: " 0.00" },
          { label: "初始资金流", value: formatSignedMoney(cashFlow), className: resultClass(cashFlow) }
        ]
      };
    },

    getCurrentPosition() {
      const basePosition = this.data.basePosition || this.getBasePosition(
        safeNumber(this.data.form.originalCost),
        safeNumber(this.data.form.originalShares)
      );
      const records = this.data.records || [];
      if (!records.length) {
        return {
          amount: safeNumber(basePosition.amount),
          shares: safeNumber(basePosition.shares),
          cost: safeNumber(basePosition.costPrice)
        };
      }

      const lastRecord = records[records.length - 1];
      return {
        amount: safeNumber(lastRecord.afterAmount),
        shares: safeNumber(lastRecord.afterShares),
        cost: safeNumber(lastRecord.afterCost)
      };
    },

    buildPreview() {
      if (!this.data.form.baseInitialized) return null;
      const buyPrice = safeNumber(this.data.form.buyPrice);
      const buyShares = safeNumber(this.data.form.buyShares);
      if (!buyPrice || !buyShares) return null;

      const currentPosition = this.getCurrentPosition();
      if (!currentPosition.shares) return null;

      const buyAmount = safeMultiply(buyPrice, buyShares);
      const fee = calcTradeFee({
        amount: buyAmount,
        direction: "BUY",
        feeSettings: this.data.feeSettings,
        includeFee: this.data.form.includeFee
      });
      const buyTotalCost = safeAdd(buyAmount, fee.totalFee);
      const nextAmount = safeAdd(currentPosition.amount, buyTotalCost);
      const nextShares = safeAdd(currentPosition.shares, buyShares);
      const nextCost = safeDivide(nextAmount, nextShares);
      const reduceAmount = safeSubtract(currentPosition.cost, nextCost);
      const reduceRate = safeMultiply(safeDivide(reduceAmount, currentPosition.cost), 100);
      const cashFlow = -buyTotalCost;
      const resultRows = buildCoreResultRows({
        nextCost,
        reduceAmount,
        reduceRate,
        nextShares,
        buyTotalCost,
        priceReference: this.data.form.originalCost
      });

      return {
        title: "本次预览",
        tag: "补仓后",
        theme: "buy",
        mainItems: [
          { label: "补仓后成本价", value: " " + formatPrice(nextCost, this.data.form.originalCost) },
          { label: "成本降低", value: " " + formatMoney(reduceAmount) + " / " + formatRate(reduceRate), className: resultClass(reduceAmount) }
        ],
        detailItems: [
          { label: "补仓后总股数", value: formatNumber(nextShares, 0) + "股" },
          { label: "本次投入金额", value: " " + formatMoney(buyTotalCost) },
          { label: "补仓价", value: " " + formatPrice(buyPrice, this.data.form.buyPrice) },
          { label: "补仓数量", value: formatNumber(buyShares, 0) + "股" },
          { label: "补仓金额", value: " " + formatMoney(buyAmount) },
          { label: "手续费", value: " " + formatMoney(fee.totalFee) },
          { label: "本次资金流", value: formatSignedMoney(cashFlow), className: resultClass(cashFlow) }
        ],
        resultRows
      };
    },

    rebuildAverageDownRecords(records, basePosition) {
      let currentAmount = safeNumber(basePosition.amount);
      let currentShares = safeNumber(basePosition.shares);
      let currentCost = safeNumber(basePosition.costPrice);
      let totalBuyCost = 0;
      let totalFee = {
        commissionFee: 0,
        transferFee: 0,
        stampDutyFee: 0,
        totalFee: 0
      };

      return records.map((record, index) => {
        const buyPrice = safeNumber(record.buyPrice);
        const buyShares = safeNumber(record.buyShares);
        const buyAmount = safeMultiply(buyPrice, buyShares);
        const fee = calcTradeFee({
          amount: buyAmount,
          direction: "BUY",
          feeSettings: this.data.feeSettings,
          includeFee: record.includeFee
        });
        const buyTotalCost = safeAdd(buyAmount, fee.totalFee);
        const nextAmount = safeAdd(currentAmount, buyTotalCost);
        const nextShares = safeAdd(currentShares, buyShares);
        const nextCost = safeDivide(nextAmount, nextShares);
        const reduceAmount = safeSubtract(currentCost, nextCost);
        const reduceRate = safeMultiply(safeDivide(reduceAmount, currentCost), 100);
        const cashFlow = -buyTotalCost;

        totalBuyCost = safeAdd(totalBuyCost, buyTotalCost);
        totalFee = {
          commissionFee: safeAdd(totalFee.commissionFee, fee.commissionFee),
          transferFee: safeAdd(totalFee.transferFee, fee.transferFee),
          stampDutyFee: safeAdd(totalFee.stampDutyFee, fee.stampDutyFee),
          totalFee: safeAdd(totalFee.totalFee, fee.totalFee)
        };

        currentAmount = nextAmount;
        currentShares = nextShares;
        currentCost = nextCost;

        return Object.assign({}, record, {
          title: "补仓 " + (index + 1),
          includeFee: record.includeFee,
          buyAmount,
          buyTotalCost,
          cashFlow,
          afterAmount: nextAmount,
          afterShares: nextShares,
          afterCost: nextCost,
          totalBuyCost,
          totalFee,
          result: {
            fee: decorateFee(fee),
            rows: buildCoreResultRows({
              nextCost,
              reduceAmount,
              reduceRate,
              nextShares,
              buyTotalCost,
              priceReference: this.data.form.originalCost
            }).concat([
              { label: "补仓金额", value: " " + formatMoney(buyAmount) },
              { label: "手续费", value: " " + formatMoney(fee.totalFee) }
            ])
          },
          resultTitle: "第 " + (index + 1) + " 笔",
          resultTimeText: record.timeText,
          resultTagText: "补仓",
          resultTheme: "buy",
          mainItems: [
            { label: "补仓后成本价", value: " " + formatPrice(nextCost, this.data.form.originalCost) },
            { label: "成本降低", value: " " + formatMoney(reduceAmount) + " / " + formatRate(reduceRate), className: resultClass(reduceAmount) }
          ],
          detailItems: [
            { label: "补仓后总股数", value: formatNumber(nextShares, 0) + "股" },
            { label: "本次投入金额", value: " " + formatMoney(buyTotalCost) },
            { label: "补仓价", value: " " + formatPrice(buyPrice, record.buyPrice || this.data.form.buyPrice) },
            { label: "补仓数量", value: formatNumber(buyShares, 0) + "股" },
            { label: "补仓金额", value: " " + formatMoney(buyAmount) },
            { label: "手续费", value: " " + formatMoney(fee.totalFee) },
            { label: "本次资金流", value: formatSignedMoney(cashFlow), className: resultClass(cashFlow) }
          ]
        });
      });
    },

    buildCumulativeResult(records, basePosition) {
      if (!records.length) return null;
      const lastRecord = records[records.length - 1];
      const reduceAmount = safeSubtract(safeNumber(basePosition.costPrice), safeNumber(lastRecord.afterCost));
      const reduceRate = safeMultiply(safeDivide(reduceAmount, safeNumber(basePosition.costPrice)), 100);

      return {
        fee: decorateFee(lastRecord.totalFee),
        rows: buildCoreResultRows({
          nextCost: safeNumber(lastRecord.afterCost),
          reduceAmount,
          reduceRate,
          nextShares: safeNumber(lastRecord.afterShares),
          buyTotalCost: safeNumber(lastRecord.buyTotalCost),
          priceReference: this.data.form.originalCost
        }).concat([
          { label: "原持仓成本", value: " " + formatMoney(basePosition.amount) },
          { label: "累计补仓投入", value: " " + formatMoney(lastRecord.totalBuyCost) }
        ])
      };
    },

    clearRecords() {
      this.setData({
        form: {
          originalCost: "",
          originalShares: "",
          buyAmount: "",
          buyPrice: "",
          buyShares: "",
          convertUnit: "100",
          roundLot: true,
          baseInitialized: false,
          includeFee: this.data.feeSettings.useFee
        },
        records: [],
        displayRecords: [],
        result: null,
        preview: null,
        basePosition: null,
        basePositionCard: null,
        showAmountPanel: false
      }, () => {
        this.refreshPreview();
        this.persistForm();
      });
    },

    removeRecord(event) {
      const id = event.detail && event.detail.id ? event.detail.id : event.currentTarget.dataset.id;
      wx.showModal({
        title: "确认撤销这笔补仓？",
        content: "撤销后会基于剩余补仓记录重新计算持仓成本和累计结果。",
        confirmText: "撤销",
        confirmColor: "#3157C8",
        success: (res) => {
          if (!res.confirm) return;
          const basePosition = this.data.basePosition || this.getBasePosition(
            safeNumber(this.data.form.originalCost),
            safeNumber(this.data.form.originalShares)
          );
          const records = this.rebuildAverageDownRecords(
            this.data.records.filter((record) => record.id !== id),
            basePosition
          );

          this.setData({
            records,
            displayRecords: this.getDisplayRecords(records),
            result: this.buildCumulativeResult(records, basePosition),
            basePosition,
            basePositionCard: this.buildBasePositionCard(basePosition)
          }, () => this.refreshPreview());
          this.persistForm();
          wx.showToast({ title: "已撤销本笔并重新计算", icon: "none" });
        }
      });
    }
  },
  onFormChange(key) {
    if (key !== "buyAmount" && key !== "buyPrice" && key !== "buyShares" && key !== "convertUnit" && key !== "includeFee") return;
    const buyAmount = safeNumber(this.data.form.buyAmount);
    const buyPrice = safeNumber(this.data.form.buyPrice);
    if (buyAmount && buyPrice && key !== "buyShares") {
      this.setData({
        "form.buyShares": String(calcSharesByAmount(buyAmount, buyPrice, getConvertUnit(this.data.form)))
      }, () => this.refreshPreview());
      return;
    }
    this.refreshPreview();
  }
}));
