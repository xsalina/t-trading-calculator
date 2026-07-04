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

Component(createCalculatorComponent({
  pageKey: "average-down",
  defaultForm: {
    originalCost: "",
    originalShares: "",
    buyAmount: "",
    buyPrice: "",
    buyShares: "",
    convertUnit: "100",
    roundLot: true
  },
  calculate: calcAverageDown,
  buildCopy() {
    if (!this.data.result) return "";
    const rows = rowMap(this.data.result);
    const lastRecord = this.data.records[this.data.records.length - 1];
    return appendSource([
      "【补仓降本计算器】",
      this.data.form.originalCost ? `原成本价：${this.data.form.originalCost}` : "",
      this.data.form.originalShares ? `原股数：${this.data.form.originalShares}股` : "",
      lastRecord ? `累计补仓：${formatNumber(safeSubtract(lastRecord.afterShares, this.data.basePosition.shares), 0)}股` : "",
      rows["最新成本价"] ? `最新成本价：${rows["最新成本价"]}` : rows["补仓后成本价"] ? `补仓后成本价：${rows["补仓后成本价"]}` : "",
      rows["累计降低金额"] ? `成本降低：${rows["累计降低金额"]}` : rows["成本降低金额"] ? `成本降低：${rows["成本降低金额"]}` : "",
      rows["累计降低比例"] ? `降低比例：${rows["累计降低比例"]}` : rows["成本降低比例"] ? `降低比例：${rows["成本降低比例"]}` : "",
      rows["补仓后总股数"] ? `当前总股数：${rows["补仓后总股数"]}` : ""
    ]);
  },
  methods: {
    setConvertUnit(event) {
      const convertUnit = String(event.currentTarget.dataset.unit || "100");
      this.setData({ "form.convertUnit": convertUnit });
      this.afterFormChange("convertUnit");
      this.persistForm();
    },

    calculate() {
      const originalCost = safeNumber(this.data.form.originalCost);
      const originalShares = safeNumber(this.data.form.originalShares);
      const buyPrice = safeNumber(this.data.form.buyPrice);
      const buyShares = safeNumber(this.data.form.buyShares);
      if (!originalCost || !originalShares || !buyPrice || !buyShares) {
        wx.showToast({ title: "请填写成本、股数和补仓信息", icon: "none" });
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

      this.setData({
        basePosition,
        records,
        result: this.buildCumulativeResult(records, basePosition)
      });
      this.persistForm();
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
          afterAmount: nextAmount,
          afterShares: nextShares,
          afterCost: nextCost,
          totalBuyCost,
          totalFee,
          result: {
            fee: decorateFee(fee),
            rows: [
              { label: "补仓金额", value: "¥" + formatMoney(buyAmount) },
              { label: "补仓总成本", value: "¥" + formatMoney(buyTotalCost) },
              { label: "补仓后股数", value: formatNumber(nextShares, 0) + " 股" },
              { label: "补仓后成本价", value: "¥" + formatNumber(nextCost, 4) },
              { label: "本笔降低金额", value: "¥" + formatNumber(reduceAmount, 4), className: resultClass(reduceAmount) },
              { label: "本笔降低比例", value: formatRate(reduceRate), className: resultClass(reduceRate) }
            ]
          }
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
        rows: [
          { label: "原持仓成本", value: "¥" + formatMoney(basePosition.amount) },
          { label: "累计补仓成本", value: "¥" + formatMoney(lastRecord.totalBuyCost) },
          { label: "补仓后总股数", value: formatNumber(lastRecord.afterShares, 0) + " 股" },
          { label: "最新成本价", value: "¥" + formatNumber(lastRecord.afterCost, 4) },
          { label: "累计降低金额", value: "¥" + formatNumber(reduceAmount, 4), className: resultClass(reduceAmount) },
          { label: "累计降低比例", value: formatRate(reduceRate), className: resultClass(reduceRate) }
        ]
      };
    },

    clearRecords() {
      this.setData({
        records: [],
        result: null,
        basePosition: null
      });
    },

    removeRecord(event) {
      const id = event.detail && event.detail.id ? event.detail.id : event.currentTarget.dataset.id;
      wx.showModal({
        title: "确认撤销这笔补仓？",
        content: "撤销后会基于剩余补仓记录重新计算持仓成本和累计结果。",
        confirmText: "撤销",
        confirmColor: "#00b894",
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
            result: this.buildCumulativeResult(records, basePosition),
            basePosition: records.length ? basePosition : null
          });
        }
      });
    }
  },
  onFormChange(key) {
    if (key !== "buyAmount" && key !== "buyPrice" && key !== "convertUnit") return;
    const buyAmount = safeNumber(this.data.form.buyAmount);
    const buyPrice = safeNumber(this.data.form.buyPrice);
    if (!buyAmount || !buyPrice) return;
    this.setData({
      "form.buyShares": String(calcSharesByAmount(buyAmount, buyPrice, getConvertUnit(this.data.form)))
    });
  }
}));
