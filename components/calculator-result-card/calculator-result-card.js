Component({
  properties: {
    title: {
      type: String,
      value: ""
    },
    tag: {
      type: String,
      value: ""
    },
    timeText: {
      type: String,
      value: ""
    },
    mainItems: {
      type: Array,
      value: []
    },
    detailItems: {
      type: Array,
      value: []
    },
    removable: {
      type: Boolean,
      value: false
    },
    removeText: {
      type: String,
      value: "撤销本笔"
    },
    theme: {
      type: String,
      value: "neutral"
    },
    recordId: {
      type: String,
      value: ""
    }
  },

  methods: {
    onRemove() {
      this.triggerEvent("remove", { id: this.data.recordId });
    }
  }
});
