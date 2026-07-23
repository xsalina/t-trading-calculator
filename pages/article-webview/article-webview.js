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

  onShareAppMessage(event) {
    return getShareMessage(event);
  },

  onShareTimeline() {
    return getShareTimelineMessage();
  }
});
