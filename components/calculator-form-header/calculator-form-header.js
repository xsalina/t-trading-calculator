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
    }
  },

  methods: {
    onRememberChange(event) {
      this.triggerEvent("rememberchange", { value: event.detail.value });
    },

    onFeeChange(event) {
      this.triggerEvent("feechange", { key: "includeFee", value: event.detail.value });
    }
  }
});
