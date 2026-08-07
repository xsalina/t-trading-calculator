# 做T计算器小程序

微信原生小程序，用于股票做T、回本、回补、止盈、补仓、卖出、网格和涨跌幅推演测算。

## 功能列表

### 做T计算器

- 输入初始持仓价格和初始持仓数量
- 选择交易方向：买入或卖出
- 输入交易价格和交易数量
- 买入时支持输入买入金额，结合交易价格自动换算股数
- 买入金额换算支持整手和单股两种模式
- 保存每一笔操作后自动更新：
  - 本次资金流，买入显示负数
  - 卖出本次收益
  - 剩余持仓
  - 最新成本价
  - 持仓成本
  - 累计已实现收益
- 支持全部清除，相当于重新进入页面

### 回本计算器

- 输入持仓成本价、当前价和股数
- 计算当前盈亏
- 计算回本目标价、回本目标市值、需上涨金额和需上涨比例

### 反T回补计算器

- 输入卖出价、回补价和股数
- 支持输入回补金额和回补价自动换算股数
- 支持整手换算或单股换算
- 计算反T净收益和回补空间

### 止盈目标价计算器

- 输入买入成本价、股数和目标收益金额
- 自动反推目标卖出价

### 补仓降本计算器

- 输入原成本价、原股数、补仓价格和补仓股数
- 支持输入计划补仓金额和补仓价格自动换算股数
- 支持整手换算或单股换算
- 计算补仓后成本价、成本降低金额和降低比例

### 卖出测算计算器

- 输入持仓成本价、计划卖出价、当前持仓股数和计划卖出股数
- 计算卖出净收益、剩余股数和剩余持仓成本价

### 网格区间计算器

- 输入当前价、上涨间隔比例、下跌间隔比例、网格档数和每档股数
- 上涨间隔比例和下跌间隔比例均支持加减按钮
- 生成网格明细，并计算单档净收益

### 涨跌幅推演计算器

- 输入起始价格、股票数量和每日涨跌幅
- 涨跌幅支持手动输入，也支持每次 0.5 的加减按钮
- 支持负数涨跌幅
- 展示近 50 天的价格、市值和累计涨跌幅

## 手续费功能

- 支持统一手续费设置，默认包含券商佣金、最低佣金、过户费、印花税
- 首页和各计算器内页顶部统一显示“交易费率”开关
- 表头开关控制的是“当前这次使用计算器时，是否把手续费计入结果”
- 表头开启时显示“交易费率：已计入估算”，计算会使用手续费设置页中已保存的费率配置
- 表头关闭时显示“交易费率：未计入估算”，当前计算忽略券商佣金、最低佣金、过户费、印花税等费用
- 表头开关是当前计算器会话的统一状态：在首页关闭后，进入任意计算器内页仍然关闭；在任意内页开启后，返回首页也保持开启
- 表头开关不会清空已保存的手续费配置，也不会修改手续费设置页的默认规则
- 手续费设置页顶部“默认计入手续费”开关控制的是“以后重新打开计算器模块时，表头交易费率默认开启还是关闭”
- 手续费设置页顶部默认开关切换后会立即保存，不需要点击底部“保存”按钮
- 手续费设置页底部“保存”按钮只负责保存券商佣金、最低佣金、过户费、印花税等具体参数
- 关闭默认计入手续费时，只影响下次新进入计算器时的默认状态，不会清空佣金费率、最低佣金、过户费、印花税等配置，也不会影响历史计算结果
- 首页底部提供“手续费设置”入口，可直接进入现有手续费设置页

## 通用交互

