const SHARED_CLOUD_RESOURCE_APPID = "wx253309efe732b547";
const SHARED_CLOUD_RESOURCE_ENV = "cloud1-7gdq3emj774ac1dd";

App({
  globalData: {
    shareImage: "/assets/images/share-t.png",
    shareImageLocal: "",
    appMiniName: "做T交易计算器",

    sharedCloud: null,
    sharedCloudReady: null
  },

  onLaunch() {
    if (!wx.cloud || typeof wx.cloud.Cloud !== "function") {
      console.error("当前微信基础库不支持云开发资源共享");
      return;
    }

    // 先初始化 Pro 共享云环境
    this.initSharedCloud();

    // 再处理可能依赖云环境的分享图片
    this.prepareShareImage();
  },

  initSharedCloud() {
    const sharedCloud = new wx.cloud.Cloud({
      resourceAppid: SHARED_CLOUD_RESOURCE_APPID,
      resourceEnv: SHARED_CLOUD_RESOURCE_ENV
    });

    this.globalData.sharedCloud = sharedCloud;

    this.globalData.sharedCloudReady = Promise.resolve(sharedCloud.init())
      .then(() => {
        console.log("Pro 共享云环境初始化成功");
        return sharedCloud;
      })
      .catch((error) => {
        console.error("Pro 共享云环境初始化失败：", error);
        throw error;
      });
  },

  async prepareShareImage() {
    const shareImage = this.globalData.shareImage;

    if (!shareImage || typeof shareImage !== "string") {
      return;
    }

    // 本地图片无需下载
    if (!shareImage.startsWith("cloud://")) {
      return;
    }

    try {
      const sharedCloud = await this.globalData.sharedCloudReady;

      const res = await sharedCloud.downloadFile({
        fileID: shareImage
      });

      this.globalData.shareImageLocal = res.tempFilePath || "";
    } catch (error) {
      console.error("分享图片下载失败：", error);
      this.globalData.shareImageLocal = "";
    }
  }
});