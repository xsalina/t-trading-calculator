const DEFAULT_CALCULATOR_TYPE_KEY = "defaultCalculatorType";
const SYSTEM_DEFAULT_CALCULATOR_TYPE = "t-profit";

Component({
  properties: {
    title: {
      type: String,
      value: ""
    },
    rememberData: {
      type: Boolean,
      value: true
    },
    showFee: {
      type: Boolean,
      value: false
    },
    includeFee: {
      type: Boolean,
      value: false
    },
    home: {
      type: Boolean,
      value: false
    },
    showDefault: {
      type: Boolean,
      value: false
    },
    isDefault: {
      type: Boolean,
      value: false
    },
    calculatorType: {
      type: String,
      value: ""
    },
    managedDefault: {
      type: Boolean,
      value: false
    }
  },

  data: {
    localIsDefault: false
  },

  lifetimes: {
    attached() {
      this.refreshDefaultStatus();
    }
  },

  pageLifetimes: {
    show() {
      this.refreshDefaultStatus();
    }
  },

  methods: {
    refreshDefaultStatus() {
      if (!this.data.calculatorType || this.data.managedDefault) return;
      const defaultType = wx.getStorageSync(DEFAULT_CALCULATOR_TYPE_KEY) || SYSTEM_DEFAULT_CALCULATOR_TYPE;
      this.setData({
        localIsDefault: defaultType === this.data.calculatorType
      });
    },

    onRememberChange(event) {
      this.triggerEvent("rememberchange", { value: event.detail.value });
    },

    onFeeChange(event) {
      this.triggerEvent("feechange", { key: "includeFee", value: event.detail.value });
    },

    onDefaultTap() {
      const isDefault = this.data.managedDefault ? this.data.isDefault : this.data.localIsDefault;
      if (isDefault) return;
      if (this.data.calculatorType) {
        wx.setStorageSync(DEFAULT_CALCULATOR_TYPE_KEY, this.data.calculatorType);
        this.setData({ localIsDefault: true });
      }
      this.triggerEvent("defaulttap");
      if (!this.data.managedDefault) {
        wx.showToast({
          title: "已设为首页默认",
          icon: "success"
        });
      }
    },

    onDefaultHelpTap() {
      wx.showToast({
        title: "每次进来都会优先展示默认计算器，方便你的习惯计算",
        icon: "none"
      });
    },

    onRememberHelpTap() {
      wx.showToast({
        title: "下次打开会自动带出上次填写的数据，方便你继续计算",
        icon: "none"
      });
    }
  }
});
