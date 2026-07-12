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
    const status = findRow(result, "状态").value || "未回本";
    const isRecovered = status === "已回本";
    return {
      resultTitle: "回本结果",
      resultTagText: status,
      resultTheme: isRecovered ? "sell" : "buy",
      mainItems: [
        { label: "回本目标价", value: findRow(result, "回本目标价").value || "-" },
        isRecovered
          ? { label: "当前盈利比例", value: findRow(result, "当前盈利比例").value || "-", className: findRow(result, "当前盈利比例").className || "" }
          : { label: "还需上涨比例", value: findRow(result, "还需上涨比例").value || "-", className: findRow(result, "还需上涨比例").className || "" }
      ],
      detailItems: (isRecovered ? [
        { label: "每股高于回本价", value: findRow(result, "每股高于回本价").value || "-", className: findRow(result, "每股高于回本价").className || "" },
        { label: "当前盈利", value: findRow(result, "当前盈利").value || "-", className: findRow(result, "当前盈利").className || "" }
      ] : [
        { label: "每股还需上涨", value: findRow(result, "每股还需上涨").value || "-", className: findRow(result, "每股还需上涨").className || "" },
        { label: "当前亏损", value: findRow(result, "当前亏损").value || "-", className: findRow(result, "当前亏损").className || "" }
      ]).concat([
        { label: "持仓成本", value: findRow(result, "持仓成本").value || "-" },
        { label: "当前市值", value: findRow(result, "当前市值").value || "-" },
        { label: "回本目标市值", value: findRow(result, "回本目标市值").value || "-" },
        { label: "持仓股数", value: formatNumber(shares, 0) + "股" }
      ])
    };
  }
}));
