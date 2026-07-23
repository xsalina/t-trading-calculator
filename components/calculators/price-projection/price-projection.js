const { calcPriceProjection } = require("../../../utils/calculators");
const { getSavedState, saveState } = require("../../../utils/pageState");
const { safeNumber, safeMultiply, roundTo, formatMoney, formatNumber } = require("../../../utils/math");
const { applyExternalFormPreset, isExternalEntry } = require("../../../utils/externalEntry");
const { appendSource, copyText, rowMap } = require("../../../utils/resultCopy");
const { setCalculatorShareContext } = require("../../../utils/share");
const {
  reportCalculatorResult,
  reportProJumpFail,
  reportProJumpSuccess
} = require("../../../utils/analytics");

const PAGE_KEY = "price-projection";
const DEFAULT_FORM = {
  startPrice: "",
  shares: "",
  changeRate: ""
};

function findRow(result, label) {
  return ((result && result.rows) || []).find((row) => row.label === label) || {};
}

function buildProjectionCopy(form, result) {
  const rows = rowMap(result);
  const projectionRows = (result && result.projectionRows) || [];
  const finalRow = projectionRows[projectionRows.length - 1] || {};
  return appendSource([
    "【涨跌幅推演计算器】",
    form.startPrice ? `起始价格：${form.startPrice}` : "",
    form.shares ? `股票数量：${form.shares}股` : "",
    form.changeRate ? `每日涨跌幅：${form.changeRate}%` : "",
    "推演天数：50天",
    rows["第50天价格"] ? `第50天价格：${rows["第50天价格"]}` : "",
    rows["第50天市值"] ? `第50天市值：${rows["第50天市值"]}` : "",
    rows["第50天盈亏"] ? `第50天盈亏：${rows["第50天盈亏"]}` : "",
    finalRow.changeRate ? `累计涨跌幅：${finalRow.changeRate}` : ""
  ]);
}

