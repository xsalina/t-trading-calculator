const { getShareMessage, getShareTimelineMessage } = require("./share");

function createCalculatorPageShell() {
  return {
    data: {
      entryQuery: {},
      showBackToTop: false
    },

    onLoad(query) {
      this.setData({
        entryQuery: query || {}
      });
    },

    onShareAppMessage(event) {
      return getShareMessage(event);
    },

    onShareTimeline() {
      return getShareTimelineMessage();
    },

    onPageScroll(event) {
      const shouldShow = event.scrollTop > 500;
      if (shouldShow === this.data.showBackToTop) return;
      this.setData({ showBackToTop: shouldShow });
    },

    backToTop() {
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });
      this.setData({ showBackToTop: false });
    }
  };
}

module.exports = {
  createCalculatorPageShell
};
