const TRADE_RECORD_MINI_PROGRAM_APP_ID = "wx253309efe732b547";
const { getShareMessage, getShareTimelineMessage } = require("../../utils/share");

Page({
  data: {
    calculators: [
      {
        name: "做T计算器",
        desc: "记录买入卖出操作，测算收益和持仓成本",
        url: "/pages/t-profit/t-profit"
      },
      {
        name: "回本计算器",
        desc: "测算当前价回到成本价需要涨多少",
        url: "/pages/break-even/break-even"
      },
      {
        name: "反T回补计算器",
        desc: "测算先卖后买的回补空间和净收益",
        url: "/pages/reverse-t/reverse-t"
      },
      {
        name: "止盈目标价计算器",
        desc: "按目标收益反推卖出价",
        url: "/pages/take-profit/take-profit"
      },
      {
        name: "补仓降本计算器",
        desc: "测算补仓后的新成本价",
        url: "/pages/average-down/average-down"
      },
      {
        name: "卖出测算计算器",
        desc: "测算部分卖出的净收益和剩余仓位",
        url: "/pages/sell-estimate/sell-estimate"
      },
      {
        name: "网格区间计算器",
        desc: "生成上下网格价和单档收益",
        url: "/pages/grid/grid"
      },
      {
        name: "涨跌幅推演计算器",
        desc: "按涨跌幅查看近50天价格和市值",
        url: "/pages/price-projection/price-projection"
      }
    ]
  },

  openTradeRecordMiniProgram() {
    wx.navigateToMiniProgram({
      appId: TRADE_RECORD_MINI_PROGRAM_APP_ID
    });
  },

  onShareAppMessage() {
    return getShareMessage();
  },

  onShareTimeline() {
    return getShareTimelineMessage();
  }
});
