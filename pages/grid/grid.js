const { createCalculatorPage } = require("../../utils/calculatorPage");
const { calcGrid } = require("../../utils/calculators");

Page(createCalculatorPage({
  pageKey: "grid",
  defaultForm: {
    currentPrice: "",
    upRate: "",
    downRate: "",
    levels: "",
    shares: ""
  },
  calculate: calcGrid
}));
