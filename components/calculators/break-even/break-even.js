const { createCalculatorComponent } = require("../../../utils/calculatorComponent");
const { calcBreakEven } = require("../../../utils/calculators");

Component(createCalculatorComponent({
  pageKey: "break-even",
  defaultForm: {
    costPrice: "",
    currentPrice: "",
    shares: ""
  },
  copyTitle: "回本计算器",
  copyInputs: [
    { key: "costPrice", label: "持仓成本价" },
    { key: "currentPrice", label: "当前价" },
    { key: "shares", label: "持仓数量", suffix: "股" }
  ],
  calculate: calcBreakEven
}));
