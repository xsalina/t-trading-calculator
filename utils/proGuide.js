const TRADE_RECORD_MINI_PROGRAM_APP_ID = "wx253309efe732b547";
const PRO_EXAMPLE_TARGET_ACTION = "open_example";
const PRO_EXAMPLE_TARGET_PATH = "/subpackages/others/example/index";
const PRO_GUIDE_TIP_TEXT = "当前计算数据已保存，回来还能继续算";

let tipsText = '股票';
const now = new Date().getTime();
if(now < 1786068000000){
  tipsText = '标的'
}
const COMMON_PRO_GUIDE_CONFIG = {
  title: `同一只${tipsText}买了很多笔，怎么分清？`,
  description: "每笔买入和反T单独记录，收益率随现价更新",
  tags: ["指定卖出哪一笔", "反T回补继续记"],
  buttonText: "查看示例",
  tipText: PRO_GUIDE_TIP_TEXT,
  targetAction: PRO_EXAMPLE_TARGET_ACTION,
  targetPath: PRO_EXAMPLE_TARGET_PATH
};
const PRO_GUIDE_CONFIG = {
  "t-profit": {
    title: `同一只${tipsText}买了很多笔，先卖哪一笔？`,
    description: "每次买入单独记录，按现价查看每笔收益率，卖出时可指定平掉哪一笔",
    tags: ["多笔不混", "指定卖出", "每笔收益单独算"],
    buttonText: "看看多笔怎么记",
    tipText: PRO_GUIDE_TIP_TEXT,
    targetAction: PRO_EXAMPLE_TARGET_ACTION,
    targetPath: PRO_EXAMPLE_TARGET_PATH
  },
  "break-even": {
    title: `整只${tipsText}回本了，每一笔都回本了吗？`,
    description: "分几次买入后，每笔成本都不同。Pro 会按现价分别计算每笔收益率和盈亏",
    tags: ["每笔成本分开", "赚亏一眼看清", "不再混看回本"],
    buttonText: "看看每笔怎么分开算",
    tipText: PRO_GUIDE_TIP_TEXT,
    targetAction: PRO_EXAMPLE_TARGET_ACTION,
    targetPath: PRO_EXAMPLE_TARGET_PATH
  },
  "reverse-t": {
    title: "卖出后一直等回补，多笔反T记乱了吗？",
    description: "每笔反T单独记录卖出价、待回补数量和回补结果，不再靠自己记",
    tags: ["反T单独记", "回补继续跟", "收益单独算"],
    buttonText: "看看反T怎么记录",
    tipText: PRO_GUIDE_TIP_TEXT,
    targetAction: PRO_EXAMPLE_TARGET_ACTION,
    targetPath: PRO_EXAMPLE_TARGET_PATH
  },
  "take-profit": {
    title: "目标价算出来了，到时候先卖哪一笔？",
    description: "每笔成本不同，Pro 会按现价分别计算收益率，帮你看清哪几笔更接近止盈",
    tags: ["每笔收益单独看", "哪笔更赚钱", "止盈顺序更清楚"],
    buttonText: "看看怎么选止盈仓位",
    tipText: PRO_GUIDE_TIP_TEXT,
    targetAction: PRO_EXAMPLE_TARGET_ACTION,
    targetPath: PRO_EXAMPLE_TARGET_PATH
  },
  "average-down": {
    title: `同一只${tipsText}补了很多次，哪一笔更亏？`,
    description: "每次补仓单独记录，按现价查看每笔成本和收益率，不再只看混在一起的均价",
    tags: ["多笔补仓不混", "每笔成本独立", "可指定卖出"],
    buttonText: "看看多笔补仓怎么记",
    tipText: PRO_GUIDE_TIP_TEXT,
    targetAction: PRO_EXAMPLE_TARGET_ACTION,
    targetPath: PRO_EXAMPLE_TARGET_PATH
  },
  "sell-estimate": {
    title: "卖出这些股，卖的到底是哪一笔？",
    description: "卖出时可指定具体买入记录，也可以把这次卖出记成反T，后续继续回补",
    tags: ["指定卖出哪一笔", "部分卖出", "可记为反T"],
    buttonText: "看看卖出怎么记录",
    tipText: PRO_GUIDE_TIP_TEXT,
    targetAction: PRO_EXAMPLE_TARGET_ACTION,
    targetPath: PRO_EXAMPLE_TARGET_PATH
  },
  grid: {
    title: "网格做了很多次，最后自己都对不上账？",
    description: "每笔买入、卖出和反T分开记录，哪笔还在、哪笔已结束一眼看清",
    tags: ["正T反T分开记", "每笔收益单独算", "买卖记录不混"],
    buttonText: "看看多笔交易怎么记",
    tipText: PRO_GUIDE_TIP_TEXT,
    targetAction: PRO_EXAMPLE_TARGET_ACTION,
    targetPath: PRO_EXAMPLE_TARGET_PATH
  },
  "price-projection": {
    title: "价格涨到这里，你的每一笔分别赚多少？",
    description: "真实持仓往往买了很多笔，Pro 会按现价自动更新每笔收益率和盈亏",
    tags: ["真实持仓记录", "每笔收益率更新", "止盈补仓分开看"],
    buttonText: "看看真实持仓怎么展示",
    tipText: PRO_GUIDE_TIP_TEXT,
    targetAction: PRO_EXAMPLE_TARGET_ACTION,
    targetPath: PRO_EXAMPLE_TARGET_PATH
  }
};

function getProGuideConfig(calculatorType) {
  return PRO_GUIDE_CONFIG[calculatorType] || PRO_GUIDE_CONFIG["t-profit"];
}

module.exports = {
  COMMON_PRO_GUIDE_CONFIG,
  PRO_EXAMPLE_TARGET_ACTION,
  PRO_EXAMPLE_TARGET_PATH,
  PRO_GUIDE_TIP_TEXT,
  TRADE_RECORD_MINI_PROGRAM_APP_ID,
  PRO_GUIDE_CONFIG,
  getProGuideConfig
};
