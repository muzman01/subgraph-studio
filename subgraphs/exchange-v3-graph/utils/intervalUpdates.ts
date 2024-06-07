import { ZERO_BD, ZERO_BI, ONE_BI } from "./constants";
/* eslint-disable prefer-const */
import {
  PancakeDayData,
  Factory,
  Pool,
  PoolHourData,
  PoolDayData,
  PoolWeekData,
  PoolMonthData,
  PoolYearData,
  Token,
  TokenDayData,
  TokenHourData,
  Bundle,
  TickDayData,
  Tick,
} from "../generated/schema";
import { FACTORY_ADDRESS } from "./constants";
import { ethereum } from "@graphprotocol/graph-ts";

/**
 * Tracks global aggregate data over daily windows
 * @param event
 */
export function updatePancakeDayData(event: ethereum.Event): PancakeDayData {
  let pancake = Factory.load(FACTORY_ADDRESS);
  if (pancake == null) {
    pancake = new Factory(FACTORY_ADDRESS);
    pancake.totalVolumeETH = ZERO_BD;
    pancake.totalVolumeUSD = ZERO_BD;
    pancake.untrackedVolumeUSD = ZERO_BD;
    pancake.totalFeesUSD = ZERO_BD;
    pancake.totalFeesETH = ZERO_BD;
    pancake.totalProtocolFeesUSD = ZERO_BD;
    pancake.totalProtocolFeesETH = ZERO_BD;
    pancake.totalValueLockedETH = ZERO_BD;
    pancake.totalValueLockedUSD = ZERO_BD;
    pancake.totalValueLockedUSDUntracked = ZERO_BD;
    pancake.totalValueLockedETHUntracked = ZERO_BD;
    pancake.txCount = ZERO_BI;
  }
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400; // rounded
  let dayStartTimestamp = dayID * 86400;
  let pancakeDayData = PancakeDayData.load(dayID.toString());
  if (pancakeDayData == null) {
    pancakeDayData = new PancakeDayData(dayID.toString());
    pancakeDayData.date = dayStartTimestamp;
    pancakeDayData.volumeETH = ZERO_BD;
    pancakeDayData.volumeUSD = ZERO_BD;
    pancakeDayData.volumeUSDUntracked = ZERO_BD;
    pancakeDayData.feesUSD = ZERO_BD;
    pancakeDayData.protocolFeesUSD = ZERO_BD;
    pancakeDayData.tvlUSD = ZERO_BD;
    pancakeDayData.txCount = ZERO_BI;
  }
  pancakeDayData.tvlUSD = pancake.totalValueLockedUSD;
  pancakeDayData.txCount = pancake.txCount;
  pancakeDayData.save();
  return pancakeDayData;
}

export function updatePoolYearData(event: ethereum.Event): PoolDayData {
  let timestamp = event.block.timestamp.toI32();
  let yearID = timestamp / 31536000;
  let yearStartTimestamp = yearID * 31536000;
  let yearPoolID = event.address.toHexString().concat("-").concat(yearID.toString());
  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    pool = new Pool(event.address.toHexString());
    pool.token0Price = ZERO_BD;
    pool.token1Price = ZERO_BD;
    pool.totalValueLockedUSD = ZERO_BD;
    pool.liquidity = ZERO_BI;
    pool.sqrtPrice = ZERO_BI;
    pool.feeGrowthGlobal0X128 = ZERO_BI;
    pool.feeGrowthGlobal1X128 = ZERO_BI;
    pool.tick = ZERO_BI;
  }
  let poolYearData = PoolYearData.load(yearPoolID);
  if (poolYearData == null) {
    poolYearData = new PoolYearData(yearPoolID);
    poolYearData.date = yearStartTimestamp;
    poolYearData.pool = pool.id;
    poolYearData.volumeToken0 = ZERO_BD;
    poolYearData.volumeToken1 = ZERO_BD;
    poolYearData.volumeUSD = ZERO_BD;
    poolYearData.feesUSD = ZERO_BD;
    poolYearData.protocolFeesUSD = ZERO_BD;
    poolYearData.txCount = ZERO_BI;
    poolYearData.feeGrowthGlobal0X128 = ZERO_BI;
    poolYearData.feeGrowthGlobal1X128 = ZERO_BI;
    poolYearData.open = pool.token0Price;
    poolYearData.high = pool.token0Price;
    poolYearData.low = pool.token0Price;
    poolYearData.close = pool.token0Price;
  }

  if (pool.token0Price.gt(poolYearData.high)) {
    poolYearData.high = pool.token0Price;
  }
  if (pool.token0Price.lt(poolYearData.low)) {
    poolYearData.low = pool.token0Price;
  }

  poolYearData.liquidity = pool.liquidity;
  poolYearData.sqrtPrice = pool.sqrtPrice;
  poolYearData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128;
  poolYearData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128;
  poolYearData.token0Price = pool.token0Price;
  poolYearData.token1Price = pool.token1Price;
  poolYearData.tick = pool.tick;
  poolYearData.tvlUSD = pool.totalValueLockedUSD;
  poolYearData.txCount = poolYearData.txCount.plus(ONE_BI);
  poolYearData.close = pool.token0Price;
  poolYearData.save();

  return poolYearData;
}

