const { calcPriceProjection } = require("../../../utils/calculators");
const { getSavedState, saveState } = require("../../../utils/pageState");
const { safeNumber, roundTo } = require("../../../utils/math");
const { applyExternalFormPreset } = require("../../../utils/externalEntry");
const { appendSource, copyText, rowMap } = require("../../../utils/resultCopy");

const PAGE_KEY = "price-projection";
const DEFAULT_FORM = {
  startPrice: "",
  shares: "",
  changeRate: ""
};

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
    rememberData: true,
    result: null,
    resultTitle: "计算结果"
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
      const savedForm = rememberData ? Object.assign({}, DEFAULT_FORM, saved.form || {}) : this.data.form;
      const externalPreset = applyExternalFormPreset(PAGE_KEY, savedForm, this.data.entryQuery || {});
      const form = externalPreset.form;

      this.setData({
        rememberData,
        form
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
      this.setData({
        result: calcPriceProjection(this.data.form),
        resultTitle: "计算结果"
      });
      this.persistForm();
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
