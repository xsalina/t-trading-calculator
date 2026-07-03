Component({
  options: {
    styleIsolation: "apply-shared"
  },

  properties: {
    records: {
      type: Array,
      value: []
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
