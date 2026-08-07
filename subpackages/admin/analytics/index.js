const RANGE_OPTIONS = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "last7", label: "近7天" },
  { key: "last15", label: "近15天" },
  { key: "last30", label: "近30天" },
];

const SORT_OPTIONS = [
  { key: "viewUserCount", label: "使用人数" },
  { key: "resultGeneratedUserCount", label: "结果人数" },
  { key: "proClickUserCount", label: "Pro点击人数" },
  { key: "proArriveUserCount", label: "Pro到达人数" },
];

const {
  callCloudFunction,
} = require("../../../utils/cloud");

/**
 * 转换为安全数字。
 */
function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * 格式化普通数字。
 */
function formatNumber(value) {
  return String(safeNumber(value));
}

/**
 * 格式化百分比。
 */
function formatRate(numerator, denominator) {
  const base = safeNumber(denominator);

  if (!base) {
    return "0.00%";
  }

  return (
    (safeNumber(numerator) / base * 100).toFixed(2) +
    "%"
  );
}

/**
 * 格式化云数据库时间。
 */
function formatDateTime(value) {
  if (!value) {
    return "暂无聚合更新时间";
  }

  let date = null;

  if (value instanceof Date) {
    date = value;
  } else if (value.$date) {
    date = new Date(value.$date);
  } else if (value.seconds) {
    date = new Date(value.seconds * 1000);
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) {
    return "暂无聚合更新时间";
  }

  const pad = (num) => {
    return num < 10 ? "0" + num : String(num);
  };

  const dateText = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");

  const timeText = [
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join(":");

  return dateText + " " + timeText;
}

Page({
  data: {
    ranges: RANGE_OPTIONS,
    sorts: SORT_OPTIONS,

    activeRange: "today",
    activeSort: "resultGeneratedUserCount",

    loading: true,
    noAccess: false,
    errorText: "",

    rangeLabel: "今日",
    updateText: "暂无聚合更新时间",

    coreMetrics: [],
    coreRates: [],
    funnel: [],
    failStats: [],
    ranking: [],
  },

  onLoad() {
    this.fetchDashboard();
  },

  /**
   * 加载统计看板。
   */
  async fetchDashboard() {
    this.setData({
      loading: true,
      noAccess: false,
      errorText: "",
    });

    try {
      const res = await callCloudFunction({
        name: "analyticsDashboard",
        data: {
          range: this.data.activeRange,
        },
      });

      const result = res && res.result
        ? res.result
        : {};

      if (!result.isAdmin) {
        this.handleNoAccess(
          result.message || "无管理员权限"
        );
        return;
      }

      console.log("analyticsDashboard 返回数据", result);
      this.applyDashboard(result);
    } catch (error) {
      console.error(
        "analyticsDashboard 云函数调用失败：",
        error
      );

      this.setData({
        loading: false,
        noAccess: false,
        errorText: "数据加载失败，请稍后重试",
      });
    }
  },

  /**
   * 处理无管理员权限。
   */
  handleNoAccess(message) {
    const errorMessage = message || "无管理员权限";

    this.setData({
      loading: false,
      noAccess: true,
      errorText: errorMessage,
    });

    wx.showToast({
      title: errorMessage,
      icon: "none",
    });

    setTimeout(() => {
      const pages = getCurrentPages();

      if (pages.length > 1) {
        wx.navigateBack();
        return;
      }

      wx.reLaunch({
        url: "/pages/index/index",
      });
    }, 900);
  },

  /**
   * 应用统计看板数据。
   */
  applyDashboard(result) {
    const totals = result.totals || {};
    const funnel = this.buildFunnel(
      Array.isArray(result.funnel)
        ? result.funnel
        : [],
      totals
    );

    const ranking = this.sortRanking(
      this.normalizeRanking(result.ranking || []),
      this.data.activeSort
    );

    this.setData({
      loading: false,
      noAccess: false,
      errorText: "",

      rangeLabel: result.rangeLabel || "今日",
      updateText: formatDateTime(result.updatedAt),

      coreMetrics: [
        {
          label: "计算器使用人数",
          value: formatNumber(totals.viewUserCount),
          desc:
            "展示 " +
            formatNumber(totals.viewCount) +
            " 次",
        },
        {
          label: "结果生成",
          value:
            formatNumber(
              totals.resultGeneratedUserCount
            ) + " 人",
          desc:
            "生成 " +
            formatNumber(
              totals.resultGeneratedCount
            ) + " 次",
        },
        {
          label: "Pro曝光",
          value:
            formatNumber(
              totals.proExposeUserCount
            ) + " 人",
          desc:
            "曝光 " +
            formatNumber(
              totals.proExposeCount
            ) + " 次",
        },
        {
          label: "Pro点击",
          value:
            formatNumber(
              totals.proClickUserCount
            ) + " 人",
          desc:
            "点击 " +
            formatNumber(
              totals.proClickCount
            ) + " 次",
        },
        {
          label: "Pro真实到达",
          value:
            formatNumber(
              totals.proArriveUserCount
            ) + " 人",
          desc:
            "到达 " +
            formatNumber(
              totals.proArriveCount
            ) + " 次",
        },
        {
          label: "Pro导流率",
          value: formatRate(
            totals.proArriveUserCount,
            totals.resultGeneratedUserCount
          ),
          desc: "到达人数 / 结果人数",
        },
      ],

      coreRates: [
        {
          label: "结果生成率",
          value: formatRate(
            totals.resultGeneratedUserCount,
            totals.viewUserCount
          ),
        },
        {
          label: "Pro点击率",
          value: formatRate(
            totals.proClickUserCount,
            totals.proExposeUserCount
          ),
        },
        {
          label: "跳转成功率",
          value: formatRate(
            totals.proJumpSuccessUserCount,
            totals.proClickUserCount
          ),
        },
        {
          label: "真实到达率",
          value: formatRate(
            totals.proArriveUserCount,
            totals.proClickUserCount
          ),
        },
      ],

      funnel,

      failStats: [
        {
          label: "用户取消",
          value: formatNumber(
            totals.proJumpCancelCount
          ),
        },
        {
          label: "技术错误",
          value: formatNumber(
            totals.proJumpErrorCount
          ),
        },
      ],

      ranking,
    });
  },

  /**
   * 补充漏斗节点之间的转化率。
   */
  buildFunnel(funnel, totals) {
    return funnel.map((item, index) => {
      const nextInfo = [
        {
          label: "点击率",
          value: formatRate(
            totals.proClickUserCount,
            totals.proExposeUserCount
          ),
        },
        {
          label: "跳转成功率",
          value: formatRate(
            totals.proJumpSuccessUserCount,
            totals.proClickUserCount
          ),
        },
        {
          label: "真实到达率",
          value: formatRate(
            totals.proArriveUserCount,
            totals.proClickUserCount
          ),
        },
      ][index];

      return Object.assign({}, item, {
        userCount: formatNumber(item.userCount),
        count: formatNumber(item.count),
        conversionLabel: nextInfo
          ? nextInfo.label
          : "",
        conversionText: nextInfo
          ? nextInfo.value
          : "",
      });
    });
  },

  /**
   * 补充排行榜展示字段。
   */
  normalizeRanking(ranking) {
    return ranking.map((item) => {
      const resultGenerateRateText = formatRate(
        item.resultGeneratedUserCount,
        item.viewUserCount
      );
      const diversionRateText = formatRate(
        item.proArriveUserCount,
        item.resultGeneratedUserCount
      );

      return Object.assign({}, item, {
        resultGenerateRateText,
        diversionRateText,
      });
    });
  },

  /**
   * 切换统计时间范围。
   */
  onRangeTap(event) {
    const range =
      event &&
      event.currentTarget &&
      event.currentTarget.dataset
        ? event.currentTarget.dataset.range
        : "";

    if (!range || range === this.data.activeRange) {
      return;
    }

    this.setData(
      {
        activeRange: range,
      },
      () => {
        this.fetchDashboard();
      }
    );
  },

  /**
   * 切换排行榜排序方式。
   */
  onSortTap(event) {
    const sort =
      event &&
      event.currentTarget &&
      event.currentTarget.dataset
        ? event.currentTarget.dataset.sort
        : "";

    if (!sort || sort === this.data.activeSort) {
      return;
    }

    this.setData({
      activeSort: sort,
      ranking: this.sortRanking(
        this.data.ranking,
        sort
      ),
    });
  },

  /**
   * 对排行榜排序。
   */
  sortRanking(ranking, key) {
    const rows = Array.isArray(ranking)
      ? ranking.slice()
      : [];

    rows.sort((a, b) => {
      const primary =
        safeNumber(b[key]) - safeNumber(a[key]);

      if (primary) {
        return primary;
      }

      return (
        safeNumber(b.resultGeneratedUserCount) -
        safeNumber(a.resultGeneratedUserCount)
      );
    });

    return rows;
  },

  /**
   * 点击刷新。
   */
  refreshData() {
    if (this.data.loading) {
      return;
    }

    this.fetchDashboard();
  },

  /**
   * 下拉刷新。
   */
  async onPullDownRefresh() {
    try {
      await this.fetchDashboard();
    } finally {
      wx.stopPullDownRefresh();
    }
  },
});
