const { createCalculatorPage } = require("../../utils/calculatorPage");
const { calcTakeProfit } = require("../../utils/calculators");

Page(createCalculatorPage({
  pageKey: "take-profit",
  defaultForm: {
    costPrice: "",
    shares: "",
    targetProfit: ""
  },
  calculate: calcTakeProfit
}));