export function updatePoolMonthData(event: ethereum.Event): PoolDayData {
  let timestamp = event.block.timestamp.toI32();
  let monthID = timestamp / 2592000;
  let monthStartTimestamp = monthID * 2592000;
  let monthPoolID = event.address.toHexString().concat("-").concat(monthID.toString());
  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    pool = new Pool(event.address.toHexString());
    pool.token0Price = ZERO_BD;
    pool.token1Price = ZERO_BD;
    pool.totalValueLockedUSD = ZERO_BD;
    pool.liquidity = ZERO_BI;
    pool.sqrtPrice = ZERO_BI;
    pool.feeGrowthGlobal0X128 = ZERO_BI;
    pool.feeGrowthGlobal1X128 = ZERO_BI;
    pool.tick = ZERO_BI;
  }
  let poolMonthData = PoolMonthData.load(monthPoolID);
  if (poolMonthData == null) {
    poolMonthData = new PoolMonthData(monthPoolID);
    poolMonthData.date = monthStartTimestamp;
    poolMonthData.pool = pool.id;
    poolMonthData.volumeToken0 = ZERO_BD;
    poolMonthData.volumeToken1 = ZERO_BD;
    poolMonthData.volumeUSD = ZERO_BD;
    poolMonthData.feesUSD = ZERO_BD;
    poolMonthData.protocolFeesUSD = ZERO_BD;
    poolMonthData.txCount = ZERO_BI;
    poolMonthData.feeGrowthGlobal0X128 = ZERO_BI;
    poolMonthData.feeGrowthGlobal1X128 = ZERO_BI;
    poolMonthData.open = pool.token0Price;
    poolMonthData.high = pool.token0Price;
    poolMonthData.low = pool.token0Price;
    poolMonthData.close = pool.token0Price;
  }

  if (pool.token0Price.gt(poolMonthData.high)) {
    poolMonthData.high = pool.token0Price;
  }
  if (pool.token0Price.lt(poolMonthData.low)) {
    poolMonthData.low = pool.token0Price;
  }

  poolMonthData.liquidity = pool.liquidity;
  poolMonthData.sqrtPrice = pool.sqrtPrice;
  poolMonthData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128;
  poolMonthData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128;
  poolMonthData.token0Price = pool.token0Price;
  poolMonthData.token1Price = pool.token1Price;
  poolMonthData.tick = pool.tick;
  poolMonthData.tvlUSD = pool.totalValueLockedUSD;
  poolMonthData.txCount = poolMonthData.txCount.plus(ONE_BI);
  poolMonthData.close = pool.token0Price;
  poolMonthData.save();

  return poolMonthData;
}

