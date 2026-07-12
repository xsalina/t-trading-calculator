const { createCalculatorComponent } = require("../../../utils/calculatorComponent");
const { calcGrid } = require("../../../utils/calculators");
const { safeNumber, formatNumber } = require("../../../utils/math");

function findRow(result, label) {
  return ((result && result.rows) || []).find((row) => row.label === label) || {};
}

Component(createCalculatorComponent({
  pageKey: "grid",
  defaultForm: {
    currentPrice: "",
    upRate: "",
    downRate: "",
    levels: "",
    shares: ""
  },
  copyTitle: "网格区间计算器",
  copyInputs: [
    { key: "currentPrice", label: "当前价" },
    { key: "upRate", label: "上涨间隔", suffix: "%" },
    { key: "downRate", label: "下跌间隔", suffix: "%" },
    { key: "levels", label: "网格档数", suffix: "档" },
    { key: "shares", label: "每档股数", suffix: "股" }
  ],
  calculate: calcGrid,
  successToast: "网格明细已生成",
  decorateRecord({ result, form }) {
    const gridRows = (result && result.gridRows) || [];
    const firstRow = gridRows[0] || {};
    const lastRow = gridRows[gridRows.length - 1] || {};
    const lowPrice = lastRow.buyPrice || "-";
    const highPrice = lastRow.sellPrice || "-";
    return {
      resultTitle: "网格结果",
      resultTagText: "网格区间",
      resultTheme: "neutral",
      gridRows,
      showDetails: true,
      mainItems: [
        { label: "单档净收益", value: firstRow.netProfit || "-", className: firstRow.className || "" },
        { label: "网格区间范围", value: lowPrice + " - " + highPrice }
      ],
      detailItems: [
        { label: "上涨网格最高价", value: highPrice },
        { label: "下跌网格最低价", value: lowPrice },
        { label: "当前价", value: findRow(result, "当前价").value || "-" },
        { label: "上涨间隔", value: (form.upRate || "0") + "%" },
        { label: "下跌间隔", value: (form.downRate || "0") + "%" },
        { label: "网格档数", value: findRow(result, "网格档数").value || "-" },
        { label: "每档股数", value: formatNumber(safeNumber(form.shares), 0) + "股" }
      ]
    };
  },
  methods: {
    toggleGridDetail(event) {
      const id = event.currentTarget.dataset.id;
      const records = this.data.records.map((record) => {
        if (record.id !== id) return record;
        return Object.assign({}, record, {
          showDetails: !record.showDetails
        });
      });
      this.setData({ records });
    }
  }
}));
