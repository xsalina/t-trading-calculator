const { getFeeSettings } = require("./fee");
const {
  clone,
  getSavedState,
  saveState,
  makeTimeText
} = require("./pageState");
const { safeNumber, roundTo } = require("./math");
const { getShareMessage, getShareTimelineMessage } = require("./share");

function createCalculatorPage(options) {
  const defaultForm = Object.assign({
    includeFee: true
  }, options.defaultForm);

  return {
    data: {
      form: clone(defaultForm),
      feeSettings: {},
      rememberData: true,
      records: []
    },

    onShow() {
      const feeSettings = getFeeSettings();
      const saved = getSavedState(options.pageKey);
      const rememberData = saved.rememberData !== false;
      const savedForm = saved.form || {};
      const form = rememberData
        ? Object.assign({}, defaultForm, savedForm, {
          includeFee: typeof savedForm.includeFee === "boolean" ? savedForm.includeFee : feeSettings.useFee
        })
        : Object.assign({}, this.data.form, { includeFee: feeSettings.useFee });

      this.setData({
        feeSettings,
        rememberData,
        form
      });
    },

    onInput(event) {
      const key = event.currentTarget.dataset.key;
      this.setData({ ["form." + key]: event.detail.value });
      this.afterFormChange(key);
      this.persistForm();
    },

    onFeeSwitch(event) {
      this.setData({ "form.includeFee": event.detail.value });
      this.persistForm();
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

      const textValue = Number.isInteger(nextValue) ? String(nextValue) : String(nextValue);
      this.setData({ ["form." + key]: textValue });
      this.afterFormChange(key);
      this.persistForm();
    },

    onFormSwitch(event) {
      const key = event.currentTarget.dataset.key;
      this.setData({ ["form." + key]: event.detail.value });
      this.afterFormChange(key);
      this.persistForm();
    },

    afterFormChange(key) {
      if (typeof options.onFormChange === "function") {
        options.onFormChange.call(this, key);
      }
    },

    onRememberSwitch(event) {
      const rememberData = event.detail.value;
      this.setData({ rememberData });
      if (rememberData) {
        this.persistForm();
      } else {
        saveState(options.pageKey, { rememberData: false });
      }
    },

    persistForm() {
      if (!this.data.rememberData) return;
      saveState(options.pageKey, {
        rememberData: true,
        form: this.data.form
      });
    },

    calculate() {
      const result = options.calculate(this.data.form, this.data.feeSettings);
      const nextCount = this.data.records.length + 1;
      const record = {
        id: Date.now() + "-" + nextCount,
        title: "测算 " + nextCount,
        timeText: makeTimeText(),
        includeFee: this.data.form.includeFee,
        result
      };

      this.setData({
        records: [record].concat(this.data.records)
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

    clearRecords() {
      this.setData({ records: [] });
    },

    removeRecord(event) {
      const id = event.detail && event.detail.id ? event.detail.id : event.currentTarget.dataset.id;
      this.setData({
        records: this.data.records.filter((record) => record.id !== id)
      });
    },

    onShareAppMessage() {
      return getShareMessage();
    },

    onShareTimeline() {
      return getShareTimelineMessage();
    }
  };
}

module.exports = {
  createCalculatorPage
};
