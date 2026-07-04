const { getShareMessage, getShareTimelineMessage } = require("./share");

function createCalculatorPageShell() {
  return {
    data: {
      entryQuery: {}
    },

    onLoad(query) {
      this.setData({
        entryQuery: query || {}
      });
    },

    onShareAppMessage() {
      return getShareMessage();
    },

    onShareTimeline() {
      return getShareTimelineMessage();
    }
  };
}

module.exports = {
  createCalculatorPageShell
};
