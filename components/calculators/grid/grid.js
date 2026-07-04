const { createCalculatorComponent } = require("../../../utils/calculatorComponent");
const { calcGrid } = require("../../../utils/calculators");

Component(createCalculatorComponent({
  pageKey: "grid",
  defaultForm: {
    currentPrice: "",
    upRate: "",
    downRate: "",
    levels: "",
    shares: ""
  },
  copyTitle: "网格区间计算器",
  copyInputs: [
    { key: "currentPrice", label: "当前价" },
    { key: "upRate", label: "上涨间隔", suffix: "%" },
    { key: "downRate", label: "下跌间隔", suffix: "%" },
    { key: "levels", label: "网格档数", suffix: "档" },
    { key: "shares", label: "每档股数", suffix: "股" }
  ],
  calculate: calcGrid
}));
