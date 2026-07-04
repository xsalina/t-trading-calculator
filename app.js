App({
  globalData: {
    shareImage: "/assets/images/share-t.png",
    shareImageLocal: "",
    appMiniName:'做T交易计算器'
  },

  onLaunch() {
    this.prepareShareImage();
  },

  prepareShareImage() {
    const shareImage = this.globalData.shareImage;
    if (!shareImage || typeof shareImage !== "string") return;

    if (shareImage.indexOf("cloud://") !== 0 || !wx.cloud || !wx.cloud.downloadFile) return;

    try {
      wx.cloud.init({ traceUser: false });
    } catch (error) {
      // Ignore repeated init or unavailable cloud context.
    }

    wx.cloud.downloadFile({
      fileID: shareImage,
      success: (res) => {
        this.globalData.shareImageLocal = res.tempFilePath || "";
      },
      fail: () => {
        this.globalData.shareImageLocal = "";
      }
    });
  }
});
