const { createCalculatorComponent } = require("../../../utils/calculatorComponent");
const { calcReverseT } = require("../../../utils/calculators");
const { calcTradeFee } = require("../../../utils/fee");
const {
  safeNumber,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  formatMoney,
  formatNumber
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

Component(createCalculatorComponent({
  pageKey: "reverse-t",
  defaultForm: {
    sellPrice: "",
    coverAmount: "",
    coverPrice: "",
    shares: "",
    convertUnit: "100",
    roundLot: true
  },
  calculate: calcReverseT,
  buildCopy() {
    if (!this.data.result) return "";
    const rows = rowMap(this.data.result);
    return appendSource([
      "【反T回补计算器】",
      this.data.form.sellPrice ? `卖出均价：${this.data.form.sellPrice}` : "",
      rows["累计回补数量"] ? `累计回补：${rows["累计回补数量"]}` : this.data.form.shares ? `回补股数：${this.data.form.shares}股` : "",
      rows["平均回补价"] ? `平均回补价：${rows["平均回补价"]}` : this.data.form.coverPrice ? `回补价：${this.data.form.coverPrice}` : "",
      rows["剩余待回补数量"] ? `剩余待回补：${rows["剩余待回补数量"]}` : "",
      rows["累计反T收益"] ? `累计反T收益：${rows["累计反T收益"]}` : ""
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
      const sellPrice = safeNumber(this.data.form.sellPrice);
      const coverPrice = safeNumber(this.data.form.coverPrice);
      const shares = safeNumber(this.data.form.shares);
      if (!sellPrice || !coverPrice || !shares) {
        wx.showToast({ title: "请填写价格和股数", icon: "none" });
        return;
      }

      const basePendingShares = this.getBasePendingShares(shares);
      const record = {
        id: Date.now() + "-" + this.data.records.length,
        timeText: makeTimeText(),
        sellPrice,
        coverPrice,
        shares
      };
      const records = this.rebuildCoverRecords(this.data.records.concat(record), basePendingShares);
      this.setData({
        basePendingShares,
        records,
        result: this.buildCumulativeResult(records, basePendingShares)
      });
      this.persistForm();
    },

    getBasePendingShares(currentShares) {
      const existingBase = safeNumber(this.data.basePendingShares);
      if (existingBase) return existingBase;
      const entryShares = safeNumber((this.data.entryQuery || {}).quantity);
      return entryShares || currentShares;
    },

    rebuildCoverRecords(records, basePendingShares) {
      let coveredShares = 0;
      return records.map((record) => {
        const coverPrice = safeNumber(record.coverPrice);
        const shares = safeNumber(record.shares);
        const sellPrice = safeNumber(record.sellPrice || this.data.form.sellPrice);
        const coverAmount = safeMultiply(coverPrice, shares);
        const sellAmount = safeMultiply(sellPrice, shares);
        const sellFee = calcTradeFee({
          amount: sellAmount,
          direction: "SELL",
          feeSettings: this.data.feeSettings,
          includeFee: this.data.form.includeFee
        });
        const coverFee = calcTradeFee({
          amount: coverAmount,
          direction: "BUY",
          feeSettings: this.data.feeSettings,
          includeFee: this.data.form.includeFee
        });
        const feeTotal = safeAdd(sellFee.totalFee, coverFee.totalFee);
        const spreadProfit = safeMultiply(safeSubtract(sellPrice, coverPrice), shares);
        const netProfit = safeSubtract(spreadProfit, feeTotal);
        coveredShares = safeAdd(coveredShares, shares);
        const remainingShares = Math.max(0, safeSubtract(basePendingShares, coveredShares));

        return Object.assign({}, record, {
          sellPrice,
          coverPrice,
          shares,
          coverAmount,
          feeTotal,
          netProfit,
          title: "回补 " + formatNumber(shares, 0) + " 股",
          coverPriceText: "¥" + formatNumber(coverPrice, 4),
          sharesText: formatNumber(shares, 0) + " 股",
          coverAmountText: "¥" + formatMoney(coverAmount),
          feeText: "¥" + formatMoney(feeTotal),
          netProfitText: "¥" + formatMoney(netProfit),
          netProfitClass: resultClass(netProfit),
          remainingSharesText: formatNumber(remainingShares, 0) + " 股"
        });
      });
    },

    buildCumulativeResult(records, basePendingShares) {
      const totalShares = records.reduce((sum, record) => safeAdd(sum, safeNumber(record.shares)), 0);
      const totalCoverAmount = records.reduce((sum, record) => safeAdd(sum, safeNumber(record.coverAmount)), 0);
      const totalProfit = records.reduce((sum, record) => safeAdd(sum, safeNumber(record.netProfit)), 0);
      const remainingShares = Math.max(0, safeSubtract(basePendingShares, totalShares));
      const avgCoverPrice = totalShares ? safeDivide(totalCoverAmount, totalShares) : 0;

      return {
        rows: [
          { label: "初始待回补数量", value: formatNumber(basePendingShares, 0) + " 股" },
          { label: "累计回补数量", value: formatNumber(totalShares, 0) + " 股" },
          { label: "剩余待回补数量", value: formatNumber(remainingShares, 0) + " 股" },
          { label: "平均回补价", value: avgCoverPrice ? "¥" + formatNumber(avgCoverPrice, 4) : "-" },
          { label: "累计反T收益", value: "¥" + formatMoney(totalProfit), className: resultClass(totalProfit) }
        ]
      };
    },

    undoCoverRecord(event) {
      const id = event.currentTarget.dataset.id;
      wx.showModal({
        title: "确认撤销这笔回补？",
        content: "撤销后会重新计算剩余待回补数量和反T收益。",
        confirmText: "撤销",
        confirmColor: "#00b894",
        success: (res) => {
          if (!res.confirm) return;
          const basePendingShares = this.getBasePendingShares(safeNumber(this.data.form.shares));
          const remainingRecords = this.data.records.filter((record) => record.id !== id);
          const records = this.rebuildCoverRecords(remainingRecords, basePendingShares);
          this.setData({
            basePendingShares,
            records,
            result: records.length ? this.buildCumulativeResult(records, basePendingShares) : this.buildCumulativeResult([], basePendingShares)
          });
          this.persistForm();
        }
      });
    },

    clearRecords() {
      this.setData({
        records: [],
        result: null,
        basePendingShares: 0
      });
    }
  },
  onFormChange(key) {
    if (key !== "coverAmount" && key !== "coverPrice" && key !== "convertUnit") return;
    const coverAmount = safeNumber(this.data.form.coverAmount);
    const coverPrice = safeNumber(this.data.form.coverPrice);
    if (!coverAmount || !coverPrice) return;
    this.setData({
      "form.shares": String(calcSharesByAmount(coverAmount, coverPrice, getConvertUnit(this.data.form)))
    });
  }
}));