- 主题色：`#3157C8`
- 首页默认计算器改为轻量状态栏，可通过“更换”设置最常用计算器
- 首页新增横向快捷入口，点击后在首页直接切换展示对应计算器组件
- 首页会按默认计算器直接渲染对应计算器组件
- 首页首屏压缩介绍和辅助入口，优先露出当前计算器输入表单
- 做T记录助手Pro 入口位于首页介绍下方，计算出结果后会出现“去做T记录助手Pro记录这一笔”主按钮
- 首页保留全部计算器列表，当前默认计算器会显示“默认”标识，列表项仍可进入独立页面
- 每个计算器页面默认开启“记住数据”
- 首页提供“做T记录助手Pro”小程序跳转入口，入口文案为“开始管理我的做T记录”
- 首页提供“在线客服 / 反馈建议”按钮，使用微信原生客服会话能力
- 首页右上角提供灯泡入口，可跳转到公众号文章链接；链接配置在 `utils/article.js`
- 首页提供分享小程序按钮，页面提示“感谢您的分享支持，祝您投资顺利！”，分享标题为“做T交易计算器”
- 所有页面都支持分享，分享标题统一为“做T交易计算器”
- 分享图片取 `app.globalData.shareImage`；如果是 `cloud://` 图片，启动时会尝试下载为临时路径后用于分享
- 当前分享图位于 `assets/images/share-t.png`，Logo 图位于 `assets/images/t-logo.png`
- 做T、反T回补、卖出测算页面在产生操作或结果后提供“开始管理我的做T记录”入口
- 价格输入支持 `+/- 0.01`
- 股数输入支持 `+/- 100`
- 金额输入按页面场景支持 `+/- 1000`
- 计算器页面底部提供“计算 / 返回”或对应操作按钮
- 本工具仅用于测算，不构成任何投资建议

## 外部小程序跳转参数

- 支持其他小程序通过 `wx.navigateToMiniProgram` 跳转到本小程序
- `source=account`：进入首页，不自动跳转到具体计算器
- `source=tradeDetail` 且 `direction=BUY`：按正常持仓处理，默认进入做T计算器
- `source=tradeDetail` 且 `direction=REVERSE_T`：按反T待回补处理，自动进入反T回补计算器
- 支持参数：`type`、`avgCost`、`quantity`、`fee`、`currentPrice`、`direction`、`stockCode`、`stockName`、`currency`、`market`、`source`
- 常用字段会自动预填到对应计算器，例如成本价、当前价、股数、反T卖出均价和待回补数量
- `type` 支持 `t-profit`、`break-even`、`reverse-t`、`take-profit`、`average-down`、`sell-estimate`、`grid`、`price-projection`，也兼容驼峰写法

## 项目结构

- `app.json`：小程序页面配置
- `app.wxss`：全局样式
- `pages/`：各计算器页面
- `components/calculators/`：各计算器核心表单和计算组件
- `utils/math.js`：安全小数计算和格式化工具
- `utils/fee.js`：手续费配置和手续费计算
- `utils/calculators.js`：各类计算器核心公式
- `components/result-list/`：测算记录列表组件

## 使用方式

用微信开发者工具打开本目录：

```text
/Users/xiaoyueping/WeChatProjects/t-trading-calculator
```






做T交易计算器自有埋点方案

一、整体方案

1. 保留现有微信官方埋点 wx.reportEvent。
2. 新增自有云数据库埋点，前端统一走 utils/analytics.js。
3. 前端不直接写数据库，只调用云函数 analyticsReport。
4. 云函数负责：
   - 校验事件白名单
   - 从云函数上下文获取 openid
   - 补充 serverTime、date、hour
   - 写入 calculator_analytics_events 原始明细
   - 更新 calculator_analytics_daily 每日聚合表
5. 普通事件进入本地队列批量上报，每次最多 10 条。
6. Pro 点击、跳转成功、跳转失败立即上报。
7. 保留双写 7～14 天，后续可对比微信后台和云数据库数据。

二、云数据库集合

1. calculator_analytics_events
用途：保存每条原始事件明细。

2. calculator_analytics_daily
用途：按 date + calculatorType 聚合，供管理员后台查排行和转化率。

三、事件白名单

calculator_view
calculator_entry_click
calculator_result_generated
calculator_result_save
calculator_export_click
pro_guide_expose
pro_guide_click
pro_jump_success
pro_jump_fail

四、统一公共字段

每条事件保存：

{
  eventId,
  eventName,
  openid,
  clientId,
  sessionId,

  calculatorType,
  calculatorName,

  sourcePage,
  entryPosition,

  eventTime,
  serverTime,
  date,
  hour,

  appVersion,
  platform,

  properties
}

