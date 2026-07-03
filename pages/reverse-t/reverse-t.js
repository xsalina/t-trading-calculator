const { createCalculatorPage } = require("../../utils/calculatorPage");
const { calcReverseT } = require("../../utils/calculators");
const { safeNumber, safeDivide } = require("../../utils/math");

function calcSharesByAmount(amount, price, roundLot) {
  const rawShares = safeDivide(safeNumber(amount), safeNumber(price));
  const unit = roundLot ? 100 : 1;
  return Math.max(0, Math.floor(rawShares / unit) * unit);
}

Page(createCalculatorPage({
  pageKey: "reverse-t",
  defaultForm: {
    sellPrice: "",
    coverAmount: "",
    coverPrice: "",
    shares: "",
    roundLot: true
  },
  calculate: calcReverseT,
  onFormChange(key) {
    if (key !== "coverAmount" && key !== "coverPrice" && key !== "roundLot") return;
    const coverAmount = safeNumber(this.data.form.coverAmount);
    const coverPrice = safeNumber(this.data.form.coverPrice);
    if (!coverAmount || !coverPrice) return;
    this.setData({
      "form.shares": String(calcSharesByAmount(coverAmount, coverPrice, this.data.form.roundLot))
    });
  }
}));
