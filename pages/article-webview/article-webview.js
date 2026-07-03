const { getShareMessage, getShareTimelineMessage } = require("../../utils/share");

Page({
  data: {
    url: ""
  },

  onLoad(options) {
    this.setData({
      url: decodeURIComponent(options.url || "")
    });
  },

  onShareAppMessage() {
    return getShareMessage();
  },

  onShareTimeline() {
    return getShareTimelineMessage();
  }
});
