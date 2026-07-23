const { clone } = require("./pageState");

const MAX_GROUP_COUNT = 10;

function stripRuntimeForm(form) {
  const next = Object.assign({}, form || {});
  delete next.includeFee;
  return next;
}

function makeGroupId(index) {
  return "group_" + String(index + 1).padStart(3, "0");
}

function makeGroupName(index) {
  return "第" + (index + 1) + "组";
}

function createGroup(index, defaultForm, overrides) {
  const now = Date.now();
  return Object.assign({
    id: makeGroupId(index),
    defaultName: makeGroupName(index),
    customName: "",
    createdAt: now,
    updatedAt: now,
    form: stripRuntimeForm(Object.assign({}, defaultForm)),
    records: [],
    operations: [],
    latestFirst: true,
    showAmountPanel: false,
    showEmbeddedAmountPanel: false,
    showBaseDetail: false
  }, overrides || {});
}

function normalizeGroup(group, index, defaultForm, listKey) {
  const source = group || {};
  const records = listKey === "operations"
    ? source.operations || []
    : source.records || [];
  return Object.assign(createGroup(index, defaultForm), source, {
    id: source.id || makeGroupId(index),
    defaultName: source.defaultName || makeGroupName(index),
    customName: source.customName || "",
    form: stripRuntimeForm(Object.assign({}, defaultForm, source.form || {})),
    records: listKey === "records" ? clone(records) : clone(source.records || []),
    operations: listKey === "operations" ? clone(records) : clone(source.operations || []),
    latestFirst: source.latestFirst !== false,
    showAmountPanel: Boolean(source.showAmountPanel),
    showEmbeddedAmountPanel: Boolean(source.showEmbeddedAmountPanel),
    showBaseDetail: Boolean(source.showBaseDetail)
  });
}

function buildGroupedState(saved, defaultForm, listKey) {
  const source = saved || {};
  if (source.version === 2 && Array.isArray(source.groups) && source.groups.length) {
    const groups = source.groups
      .slice(0, MAX_GROUP_COUNT)
      .map((group, index) => normalizeGroup(group, index, defaultForm, listKey));
    const activeGroupId = groups.some((group) => group.id === source.activeGroupId)
      ? source.activeGroupId
      : groups[0].id;
    return { groups, activeGroupId };
  }

  const legacyGroup = createGroup(0, defaultForm, {
    form: stripRuntimeForm(Object.assign({}, defaultForm, source.form || {})),
    records: listKey === "records" ? clone(source.records || []) : [],
    operations: listKey === "operations" ? clone(source.operations || []) : [],
    latestFirst: source.latestFirst !== false,
    showAmountPanel: Boolean(source.showAmountPanel),
    showEmbeddedAmountPanel: Boolean(source.showEmbeddedAmountPanel),
    showBaseDetail: Boolean(source.showBaseDetail)
  });
  return { groups: [legacyGroup], activeGroupId: legacyGroup.id };
}

function getGroupLabel(group) {
  if (!group) return "";
  return group.customName || group.defaultName || "";
}

function getNextGroupIndex(groups) {
  const indexes = (groups || []).map((group) => {
    const idMatch = String(group.id || "").match(/^group_(\d+)$/);
    const nameMatch = String(group.defaultName || "").match(/^第(\d+)组$/);
    return Math.max(
      idMatch ? Number(idMatch[1]) : 0,
      nameMatch ? Number(nameMatch[1]) : 0
    );
  });
  const maxIndex = indexes.length ? Math.max.apply(null, indexes) : 0;
  return maxIndex;
}

function getActiveGroup(groups, activeGroupId) {
  const list = groups || [];
  return list.find((group) => group.id === activeGroupId) || list[0] || null;
}

function getActiveTabId(activeGroupId) {
  return activeGroupId ? "group-tab-" + activeGroupId : "";
}

module.exports = {
  MAX_GROUP_COUNT,
  stripRuntimeForm,
  createGroup,
  normalizeGroup,
  buildGroupedState,
  getGroupLabel,
  getNextGroupIndex,
  getActiveGroup,
  getActiveTabId
};