export function updatePoolWeekData(event: ethereum.Event): PoolDayData {
  let timestamp = event.block.timestamp.toI32();
  let weekID = timestamp / 604800;
  let weekStartTimestamp = weekID * 604800;
  let weekPoolID = event.address.toHexString().concat("-").concat(weekID.toString());
  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    pool = new Pool(event.address.toHexString());
    pool.token0Price = ZERO_BD;
    pool.token1Price = ZERO_BD;
    pool.totalValueLockedUSD = ZERO_BD;
    pool.liquidity = ZERO_BI;
    pool.sqrtPrice = ZERO_BI;
    pool.feeGrowthGlobal0X128 = ZERO_BI;
    pool.feeGrowthGlobal1X128 = ZERO_BI;
    pool.tick = ZERO_BI;
  }
  let poolWeekData = PoolWeekData.load(weekPoolID);
  if (poolWeekData == null) {
    poolWeekData = new PoolWeekData(weekPoolID);
    poolWeekData.date = weekStartTimestamp;
    poolWeekData.pool = pool.id;
    poolWeekData.volumeToken0 = ZERO_BD;
    poolWeekData.volumeToken1 = ZERO_BD;
    poolWeekData.volumeUSD = ZERO_BD;
    poolWeekData.feesUSD = ZERO_BD;
    poolWeekData.protocolFeesUSD = ZERO_BD;
    poolWeekData.txCount = ZERO_BI;
    poolWeekData.feeGrowthGlobal0X128 = ZERO_BI;
    poolWeekData.feeGrowthGlobal1X128 = ZERO_BI;
    poolWeekData.open = pool.token0Price;
    poolWeekData.high = pool.token0Price;
    poolWeekData.low = pool.token0Price;
    poolWeekData.close = pool.token0Price;
  }

  if (pool.token0Price.gt(poolWeekData.high)) {
    poolWeekData.high = pool.token0Price;
  }
  if (pool.token0Price.lt(poolWeekData.low)) {
    poolWeekData.low = pool.token0Price;
  }

  poolWeekData.liquidity = pool.liquidity;
  poolWeekData.sqrtPrice = pool.sqrtPrice;
  poolWeekData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128;
  poolWeekData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128;
  poolWeekData.token0Price = pool.token0Price;
  poolWeekData.token1Price = pool.token1Price;
  poolWeekData.tick = pool.tick;
  poolWeekData.tvlUSD = pool.totalValueLockedUSD;
  poolWeekData.txCount = poolWeekData.txCount.plus(ONE_BI);
  poolWeekData.close = pool.token0Price;
  poolWeekData.save();

  return poolWeekData;
}

export function updatePoolDayData(event: ethereum.Event): PoolDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let dayPoolID = event.address.toHexString().concat("-").concat(dayID.toString());
  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    pool = new Pool(event.address.toHexString());
    pool.token0Price = ZERO_BD;
    pool.token1Price = ZERO_BD;
    pool.totalValueLockedUSD = ZERO_BD;
    pool.liquidity = ZERO_BI;
    pool.sqrtPrice = ZERO_BI;
    pool.feeGrowthGlobal0X128 = ZERO_BI;
    pool.feeGrowthGlobal1X128 = ZERO_BI;
    pool.tick = ZERO_BI;
  }
  let poolDayData = PoolDayData.load(dayPoolID);
  if (poolDayData == null) {
    poolDayData = new PoolDayData(dayPoolID);
    poolDayData.date = dayStartTimestamp;
    poolDayData.pool = pool.id;
    poolDayData.volumeToken0 = ZERO_BD;
    poolDayData.volumeToken1 = ZERO_BD;
    poolDayData.volumeUSD = ZERO_BD;
    poolDayData.feesUSD = ZERO_BD;
    poolDayData.protocolFeesUSD = ZERO_BD;
    poolDayData.txCount = ZERO_BI;
    poolDayData.feeGrowthGlobal0X128 = ZERO_BI;
    poolDayData.feeGrowthGlobal1X128 = ZERO_BI;
    poolDayData.open = pool.token0Price;
    poolDayData.high = pool.token0Price;
    poolDayData.low = pool.token0Price;
    poolDayData.close = pool.token0Price;
  }

  if (pool.token0Price.gt(poolDayData.high)) {
    poolDayData.high = pool.token0Price;
  }
  if (pool.token0Price.lt(poolDayData.low)) {
    poolDayData.low = pool.token0Price;
  }

  poolDayData.liquidity = pool.liquidity;
  poolDayData.sqrtPrice = pool.sqrtPrice;
  poolDayData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128;
  poolDayData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128;
  poolDayData.token0Price = pool.token0Price;
  poolDayData.token1Price = pool.token1Price;
  poolDayData.tick = pool.tick;
  poolDayData.tvlUSD = pool.totalValueLockedUSD;
  poolDayData.txCount = poolDayData.txCount.plus(ONE_BI);
  poolDayData.close = pool.token0Price;
  poolDayData.save();

  return poolDayData;
}

