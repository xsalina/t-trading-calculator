const { createCalculatorComponent } = require("../../../utils/calculatorComponent");
const { calcTakeProfit } = require("../../../utils/calculators");

Component(createCalculatorComponent({
  pageKey: "take-profit",
  defaultForm: {
    costPrice: "",
    shares: "",
    targetProfit: ""
  },
  copyTitle: "止盈目标价计算器",
  copyInputs: [
    { key: "costPrice", label: "成本价" },
    { key: "shares", label: "持仓数量", suffix: "股" },
    { key: "targetProfit", label: "目标收益" }
  ],
  calculate: calcTakeProfit
}));
