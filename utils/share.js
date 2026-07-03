const SHARE_TITLE = "做T交易计算器";

function getCurrentSharePath() {
  const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
  const currentPage = pages[pages.length - 1];
  return currentPage && currentPage.route ? "/" + currentPage.route : "/pages/index/index";
}

function getShareImageUrl(app) {
  const globalData = app && app.globalData ? app.globalData : {};
  const localImage = globalData.shareImageLocal;
  const shareImage = globalData.shareImage;

  if (localImage) return localImage;
  if (shareImage && String(shareImage).indexOf("cloud://") !== 0) return shareImage;
  return "";
}

function getShareMessage() {
  const app = getApp();
  if (app && typeof app.prepareShareImage === "function") {
    app.prepareShareImage();
  }

  const message = {
    title: SHARE_TITLE,
    path: getCurrentSharePath()
  };
  const imageUrl = getShareImageUrl(app);
  if (imageUrl) {
    message.imageUrl = imageUrl;
  }
  return message;
}

function getShareTimelineMessage() {
  const message = getShareMessage();
  const timelineMessage = {
    title: message.title,
    query: ""
  };
  if (message.imageUrl) {
    timelineMessage.imageUrl = message.imageUrl;
  }
  return timelineMessage;
}

module.exports = {
  SHARE_TITLE,
  getShareMessage,
  getShareTimelineMessage
};
