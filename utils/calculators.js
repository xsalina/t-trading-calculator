const {
  safeNumber,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  roundTo,
  formatMoney,
  formatRate,
  formatNumber,
  formatPrice
} = require("./math");
const { calcTradeFee } = require("./fee");

function decorateFee(fee) {
  return {
    commissionFee: fee.commissionFee,
    transferFee: fee.transferFee,
    stampDutyFee: fee.stampDutyFee,
    totalFee: fee.totalFee,
    commissionText: formatMoney(fee.commissionFee),
    transferText: formatMoney(fee.transferFee),
    stampDutyText: formatMoney(fee.stampDutyFee),
    totalText: formatMoney(fee.totalFee)
  };
}

function sumFees(fees) {
  return fees.reduce((total, fee) => ({
    commissionFee: safeAdd(total.commissionFee, fee.commissionFee),
    transferFee: safeAdd(total.transferFee, fee.transferFee),
    stampDutyFee: safeAdd(total.stampDutyFee, fee.stampDutyFee),
    totalFee: safeAdd(total.totalFee, fee.totalFee)
  }), {
    commissionFee: 0,
    transferFee: 0,
    stampDutyFee: 0,
    totalFee: 0
  });
}

function resultClass(value) {
  const num = safeNumber(value);
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "";
}

function calcTProfit(input, feeSettings) {
  const buyPrice = safeNumber(input.buyPrice);
  const sellPrice = safeNumber(input.sellPrice);
  const shares = safeNumber(input.shares);
  const includeFee = input.includeFee;
  const buyAmount = safeMultiply(buyPrice, shares);
  const sellAmount = safeMultiply(sellPrice, shares);
  const buyFee = calcTradeFee({ amount: buyAmount, direction: "BUY", feeSettings, includeFee });
  const sellFee = calcTradeFee({ amount: sellAmount, direction: "SELL", feeSettings, includeFee });
  const totalFee = sumFees([buyFee, sellFee]);
  const grossProfit = safeMultiply(safeSubtract(sellPrice, buyPrice), shares);
  const netProfit = safeSubtract(safeSubtract(grossProfit, buyFee.totalFee), sellFee.totalFee);
  const costBase = safeAdd(buyAmount, buyFee.totalFee);
  const profitRate = safeMultiply(safeDivide(netProfit, costBase), 100);

  return {
    fee: decorateFee(totalFee),
    rows: [
      { label: "买入金额", value: " " + formatMoney(buyAmount) },
      { label: "卖出金额", value: " " + formatMoney(sellAmount) },
      { label: "毛收益", value: " " + formatMoney(grossProfit), className: resultClass(grossProfit) },
      { label: "净收益", value: " " + formatMoney(netProfit), className: resultClass(netProfit) },
      { label: "收益率", value: formatRate(profitRate), className: resultClass(profitRate) }
    ]
  };
}

function calcReverseT(input, feeSettings) {
  const sellPrice = safeNumber(input.sellPrice);
  const coverPrice = safeNumber(input.coverPrice);
  const shares = safeNumber(input.shares);
  const includeFee = input.includeFee;
  const sellAmount = safeMultiply(sellPrice, shares);
  const coverAmount = safeMultiply(coverPrice, shares);
  const sellFee = calcTradeFee({ amount: sellAmount, direction: "SELL", feeSettings, includeFee });
  const coverFee = calcTradeFee({ amount: coverAmount, direction: "BUY", feeSettings, includeFee });
  const totalFee = sumFees([sellFee, coverFee]);
  const spreadProfit = safeMultiply(safeSubtract(sellPrice, coverPrice), shares);
  const netProfit = safeSubtract(safeSubtract(spreadProfit, sellFee.totalFee), coverFee.totalFee);
  const coverSpace = safeMultiply(safeDivide(safeSubtract(sellPrice, coverPrice), sellPrice), 100);

  return {
    fee: decorateFee(totalFee),
    rows: [
      { label: "卖出金额", value: " " + formatMoney(sellAmount) },
      { label: "回补金额", value: " " + formatMoney(coverAmount) },
      { label: "价差收益", value: " " + formatMoney(spreadProfit), className: resultClass(spreadProfit) },
      { label: "反T净收益", value: " " + formatMoney(netProfit), className: resultClass(netProfit) },
      { label: "回补空间", value: formatRate(coverSpace), className: resultClass(coverSpace) }
    ]
  };
}