export function updatePoolHourData(event: ethereum.Event): PoolHourData {
  let timestamp = event.block.timestamp.toI32();
  let hourIndex = timestamp / 3600; // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600; // want the rounded effect
  let hourPoolID = event.address.toHexString().concat("-").concat(hourIndex.toString());
  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    pool = new Pool(event.address.toHexString());
    pool.token0Price = ZERO_BD;
    pool.token1Price = ZERO_BD;
    pool.totalValueLockedUSD = ZERO_BD;
    pool.liquidity = ZERO_BI;
    pool.sqrtPrice = ZERO_BI;
    pool.feeGrowthGlobal0X128 = ZERO_BI;
    pool.feeGrowthGlobal1X128 = ZERO_BI;
    pool.tick = ZERO_BI;
  }
  let poolHourData = PoolHourData.load(hourPoolID);
  if (poolHourData == null) {
    poolHourData = new PoolHourData(hourPoolID);
    poolHourData.periodStartUnix = hourStartUnix;
    poolHourData.pool = pool.id;
    poolHourData.volumeToken0 = ZERO_BD;
    poolHourData.volumeToken1 = ZERO_BD;
    poolHourData.volumeUSD = ZERO_BD;
    poolHourData.txCount = ZERO_BI;
    poolHourData.feesUSD = ZERO_BD;
    poolHourData.protocolFeesUSD = ZERO_BD;
    poolHourData.feeGrowthGlobal0X128 = ZERO_BI;
    poolHourData.feeGrowthGlobal1X128 = ZERO_BI;
    poolHourData.open = pool.token0Price;
    poolHourData.high = pool.token0Price;
    poolHourData.low = pool.token0Price;
    poolHourData.close = pool.token0Price;
  }

  if (pool.token0Price.gt(poolHourData.high)) {
    poolHourData.high = pool.token0Price;
  }
  if (pool.token0Price.lt(poolHourData.low)) {
    poolHourData.low = pool.token0Price;
  }

  poolHourData.liquidity = pool.liquidity;
  poolHourData.sqrtPrice = pool.sqrtPrice;
  poolHourData.token0Price = pool.token0Price;
  poolHourData.token1Price = pool.token1Price;
  poolHourData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128;
  poolHourData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128;
  poolHourData.close = pool.token0Price;
  poolHourData.tick = pool.tick;
  poolHourData.tvlUSD = pool.totalValueLockedUSD;
  poolHourData.txCount = poolHourData.txCount.plus(ONE_BI);
  poolHourData.save();

  return poolHourData;
}

