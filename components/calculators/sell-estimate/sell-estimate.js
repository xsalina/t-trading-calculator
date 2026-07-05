const { createCalculatorComponent } = require("../../../utils/calculatorComponent");
const { calcSellEstimate } = require("../../../utils/calculators");
const { safeNumber, safeSubtract, safeMultiply, formatMoney, formatNumber, formatPrice } = require("../../../utils/math");

function findRow(result, label) {
  return ((result && result.rows) || []).find((row) => row.label === label) || {};
}

Component(createCalculatorComponent({
  pageKey: "sell-estimate",
  defaultForm: {
    costPrice: "",
    sellPrice: "",
    totalShares: "",
    sellShares: ""
  },
  copyTitle: "卖出测算计算器",
  copyInputs: [
    { key: "costPrice", label: "持仓成本价" },
    { key: "sellPrice", label: "计划卖出价" },
    { key: "totalShares", label: "当前持仓", suffix: "股" },
    { key: "sellShares", label: "计划卖出", suffix: "股" }
  ],
  calculate: calcSellEstimate,
  decorateRecord({ result, form }) {
    const costPrice = safeNumber(form.costPrice);
    const sellPrice = safeNumber(form.sellPrice);
    const totalShares = safeNumber(form.totalShares);
    const sellShares = safeNumber(form.sellShares);
    const remainShares = safeSubtract(totalShares, sellShares);
    const remainCost = safeMultiply(costPrice, remainShares);
    return {
      resultTitle: "卖出结果",
      resultTagText: "卖出后",
      resultTheme: "sell",
      mainItems: [
        { label: "卖出净收益", value: findRow(result, "卖出净收益").value || "-", className: findRow(result, "卖出净收益").className || "" },
        { label: "卖出后剩余股数", value: formatNumber(remainShares, 0) + "股" }
      ],
      detailItems: [
        { label: "卖出后成本价", value: findRow(result, "剩余持仓成本价").value || "-" },
        { label: "卖出后持仓成本", value: " " + formatMoney(remainCost) },
        { label: "持仓成本价", value: " " + formatPrice(costPrice, form.costPrice) },
        { label: "计划卖出价", value: " " + formatPrice(sellPrice, form.sellPrice) },
        { label: "计划卖出股数", value: formatNumber(sellShares, 0) + "股" },
        { label: "成交金额", value: findRow(result, "卖出金额").value || "-" },
        { label: "预计手续费", value: " " + ((result.fee && result.fee.totalText) || "0.00") }
      ]
    };
  }
}));