function calcTakeProfit(input, feeSettings) {
  const costPrice = safeNumber(input.costPrice);
  const shares = safeNumber(input.shares);
  const targetProfit = safeNumber(input.targetProfit);
  const includeFee = input.includeFee;
  const costAmount = safeMultiply(costPrice, shares);
  const initialTargetPrice = safeDivide(safeAdd(costAmount, targetProfit), shares);
  const estimatedSellAmount = safeMultiply(initialTargetPrice, shares);
  const sellFee = calcTradeFee({ amount: estimatedSellAmount, direction: "SELL", feeSettings, includeFee });
  const targetPrice = safeDivide(safeAdd(safeAdd(costAmount, targetProfit), sellFee.totalFee), shares);
  const finalSellAmount = safeMultiply(targetPrice, shares);

  return {
    fee: decorateFee(sellFee),
    rows: [
      { label: "持仓成本", value: " " + formatMoney(costAmount) },
      { label: "目标收益", value: " " + formatMoney(targetProfit), className: resultClass(targetProfit) },
      { label: "目标卖出价", value: " " + formatPrice(targetPrice, input.costPrice), className: resultClass(targetProfit) },
      { label: "预计卖出金额", value: " " + formatMoney(finalSellAmount) }
    ]
  };
}

function calcAverageDown(input, feeSettings) {
  const originalCost = safeNumber(input.originalCost);
  const originalShares = safeNumber(input.originalShares);
  const buyPrice = safeNumber(input.buyPrice);
  const buyShares = safeNumber(input.buyShares);
  const includeFee = input.includeFee;
  const originalAmount = safeMultiply(originalCost, originalShares);
  const buyAmount = safeMultiply(buyPrice, buyShares);
  const buyFee = calcTradeFee({ amount: buyAmount, direction: "BUY", feeSettings, includeFee });
  const buyTotalCost = safeAdd(buyAmount, buyFee.totalFee);
  const totalCost = safeAdd(originalAmount, buyTotalCost);
  const totalShares = safeAdd(originalShares, buyShares);
  const newCost = safeDivide(totalCost, totalShares);
  const reduceAmount = safeSubtract(originalCost, newCost);
  const reduceRate = safeMultiply(safeDivide(reduceAmount, originalCost), 100);

  return {
    fee: decorateFee(buyFee),
    rows: [
      { label: "原持仓成本", value: " " + formatMoney(originalAmount) },
      { label: "补仓总成本", value: " " + formatMoney(buyTotalCost) },
      { label: "补仓后成本价", value: " " + formatPrice(newCost, input.originalCost) },
      { label: "成本降低金额", value: " " + formatMoney(reduceAmount), className: resultClass(reduceAmount) },
      { label: "成本降低比例", value: formatRate(reduceRate), className: resultClass(reduceRate) }
    ]
  };
}

function calcSellEstimate(input, feeSettings) {
  const costPrice = safeNumber(input.costPrice);
  const sellPrice = safeNumber(input.sellPrice);
  const totalShares = safeNumber(input.totalShares);
  const sellShares = safeNumber(input.sellShares);
  const includeFee = input.includeFee;
  const sellAmount = safeMultiply(sellPrice, sellShares);
  const sellFee = calcTradeFee({ amount: sellAmount, direction: "SELL", feeSettings, includeFee });
  const soldCost = safeMultiply(costPrice, sellShares);
  const grossProfit = safeSubtract(sellAmount, soldCost);
  const netProfit = safeSubtract(grossProfit, sellFee.totalFee);
  const remainShares = safeSubtract(totalShares, sellShares);

  return {
    fee: decorateFee(sellFee),
    rows: [
      { label: "卖出金额", value: " " + formatMoney(sellAmount) },
      { label: "卖出部分成本", value: " " + formatMoney(soldCost) },
      { label: "卖出毛收益", value: " " + formatMoney(grossProfit), className: resultClass(grossProfit) },
      { label: "卖出净收益", value: " " + formatMoney(netProfit), className: resultClass(netProfit) },
      { label: "剩余股数", value: formatNumber(remainShares, 0) + " 股" },
      { label: "剩余持仓成本价", value: " " + formatPrice(costPrice, input.costPrice) }
    ]
  };
}

function calcGrid(input, feeSettings) {
  const currentPrice = safeNumber(input.currentPrice);
  const upRate = safeDivide(safeNumber(input.upRate), 100);
  const downRate = safeDivide(safeNumber(input.downRate), 100);
  const levels = Math.max(0, Math.floor(safeNumber(input.levels)));
  const shares = safeNumber(input.shares);
  const includeFee = input.includeFee;
  const rows = [];
  let feeTotal = { commissionFee: 0, transferFee: 0, stampDutyFee: 0, totalFee: 0 };

  for (let i = 1; i <= levels; i += 1) {
    const upPrice = safeMultiply(currentPrice, Math.pow(1 + upRate, i));
    const downPrice = safeMultiply(currentPrice, Math.pow(1 - downRate, i));
    const buyAmount = safeMultiply(downPrice, shares);
    const sellAmount = safeMultiply(upPrice, shares);
    const buyFee = calcTradeFee({ amount: buyAmount, direction: "BUY", feeSettings, includeFee });
    const sellFee = calcTradeFee({ amount: sellAmount, direction: "SELL", feeSettings, includeFee });
    const levelFee = sumFees([buyFee, sellFee]);
    const grossProfit = safeMultiply(safeSubtract(upPrice, downPrice), shares);
    const netProfit = safeSubtract(grossProfit, levelFee.totalFee);
    feeTotal = sumFees([feeTotal, levelFee]);
    rows.push({
      level: i,
      buyPrice: " " + formatPrice(downPrice, input.currentPrice),
      sellPrice: " " + formatPrice(upPrice, input.currentPrice),
      netProfit: " " + formatMoney(netProfit),
      className: resultClass(netProfit)
    });
  }

  return {
    fee: decorateFee(feeTotal),
    gridRows: rows,
    rows: [
      { label: "当前价", value: " " + formatPrice(currentPrice, input.currentPrice) },
      { label: "网格档数", value: levels + " 档" },
      { label: "每档股数", value: formatNumber(shares, 0) + " 股" }
    ]
  };
}

