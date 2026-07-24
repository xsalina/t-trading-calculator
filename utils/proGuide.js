const TRADE_RECORD_MINI_PROGRAM_APP_ID = "wx253309efe732b547";
const PRO_GUIDE_CONFIG = {
  "t-profit": {
    title: "做T次数多了，最怕买入和卖出对不上",
    description: "Pro 会单独记录每笔正T和反T，并持续更新每笔收益率。卖出时可以选择具体买入仓位，也可以单独记录成一笔反T。",
    tags: ["每笔收益率独立", "卖出指定仓位", "反T单独记录"],
    buttonText: "去Pro记录这笔做T",
    targetAction: "add_deal",
    targetPath: "/subpackages/deal/add-deal/index"
  },
  "break-even": {
    title: "整只股票回本了，每一笔都回本了吗？",
    description: "分几次买入后，每笔成本都不一样。Pro 会把每笔分开记录，按现价单独计算成本、收益率和盈亏。",
    tags: ["每笔成本分开", "赚亏一眼看清", "不再混看回本"],
    buttonText: "去Pro记录当前持仓",
    targetAction: "position",
    targetPath: "/pages/index/index"
  },
  "reverse-t": {
    title: "卖出去以后，跌到多少接回才有利润？",
    description: "记录反T卖出后，系统会根据现价持续更新预计收益率和待回补数量。完成回补后，再计算这笔反T的实际收益。",
    tags: ["反T单独记录", "预计收益率更新", "回补后计算收益"],
    buttonText: "去Pro记录这笔反T",
    targetAction: "add_deal",
    targetPath: "/subpackages/deal/add-deal/index"
  },
  "take-profit": {
    title: "目标价算出来了，但到时候先卖哪一笔？",
    description: "同一只股票买了很多笔，每笔成本都不同。记录到 Pro 后，每笔都会按现价单独计算收益率，方便看清哪几笔更接近止盈。",
    tags: ["每笔收益单独看", "哪笔更赚钱", "止盈仓位更清楚"],
    buttonText: "去Pro记录当前持仓",
    targetAction: "position",
    targetPath: "/pages/index/index"
  },
  "average-down": {
    title: "买了好几笔，跌下来到底先看哪一笔？",
    description: "同一只股票买得越多，越容易分不清哪笔亏得最多。Pro 会单独计算每笔盈亏，并优先展示亏损较多的前3笔。",
    tags: ["每笔亏损分开看", "补后成本算清", "先看亏损前3笔"],
    buttonText: "去Pro记录这笔补仓",
    targetAction: "add_deal",
    targetPath: "/subpackages/deal/add-deal/index"
  },
  "sell-estimate": {
    title: "卖出这些股，卖的到底是哪一笔？",
    description: "同一只股票买了很多笔，卖出后最容易分不清卖了哪笔、还剩多少、实际赚了多少。Pro 可以选择具体仓位卖出，也可以单独记录成反T。",
    tags: ["选择具体仓位", "单笔卖出收益", "剩余仓位保留"],
    buttonText: "去Pro记录这次卖出",
    targetAction: "sell_plan",
    targetPath: "/pages/index/index"
  },
  grid: {
    title: "网格做了很多次，最后自己都对不上账",
    description: "买卖次数一多，很容易分不清哪笔还在、哪笔已经卖出。Pro 会把每笔正T和反T单独记录、单独计算收益。",
    tags: ["正T反T分开记", "每笔收益单独算", "买卖记录不混乱"],
    buttonText: "去Pro逐笔记录交易",
    targetAction: "position",
    targetPath: "/pages/index/index"
  },
  "price-projection": {
    title: "价格涨到这里，你的每一笔能赚多少？",
    description: "真实持仓可能买了很多笔，每笔成本都不同。Pro 会根据现价实时更新每笔收益率，并分别展示止盈和补仓机会。",
    tags: ["真实持仓记录", "每笔收益率更新", "止盈补仓分开看"],
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
