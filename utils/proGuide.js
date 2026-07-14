const TRADE_RECORD_MINI_PROGRAM_APP_ID = "wx253309efe732b547";
const PRO_GUIDE_CONFIG = {
  "t-profit": {
    title: "同一只股票反复做T，别把每一笔混在一起",
    description: "在Pro中，每笔买入都有独立成本和收益率，卖出时可选择具体仓位，剩余持仓和累计收益自动更新。",
    tags: ["同股多笔分开记", "每笔独立收益率", "止盈补仓聚合"],
    buttonText: "去Pro记录这笔做T",
    targetAction: "add_deal",
    targetPath: "/subpackages/deal/add-deal/index"
  },
  "break-even": {
    title: "整只股票回本，不代表每一笔都回本",
    description: "同一只股票有多笔买入时，Pro会把每一笔分开计算，让你看清哪一笔已经盈利，哪一笔还在亏损。",
    tags: ["同股多笔分开看", "每笔独立成本", "每笔独立收益率"],
    buttonText: "去Pro记录当前持仓",
    targetAction: "position",
    targetPath: "/pages/index/index"
  },
  "reverse-t": {
    title: "反T不只算一次，卖出和回补要对应",
    description: "在Pro中记录每笔反T卖出和回补，可以持续查看卖出价、待回补数量、回补情况和单笔反T收益。",
    tags: ["卖出回补对应", "待回补数量", "单笔反T收益"],
    buttonText: "去Pro记录这笔反T",
    targetAction: "add_deal",
    targetPath: "/subpackages/deal/add-deal/index"
  },
  "take-profit": {
    title: "目标价算出来了，哪一笔更接近止盈？",
    description: "Pro会聚合同一只股票的多笔记录，分别计算每一笔收益率，并自动展示优先止盈的前3笔。",
    tags: ["同股多笔聚合", "每笔独立收益率", "优先止盈前3笔"],
    buttonText: "去Pro查看止盈机会",
    targetAction: "position",
    targetPath: "/pages/index/index"
  },
  "average-down": {
    title: "补仓后成本算出来了，该优先看哪一笔？",
    description: "同一只股票有多笔买入时，Pro会分开计算每一笔的亏损幅度，自动找出需要优先关注的前3笔补仓机会。",
    tags: ["同股多笔聚合", "每笔独立收益率", "优先补仓前3笔"],
    buttonText: "去Pro记录这笔补仓",
    targetAction: "add_deal",
    targetPath: "/subpackages/deal/add-deal/index"
  },
  "sell-estimate": {
    title: "准备卖出时，别只看整只股票的平均收益",
    description: "每一笔买入都有独立收益率，卖出时可以选择具体仓位，清楚知道这一笔实际赚了多少。",
    tags: ["选择具体仓位", "单笔卖出收益", "剩余仓位保留"],
    buttonText: "去Pro记录卖出",
    targetAction: "sell_plan",
    targetPath: "/pages/index/index"
  },
  grid: {
    title: "网格交易次数多，仓位最容易记混",
    description: "在Pro中，每次买入都能独立记录，卖出时可对应具体仓位，剩余持仓、成本和收益不会混在一起。",
    tags: ["同股多笔分开记", "买卖逐笔对应", "收益逐笔核对"],
    buttonText: "去Pro逐笔记录交易",
    targetAction: "position",
    targetPath: "/pages/index/index"
  },
  "price-projection": {
    title: "价格推演只是参考，真实仓位要分开看",
    description: "同一只股票有多笔真实买入时，Pro会分别记录每一笔成本和收益率，并聚合止盈和补仓机会。",
    tags: ["真实仓位记录", "每笔独立收益率", "止盈补仓聚合"],
    buttonText: "去Pro记录真实持仓",
    targetAction: "position",
    targetPath: "/pages/index/index"
  }
};

function getProGuideConfig(calculatorType) {
  return PRO_GUIDE_CONFIG[calculatorType] || PRO_GUIDE_CONFIG["t-profit"];
}

module.exports = {
  TRADE_RECORD_MINI_PROGRAM_APP_ID,
  PRO_GUIDE_CONFIG,
  getProGuideConfig
};
