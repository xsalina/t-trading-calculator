const { createCalculatorComponent } = require("../../../utils/calculatorComponent");
const { calcBreakEven } = require("../../../utils/calculators");
const { safeNumber, formatNumber } = require("../../../utils/math");

function findRow(result, label) {
  return ((result && result.rows) || []).find((row) => row.label === label) || {};
}

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
  calculate: calcBreakEven,
  decorateRecord({ result, form }) {
    const shares = safeNumber(form.shares);
    return {
      resultTitle: "回本结果",
      resultTagText: "目标回本",
      resultTheme: "neutral",
      mainItems: [
        { label: "回本目标价", value: findRow(result, "回本目标价").value || "-" },
        { label: "还需上涨比例", value: findRow(result, "需上涨比例").value || "-", className: findRow(result, "需上涨比例").className || "" }
      ],
      detailItems: [
        { label: "当前盈亏", value: findRow(result, "当前盈亏").value || "-", className: findRow(result, "当前盈亏").className || "" },
        { label: "需上涨金额", value: findRow(result, "需上涨金额").value || "-", className: findRow(result, "需上涨金额").className || "" },
        { label: "持仓成本", value: findRow(result, "持仓成本").value || "-" },
        { label: "当前市值", value: findRow(result, "当前市值").value || "-" },
        { label: "回本目标市值", value: findRow(result, "回本目标市值").value || "-" },
        { label: "持仓股数", value: formatNumber(shares, 0) + "股" }
      ]
    };
  }
}));
