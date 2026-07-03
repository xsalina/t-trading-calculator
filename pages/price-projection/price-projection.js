const { calcPriceProjection } = require("../../utils/calculators");
const { getSavedState, saveState } = require("../../utils/pageState");
const { safeNumber, roundTo } = require("../../utils/math");
const { getShareMessage, getShareTimelineMessage } = require("../../utils/share");

const PAGE_KEY = "price-projection";
const DEFAULT_FORM = {
  startPrice: "",
  shares: "",
  changeRate: ""
};

Page({
  data: {
    form: DEFAULT_FORM,
    rememberData: true,
    result: null,
    resultTitle: "计算结果"
  },

  onShow() {
    const saved = getSavedState(PAGE_KEY);
    const rememberData = saved.rememberData !== false;
    this.setData({
      rememberData,
      form: rememberData ? Object.assign({}, DEFAULT_FORM, saved.form || {}) : this.data.form
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

  onShareAppMessage() {
    return getShareMessage();
  },

  onShareTimeline() {
    return getShareTimelineMessage();
  }
});
