const { createCalculatorComponent } = require("../../../utils/calculatorComponent");
const { calcSellEstimate } = require("../../../utils/calculators");

Component(createCalculatorComponent({
  pageKey: "sell-estimate",
  defaultForm: {
    costPrice: "",
    sellPrice: "",
    totalShares: "",
    sellShares: ""
  },
  copyTitle: "卖出测算计算器",
  copyInputs: [
    { key: "costPrice", label: "持仓成本价" },
    { key: "sellPrice", label: "计划卖出价" },
    { key: "totalShares", label: "当前持仓", suffix: "股" },
    { key: "sellShares", label: "计划卖出", suffix: "股" }
  ],
  calculate: calcSellEstimate
}));