function calcPriceProjection(input) {
  const startPrice = safeNumber(input.startPrice);
  const shares = safeNumber(input.shares);
  const changeRate = safeDivide(safeNumber(input.changeRate), 100);
  const days = 50;
  const startDate = new Date();
  const startMarketValue = safeMultiply(startPrice, shares);
  const rows = [
    {
      day: 0,
      dateText: "初始",
      price: " " + formatPrice(startPrice, input.startPrice),
      marketValue: " " + formatMoney(startMarketValue),
      profit: " " + formatMoney(0),
      changeRate: formatRate(0),
      className: ""
    }
  ];

  for (let day = 1; day <= days; day += 1) {
    const currentDate = new Date(startDate.getTime());
    currentDate.setDate(startDate.getDate() + day);
    const price = safeMultiply(startPrice, Math.pow(1 + changeRate, day));
    const marketValue = safeMultiply(price, shares);
    const profit = safeSubtract(marketValue, safeMultiply(startPrice, shares));
    const changeAmount = safeSubtract(price, startPrice);
    const totalChangeRate = safeMultiply(safeDivide(changeAmount, startPrice), 100);

    rows.push({
      day,
      dateText: `${currentDate.getMonth() + 1}/${currentDate.getDate()}`,
      price: " " + formatPrice(price, input.startPrice),
      marketValue: " " + formatMoney(marketValue),
      profit: " " + formatMoney(profit),
      changeRate: formatRate(totalChangeRate),
      className: resultClass(totalChangeRate)
    });
  }

  const finalRow = rows[rows.length - 1] || {};
  const finalPrice = safeMultiply(startPrice, Math.pow(1 + changeRate, days));
  const finalMarketValue = safeMultiply(finalPrice, shares);
  const marketValueChange = safeSubtract(finalMarketValue, startMarketValue);

  return {
    rows: [
      { label: "起始价格", value: " " + formatPrice(startPrice, input.startPrice) },
      { label: "股票数量", value: formatNumber(shares, 0) + " 股" },
      { label: "每日涨跌幅", value: formatRate(safeNumber(input.changeRate)), className: resultClass(input.changeRate) },
      { label: "第50天价格", value: finalRow.price || " 0.0000", className: finalRow.className || "" },
      { label: "第50天市值", value: " " + formatMoney(finalMarketValue), className: resultClass(marketValueChange) },
      { label: "第50天盈亏", value: " " + formatMoney(marketValueChange), className: resultClass(marketValueChange) }
    ],
    projectionRows: rows
  };
}

function calcBreakEven(input) {
  const costPrice = safeNumber(input.costPrice);
  const currentPrice = safeNumber(input.currentPrice);
  const shares = safeNumber(input.shares);
  const costAmount = safeMultiply(costPrice, shares);
  const currentValue = safeMultiply(currentPrice, shares);
  const profit = safeSubtract(currentValue, costAmount);
  const needPriceAmount = safeSubtract(costPrice, currentPrice);
  const needRate = safeMultiply(safeDivide(needPriceAmount, currentPrice), 100);
  const breakEvenValue = safeMultiply(costPrice, shares);

  return {
    rows: [
      { label: "持仓成本", value: " " + formatMoney(costAmount) },
      { label: "当前市值", value: " " + formatMoney(currentValue) },
      { label: "当前盈亏", value: " " + formatMoney(profit), className: resultClass(profit) },
      { label: "回本目标价", value: " " + formatPrice(costPrice, input.costPrice) },
      { label: "回本目标市值", value: " " + formatMoney(breakEvenValue) },
      { label: "需上涨金额", value: " " + formatMoney(needPriceAmount), className: resultClass(needPriceAmount) },
      { label: "需上涨比例", value: formatRate(needRate), className: resultClass(needRate) }
    ]
  };
}

module.exports = {
  calcTProfit,
  calcReverseT,
  calcTakeProfit,
  calcAverageDown,
  calcSellEstimate,
  calcGrid,
  calcPriceProjection,
  calcBreakEven
};
