const { getFeeSettings, getCurrentIncludeFee, setCurrentIncludeFee } = require("./fee");
const {
  clone,
  getSavedState,
  saveState,
  clearState,
  makeTimeText
} = require("./pageState");
const { safeNumber, roundTo } = require("./math");
const { applyExternalFormPreset, isExternalEntry } = require("./externalEntry");
const { buildGenericResultCopy, copyText } = require("./resultCopy");
const { buildFeeSummary } = require("./feeSummary");
const { setCalculatorShareContext } = require("./share");
const {
  reportCalculatorExport,
  reportCalculatorResult,
  reportProJumpFail,
  reportProJumpSuccess
} = require("./analytics");
const { exportCalculatorGroups } = require("./exportCalculators");
const {
  MAX_GROUP_COUNT,
  stripRuntimeForm,
  createGroup,
  buildGroupedState,
  getActiveGroup,
  getActiveTabId,
  getNextGroupIndex
} = require("./calculatorGroups");

function createCalculatorComponent(options) {
  const defaultForm = Object.assign({
    includeFee: true
  }, options.defaultForm);
  const useGroups = Boolean(options.multiGroup);
  const listKey = options.groupListKey || "records";

  return {
    properties: {
      entryQuery: {
        type: Object,
        value: {},
        observer() {
          this.initCalculator();
        }
      },
      embedded: {
        type: Boolean,
        value: false
      },
      calculatorKey: {
        type: String,
        value: options.pageKey || ""
      },
      isDefaultCalculator: {
        type: Boolean,
        value: false
      }
    },

    data: {
      form: clone(defaultForm),
      feeSettings: {},
      feeSummary: "",
      rememberData: true,
      records: [],
      displayRecords: [],
      latestFirst: true,
      result: null,
      submitting: false,
      includeFee: true,
      groups: [],
      activeGroupId: "",
      activeGroupTabId: ""
    },

    lifetimes: {
      attached() {
        this.initCalculator();
      }
    },

    pageLifetimes: {
      show() {
        this.initCalculator();
      }
    },

    methods: Object.assign({
      initCalculator() {
        const feeSettings = getFeeSettings();
        const saved = getSavedState(options.pageKey);
        const rememberData = this.data.rememberData === false ? false : saved.rememberData !== false;
        const includeFee = rememberData && saved.version === 2 && typeof saved.includeFee === "boolean"
          ? saved.includeFee
          : getCurrentIncludeFee();
        const savedForm = saved.form || {};
        const entryQuery = this.data.entryQuery || {};
        const hasExternalEntry = isExternalEntry(entryQuery);
        if (useGroups) {
          const groupedState = hasExternalEntry
            ? buildGroupedState({}, defaultForm, listKey)
            : rememberData
            ? buildGroupedState(saved, defaultForm, listKey)
            : {
              groups: this.data.groups && this.data.groups.length
                ? this.data.groups
                : buildGroupedState({}, defaultForm, listKey).groups,
              activeGroupId: this.data.activeGroupId
            };
          let groups = groupedState.groups;
          let activeGroupId = groupedState.activeGroupId || (groups[0] && groups[0].id);
          let activeGroup = getActiveGroup(groups, activeGroupId);
          let form = Object.assign({}, defaultForm, activeGroup ? activeGroup.form : {}, { includeFee });
          const externalPreset = applyExternalFormPreset(options.pageKey, form, entryQuery);
          form = externalPreset.form;
          if (externalPreset.applied && activeGroup) {
            const nextActiveGroup = Object.assign({}, activeGroup, {
              form: stripRuntimeForm(form),
              records: [],
              operations: []
            });
            groups = groups.map((group) => group.id === activeGroup.id ? nextActiveGroup : group);
            activeGroup = nextActiveGroup;
            activeGroupId = nextActiveGroup.id;
          }

          this.setData({
            feeSettings,
            includeFee,
            feeSummary: buildFeeSummary(feeSettings, includeFee),
            rememberData,
            groups,
            activeGroupId,
            activeGroupTabId: getActiveTabId(activeGroupId),
            form,
            records: hasExternalEntry ? [] : clone((activeGroup && activeGroup.records) || []),
            result: hasExternalEntry ? null : this.data.result,
            latestFirst: activeGroup ? activeGroup.latestFirst !== false : true,
            showAmountPanel: activeGroup ? Boolean(activeGroup.showAmountPanel) : false,
            displayRecords: []
          }, () => {
            this.setData({
              displayRecords: this.getDisplayRecords ? this.getDisplayRecords(this.data.records) : this.data.records
            }, () => {
              this.emitResultState();
              if (typeof options.afterInit === "function") {
                options.afterInit.call(this, externalPreset);
              }
              if (externalPreset.applied) {
                this.persistForm();
              }
            });
          });
          return;
        }

        let form = hasExternalEntry
          ? Object.assign({}, defaultForm, { includeFee })
          : rememberData
          ? Object.assign({}, defaultForm, savedForm, {
            includeFee
          })
          : Object.assign({}, this.data.form, { includeFee });
        const externalPreset = applyExternalFormPreset(options.pageKey, form, entryQuery);
        form = externalPreset.form;

        this.setData({
          feeSettings,
          feeSummary: buildFeeSummary(feeSettings, form.includeFee),
          rememberData,
          form,
          records: hasExternalEntry ? [] : this.data.records,
          result: hasExternalEntry ? null : this.data.result
        }, () => {
          this.emitResultState();
          if (typeof options.afterInit === "function") {
            options.afterInit.call(this, externalPreset);
          }
          if (externalPreset.applied) {
            this.persistForm();
          }
        });
      },

      onInput(event) {
        const key = event.currentTarget.dataset.key;
        this.setData({ ["form." + key]: event.detail.value });
        this.afterFormChange(key);
        this.persistForm();
      },

      onFeeSwitch(event) {
        const includeFee = setCurrentIncludeFee(event.detail.value);
        this.setData({
          includeFee,
          "form.includeFee": includeFee,
          feeSummary: buildFeeSummary(this.data.feeSettings, includeFee)
        }, () => {
          this.afterFormChange("includeFee");
          if (useGroups) {
            this.rebuildCurrentGroupAfterFeeChange();
          }
          this.persistForm();
        });
      },

      adjustNumber(event) {
        const key = event.currentTarget.dataset.key;
        const step = safeNumber(event.currentTarget.dataset.step);
        const min = event.currentTarget.dataset.min;
        const minValue = min === undefined ? null : safeNumber(min);
        const currentValue = safeNumber(this.data.form[key]);
        let nextValue = roundTo(currentValue + step, 4);

        if (minValue !== null && nextValue < minValue) {
          nextValue = minValue;
        }

        const textValue = Number.isInteger(nextValue) ? String(nextValue) : String(nextValue);
        this.setData({ ["form." + key]: textValue });
        this.afterFormChange(key);
        this.persistForm();
      },

      onFormSwitch(event) {
        const key = event.currentTarget.dataset.key;
        this.setData({ ["form." + key]: event.detail.value });
        this.afterFormChange(key);
        this.persistForm();
      },

      afterFormChange(key) {
        if (typeof options.onFormChange === "function") {
          options.onFormChange.call(this, key);
        }
      },

      onRememberSwitch(event) {
        const rememberData = event.detail.value;
        this.setData({ rememberData });
        if (rememberData) {
          this.persistForm();
        } else {
          clearState(options.pageKey);
        }
      },

      persistForm() {
        if (useGroups) {
          const groups = this.buildGroupsWithCurrentState();
          this.data.groups = groups;
          if (!this.data.rememberData) return;
          saveState(options.pageKey, {
            version: 2,
            rememberData: true,
            includeFee: this.data.includeFee,
            activeGroupId: this.data.activeGroupId,
            groups
          });
          return;
        }
        saveState(options.pageKey, {
          rememberData: true,
          form: this.data.form
        });
      },

      buildGroupsWithCurrentState() {
        if (!useGroups) return this.data.groups || [];
        const groups = this.data.groups && this.data.groups.length
          ? this.data.groups
          : buildGroupedState({}, defaultForm, listKey).groups;
        return groups.map((group) => {
          if (group.id !== this.data.activeGroupId) return group;
          const next = Object.assign({}, group, {
            form: stripRuntimeForm(this.data.form),
            latestFirst: this.data.latestFirst !== false,
            showAmountPanel: Boolean(this.data.showAmountPanel),
            updatedAt: Date.now()
          });
          if (listKey === "records") {
            next.records = clone(this.data.records || []);
          } else {
            next.operations = clone(this.data.operations || []);
          }
          return next;
        });
      },

      syncCurrentGroup(callback) {
        if (!useGroups) {
          if (typeof callback === "function") callback();
          return;
        }
        this.setData({ groups: this.buildGroupsWithCurrentState() }, () => {
          if (typeof callback === "function") callback();
        });
      },

      loadGroup(group) {
        if (!group) return;
        const form = Object.assign({}, defaultForm, group.form || {}, {
          includeFee: this.data.includeFee
        });
        const records = clone(group.records || []);
        this.setData({
          activeGroupId: group.id,
          activeGroupTabId: getActiveTabId(group.id),
          form,
          records,
          displayRecords: this.getDisplayRecords ? this.getDisplayRecords(records) : records,
          latestFirst: group.latestFirst !== false,
          showAmountPanel: Boolean(group.showAmountPanel),
          result: null,
          preview: null,
          basePosition: null,
          basePositionCard: null,
          baseSellCard: null,
          basePendingShares: 0
        }, () => {
          if (typeof options.afterInit === "function") {
            options.afterInit.call(this, { applied: false });
          }
          this.emitResultState();
          this.persistForm();
        });
      },

      switchGroup(event) {
        const id = event.currentTarget.dataset.id;
        if (!id || id === this.data.activeGroupId) return;
        this.syncCurrentGroup(() => {
          const group = getActiveGroup(this.data.groups, id);
          this.loadGroup(group);
        });
      },

      addGroup() {
        this.syncCurrentGroup(() => {
          const groups = this.data.groups || [];
          if (groups.length >= MAX_GROUP_COUNT) {
            wx.showToast({ title: "最多保留10组", icon: "none" });
            return;
          }
          const nextIndex = getNextGroupIndex(groups);
          const group = createGroup(nextIndex, defaultForm);
          const nextGroups = groups.concat(group);
          this.setData({ groups: nextGroups }, () => {
            this.loadGroup(group);
            wx.showToast({ title: "已新增第" + (nextIndex + 1) + "组", icon: "none" });
          });
        });
      },

      openGroupManage() {
        wx.showActionSheet({
          itemList: ["修改当前组名称", "清空当前组", "删除当前组"],
          success: (res) => {
            if (res.tapIndex === 0) this.renameCurrentGroup();
            if (res.tapIndex === 1) this.clearRecords();
            if (res.tapIndex === 2) this.deleteCurrentGroup();
          }
        });
      },

      exportAllGroups() {
        if (!useGroups) return;
        this.syncCurrentGroup(() => {
          const groups = this.data.groups || [];
          reportCalculatorExport({
            calculatorType: options.pageKey,
            sourcePage: this.data.embedded ? "tab" : "detail",
            groupCount: groups.length
          });
          exportCalculatorGroups({
            type: options.pageKey,
            groups,
            feeSettings: this.data.feeSettings,
            includeFee: this.data.includeFee
          });
        });
      },

      renameCurrentGroup() {
        const group = getActiveGroup(this.data.groups, this.data.activeGroupId);
        if (!group) return;
        wx.showModal({
          title: "修改分组名称",
          editable: true,
          placeholderText: group.customName || group.defaultName,
          success: (res) => {
            if (!res.confirm) return;
            const customName = String(res.content || "").trim().slice(0, 12);
            const groups = (this.data.groups || []).map((item) => item.id === group.id
              ? Object.assign({}, item, { customName, updatedAt: Date.now() })
              : item);
            this.setData({ groups }, () => this.persistForm());
          }
        });
      },

      deleteCurrentGroup() {
        wx.showModal({
          title: "确认删除当前组？",
          content: "删除后只移除当前组，其他分组不受影响。",
          confirmText: "确认删除",
          confirmColor: "#D96B6B",
          success: (res) => {
            if (!res.confirm) return;
            const groups = this.data.groups || [];
            const index = groups.findIndex((group) => group.id === this.data.activeGroupId);
            let nextGroups = groups.filter((group) => group.id !== this.data.activeGroupId);
            if (!nextGroups.length) {
              nextGroups = [createGroup(0, defaultForm)];
            }
            const nextGroup = nextGroups[Math.max(0, Math.min(index, nextGroups.length - 1))];
            this.setData({ groups: nextGroups }, () => {
              this.loadGroup(nextGroup);
              wx.showToast({ title: "已删除当前组", icon: "none" });
            });
          }
        });
      },

      rebuildCurrentGroupAfterFeeChange() {
        if (!useGroups) return;
        if (typeof this.recalculateCurrentGroup === "function") {
          this.recalculateCurrentGroup();
        } else if (typeof options.afterInit === "function") {
          options.afterInit.call(this, { applied: false });
        }
        this.persistForm();
      },

      getActiveGroupReportInfo() {
        if (!useGroups) return {};
        const groups = this.data.groups || [];
        const index = groups.findIndex((group) => group.id === this.data.activeGroupId);
        const group = index >= 0 ? groups[index] : null;
        return {
          groupIndex: index >= 0 ? index + 1 : 1,
          groupName: group ? (group.customName || group.defaultName || "") : ""
        };
      },

      reportCalculatorAction(action, extraParams) {
        reportCalculatorResult(Object.assign({
          calculatorType: options.pageKey,
          action,
          sourcePage: this.data.embedded ? "tab" : "detail",
          hasResult: Boolean((this.data.records || []).length || this.data.result)
        }, this.getActiveGroupReportInfo(), extraParams || {}));
      },

      calculate() {
        if (this.data.submitting) return;
        this.setData({ submitting: true }, () => {
          const result = options.calculate(this.data.form, this.data.feeSettings);
          const nextCount = this.data.records.length + 1;
          const formSnapshot = clone(this.data.form);
          let record = {
            id: Date.now() + "-" + nextCount,
            title: "测算 " + nextCount,
            timeText: makeTimeText(),
            includeFee: formSnapshot.includeFee,
            form: formSnapshot,
            result
          };
          if (typeof options.decorateRecord === "function") {
            record = Object.assign(record, options.decorateRecord.call(this, {
              result,
              form: formSnapshot,
              record,
              count: nextCount
            }));
          }
          record.copyValue = buildGenericResultCopy({
            title: options.copyTitle || "做T交易计算器",
            form: formSnapshot,
            inputs: options.copyInputs || [],
            result
          });

          this.setData({
            result,
            records: [record].concat(this.data.records),
            submitting: false
          }, () => {
            this.reportCalculatorAction("calculate", {
              buttonText: "计算",
              resultCount: this.data.records.length
            });
            this.updateShareContext(record);
            this.emitResultState();
            this.persistForm();
            this.handleResultPosition({
              selector: "#" + this.data.calculatorKey + "-first-result-card",
              toastText: options.successToast || "计算完成，结果已更新"
            });
          });
        });
      },

      goBack() {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          wx.navigateBack();
        } else {
          wx.reLaunch({ url: "/pages/index/index" });
        }
      },

      openTradeRecordMiniProgram() {
        const params = {
          calculatorType: options.pageKey,
          sourcePage: this.data.embedded ? "tab" : "detail",
          entryPosition: "legacy_calculator",
          guideType: "legacy",
          targetPath: "/pages/index/index"
        };
        wx.navigateToMiniProgram({
          appId: "wx253309efe732b547",
          success: () => reportProJumpSuccess(params),
          fail: (error) => reportProJumpFail(params, error)
        });
      },

      onDefaultCalculatorTap() {
        this.triggerEvent("setdefaultcalculator");
      },

      handleResultPosition({ selector, toastText }) {
        wx.showToast({
          title: toastText,
          icon: "none",
          duration: 1200
        });
        if (this.data.embedded) {
          this.triggerEvent("resultready", {
            calculatorKey: this.data.calculatorKey,
            selector
          });
          return;
        }
        wx.nextTick(() => {
          wx.pageScrollTo({
            selector,
            duration: 300,
            offsetTop: -16
          });
        });
      },

      setShareRecord(event) {
        const id = event.currentTarget.dataset.id || "";
        const index = event.currentTarget.dataset.index;
        const record = id
          ? this.data.records.find((item) => item.id === id)
          : this.data.records[Number(index)] || null;
        this.setData({
          currentShareRecordId: id,
          currentShareRecordIndex: index === undefined ? "" : String(index)
        }, () => this.updateShareContext(record));
      },

      updateShareContext(record) {
        const targetRecord = record || (this.data.records && this.data.records[0]);
        if (!targetRecord && !this.data.result) {
          setCalculatorShareContext(null);
          return;
        }
        setCalculatorShareContext({
          calculatorType: options.pageKey,
          form: (targetRecord && targetRecord.form) || this.data.form,
          result: (targetRecord && targetRecord.result) || this.data.result,
          record: targetRecord || null
        });
      },

      getRecordFromEvent(event) {
        const dataset = (event && event.currentTarget && event.currentTarget.dataset) || {};
        const id = dataset.id;
        const index = dataset.index;
        if (id) {
          return this.data.records.find((record) => record.id === id);
        }
        if (index !== undefined && index !== "") {
          return this.data.records[Number(index)];
        }
        return null;
      },

      copyResult(event) {
        const record = this.getRecordFromEvent(event);
        if (record) {
          copyText(record.copyValue || buildGenericResultCopy({
            title: options.copyTitle || "做T交易计算器",
            form: this.data.form,
            inputs: options.copyInputs || [],
            result: record.result
          }));
          return;
        }

        if (!this.data.result) {
          wx.showToast({ title: "请先完成测算", icon: "none" });
          return;
        }

        const copyValue = typeof options.buildCopy === "function"
          ? options.buildCopy.call(this)
          : buildGenericResultCopy({
            title: options.copyTitle || "做T交易计算器",
            form: this.data.form,
            inputs: options.copyInputs || [],
            result: this.data.result
          });
        copyText(copyValue);
      },

      clearRecords() {
        this.setData({ records: [], result: null }, () => {
          this.updateShareContext(null);
          this.emitResultState();
          this.persistForm();
        });
      },

      removeRecord(event) {
        const id = event.detail && event.detail.id ? event.detail.id : event.currentTarget.dataset.id;
        const records = this.data.records.filter((record) => record.id !== id);
        this.setData({
          records,
          result: records.length ? records[0].result : null
        }, () => {
          this.updateShareContext(records[0] || null);
          this.emitResultState();
          this.persistForm();
        });
      },

      emitResultState() {
        const resultCount = (this.data.records || []).length;
        this.updateShareContext(resultCount ? this.data.records[0] : null);
        this.triggerEvent("resultstatechange", {
          calculatorKey: this.data.calculatorKey,
          hasResult: Boolean(resultCount || this.data.result),
          resultCount
        });
      }
    }, options.methods || {})
  };
}

module.exports = {
  createCalculatorComponent
};