说明：
- eventId：前端生成，用于防重复
- openid：云函数从 cloud.getWXContext() 获取，前端不传
- clientId：前端本地生成并缓存，用于无 openid 场景辅助去重
- sessionId：每次小程序冷启动生成
- serverTime/date/hour：云函数补充
- 高频统计字段放顶层
- 其他事件字段放 properties

五、事件定义

1. calculator_view

触发：
当前计算器首次真实展示时上报，包括首页默认计算器和独立页面。

用途：
统计每个计算器的展示次数、展示人数。

properties：
{}

2. calculator_entry_click

触发：
用户点击首页顶部 Tab，或点击底部全部计算器里的单个计算器入口。

properties：
{
  clickTarget,
  isDefault,
  previousCalculatorType
}

用途：
统计用户主动点击了哪个计算器入口。

3. calculator_result_generated

触发：
输入校验通过，并成功生成计算结果。

适用：
8 个计算器全部适用。

properties：
{
  resultCount,
  market,
  hasFee
}

注意：
不保存股票代码、股票名称、价格、数量、金额、收益等用户交易明细。

4. calculator_result_save

触发：
仅用于多步骤计算器：
- t-profit 做T
- reverse-t 反T回补
- average-down 补仓降本

触发动作：
- 初始化
- 保存操作 / 保存回补 / 保存补仓

properties：
{
  action,
  direction,
  groupId,
  groupIndex,
  operationIndex,
  resultCount
}

action 口径：
- initialize：初始化
- save_operation：保存一笔操作

用途：
统计多步骤计算器里用户真正保存了多少笔操作。

5. calculator_export_click

触发：
做T、反T、补仓点击“导出”。

properties：
{
  groupCount,
  resultCount
}

用途：
统计导出使用情况，以及导出时有多少组、多少条结果。

6. pro_guide_expose

触发：
Pro 引导卡真实展示时。

properties：
{
  guideId,
  guideType,
  traceId,
  hasResult,
  resultCount,
  targetAction,
  targetPath,
  direction,
  buttonText
}

用途：
统计 Pro 卡曝光人数和曝光次数。

7. pro_guide_click

触发：
用户点击 Pro 引导卡按钮。

上报方式：
立即上报。

properties：
{
  guideId,
  guideType,
  traceId,
  hasResult,
  resultCount,
  targetAction,
  targetPath,
  direction,
  buttonText
}

用途：
统计 Pro 点击率。

8. pro_jump_success

触发：
wx.navigateToMiniProgram 跳转 Pro 成功。

上报方式：
立即上报。

properties：
{
  guideId,
  guideType,
  traceId,
  hasResult,
  resultCount,
  targetAction,
  targetPath,
  direction,
  buttonText
}

用途：
统计 Pro 跳转成功率和导流率。

9. pro_jump_fail

触发：
wx.navigateToMiniProgram 跳转 Pro 失败。

上报方式：
立即上报。

properties：
{
  guideId,
  traceId,
  failReason,
  failCategory,
  isUserCancel,
  errorMessage
}

说明：
- errorMessage 最多保存 500 字符
- 用户取消时：
  failReason = user_cancel
  failCategory = cancel
  isUserCancel = true
- 其他失败：
  failReason = other
  failCategory = error
  isUserCancel = false

六、每日聚合表 calculator_analytics_daily

唯一维度：

date + calculatorType

字段：

{
  date,
  calculatorType,
  calculatorName,

  viewCount,
  viewUserCount,

  entryClickCount,
  entryClickUserCount,

  resultCount,
  resultUserCount,

  saveOperationCount,
  exportCount,

  proExposeCount,
  proExposeUserCount,

  proClickCount,
  proClickUserCount,

  proJumpSuccessCount,
  proJumpSuccessUserCount,

  proJumpFailCount,

  updatedAt
}

内部辅助去重字段：

{
  viewUsers,
  entryClickUsers,
  resultUsers,
  proExposeUsers,
  proClickUsers,
  proJumpSuccessUsers
}

七、管理员后台可计算指标

