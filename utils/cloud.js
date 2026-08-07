/**
 * Pro 共享云环境调用工具
 *
 * 使用方式：
 * const { callCloudFunction, canCallCloudFunction } = require("../../utils/cloud");
 *
 * const res = await callCloudFunction({
 *   name: "analyticsDashboard",
 *   data: {}
 * });
 */

function getSharedCloudState() {
  try {
    const app = getApp();

    if (!app || !app.globalData) {
      return {};
    }

    return app.globalData;
  } catch (error) {
    console.error("获取共享云环境状态失败：", error);
    return {};
  }
}

/**
 * 判断共享云环境实例是否已经创建。
 *
 * 注意：
 * 返回 true 只代表 sharedCloud 实例存在，
 * 真正调用云函数时仍会等待 sharedCloudReady。
 */
function canCallCloudFunction() {
  const state = getSharedCloudState();
  const sharedCloud = state.sharedCloud;

  return Boolean(
    sharedCloud &&
    typeof sharedCloud.callFunction === "function"
  );
}

/**
 * 获取已经初始化完成的共享云环境实例。
 *
 * @returns {Promise<Object>}
 */
async function getReadySharedCloud() {
  const state = getSharedCloudState();
  const sharedCloud = state.sharedCloud;
  const sharedCloudReady = state.sharedCloudReady;

  if (
    !sharedCloud ||
    typeof sharedCloud.callFunction !== "function"
  ) {
    throw new Error(
      "Pro 共享云环境尚未创建，请检查 app.js 中的 initSharedCloud 配置"
    );
  }

  if (
    sharedCloudReady &&
    typeof sharedCloudReady.then === "function"
  ) {
    await sharedCloudReady;
  }

  return sharedCloud;
}

/**
 * 调用 Pro 共享环境中的云函数。
 *
 * @param {Object} options
 * @param {string} options.name 云函数名称
 * @param {Object} [options.data] 云函数参数
 * @param {Object} [options.config] 其他调用配置
 * @returns {Promise<Object>}
 */
async function callCloudFunction(options) {
  const callOptions = options || {};
  const {
    name,
    data = {},
    config,
    success,
    fail,
    complete
  } = callOptions;

  if (!name || typeof name !== "string") {
    const error = new Error("调用云函数失败：缺少有效的云函数名称 name");
    if (typeof fail === "function") fail(error);
    if (typeof complete === "function") complete(error);
    if (typeof fail === "function" || typeof complete === "function") return { error };
    throw error;
  }

  try {
    const sharedCloud = await getReadySharedCloud();

    const requestOptions = {
      name,
      data
    };

    if (config && typeof config === "object") {
      requestOptions.config = config;
    }

    const result = await sharedCloud.callFunction(requestOptions);
    if (typeof success === "function") success(result);
    if (typeof complete === "function") complete(result);
    return result;
  } catch (error) {
    console.error(`调用共享云函数 ${name} 失败：`, error);
    if (typeof fail === "function") fail(error);
    if (typeof complete === "function") complete(error);
    if (typeof fail === "function" || typeof complete === "function") return { error };
    throw error;
  }
}

/**
 * 获取 Pro 共享环境数据库实例。
 *
 * @returns {Promise<Object>}
 */
async function getSharedDatabase() {
  const sharedCloud = await getReadySharedCloud();

  if (typeof sharedCloud.database !== "function") {
    throw new Error("当前共享云环境不支持 database");
  }

  return sharedCloud.database();
}

/**
 * 从 Pro 共享云存储下载文件。
 *
 * @param {Object} options
 * @param {string} options.fileID 云文件 ID
 * @returns {Promise<Object>}
 */
async function downloadCloudFile(options) {
  const downloadOptions = options || {};
  const { fileID } = downloadOptions;

  if (!fileID || typeof fileID !== "string") {
    throw new Error("下载云文件失败：缺少有效的 fileID");
  }

  const sharedCloud = await getReadySharedCloud();

  if (typeof sharedCloud.downloadFile !== "function") {
    throw new Error("当前共享云环境不支持 downloadFile");
  }

  try {
    return await sharedCloud.downloadFile({
      fileID
    });
  } catch (error) {
    console.error("下载共享云文件失败：", error);
    throw error;
  }
}

/**
 * 上传文件到 Pro 共享云存储。
 *
 * @param {Object} options
 * @param {string} options.cloudPath 云端路径
 * @param {string} options.filePath 本地临时文件路径
 * @returns {Promise<Object>}
 */
async function uploadCloudFile(options) {
  const uploadOptions = options || {};
  const {
    cloudPath,
    filePath
  } = uploadOptions;

  if (!cloudPath || typeof cloudPath !== "string") {
    throw new Error("上传云文件失败：缺少有效的 cloudPath");
  }

  if (!filePath || typeof filePath !== "string") {
    throw new Error("上传云文件失败：缺少有效的 filePath");
  }

  const sharedCloud = await getReadySharedCloud();

  if (typeof sharedCloud.uploadFile !== "function") {
    throw new Error("当前共享云环境不支持 uploadFile");
  }

  try {
    return await sharedCloud.uploadFile({
      cloudPath,
      filePath
    });
  } catch (error) {
    console.error("上传共享云文件失败：", error);
    throw error;
  }
}

module.exports = {
  getSharedCloudState,
  getReadySharedCloud,
  canCallCloudFunction,
  callCloudFunction,
  getSharedDatabase,
  downloadCloudFile,
  uploadCloudFile
};
