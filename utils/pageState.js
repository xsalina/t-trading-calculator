function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function getSavedState(pageKey) {
  return wx.getStorageSync("calculatorState:" + pageKey) || {};
}

function saveState(pageKey, state) {
  wx.setStorageSync("calculatorState:" + pageKey, state);
}

function clearState(pageKey) {
  wx.removeStorageSync("calculatorState:" + pageKey);
}

function makeTimeText() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

module.exports = {
  clone,
  getSavedState,
  saveState,
  clearState,
  makeTimeText
};