1. 今日、近7天、近15天、近30天计算器使用排行
依据：
- viewCount
- viewUserCount
- resultCount
- resultUserCount

2. 哪个计算器生成结果最多
依据：
- resultCount

3. 哪个计算器点击 Pro 最多
依据：
- proClickCount
- proClickUserCount

4. 哪个计算器成功跳转 Pro 最多
依据：
- proJumpSuccessCount
- proJumpSuccessUserCount

5. Pro 点击率

Pro点击率 = Pro点击人数 ÷ Pro曝光人数

字段：
proClickUserCount ÷ proExposeUserCount

6. 跳转成功率

跳转成功率 = Pro跳转成功人数 ÷ Pro点击人数

字段：
proJumpSuccessUserCount ÷ proClickUserCount

7. 导流率

导流率 = Pro跳转成功人数 ÷ 结果生成人数

字段：
proJumpSuccessUserCount ÷ resultUserCount

八、隐私口径

自有云库不保存以下用户交易明细：

- 股票代码
- 股票名称
- 价格
- 数量
- 金额
- 收益
- 成本
- 市值

只保存统计分析需要的非敏感字段：

- 计算器类型
- 计算器名称
- 来源页面
- 入口位置
- 是否计入手续费
- 结果数量
- 分组序号
- 操作类型
- Pro 引导曝光/点击/跳转状态

九、前端文件改动

1. utils/analytics.js

作用：
统一埋点入口。

包含：
- wx.reportEvent 保留
- 云函数双写
- 本地队列
- 事件字段白名单
- clientId/sessionId/eventId 生成
- Pro 跳转失败原因识别
- calculator_view 去重上报

2. pages/index/index.js

接入：
- 首页 Pro 卡曝光
- 首页 Pro 卡点击
- 顶部 Tab 点击
- 底部计算器入口点击

3. components/calculator-pro-guide/calculator-pro-guide.js

接入：
- 结果页 Pro 卡曝光
- 结果页 Pro 卡点击
- Pro 跳转成功
- Pro 跳转失败

4. utils/calculatorComponent.js

接入：
- 通用计算器展示
- 通用计算结果生成
- 通用导出点击
- 反T、补仓等多组计算器初始化/保存结果

5. components/calculators/t-profit/t-profit.js

接入：
- 做T计算器展示
- 初始化底仓
- 保存操作
- 导出点击
- 分组信息上报

6. components/calculators/price-projection/price-projection.js

接入：
- 涨跌幅推演计算器展示
- 计算结果生成

十、云函数改动

新增：

cloudfunctions/analyticsReport

文件：
- index.js
- package.json

职责：
1. 接收前端 events 数组。
2. 每次最多处理 10 条。
3. 校验事件名是否在白名单。
4. 从 cloud.getWXContext() 获取 openid。
5. 补充 serverTime、date、hour。
6. 按 eventId 写入 calculator_analytics_events，防重复。
7. 按 date + calculatorType 更新 calculator_analytics_daily。
8. 返回 accepted/rejected 数量。

十一、项目配置

project.config.json 增加：

cloudfunctionRoot: "cloudfunctions/"

十二、上报策略

普通事件：
- calculator_view
- calculator_entry_click
- calculator_result_generated
- calculator_result_save
- calculator_export_click
- pro_guide_expose

进入本地队列，批量上报。

立即事件：
- pro_guide_click
- pro_jump_success
- pro_jump_fail

点击和跳转类事件优先级更高，立即调用云函数。

失败处理：
- 云函数调用失败时，事件重新放回本地队列。
- 下次触发上报时继续重试。

十三、上线注意事项

1. 需要在微信开发者工具中上传并部署云函数：
analyticsReport

2. 需要确认云开发环境：
cloud1-7gdq3emj774ac1dd

3. 建议提前创建或授权集合：
calculator_analytics_events
calculator_analytics_daily

4. 上线后先双写 7～14 天：
- 对比微信后台 wx.reportEvent 数据
- 对比云数据库 calculator_analytics_daily 数据

5. 数据稳定后，再决定是否减少或停止微信官方埋点。