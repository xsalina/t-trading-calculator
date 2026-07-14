const { getFeeSettings, saveFeeSettings, resetFeeSettings, saveDefaultUseFee } = require("../../utils/fee");
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
    const value = event.detail.value;
    this.setData({ ["form." + key]: value });
    if (key === "useFee") {
      const form = saveDefaultUseFee(value);
      this.setData({ form });
      wx.showToast({
        title: value ? "已设为默认计入手续费" : "已设为默认不计入手续费",
        icon: "none"
      });
    }
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
