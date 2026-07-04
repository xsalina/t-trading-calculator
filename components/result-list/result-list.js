Component({
  options: {
    styleIsolation: "apply-shared"
  },

  properties: {
    records: {
      type: Array,
      value: []
    },
    removeText: {
      type: String,
      value: "删除"
    }
  },

  methods: {
    clear() {
      this.triggerEvent("clear");
    },

    remove(event) {
      this.triggerEvent("remove", {
        id: event.currentTarget.dataset.id
      });
    }
  }
});