Component({
  properties: {
    entryQuery: {
      type: Object,
      value: {},
      observer() {
        this.initCalculator();
      }
    },
    embedded: {
      type: Boolean,
      value: false
    },
    calculatorKey: {
      type: String,
      value: PAGE_KEY
    },
    isDefaultCalculator: {
      type: Boolean,
      value: false
    }
  },

  data: {
    form: DEFAULT_FORM,
    rememberData: true,
    result: null,
    records: [],
    submitting: false
  },

  lifetimes: {
    attached() {
      this.initCalculator();
    }
  },

  pageLifetimes: {
    show() {
      this.initCalculator();
    }
  },

  methods: {
    initCalculator() {
      const saved = getSavedState(PAGE_KEY);
      const rememberData = saved.rememberData !== false;
      const entryQuery = this.data.entryQuery || {};
      const savedForm = isExternalEntry(entryQuery)
        ? Object.assign({}, DEFAULT_FORM)
        : rememberData ? Object.assign({}, DEFAULT_FORM, saved.form || {}) : this.data.form;
      const externalPreset = applyExternalFormPreset(PAGE_KEY, savedForm, entryQuery);
      const form = externalPreset.form;

      this.setData({
        rememberData,
        form,
        records: isExternalEntry(entryQuery) ? [] : this.data.records,
        result: isExternalEntry(entryQuery) ? null : this.data.result
      }, () => {
        this.emitResultState();
        if (externalPreset.applied) {
          this.persistForm();
        }
      });
    },

    onInput(event) {
      const key = event.currentTarget.dataset.key;
      this.setData({ ["form." + key]: event.detail.value });
      this.persistForm();
    },

    onRememberSwitch(event) {
      const rememberData = event.detail.value;
      this.setData({ rememberData });
      if (rememberData) {
        this.persistForm();
      } else {
        saveState(PAGE_KEY, { rememberData: false });
      }
    },

    adjustNumber(event) {
      const key = event.currentTarget.dataset.key;
      const step = safeNumber(event.currentTarget.dataset.step);
      const min = event.currentTarget.dataset.min;
      const minValue = min === undefined ? null : safeNumber(min);
      const currentValue = safeNumber(this.data.form[key]);
      let nextValue = roundTo(currentValue + step, 4);

      if (minValue !== null && nextValue < minValue) {
        nextValue = minValue;
      }

      this.setData({ ["form." + key]: Number.isInteger(nextValue) ? String(nextValue) : String(nextValue) });
      this.persistForm();
    },

    persistForm() {
      if (!this.data.rememberData) return;
      saveState(PAGE_KEY, {
        rememberData: true,
        form: this.data.form
      });
    },

    calculate() {
      if (this.data.submitting) return;
      this.setData({ submitting: true }, () => {
        const result = calcPriceProjection(this.data.form);
        const formSnapshot = Object.assign({}, this.data.form);
        const projectionRows = (result && result.projectionRows) || [];
        const finalRow = projectionRows[projectionRows.length - 1] || {};
        const startPrice = safeNumber(formSnapshot.startPrice);
        const shares = safeNumber(formSnapshot.shares);
        const startMarketValue = safeMultiply(startPrice, shares);
        const record = {
          id: Date.now() + "-" + this.data.records.length,
          form: formSnapshot,
          result,
          copyValue: buildProjectionCopy(formSnapshot, result),
          projectionRows: result.projectionRows || [],
          showDetails: true,
          resultTitle: "推演结果",
          resultTagText: "第50天",
          resultTheme: safeNumber(formSnapshot.changeRate) >= 0 ? "sell" : "buy",
          mainItems: [
            { label: "第50天价格", value: findRow(result, "第50天价格").value || "-", className: findRow(result, "第50天价格").className || "" },
            { label: "第50天盈亏", value: findRow(result, "第50天盈亏").value || "-", className: findRow(result, "第50天盈亏").className || "" }
          ],
          detailItems: [
            { label: "第50天市值", value: findRow(result, "第50天市值").value || "-", className: findRow(result, "第50天市值").className || "" },
            { label: "累计涨跌幅", value: finalRow.changeRate || "-", className: finalRow.className || "" },
            { label: "起始价格", value: findRow(result, "起始价格").value || "-" },
            { label: "股票数量", value: formatNumber(shares, 0) + "股" },
            { label: "每日涨跌幅", value: (formSnapshot.changeRate || "0") + "%", className: findRow(result, "每日涨跌幅").className || "" },
            { label: "起始市值", value: " " + formatMoney(startMarketValue) }
          ]
        };
        this.setData({
          result,
          records: [record].concat(this.data.records),
          submitting: false
        }, () => {
          reportCalculatorResult({
            calculatorType: PAGE_KEY,
            action: "calculate",
            buttonText: "计算50天",
            sourcePage: this.data.embedded ? "tab" : "detail",
            resultCount: this.data.records.length,
            hasResult: true
          });
          this.updateShareContext(record);
          this.emitResultState();
          this.persistForm();
          this.handleResultPosition("推演结果已生成");
        });
      });
    },

    removeRecord(event) {
      const id = event.detail && event.detail.id ? event.detail.id : event.currentTarget.dataset.id;
      const records = this.data.records.filter((record) => record.id !== id);
      this.setData({
        records,
        result: records.length ? records[0].result : null
      }, () => {
        this.updateShareContext(records[0] || null);
        this.emitResultState();
      });
    },

    toggleProjectionDetail(event) {
      const id = event.currentTarget.dataset.id;
      const records = this.data.records.map((record) => {
        if (record.id !== id) return record;
        return Object.assign({}, record, {
          showDetails: !record.showDetails
        });
      });
      this.setData({ records });
    },

    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.reLaunch({ url: "/pages/index/index" });
      }
    },

    openTradeRecordMiniProgram() {
      const params = {
        calculatorType: "price-projection",
        sourcePage: this.data.embedded ? "tab" : "detail",
        entryPosition: "legacy_calculator",
        guideType: "legacy",
        targetPath: "/pages/index/index"
      };
      wx.navigateToMiniProgram({
        appId: "wx253309efe732b547",
        success: () => reportProJumpSuccess(params),
        fail: (error) => reportProJumpFail(params, error)
      });
    },

    onDefaultCalculatorTap() {
      this.triggerEvent("setdefaultcalculator");
    },

    emitResultState() {
      const resultCount = (this.data.records || []).length;
      this.updateShareContext(resultCount ? this.data.records[0] : null);
      this.triggerEvent("resultstatechange", {
        calculatorKey: this.data.calculatorKey,
        hasResult: resultCount > 0,
        resultCount
      });
    },

    handleResultPosition(toastText) {
      const selector = "#" + this.data.calculatorKey + "-first-result-card";
      wx.showToast({ title: toastText, icon: "none", duration: 1200 });
      if (this.data.embedded) {
        this.triggerEvent("resultready", {
          calculatorKey: this.data.calculatorKey,
          selector
        });
        return;
      }
      wx.nextTick(() => {
        wx.pageScrollTo({ selector, duration: 300, offsetTop: -16 });
      });
    },

    setShareRecord(event) {
      const id = event.currentTarget.dataset.id || "";
      const record = id ? this.data.records.find((item) => item.id === id) : null;
      this.setData({ currentShareRecordId: id }, () => this.updateShareContext(record));
    },

    updateShareContext(record) {
      const targetRecord = record || (this.data.records && this.data.records[0]);
      if (!targetRecord && !this.data.result) {
        setCalculatorShareContext(null);
        return;
      }
      setCalculatorShareContext({
        calculatorType: PAGE_KEY,
        form: (targetRecord && targetRecord.form) || this.data.form,
        result: (targetRecord && targetRecord.result) || this.data.result,
        record: targetRecord || null
      });
    },

    getRecordFromEvent(event) {
      const dataset = (event && event.currentTarget && event.currentTarget.dataset) || {};
      const id = dataset.id;
      if (!id) return null;
      return this.data.records.find((record) => record.id === id);
    },

    copyResult(event) {
      const record = this.getRecordFromEvent(event);
      if (record) {
        copyText(record.copyValue || buildProjectionCopy(this.data.form, record.result));
        return;
      }

      if (!this.data.result) {
        wx.showToast({ title: "请先完成测算", icon: "none" });
        return;
      }

      copyText(buildProjectionCopy(this.data.form, this.data.result));
    }
  }
});
