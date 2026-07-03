const { createCalculatorPage } = require("../../utils/calculatorPage");
const { calcBreakEven } = require("../../utils/calculators");

Page(createCalculatorPage({
  pageKey: "break-even",
  defaultForm: {
    costPrice: "",
    currentPrice: "",
    shares: ""
  },
  calculate: calcBreakEven
}));
