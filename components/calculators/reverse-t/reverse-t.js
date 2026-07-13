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
  formatNumber,
  formatPrice
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

function hasExternalFee(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
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

function calcAllocatedSellFee({ sellPrice, shares, basePendingShares, feeSettings, includeFee, externalSellFee }) {
  if (hasExternalFee(externalSellFee)) {
    if (!basePendingShares || !shares) return 0;
    return safeMultiply(safeNumber(externalSellFee), safeDivide(shares, basePendingShares));
  }

  const totalSellAmount = safeMultiply(safeNumber(sellPrice), safeNumber(basePendingShares));
  if (!totalSellAmount || !basePendingShares || !shares) return 0;
  const totalSellFee = calcTradeFee({
    amount: totalSellAmount,
    direction: "SELL",
    feeSettings,
    includeFee
  }).totalFee;
  return safeMultiply(totalSellFee, safeDivide(shares, basePendingShares));
}

Component(createCalculatorComponent({
  pageKey: "reverse-t",
  defaultForm: {
    sellPrice: "",
    coverAmount: "",
    coverPrice: "",
    shares: "",
    convertUnit: "100",
    roundLot: true,
    baseInitialized: false,
    basePendingShares: "",
    externalSellFee: ""
  },
  calculate: calcReverseT,
  afterInit() {
    if (!this.data.form.baseInitialized) return;
    const basePendingShares = this.getBasePendingShares(safeNumber(this.data.form.shares));
    if (!basePendingShares) {
      this.setData({ "form.baseInitialized": false });
      return;
    }
    this.setData({
      basePendingShares,
      baseSellCard: this.buildBaseSellCard(basePendingShares)
    }, () => this.refreshPreview());
  },
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
      this.setData({ preview: this.buildPreview() });
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
        this.initializeSell();
        return;
      }

      const sellPrice = safeNumber(this.data.form.sellPrice);
      const coverPrice = safeNumber(this.data.form.coverPrice);
      const shares = safeNumber(this.data.form.shares);
      if (!sellPrice || !coverPrice || !shares) {
        wx.showToast({ title: "请填写回补价和回补股数", icon: "none" });
        return;
      }

      const basePendingShares = this.getBasePendingShares();
      const record = {
        id: Date.now() + "-" + this.data.records.length,
        timeText: makeTimeText(),
        sellPrice,
        coverPrice,
        shares
      };
      const records = this.rebuildCoverRecords(this.data.records.concat(record), basePendingShares);
      this.setData({ submitting: true });
      this.setData({
        basePendingShares,
        records,
        displayRecords: this.getDisplayRecords(records),
        result: this.buildCumulativeResult(records, basePendingShares),
        submitting: false
      }, () => {
        this.refreshPreview();
        this.persistForm();
        this.handleResultPosition("回补结果已生成");
      });
    },

    initializeSell() {
      const sellPrice = safeNumber(this.data.form.sellPrice);
      const pendingShares = safeNumber(this.data.form.shares);
      if (!sellPrice || !pendingShares) {
        wx.showToast({ title: "请填写卖出价和待回补股数", icon: "none" });
        return;
      }

      this.setData({ submitting: true });
      this.setData({
        basePendingShares: pendingShares,
        baseSellCard: this.buildBaseSellCard(pendingShares),
        "form.baseInitialized": true,
        "form.basePendingShares": String(pendingShares),
        "form.shares": "",
        "form.coverAmount": "",
        submitting: false
      }, () => {
        this.refreshPreview();
        this.persistForm();
        wx.showToast({ title: "初始化完成", icon: "none", duration: 1200 });
      });
    },

    getBasePendingShares(currentShares) {
      const existingBase = safeNumber(this.data.basePendingShares);
      if (existingBase) return existingBase;
      const formBase = safeNumber(this.data.form.basePendingShares);
      if (formBase) return formBase;
      const entryShares = safeNumber((this.data.entryQuery || {}).quantity);
      return entryShares || currentShares;
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

    buildBaseSellCard(basePendingShares) {
      const sellPrice = safeNumber(this.data.form.sellPrice);
      const sellAmount = safeMultiply(sellPrice, basePendingShares);
      const externalFeeUsed = hasExternalFee(this.data.form.externalSellFee);
      const sellFeeTotal = externalFeeUsed
        ? safeNumber(this.data.form.externalSellFee)
        : calcTradeFee({
          amount: sellAmount,
          direction: "SELL",
          feeSettings: this.data.feeSettings,
          includeFee: this.data.form.includeFee
        }).totalFee;
      const initialCashFlow = safeSubtract(sellAmount, sellFeeTotal);

      return {
        title: "初始化卖出",
        tag: "已锁定",
        theme: "sell",
        mainItems: [
          { label: "卖出价", value: " " + formatPrice(sellPrice, this.data.form.sellPrice) },
          { label: "待回补股数", value: formatNumber(basePendingShares, 0) + "股" }
        ],
        detailItems: [
          { label: "卖出金额", value: " " + formatMoney(sellAmount) },
          { label: externalFeeUsed ? "外部卖出手续费" : "卖出手续费", value: " " + formatMoney(sellFeeTotal) },
          { label: "初始资金流", value: formatSignedMoney(initialCashFlow), className: resultClass(initialCashFlow) }
        ]
      };
    },

    getCoveredShares(records) {
      return (records || []).reduce((sum, record) => safeAdd(sum, safeNumber(record.shares)), 0);
    },

    buildPreview() {
      if (!this.data.form.baseInitialized) return null;
      const sellPrice = safeNumber(this.data.form.sellPrice);
      const coverPrice = safeNumber(this.data.form.coverPrice);
      const shares = safeNumber(this.data.form.shares);
      const basePendingShares = this.getBasePendingShares();
      if (!sellPrice || !coverPrice || !shares || !basePendingShares) return null;

      const coverAmount = safeMultiply(coverPrice, shares);
      const allocatedSellFee = calcAllocatedSellFee({
        sellPrice,
        shares,
        basePendingShares,
        feeSettings: this.data.feeSettings,
        includeFee: this.data.form.includeFee,
        externalSellFee: this.data.form.externalSellFee
      });
      const coverFee = calcTradeFee({
        amount: coverAmount,
        direction: "BUY",
        feeSettings: this.data.feeSettings,
        includeFee: this.data.form.includeFee
      });
      const feeTotal = safeAdd(allocatedSellFee, coverFee.totalFee);
      const spreadProfit = safeMultiply(safeSubtract(sellPrice, coverPrice), shares);
      const netProfit = safeSubtract(spreadProfit, feeTotal);
      const cashFlow = -safeAdd(coverAmount, coverFee.totalFee);
      const coverSpace = safeSubtract(sellPrice, coverPrice);
      const remainingShares = Math.max(0, safeSubtract(
        basePendingShares,
        safeAdd(this.getCoveredShares(this.data.records), shares)
      ));

      return {
        title: "本次预览",
        tag: "回补后",
        theme: "buy",
        mainItems: [
          { label: "回补价", value: " " + formatPrice(coverPrice, this.data.form.coverPrice) },
          { label: "回补股数", value: formatNumber(shares, 0) + "股" }
        ],
        detailItems: [
          { label: "剩余待回补", value: formatNumber(remainingShares, 0) + "股" },
          { label: "本次回补收益", value: formatSignedMoney(netProfit), className: resultClass(netProfit) },
          { label: "回补金额", value: " " + formatMoney(coverAmount) },
          { label: "卖出手续费分摊", value: " " + formatMoney(allocatedSellFee) },
          { label: "回补手续费", value: " " + formatMoney(coverFee.totalFee) },
          { label: "本次资金流", value: formatSignedMoney(cashFlow), className: resultClass(cashFlow) },
          { label: "回补空间", value: " " + formatMoney(coverSpace), className: resultClass(coverSpace) }
        ]
      };
    },

    rebuildCoverRecords(records, basePendingShares) {
      let coveredShares = 0;
      return records.map((record, index) => {
        const coverPrice = safeNumber(record.coverPrice);
        const shares = safeNumber(record.shares);
        const sellPrice = safeNumber(record.sellPrice || this.data.form.sellPrice);
        const coverAmount = safeMultiply(coverPrice, shares);
        const allocatedSellFee = calcAllocatedSellFee({
          sellPrice,
          shares,
          basePendingShares,
          feeSettings: this.data.feeSettings,
          includeFee: this.data.form.includeFee,
          externalSellFee: this.data.form.externalSellFee
        });
        const coverFee = calcTradeFee({
          amount: coverAmount,
          direction: "BUY",
          feeSettings: this.data.feeSettings,
          includeFee: this.data.form.includeFee
        });
        const feeTotal = safeAdd(allocatedSellFee, coverFee.totalFee);
        const spreadProfit = safeMultiply(safeSubtract(sellPrice, coverPrice), shares);
        const netProfit = safeSubtract(spreadProfit, feeTotal);
        const cashFlow = -safeAdd(coverAmount, coverFee.totalFee);
        const coverSpace = safeSubtract(sellPrice, coverPrice);
        coveredShares = safeAdd(coveredShares, shares);
        const remainingShares = Math.max(0, safeSubtract(basePendingShares, coveredShares));

        return Object.assign({}, record, {
          sellPrice,
          coverPrice,
          shares,
          coverAmount,
          feeTotal,
          allocatedSellFee,
          coverFeeTotal: coverFee.totalFee,
          netProfit,
          cashFlow,
          coverSpace,
          title: "回补 " + formatNumber(shares, 0) + " 股",
          coverPriceText: " " + formatPrice(coverPrice, record.coverPrice || this.data.form.coverPrice),
          sharesText: formatNumber(shares, 0) + " 股",
          coverAmountText: " " + formatMoney(coverAmount),
          feeText: " " + formatMoney(feeTotal),
          netProfitText: " " + formatMoney(netProfit),
          netProfitClass: resultClass(netProfit),
          remainingSharesText: formatNumber(remainingShares, 0) + " 股",
          resultTitle: "第 " + (index + 1) + " 笔",
          resultTimeText: record.timeText,
          resultTagText: "回补",
          resultTheme: "buy",
          mainItems: [
            { label: "剩余待回补", value: formatNumber(remainingShares, 0) + "股" },
            { label: "本次回补收益", value: formatSignedMoney(netProfit), className: resultClass(netProfit) }
          ],
          detailItems: [
            { label: "回补价", value: " " + formatPrice(coverPrice, record.coverPrice || this.data.form.coverPrice) },
            { label: "回补股数", value: formatNumber(shares, 0) + "股" },
            { label: "回补金额", value: " " + formatMoney(coverAmount) },
            { label: "卖出手续费分摊", value: " " + formatMoney(allocatedSellFee) },
            { label: "回补手续费", value: " " + formatMoney(coverFee.totalFee) },
            { label: "本次资金流", value: formatSignedMoney(cashFlow), className: resultClass(cashFlow) },
            { label: "回补空间", value: " " + formatMoney(coverSpace), className: resultClass(coverSpace) }
          ]
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
          { label: "剩余待回补数量", value: formatNumber(remainingShares, 0) + " 股", highlight: true },
          { label: "平均回补价", value: avgCoverPrice ? " " + formatPrice(avgCoverPrice, this.data.form.sellPrice) : "-", highlight: true },
          { label: "累计反T收益", value: formatSignedMoney(totalProfit), className: resultClass(totalProfit), highlight: true },
          { label: "初始待回补数量", value: formatNumber(basePendingShares, 0) + " 股" },
          { label: "累计回补数量", value: formatNumber(totalShares, 0) + " 股" }
        ]
      };
    },

    undoCoverRecord(event) {
      const id = (event.detail && event.detail.id) || event.currentTarget.dataset.id;
      wx.showModal({
        title: "确认撤销这笔回补？",
        content: "撤销后会重新计算剩余待回补数量和反T收益。",
        confirmText: "确认撤销",
        confirmColor: "#D96B6B",
        success: (res) => {
          if (!res.confirm) return;
          const basePendingShares = this.getBasePendingShares(safeNumber(this.data.form.shares));
          const remainingRecords = this.data.records.filter((record) => record.id !== id);
          const records = this.rebuildCoverRecords(remainingRecords, basePendingShares);
          this.setData({
            basePendingShares,
            records,
            displayRecords: this.getDisplayRecords(records),
            result: records.length ? this.buildCumulativeResult(records, basePendingShares) : this.buildCumulativeResult([], basePendingShares)
          }, () => this.refreshPreview());
          this.persistForm();
          wx.showToast({ title: "已撤销本笔并重新计算", icon: "none" });
        }
      });
    },

    clearRecords() {
      wx.showModal({
        title: "确认全部清除？",
        content: "清除后会重置卖出信息和所有回补记录。",
        confirmText: "确认清除",
        confirmColor: "#D96B6B",
        success: (res) => {
          if (!res.confirm) return;
          this.resetRecords();
        }
      });
    },

    resetRecords() {
      this.setData({
        form: {
          sellPrice: "",
          coverAmount: "",
          coverPrice: "",
          shares: "",
          convertUnit: "100",
          roundLot: true,
          baseInitialized: false,
          basePendingShares: "",
          externalSellFee: "",
          includeFee: this.data.feeSettings.useFee
        },
        records: [],
        displayRecords: [],
        result: null,
        preview: null,
        basePendingShares: 0,
        baseSellCard: null,
        showAmountPanel: false
      }, () => {
        this.refreshPreview();
        this.persistForm();
      });
    }
  },
  onFormChange(key) {
    if (key !== "coverAmount" && key !== "coverPrice" && key !== "convertUnit" && key !== "shares" && key !== "includeFee") return;
    const coverAmount = safeNumber(this.data.form.coverAmount);
    const coverPrice = safeNumber(this.data.form.coverPrice);
    if (coverAmount && coverPrice && key !== "shares") {
      this.setData({
        "form.shares": String(calcSharesByAmount(coverAmount, coverPrice, getConvertUnit(this.data.form)))
      }, () => this.refreshPreview());
      return;
    }
    this.refreshPreview();
  }
}));
