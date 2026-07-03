const { createCalculatorPage } = require("../../utils/calculatorPage");
const { calcSellEstimate } = require("../../utils/calculators");

Page(createCalculatorPage({
  pageKey: "sell-estimate",
  defaultForm: {
    costPrice: "",
    sellPrice: "",
    totalShares: "",
    sellShares: ""
  },
  calculate: calcSellEstimate
}));