export function updateTokenDayData(token: Token, event: ethereum.Event): TokenDayData {
  let bundle = Bundle.load("1");
  if (bundle == null) {
    bundle = new Bundle("1");
    bundle.ethPriceUSD = ZERO_BD;
  }
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let tokenDayID = token.id.toString().concat("-").concat(dayID.toString());
  let tokenPrice = token.derivedETH.times(bundle.ethPriceUSD);

  let tokenDayData = TokenDayData.load(tokenDayID);
  if (tokenDayData == null) {
    tokenDayData = new TokenDayData(tokenDayID);
    tokenDayData.date = dayStartTimestamp;
    tokenDayData.token = token.id;
    tokenDayData.volume = ZERO_BD;
    tokenDayData.volumeUSD = ZERO_BD;
    tokenDayData.feesUSD = ZERO_BD;
    tokenDayData.protocolFeesUSD = ZERO_BD;
    tokenDayData.untrackedVolumeUSD = ZERO_BD;
    tokenDayData.open = tokenPrice;
    tokenDayData.high = tokenPrice;
    tokenDayData.low = tokenPrice;
    tokenDayData.close = tokenPrice;
  }

  if (tokenPrice.gt(tokenDayData.high)) {
    tokenDayData.high = tokenPrice;
  }

  if (tokenPrice.lt(tokenDayData.low)) {
    tokenDayData.low = tokenPrice;
  }

  tokenDayData.close = tokenPrice;
  tokenDayData.priceUSD = token.derivedETH.times(bundle.ethPriceUSD);
  tokenDayData.totalValueLocked = token.totalValueLocked;
  tokenDayData.totalValueLockedUSD = token.totalValueLockedUSD;
  tokenDayData.save();

  return tokenDayData;
}

export function updateTokenHourData(token: Token, event: ethereum.Event): TokenHourData {
  let bundle = Bundle.load("1");
  if (bundle == null) {
    bundle = new Bundle("1");
    bundle.ethPriceUSD = ZERO_BD;
  }
  let timestamp = event.block.timestamp.toI32();
  let hourIndex = timestamp / 3600; // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600; // want the rounded effect
  let tokenHourID = token.id.toString().concat("-").concat(hourIndex.toString());
  let tokenHourData = TokenHourData.load(tokenHourID);
  let tokenPrice = token.derivedETH.times(bundle.ethPriceUSD);

  if (tokenHourData == null) {
    tokenHourData = new TokenHourData(tokenHourID);
    tokenHourData.periodStartUnix = hourStartUnix;
    tokenHourData.token = token.id;
    tokenHourData.volume = ZERO_BD;
    tokenHourData.volumeUSD = ZERO_BD;
    tokenHourData.untrackedVolumeUSD = ZERO_BD;
    tokenHourData.feesUSD = ZERO_BD;
    tokenHourData.protocolFeesUSD = ZERO_BD;
    tokenHourData.open = tokenPrice;
    tokenHourData.high = tokenPrice;
    tokenHourData.low = tokenPrice;
    tokenHourData.close = tokenPrice;
  }

  if (tokenPrice.gt(tokenHourData.high)) {
    tokenHourData.high = tokenPrice;
  }

  if (tokenPrice.lt(tokenHourData.low)) {
    tokenHourData.low = tokenPrice;
  }

  tokenHourData.close = tokenPrice;
  tokenHourData.priceUSD = tokenPrice;
  tokenHourData.totalValueLocked = token.totalValueLocked;
  tokenHourData.totalValueLockedUSD = token.totalValueLockedUSD;
  tokenHourData.save();

  return tokenHourData;
}

export function updateTickDayData(tick: Tick, event: ethereum.Event): TickDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let tickDayDataID = tick.id.concat("-").concat(dayID.toString());
  let tickDayData = TickDayData.load(tickDayDataID);
  if (tickDayData == null) {
    tickDayData = new TickDayData(tickDayDataID);
    tickDayData.date = dayStartTimestamp;
    tickDayData.pool = tick.pool;
    tickDayData.tick = tick.id;
  }
  tickDayData.liquidityGross = tick.liquidityGross;
  tickDayData.liquidityNet = tick.liquidityNet;
  tickDayData.volumeToken0 = tick.volumeToken0;
  tickDayData.volumeToken1 = tick.volumeToken0;
  tickDayData.volumeUSD = tick.volumeUSD;
  tickDayData.feesUSD = tick.feesUSD;
  tickDayData.feeGrowthOutside0X128 = tick.feeGrowthOutside0X128;
  tickDayData.feeGrowthOutside1X128 = tick.feeGrowthOutside1X128;

  tickDayData.save();

  return tickDayData;
}
