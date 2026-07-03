const { getFeeSettings, saveFeeSettings, resetFeeSettings } = require("../../utils/fee");
const { safeNumber } = require("../../utils/math");
const { getShareMessage, getShareTimelineMessage } = require("../../utils/share");

const NUMBER_KEYS = [
  "commissionRate",
  "commissionMinAmount",
  "transferFeeRate",
  "stampDutyRate"
];

Page({
  data: {
    form: {}
  },

  onShow() {
    this.setData({ form: getFeeSettings() });
  },

  onInput(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ ["form." + key]: event.detail.value });
  },

  onSwitchChange(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ ["form." + key]: event.detail.value });
  },

  save() {
    const form = Object.assign({}, this.data.form);
    NUMBER_KEYS.forEach((key) => {
      form[key] = safeNumber(form[key]);
    });
    saveFeeSettings(form);
    wx.showToast({ title: "已保存", icon: "success" });
  },

  reset() {
    const form = resetFeeSettings();
    this.setData({ form });
    wx.showToast({ title: "已恢复默认", icon: "success" });
  },

  onShareAppMessage() {
    return getShareMessage();
  },

  onShareTimeline() {
    return getShareTimelineMessage();
  }
});
