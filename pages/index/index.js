const TRADE_RECORD_MINI_PROGRAM_APP_ID = "wx253309efe732b547";
const ARTICLE_URL = "https://mp.weixin.qq.com/s/u23rAa1l3od1e3Tuu-j__w";
const DEFAULT_CALCULATOR_TYPE_KEY = "defaultCalculatorType";
const FAVORITE_GUIDE_DISMISSED_KEY = "favoriteGuideDismissed";
const SYSTEM_DEFAULT_CALCULATOR_TYPE = "t-profit";
const { getShareMessage, getShareTimelineMessage } = require("../../utils/share");
const { getEntryCalculatorType, isExternalEntry } = require("../../utils/externalEntry");

const CALCULATORS = [
  {
    type: "t-profit",
    shortName: "做T",
    name: "做T计算器",
    desc: "记录买入卖出操作，测算收益和持仓成本",
    url: "/pages/t-profit/t-profit"
  },
  {
    type: "average-down",
    shortName: "补仓",
    name: "补仓降本计算器",
    desc: "测算补仓后的新成本价",
    url: "/pages/average-down/average-down"
  },
  {
    type: "break-even",
    shortName: "回本",
    name: "回本计算器",
    desc: "测算当前价回到成本价需要涨多少",
    url: "/pages/break-even/break-even"
  },
  {
    type: "take-profit",
    shortName: "止盈",
    name: "止盈目标价计算器",
    desc: "按目标收益反推卖出价",
    url: "/pages/take-profit/take-profit"
  },

  {
    type: "reverse-t",
    shortName: "反T",
    name: "反T回补计算器",
    desc: "测算先卖后买的回补空间和净收益",
    url: "/pages/reverse-t/reverse-t"
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

Page({
  data: {
    calculators: CALCULATORS,
    bottomCalculators: CALCULATORS.slice().reverse(),
    showAllCalculators: false,
    defaultCalculatorType: SYSTEM_DEFAULT_CALCULATOR_TYPE,
    defaultCalculator: CALCULATORS[0],
    activeCalculatorType: SYSTEM_DEFAULT_CALCULATOR_TYPE,
    activeCalculator: CALCULATORS[0],
    activeTabIntoView: "",
    entryQuery: {},
    showDefaultPicker: false,
    showFavoriteGuide: false,
    showBackToTop: false,
  },

  onLoad(options) {
    this.hasActiveCalculatorChanged = false;
    this.initDefaultCalculator();
    this.applyEntryQuery(options || {});
    this.initFavoriteGuide();
  },

  onShow() {
    this.initDefaultCalculator();
  },

  onReady() {
    this.scrollActiveCalculatorTab();
  },

  onUnload() {
    this.clearFavoriteGuideTimer();
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
      defaultCalculator: calculator
    });

    if (!this.hasActiveCalculatorChanged) {
      this.setData({
        activeCalculatorType: calculator.type,
        activeCalculator: calculator
      }, () => this.scrollActiveCalculatorTab(calculator.type));
    }
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
    const type = event.currentTarget.dataset.type;
    if (type === this.data.activeCalculatorType) return;
    this.setActiveCalculator(type);
    this.scrollHomeCalculatorAfterSwitch(type);
  },

  initFavoriteGuide() {
    if (wx.getStorageSync(FAVORITE_GUIDE_DISMISSED_KEY)) return;

    this.setData({
      showFavoriteGuide: true,
    });

    this.clearFavoriteGuideTimer();
    this.favoriteGuideTimer = setTimeout(() => {
      this.setData({ showFavoriteGuide: false });
    }, 3000);
  },

  closeFavoriteGuide() {
    wx.setStorageSync(FAVORITE_GUIDE_DISMISSED_KEY, true);
    this.clearFavoriteGuideTimer();
    this.setData({ showFavoriteGuide: false });
  },

  clearFavoriteGuideTimer() {
    if (!this.favoriteGuideTimer) return;
    clearTimeout(this.favoriteGuideTimer);
    this.favoriteGuideTimer = null;
  },

  applyEntryQuery(query) {
    if (!isExternalEntry(query || {})) return;

    const calculatorType = getEntryCalculatorType(query || {});
    this.setData({ entryQuery: query || {} });
    if (!calculatorType) return;

    this.setActiveCalculator(calculatorType);
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
    }, () => this.scrollActiveCalculatorTab(calculator.type));
    this.hasActiveCalculatorChanged = true;
  },

  getCalculatorTabId(type) {
    return "calculator-tab-" + type;
  },

  scrollActiveCalculatorTab(type) {
    const targetType = type || this.data.activeCalculatorType;
    if (!targetType) return;
    const tabId = this.getCalculatorTabId(targetType);
    this.setData({ activeTabIntoView: "" }, () => {
      wx.nextTick(() => {
        this.setData({ activeTabIntoView: tabId });
      });
    });
  },

  scrollHomeCalculatorAfterSwitch(type) {
    const resultSelector = "#" + type + "-first-result-card";
    wx.nextTick(() => {
      wx.createSelectorQuery()
        .select(resultSelector)
        .boundingClientRect((rect) => {
          wx.pageScrollTo({
            selector: rect ? resultSelector : "#homeCalculator",
            duration: 300,
            offsetTop: rect ? -16 : 0
          });
        })
        .exec();
    });
  },

  onCalculatorResultReady(event) {
    const detail = event.detail || {};
    if (detail.calculatorKey !== this.data.activeCalculatorType) return;

    wx.nextTick(() => {
      if (typeof detail.scrollTop === "number") {
        wx.pageScrollTo({
          scrollTop: detail.scrollTop,
          duration: 300
        });
        return;
      }
      wx.pageScrollTo({
        selector: detail.selector,
        duration: 300,
        offsetTop: -16
      });
    });
  },

  onPageScroll(event) {
    const shouldShow = event.scrollTop > 500;
    if (shouldShow === this.data.showBackToTop) return;
    this.setData({ showBackToTop: shouldShow });
  },

  backToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
    this.setData({ showBackToTop: false });
  },

  setCurrentAsDefault() {
    const calculator = this.data.activeCalculator;
    if (!calculator) return;
    if (calculator.type === this.data.defaultCalculatorType) return;

    wx.setStorageSync(DEFAULT_CALCULATOR_TYPE_KEY, calculator.type);
    this.setData({
      defaultCalculatorType: calculator.type,
      defaultCalculator: calculator
    });
    wx.showToast({
      title: "已设为首页默认",
      icon: "success"
    });
  },

  toggleAllCalculators() {
    const nextValue = !this.data.showAllCalculators;
    this.setData({
      showAllCalculators: nextValue
    }, () => {
      if (!nextValue) return;
      wx.nextTick(() => {
        wx.pageScrollTo({
          selector: "#allCalculatorsEntry",
          duration: 300,
          offsetTop: -16
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
    }, () => this.scrollActiveCalculatorTab(type));
    wx.showToast({
      title: "已设为首页默认",
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
    wx.navigateTo({
      url: "/pages/article-webview/article-webview?url=" + encodeURIComponent(ARTICLE_URL)
    });
  },

  goFeeSettings() {
    wx.navigateTo({
      url: "/pages/fee-settings/fee-settings"
    });
  },

  onShareAppMessage() {
    return getShareMessage();
  },

  onShareTimeline() {
    return getShareTimelineMessage();
  }
});
