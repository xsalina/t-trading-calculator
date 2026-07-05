const { createCalculatorComponent } = require("../../../utils/calculatorComponent");
const { calcTakeProfit } = require("../../../utils/calculators");
const { safeNumber, safeMultiply, safeDivide, formatMoney, formatRate, formatNumber, formatPrice } = require("../../../utils/math");

function findRow(result, label) {
  return ((result && result.rows) || []).find((row) => row.label === label) || {};
}

function resultClass(value) {
  const num = safeNumber(value);
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "";
}

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
  calculate: calcTakeProfit,
  decorateRecord({ result, form }) {
    const costPrice = safeNumber(form.costPrice);
    const shares = safeNumber(form.shares);
    const targetProfit = safeNumber(form.targetProfit);
    const costAmount = safeMultiply(costPrice, shares);
    const targetProfitRate = safeMultiply(safeDivide(targetProfit, costAmount), 100);
    return {
      resultTitle: "止盈结果",
      resultTagText: "目标止盈",
      resultTheme: targetProfit >= 0 ? "sell" : "buy",
      mainItems: [
        { label: "目标卖出价", value: findRow(result, "目标卖出价").value || "-", className: findRow(result, "目标卖出价").className || "" },
        { label: "目标收益金额", value: findRow(result, "目标收益").value || " " + formatMoney(targetProfit), className: resultClass(targetProfit) }
      ],
      detailItems: [
        { label: "目标收益率", value: formatRate(targetProfitRate), className: resultClass(targetProfitRate) },
        { label: "预计卖出市值", value: findRow(result, "预计卖出金额").value || "-" },
        { label: "买入成本价", value: " " + formatPrice(costPrice, form.costPrice) },
        { label: "股数", value: formatNumber(shares, 0) + "股" },
        { label: "持仓成本", value: findRow(result, "持仓成本").value || "-" },
        { label: "预计手续费", value: " " + ((result.fee && result.fee.totalText) || "0.00") }
      ]
    };
  }
}));
