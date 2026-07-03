const { createCalculatorPage } = require("../../utils/calculatorPage");
const { calcAverageDown } = require("../../utils/calculators");
const { safeNumber, safeDivide } = require("../../utils/math");

function calcSharesByAmount(amount, price, roundLot) {
  const rawShares = safeDivide(safeNumber(amount), safeNumber(price));
  const unit = roundLot ? 100 : 1;
  return Math.max(0, Math.floor(rawShares / unit) * unit);
}

Page(createCalculatorPage({
  pageKey: "average-down",
  defaultForm: {
    originalCost: "",
    originalShares: "",
    buyAmount: "",
    buyPrice: "",
    buyShares: "",
    roundLot: true
  },
  calculate: calcAverageDown,
  onFormChange(key) {
    if (key !== "buyAmount" && key !== "buyPrice" && key !== "roundLot") return;
    const buyAmount = safeNumber(this.data.form.buyAmount);
    const buyPrice = safeNumber(this.data.form.buyPrice);
    if (!buyAmount || !buyPrice) return;
    this.setData({
      "form.buyShares": String(calcSharesByAmount(buyAmount, buyPrice, this.data.form.roundLot))
    });
  }
}));
