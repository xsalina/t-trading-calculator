const { calcPriceProjection } = require("../../../utils/calculators");
const { getSavedState, saveState } = require("../../../utils/pageState");
const { safeNumber, safeMultiply, roundTo, formatMoney, formatNumber, formatPrice } = require("../../../utils/math");
const { applyExternalFormPreset, isExternalEntry } = require("../../../utils/externalEntry");
const { appendSource, copyText, rowMap } = require("../../../utils/resultCopy");

const PAGE_KEY = "price-projection";
const DEFAULT_FORM = {
  startPrice: "",
  shares: "",
  changeRate: ""
};

function findRow(result, label) {
  return ((result && result.rows) || []).find((row) => row.label === label) || {};
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
    },
    isDefaultCalculator: {
      type: Boolean,
      value: false
    }
  },

  data: {
    form: DEFAULT_FORM,
    rememberData: true,
    result: null,
    records: []
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
      const saved = getSavedState(PAGE_KEY);
      const rememberData = saved.rememberData !== false;
      const entryQuery = this.data.entryQuery || {};
      const savedForm = isExternalEntry(entryQuery)
        ? Object.assign({}, DEFAULT_FORM)
        : rememberData ? Object.assign({}, DEFAULT_FORM, saved.form || {}) : this.data.form;
      const externalPreset = applyExternalFormPreset(PAGE_KEY, savedForm, entryQuery);
      const form = externalPreset.form;

      this.setData({
        rememberData,
        form,
        records: isExternalEntry(entryQuery) ? [] : this.data.records,
        result: isExternalEntry(entryQuery) ? null : this.data.result
      }, () => {
        if (externalPreset.applied) {
          this.persistForm();
        }
      });
    },

    onInput(event) {
      const key = event.currentTarget.dataset.key;
      this.setData({ ["form." + key]: event.detail.value });
      this.persistForm();
    },

    onRememberSwitch(event) {
      const rememberData = event.detail.value;
      this.setData({ rememberData });
      if (rememberData) {
        this.persistForm();
      } else {
        saveState(PAGE_KEY, { rememberData: false });
      }
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

      this.setData({ ["form." + key]: Number.isInteger(nextValue) ? String(nextValue) : String(nextValue) });
      this.persistForm();
    },

    persistForm() {
      if (!this.data.rememberData) return;
      saveState(PAGE_KEY, {
        rememberData: true,
        form: this.data.form
      });
    },

    calculate() {
      const result = calcPriceProjection(this.data.form);
      const projectionRows = (result && result.projectionRows) || [];
      const finalRow = projectionRows[projectionRows.length - 1] || {};
      const startPrice = safeNumber(this.data.form.startPrice);
      const shares = safeNumber(this.data.form.shares);
      const startMarketValue = safeMultiply(startPrice, shares);
      const record = {
        id: Date.now() + "-" + this.data.records.length,
        result,
        projectionRows: result.projectionRows || [],
        showDetails: true,
        resultTitle: "推演结果",
        resultTagText: "第50天",
        resultTheme: safeNumber(this.data.form.changeRate) >= 0 ? "sell" : "buy",
        mainItems: [
          { label: "第50天价格", value: findRow(result, "第50天价格").value || "-", className: findRow(result, "第50天价格").className || "" },
          { label: "第50天盈亏", value: findRow(result, "第50天盈亏").value || "-", className: findRow(result, "第50天盈亏").className || "" }
        ],
        detailItems: [
          { label: "第50天市值", value: findRow(result, "第50天市值").value || "-", className: findRow(result, "第50天市值").className || "" },
          { label: "累计涨跌幅", value: finalRow.changeRate || "-", className: finalRow.className || "" },
          { label: "起始价格", value: " " + formatPrice(startPrice, this.data.form.startPrice) },
          { label: "股票数量", value: formatNumber(shares, 0) + "股" },
          { label: "每日涨跌幅", value: (this.data.form.changeRate || "0") + "%", className: findRow(result, "每日涨跌幅").className || "" },
          { label: "起始市值", value: " " + formatMoney(startMarketValue) }
        ]
      };
      this.setData({
        result,
        records: [record].concat(this.data.records)
      });
      this.persistForm();
    },

    removeRecord(event) {
      const id = event.detail && event.detail.id ? event.detail.id : event.currentTarget.dataset.id;
      const records = this.data.records.filter((record) => record.id !== id);
      this.setData({
        records,
        result: records.length ? records[0].result : null
      });
    },

    toggleProjectionDetail(event) {
      const id = event.currentTarget.dataset.id;
      const records = this.data.records.map((record) => {
        if (record.id !== id) return record;
        return Object.assign({}, record, {
          showDetails: !record.showDetails
        });
      });
      this.setData({ records });
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

    onDefaultCalculatorTap() {
      this.triggerEvent("setdefaultcalculator");
    },

    copyResult() {
      if (!this.data.result) {
        wx.showToast({ title: "请先完成测算", icon: "none" });
        return;
      }

      const rows = rowMap(this.data.result);
      const copyValue = appendSource([
        "【涨跌幅推演计算器】",
        this.data.form.startPrice ? `起始价格：${this.data.form.startPrice}` : "",
        this.data.form.shares ? `股票数量：${this.data.form.shares}股` : "",
        this.data.form.changeRate ? `每日涨跌幅：${this.data.form.changeRate}%` : "",
        "推演天数：50天",
        rows["第50天价格"] ? `第50天价格：${rows["第50天价格"]}` : "",
        rows["第50天市值"] ? `第50天市值：${rows["第50天市值"]}` : "",
        rows["第50天盈亏"] ? `第50天盈亏：${rows["第50天盈亏"]}` : ""
      ]);
      copyText(copyValue);
    }
  }
});
