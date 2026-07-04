const TRADE_RECORD_MINI_PROGRAM_APP_ID = "wx253309efe732b547";
const DEFAULT_CALCULATOR_TYPE_KEY = "defaultCalculatorType";
const SYSTEM_DEFAULT_CALCULATOR_TYPE = "t-profit";
const { getShareMessage, getShareTimelineMessage } = require("../../utils/share");
const { ARTICLE_URL } = require("../../utils/article");
const { getEntryRedirectUrl } = require("../../utils/externalEntry");
const { getFeeSettings } = require("../../utils/fee");
const { formatMoney, roundTo } = require("../../utils/math");

const CALCULATORS = [
  {
    type: "t-profit",
    shortName: "做T",
    name: "做T计算器",
    desc: "记录买入卖出操作，测算收益和持仓成本",
    url: "/pages/t-profit/t-profit"
  },
  {
    type: "break-even",
    shortName: "回本",
    name: "回本计算器",
    desc: "测算当前价回到成本价需要涨多少",
    url: "/pages/break-even/break-even"
  },
  {
    type: "reverse-t",
    shortName: "反T",
    name: "反T回补计算器",
    desc: "测算先卖后买的回补空间和净收益",
    url: "/pages/reverse-t/reverse-t"
  },
  {
    type: "take-profit",
    shortName: "止盈",
    name: "止盈目标价计算器",
    desc: "按目标收益反推卖出价",
    url: "/pages/take-profit/take-profit"
  },
  {
    type: "average-down",
    shortName: "补仓",
    name: "补仓降本计算器",
    desc: "测算补仓后的新成本价",
    url: "/pages/average-down/average-down"
  },
  {
    type: "sell-estimate",
    shortName: "卖出",
    name: "卖出测算计算器",
    desc: "测算部分卖出的净收益和剩余仓位",
    url: "/pages/sell-estimate/sell-estimate"
  },
  {
    type: "grid",
    shortName: "网格",
    name: "网格区间计算器",
    desc: "生成上下网格价和单档收益",
    url: "/pages/grid/grid"
  },
  {
    type: "price-projection",
    shortName: "涨跌幅",
    name: "涨跌幅推演计算器",
    desc: "按涨跌幅查看近50天价格和市值",
    url: "/pages/price-projection/price-projection"
  }
];

function formatFeeRate(rate) {
  const value = roundTo(Number(rate || 0) * 100, 3);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + "%";
}

Page({
  data: {
    calculators: CALCULATORS,
    defaultCalculatorType: SYSTEM_DEFAULT_CALCULATOR_TYPE,
    defaultCalculator: CALCULATORS[0],
    activeCalculatorType: SYSTEM_DEFAULT_CALCULATOR_TYPE,
    activeCalculator: CALCULATORS[0],
    feeSummary: null,
    showDefaultPicker: false
  },

  onLoad(options) {
    const url = getEntryRedirectUrl(options || {});
    if (url) {
      wx.redirectTo({ url });
      return;
    }

    this.initDefaultCalculator();
    this.initFeeSummary();
  },

  onShow() {
    this.initDefaultCalculator();
    this.initFeeSummary();
  },

  initFeeSummary() {
    const settings = getFeeSettings();
    this.setData({
      feeSummary: {
        useFeeText: settings.useFee ? "已开启" : "已关闭",
        commissionText: settings.commissionEnabled ? formatFeeRate(settings.commissionRate) : "关闭",
        commissionMinText: settings.commissionMinEnabled ? "¥" + formatMoney(settings.commissionMinAmount) : "无最低",
        transferText: settings.transferFeeEnabled ? formatFeeRate(settings.transferFeeRate) : "关闭",
        stampDutyText: settings.stampDutyEnabled ? formatFeeRate(settings.stampDutyRate) : "关闭",
        stampDutyScopeText: settings.stampDutyOnlySell ? "卖出收" : "买卖都收"
      }
    });
  },

  initDefaultCalculator() {
    const savedType = wx.getStorageSync(DEFAULT_CALCULATOR_TYPE_KEY) || SYSTEM_DEFAULT_CALCULATOR_TYPE;
    const calculator = this.data.calculators.find((item) => item.type === savedType)
      || this.data.calculators.find((item) => item.type === SYSTEM_DEFAULT_CALCULATOR_TYPE)
      || this.data.calculators[0];

    if (!calculator) return;

    if (savedType !== calculator.type) {
      wx.setStorageSync(DEFAULT_CALCULATOR_TYPE_KEY, calculator.type);
    }

    this.setData({
      defaultCalculatorType: calculator.type,
      defaultCalculator: calculator,
      activeCalculatorType: calculator.type,
      activeCalculator: calculator
    });
  },

  goDefaultCalculator() {
    const calculator = this.data.defaultCalculator;
    if (!calculator) return;
    this.hasActiveCalculatorChanged = false;
    this.setActiveCalculator(calculator.type);
  },

  goCalculatorPage(event) {
    this.goCalculatorByUrl(event.currentTarget.dataset.url);
  },

  switchHomeCalculator(event) {
    this.setActiveCalculator(event.currentTarget.dataset.type);
    this.scrollToHomeCalculator();
  },

  setActiveCalculator(type) {
    const calculator = this.data.calculators.find((item) => item.type === type);
    if (!calculator) {
      wx.showToast({
        title: "计算器不存在",
        icon: "none"
      });
      return;
    }

    this.setData({
      activeCalculatorType: calculator.type,
      activeCalculator: calculator
    });
    this.hasActiveCalculatorChanged = true;
  },

  scrollToHomeCalculator() {
    wx.nextTick(() => {
      wx.createSelectorQuery()
        .select("#homeCalculator")
        .boundingClientRect()
        .selectViewport()
        .scrollOffset()
        .exec((res) => {
          const rect = res && res[0];
          const viewport = res && res[1];
          if (!rect || !viewport) return;

          wx.pageScrollTo({
            scrollTop: Math.max(0, viewport.scrollTop + rect.top - 16),
            duration: 220
          });
        });
    });
  },

  goCalculatorByUrl(url) {
    if (!url) {
      wx.showToast({
        title: "计算器不存在",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({ url });
  },

  openDefaultPicker() {
    this.setData({ showDefaultPicker: true });
  },

  closeDefaultPicker() {
    this.setData({ showDefaultPicker: false });
  },

  chooseDefaultCalculator(event) {
    const type = event.currentTarget.dataset.type;
    const calculator = this.data.calculators.find((item) => item.type === type);
    if (!calculator) {
      wx.showToast({
        title: "计算器不存在",
        icon: "none"
      });
      return;
    }

    wx.setStorageSync(DEFAULT_CALCULATOR_TYPE_KEY, type);
    this.hasActiveCalculatorChanged = false;
    this.setData({
      defaultCalculatorType: type,
      defaultCalculator: calculator,
      activeCalculatorType: type,
      activeCalculator: calculator,
      showDefaultPicker: false
    });
    wx.showToast({
      title: "已设为默认",
      icon: "success"
    });
  },

  noop() {
  },

  openTradeRecordMiniProgram() {
    wx.navigateToMiniProgram({
      appId: TRADE_RECORD_MINI_PROGRAM_APP_ID
    });
  },

  openArticle() {
    if (!ARTICLE_URL) {
      wx.showToast({
        title: "文章链接待配置",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url: "/pages/article-webview/article-webview?url=" + encodeURIComponent(ARTICLE_URL)
    });
  },

  onShareAppMessage() {
    return getShareMessage();
  },

  onShareTimeline() {
    return getShareTimelineMessage();
  }
});
