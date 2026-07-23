const {
  TRADE_RECORD_MINI_PROGRAM_APP_ID,
  getProGuideConfig
} = require("../../utils/proGuide");
const {
  reportProJumpFail,
  reportProJumpSuccess
} = require("../../utils/analytics");

function safeReport(eventName, params) {
  if (typeof wx.reportEvent === "function") {
    try {
      wx.reportEvent(eventName, params);
    } catch (error) {
      // 埋点不可用时不影响用户继续使用计算器。
    }
  }
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function firstValue(form, keys, fallback) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = form[keys[i]];
    if (hasValue(value)) return value;
  }
  return fallback;
}

Component({
  properties: {
    calculatorType: {
      type: String,
      value: "t-profit",
      observer() {
        this.refreshGuide();
      }
    },
    sourcePage: {
      type: String,
      value: "detail"
    },
    entryPosition: {
      type: String,
      value: ""
    },
    hasResult: {
      type: Boolean,
      value: false,
      observer() {
        this.refreshGuide();
      }
    },
    resultCount: {
      type: Number,
      value: 0,
      observer() {
        this.refreshGuide();
      }
    },
    direction: {
      type: String,
      value: ""
    },
    form: {
      type: Object,
      value: {}
    }
  },

  data: {
    visible: false,
    guide: getProGuideConfig("t-profit"),
    exposedKey: ""
  },

  lifetimes: {
    attached() {
      this.refreshGuide();
    }
  },

  methods: {
    refreshGuide() {
      const guide = getProGuideConfig(this.data.calculatorType);
      const visible = Boolean(this.data.hasResult || this.data.resultCount > 0);
      this.setData({ guide, visible }, () => {
        if (visible) {
          this.reportExpose();
        }
      });
    },

    buildReportParams() {
      return {
        calculatorType: this.data.calculatorType,
        sourcePage: this.data.sourcePage,
        entryPosition: this.data.entryPosition || "",
        guideType: "personalized",
        buttonText: this.data.guide.buttonText,
        resultCount: this.data.resultCount,
        direction: this.data.direction || "",
        hasResult: Boolean(this.data.visible)
      };
    },

    reportExpose() {
      const key = [
        this.data.calculatorType,
        this.data.sourcePage,
        this.data.entryPosition,
        this.data.resultCount,
        this.data.direction
      ].join("|");
      if (key === this.data.exposedKey) return;
      this.setData({ exposedKey: key });
      safeReport("pro_guide_expose", this.buildReportParams());
    },

    buildTradePayload() {
      const form = this.data.form || {};
      const calculatorType = this.data.calculatorType || "";

      if (calculatorType === "t-profit") {
        return {
          tradeDirection: "BUY",
          price: firstValue(form, ["initialPrice", "initialCostPrice", "avgCost"], ""),
          qty: firstValue(form, ["initialShares", "initialQty", "initialQuantity", "holdingQuantity"], ""),
          buyfee: firstValue(form, ["initialFee", "initialBuyFee", "buyfee"], 0)
        };
      }

      if (calculatorType === "average-down") {
        return {
          tradeDirection: "BUY",
          price: firstValue(form, ["originalCost", "originalCostPrice", "originalAvgCost", "avgCost"], ""),
          qty: firstValue(form, ["originalShares", "originalQty", "originalQuantity", "holdingQuantity"], ""),
          buyfee: firstValue(form, ["originalFee", "initialFee", "buyfee"], 0)
        };
      }

      if (calculatorType === "reverse-t") {
        return {
          tradeDirection: "REVERSE_T",
          price: firstValue(form, ["initialSellPrice", "sellPrice", "originalSellPrice"], ""),
          qty: firstValue(form, ["initialSellQty", "initialSellQuantity", "basePendingShares", "sellQty", "sellQuantity", "shares"], ""),
          buyfee: firstValue(form, ["initialSellFee", "externalSellFee", "sellFee", "buyfee"], 0)
        };
      }

      return {};
    },

    buildJumpPayload(traceId) {
      const guide = this.data.guide || {};
      const tradePayload = this.buildTradePayload();
      const isDirectAddDeal = ["t-profit", "average-down", "reverse-t"].includes(this.data.calculatorType);
      const extraData = {
        version: 1,
        source: "calculator",
        traceId,
        calculatorType: this.data.calculatorType,
        sourcePage: this.data.sourcePage,
        entryPosition: this.data.entryPosition || "",
        targetAction: guide.targetAction || "",
        targetPath: guide.targetPath || "/pages/index/index",
        direction: tradePayload.tradeDirection || ""
      };
      if (isDirectAddDeal) {
        extraData.payload = tradePayload;
      }
      return extraData;
    },

    openPro() {
      const guide = this.data.guide || {};
      const targetPath = guide.targetPath || "/pages/index/index";
      const traceId = "calc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const extraData = this.buildJumpPayload(traceId);
      const finalDirection = (extraData.payload && extraData.payload.tradeDirection) || extraData.direction || "";
      const reportParams = Object.assign({}, this.buildReportParams(), {
        traceId,
        targetPath,
        direction: finalDirection
      });
      safeReport("pro_guide_click", reportParams);
      const query = [
        "source=calculator",
        "traceId=" + encodeURIComponent(traceId),
        "calculatorType=" + encodeURIComponent(this.data.calculatorType),
        "sourcePage=" + encodeURIComponent(this.data.sourcePage),
        "entryPosition=" + encodeURIComponent(this.data.entryPosition || ""),
        "targetAction=" + encodeURIComponent(guide.targetAction || ""),
        "direction=" + encodeURIComponent(finalDirection)
      ].join("&");
      wx.navigateToMiniProgram({
        appId: TRADE_RECORD_MINI_PROGRAM_APP_ID,
        path: targetPath + "?" + query,
        extraData,
        success: () => {
          reportProJumpSuccess(reportParams);
        },
        fail: (error) => {
          reportProJumpFail(reportParams, error);
        }
      });
    }
  }
});
