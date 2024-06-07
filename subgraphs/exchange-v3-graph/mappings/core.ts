/* eslint-disable prefer-const */
import { Bundle, Burn, Factory, Mint, Pool, Swap, Tick, Token, Collect } from "../generated/schema";
import { Pool as PoolABI } from "../generated/Factory/Pool";
import { BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import {
  Burn as BurnEvent,
  Flash as FlashEvent,
  Initialize,
  Mint as MintEvent,
  Swap as SwapEvent,
  Collect as CollectEvent,
  CollectProtocol as CollectProtocolEvent,
} from "../generated/templates/Pool/Pool";
import { convertTokenToDecimal, loadTransaction } from "../utils";
import { FACTORY_ADDRESS, ONE_BI, TWO_BD, ZERO_BD, ZERO_BI, ADDRESS_ZERO } from "../utils/constants";
import {
  AmountType,
  findEthPerToken,
  getAdjustedAmounts,
  getEthPriceInUSD,
  sqrtPriceX96ToTokenPrices,
} from "../utils/pricing";
import {
  updatePoolDayData,
  updatePoolHourData,
  updatePoolWeekData,
  updatePoolMonthData,
  updatePoolYearData,
  updateTickDayData,
  updateTokenDayData,
  updateTokenHourData,
  updatePancakeDayData,
} from "../utils/intervalUpdates";
import { createTick, feeTierToTickSpacing } from "../utils/tick";
import { updateDerivedTVLAmounts } from "../utils/tvl";

export function handleInitialize(event: Initialize): void {
  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    log.error("Pool not found for address: {}", [event.address.toHexString()]);
    return;
  }

  pool.sqrtPrice = event.params.sqrtPriceX96;
  pool.tick = BigInt.fromI32(event.params.tick);
  pool.save();

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 == null || token1 == null) {
    log.error("Token0 or Token1 not found for pool: {}", [pool.id]);
    return;
  }

  let bundle = Bundle.load("1");
  if (bundle == null) {
    bundle = new Bundle("1");
    bundle.ethPriceUSD = ZERO_BD;
  }
  bundle.ethPriceUSD = getEthPriceInUSD();
  bundle.save();

  updatePoolYearData(event);
  updatePoolMonthData(event);
  updatePoolWeekData(event);
  updatePoolDayData(event);
  updatePoolHourData(event);

  token0.derivedETH = findEthPerToken(token0);
  token1.derivedETH = findEthPerToken(token1);
  token0.save();
  token1.save();
}

export function handleMint(event: MintEvent): void {
  let bundle = Bundle.load("1");
  if (bundle == null) {
    bundle = new Bundle("1");
    bundle.ethPriceUSD = ZERO_BD;
  }

  let poolAddress = event.address.toHexString();
  let pool = Pool.load(poolAddress);
  if (pool == null) {
    log.error("Pool not found for address: {}", [poolAddress]);
    return;
  }

  let factory = Factory.load(FACTORY_ADDRESS);
  if (factory == null) {
    factory = new Factory(FACTORY_ADDRESS);
    factory.totalVolumeETH = ZERO_BD;
    factory.totalVolumeUSD = ZERO_BD;
    factory.untrackedVolumeUSD = ZERO_BD;
    factory.totalFeesUSD = ZERO_BD;
    factory.totalFeesETH = ZERO_BD;
    factory.totalProtocolFeesUSD = ZERO_BD;
    factory.totalProtocolFeesETH = ZERO_BD;
    factory.totalValueLockedETH = ZERO_BD;
    factory.totalValueLockedUSD = ZERO_BD;
    factory.totalValueLockedUSDUntracked = ZERO_BD;
    factory.totalValueLockedETHUntracked = ZERO_BD;
    factory.txCount = ZERO_BI;
    factory.owner = ADDRESS_ZERO;
  }

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 == null || token1 == null) {
    log.error("Token0 or Token1 not found for pool: {}", [pool.id]);
    return;
  }

  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);

  let amountUSD = amount0
    .times(token0.derivedETH.times(bundle.ethPriceUSD))
    .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)));

  let oldPoolTVLETH = pool.totalValueLockedETH;
  let oldPoolTVLETHUntracked = pool.totalValueLockedETHUntracked;
  token0.totalValueLocked = token0.totalValueLocked.plus(amount0);
  token1.totalValueLocked = token1.totalValueLocked.plus(amount1);
  pool.totalValueLockedToken0 = pool.totalValueLockedToken0.plus(amount0);
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1.plus(amount1);
  updateDerivedTVLAmounts(pool, factory, token0, token1, oldPoolTVLETH, oldPoolTVLETHUntracked);

  factory.txCount = factory.txCount.plus(ONE_BI);
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);
  pool.txCount = pool.txCount.plus(ONE_BI);

  if (
    pool.tick !== null &&
    BigInt.fromI32(event.params.tickLower).le(pool.tick as BigInt) &&
    BigInt.fromI32(event.params.tickUpper).gt(pool.tick as BigInt)
  ) {
    pool.liquidity = pool.liquidity.plus(event.params.amount);
  }

  pool.liquidityProviderCount = pool.liquidityProviderCount.plus(ONE_BI);

  let transaction = loadTransaction(event);
  if (transaction === null) {
    log.warning("Transaction is null for mint event: {}", [event.transaction.hash.toHexString()]);
    return;
  }
  let mint = new Mint(transaction.id.toString() + "#" + pool.txCount.toString());
  mint.transaction = transaction.id;
  mint.timestamp = transaction.timestamp;
  mint.pool = pool.id;
  mint.token0 = pool.token0;
  mint.token1 = pool.token1;
  mint.owner = event.params.owner;
  mint.sender = event.params.sender;
  mint.origin = event.transaction.from;
  mint.amount = event.params.amount;
  mint.amount0 = amount0;
  mint.amount1 = amount1;
  mint.amountUSD = amountUSD;
  mint.tickLower = BigInt.fromI32(event.params.tickLower);
  mint.tickUpper = BigInt.fromI32(event.params.tickUpper);
  mint.logIndex = event.logIndex;

  let lowerTickIdx = event.params.tickLower;
  let upperTickIdx = event.params.tickUpper;

  let lowerTickId = poolAddress + "#" + BigInt.fromI32(event.params.tickLower).toString();
  let upperTickId = poolAddress + "#" + BigInt.fromI32(event.params.tickUpper).toString();

  let lowerTick = Tick.load(lowerTickId);
  let upperTick = Tick.load(upperTickId);

  if (lowerTick === null) {
    lowerTick = createTick(lowerTickId, lowerTickIdx, pool.id, event);
  }

  if (upperTick === null) {
    upperTick = createTick(upperTickId, upperTickIdx, pool.id, event);
  }

  let amount = event.params.amount;
  lowerTick.liquidityGross = lowerTick.liquidityGross.plus(amount);
  lowerTick.liquidityNet = lowerTick.liquidityNet.plus(amount);
  upperTick.liquidityGross = upperTick.liquidityGross.plus(amount);
  upperTick.liquidityNet = upperTick.liquidityNet.minus(amount);

  updatePancakeDayData(event);

  updatePoolYearData(event);
  updatePoolMonthData(event);
  updatePoolWeekData(event);
  updatePoolDayData(event);
  updatePoolHourData(event);

  updateTokenDayData(token0, event);
  updateTokenDayData(token1, event);
  updateTokenHourData(token0, event);
  updateTokenHourData(token1, event);

  token0.save();
  token1.save();
  pool.save();
  factory.save();
  mint.save();

  updateTickFeeVarsAndSave(lowerTick, event);
  updateTickFeeVarsAndSave(upperTick, event);
}

export function handleBurn(event: BurnEvent): void {
  let bundle = Bundle.load("1");
  if (bundle == null) {
    bundle = new Bundle("1");
    bundle.ethPriceUSD = ZERO_BD;
  }

  let poolAddress = event.address.toHexString();
  let pool = Pool.load(poolAddress);
  if (pool == null) {
    log.error("Pool not found for address: {}", [poolAddress]);
    return;
  }

  let factory = Factory.load(FACTORY_ADDRESS);
  if (factory == null) {
    factory = new Factory(FACTORY_ADDRESS);
    factory.totalVolumeETH = ZERO_BD;
    factory.totalVolumeUSD = ZERO_BD;
    factory.untrackedVolumeUSD = ZERO_BD;
    factory.totalFeesUSD = ZERO_BD;
    factory.totalFeesETH = ZERO_BD;
    factory.totalProtocolFeesUSD = ZERO_BD;
    factory.totalProtocolFeesETH = ZERO_BD;
    factory.totalValueLockedETH = ZERO_BD;
    factory.totalValueLockedUSD = ZERO_BD;
    factory.totalValueLockedUSDUntracked = ZERO_BD;
    factory.totalValueLockedETHUntracked = ZERO_BD;
    factory.txCount = ZERO_BI;
    factory.owner = ADDRESS_ZERO;
  }

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 == null || token1 == null) {
    log.error("Token0 or Token1 not found for pool: {}", [pool.id]);
    return;
  }

  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);

  let amountUSD = amount0
    .times(token0.derivedETH.times(bundle.ethPriceUSD))
    .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)));

  factory.txCount = factory.txCount.plus(ONE_BI);
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);
  pool.txCount = pool.txCount.plus(ONE_BI);

  let oldPoolTotalValueLockedETH = pool.totalValueLockedETH;
  let oldPoolTVLETHUntracked = pool.totalValueLockedETHUntracked;
  token0.totalValueLocked = token0.totalValueLocked.minus(amount0);
  token1.totalValueLocked = token1.totalValueLocked.minus(amount1);
  pool.totalValueLockedToken0 = pool.totalValueLockedToken0.minus(amount0);
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1.minus(amount1);
  updateDerivedTVLAmounts(pool, factory, token0, token1, oldPoolTotalValueLockedETH, oldPoolTVLETHUntracked);

  if (
    pool.tick !== null &&
    BigInt.fromI32(event.params.tickLower).le(pool.tick as BigInt) &&
    BigInt.fromI32(event.params.tickUpper).gt(pool.tick as BigInt)
  ) {
    pool.liquidity = pool.liquidity.minus(event.params.amount);
  }

  let transaction = loadTransaction(event);
  if (transaction === null) {
    log.warning("Transaction is null for increase liquidity event: {}", [event.transaction.hash.toHexString()]);
    return;
  }
  let burn = new Burn(transaction.id + "#" + pool.txCount.toString());
  burn.transaction = transaction.id;
  burn.timestamp = transaction.timestamp;
  burn.pool = pool.id;
  burn.token0 = pool.token0;
  burn.token1 = pool.token1;
  burn.owner = event.params.owner;
  burn.origin = event.transaction.from;
  burn.amount = event.params.amount;
  burn.amount0 = amount0;
  burn.amount1 = amount1;
  burn.amountUSD = amountUSD;
  burn.tickLower = BigInt.fromI32(event.params.tickLower);
  burn.tickUpper = BigInt.fromI32(event.params.tickUpper);
  burn.logIndex = event.logIndex;

  let lowerTickId = poolAddress + "#" + BigInt.fromI32(event.params.tickLower).toString();
  let upperTickId = poolAddress + "#" + BigInt.fromI32(event.params.tickUpper).toString();
  let lowerTick = Tick.load(lowerTickId);
  let upperTick = Tick.load(upperTickId);
  if (lowerTick == null || upperTick == null) {
    log.error("LowerTick or UpperTick not found for pool: {}", [pool.id]);
    return;
  }

  let amount = event.params.amount;
  lowerTick.liquidityGross = lowerTick.liquidityGross.minus(amount);
  lowerTick.liquidityNet = lowerTick.liquidityNet.minus(amount);
  upperTick.liquidityGross = upperTick.liquidityGross.minus(amount);
  upperTick.liquidityNet = upperTick.liquidityNet.plus(amount);

  updatePancakeDayData(event);

  updatePoolYearData(event);
  updatePoolMonthData(event);
  updatePoolWeekData(event);
  updatePoolDayData(event);
  updatePoolHourData(event);
  updateTokenDayData(token0, event);
  updateTokenDayData(token1, event);
  updateTokenHourData(token0, event);
  updateTokenHourData(token1, event);
  updateTickFeeVarsAndSave(lowerTick, event);
  updateTickFeeVarsAndSave(upperTick, event);

  token0.save();
  token1.save();
  pool.save();
  factory.save();
  burn.save();
}

export function handleSwap(event: SwapEvent): void {
  let bundle = Bundle.load("1");
  let factory = Factory.load(FACTORY_ADDRESS);
  let pool = Pool.load(event.address.toHexString());

  if (bundle === null || factory === null || pool === null) {
    log.warning("Bundle, factory, or pool is null. Bundle: {}, Factory: {}, Pool: {}", [
      bundle ? "not null" : "null",
      factory ? "not null" : "null",
      pool ? "not null" : "null",
    ]);
    return;
  }

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);

  if (token0 === null || token1 === null) {
    log.warning("Token0 or Token1 is null. Token0: {}, Token1: {}", [
      token0 ? "not null" : "null",
      token1 ? "not null" : "null",
    ]);
    return;
  }

  let oldTick = pool.tick;

  if (oldTick === null) {
    log.warning("Old tick is null for pool: {}", [pool.id]);
    return;
  }

  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);
  let protocolFeeAmount0 = convertTokenToDecimal(event.params.protocolFeesToken0, token0.decimals);
  let protocolFeeAmount1 = convertTokenToDecimal(event.params.protocolFeesToken1, token1.decimals);

  log.debug("amount0: {}", [amount0.toString()]);
  log.debug("amount1: {}", [amount1.toString()]);
  log.debug("protocolFeeAmount0: {}", [protocolFeeAmount0.toString()]);
  log.debug("protocolFeeAmount1: {}", [protocolFeeAmount1.toString()]);

  let amount0Abs = amount0.times(BigDecimal.fromString(amount0.lt(ZERO_BD) ? "-1" : "1"));
  let amount1Abs = amount1.times(BigDecimal.fromString(amount1.lt(ZERO_BD) ? "-1" : "1"));

  log.debug("amount0Abs: {}", [amount0Abs.toString()]);
  log.debug("amount1Abs: {}", [amount1Abs.toString()]);

  let volumeAmounts: AmountType = getAdjustedAmounts(amount0Abs, token0, amount1Abs, token1);
  log.debug("volumeAmounts.eth: {}", [volumeAmounts.eth.toString()]);
  log.debug("volumeAmounts.usd: {}", [volumeAmounts.usd.toString()]);
  log.debug("volumeAmounts.usdUntracked: {}", [volumeAmounts.usdUntracked.toString()]);

  if (volumeAmounts.usd.equals(ZERO_BD)) {
    log.warning("Volume amounts USD is zero for transaction: {}", [event.transaction.hash.toHexString()]);
  }

  let volumeETH = volumeAmounts.eth.div(TWO_BD);
  let volumeUSD = volumeAmounts.usd.div(TWO_BD);
  let volumeUSDUntracked = volumeAmounts.usdUntracked.div(TWO_BD);

  log.debug("volumeETH: {}", [volumeETH.toString()]);
  log.debug("volumeUSD: {}", [volumeUSD.toString()]);
  log.debug("volumeUSDUntracked: {}", [volumeUSDUntracked.toString()]);

  let protocolFeeAmounts: AmountType = getAdjustedAmounts(protocolFeeAmount0, token0, protocolFeeAmount1, token1);
  log.debug("protocolFeeAmounts.eth: {}", [protocolFeeAmounts.eth.toString()]);
  log.debug("protocolFeeAmounts.usd: {}", [protocolFeeAmounts.usd.toString()]);

  let feesETH = volumeETH.times(pool.feeTier.toBigDecimal()).div(BigDecimal.fromString("1000000"));
  let feesUSD = volumeUSD.times(pool.feeTier.toBigDecimal()).div(BigDecimal.fromString("1000000"));
  let feesProtocolETH = protocolFeeAmounts.eth;

  log.debug("feesETH: {}", [feesETH.toString()]);
  log.debug("feesUSD: {}", [feesUSD.toString()]);
  log.debug("feesProtocolETH: {}", [feesProtocolETH.toString()]);

  factory.txCount = factory.txCount.plus(ONE_BI);
  factory.totalVolumeETH = factory.totalVolumeETH.plus(volumeETH);
  factory.totalVolumeUSD = factory.totalVolumeUSD.plus(volumeUSD);
  factory.untrackedVolumeUSD = factory.untrackedVolumeUSD.plus(volumeUSDUntracked);
  factory.totalFeesETH = factory.totalFeesETH.plus(feesETH);
  factory.totalFeesUSD = factory.totalFeesUSD.plus(feesUSD);
  factory.totalProtocolFeesETH = factory.totalProtocolFeesETH.plus(feesProtocolETH);
  factory.totalProtocolFeesUSD = factory.totalProtocolFeesUSD.plus(protocolFeeAmounts.usd);

  pool.volumeToken0 = pool.volumeToken0.plus(amount0Abs);
  pool.volumeToken1 = pool.volumeToken1.plus(amount1Abs);
  pool.volumeUSD = pool.volumeUSD.plus(volumeUSD);
  pool.untrackedVolumeUSD = pool.untrackedVolumeUSD.plus(volumeUSDUntracked);
  pool.feesUSD = pool.feesUSD.plus(feesUSD);
  pool.protocolFeesUSD = pool.protocolFeesUSD.plus(protocolFeeAmounts.usd);
  pool.txCount = pool.txCount.plus(ONE_BI);

  pool.liquidity = event.params.liquidity;
  pool.tick = BigInt.fromI32(event.params.tick as i32);
  pool.sqrtPrice = event.params.sqrtPriceX96;

  token0.volume = token0.volume.plus(amount0Abs);
  token0.volumeUSD = token0.volumeUSD.plus(volumeUSD);
  token0.untrackedVolumeUSD = token0.untrackedVolumeUSD.plus(volumeUSDUntracked);
  token0.feesUSD = token0.feesUSD.plus(feesUSD);
  token0.protocolFeesUSD = token0.protocolFeesUSD.plus(protocolFeeAmounts.usd);
  token0.txCount = token0.txCount.plus(ONE_BI);

  token1.volume = token1.volume.plus(amount1Abs);
  token1.volumeUSD = token1.volumeUSD.plus(volumeUSD);
  token1.untrackedVolumeUSD = token1.untrackedVolumeUSD.plus(volumeUSDUntracked);
  token1.feesUSD = token1.feesUSD.plus(feesUSD);
  token1.protocolFeesUSD = token1.protocolFeesUSD.plus(protocolFeeAmounts.usd);
  token1.txCount = token1.txCount.plus(ONE_BI);

  let prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1);
  pool.token0Price = prices[0];
  pool.token1Price = prices[1];
  pool.save();

  bundle.ethPriceUSD = getEthPriceInUSD();
  bundle.save();
  token0.derivedETH = findEthPerToken(token0);
  token1.derivedETH = findEthPerToken(token1);
  token0.derivedUSD = token0.derivedETH.times(bundle.ethPriceUSD);
  token1.derivedUSD = token1.derivedETH.times(bundle.ethPriceUSD);

  let oldPoolTVLETH = pool.totalValueLockedETH;
  let oldPoolTVLETHUntracked = pool.totalValueLockedETHUntracked;
  pool.totalValueLockedToken0 = pool.totalValueLockedToken0.plus(amount0);
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1.plus(amount1);
  token0.totalValueLocked = token0.totalValueLocked.plus(amount0);
  token1.totalValueLocked = token1.totalValueLocked.plus(amount1);
  updateDerivedTVLAmounts(pool, factory, token0, token1, oldPoolTVLETH, oldPoolTVLETHUntracked);

  let transaction = loadTransaction(event);
  let swap = new Swap(transaction.id + "#" + pool.txCount.toString());
  swap.transaction = transaction.id;
  swap.timestamp = transaction.timestamp;
  swap.pool = pool.id;
  swap.token0 = pool.token0;
  swap.token1 = pool.token1;
  swap.sender = event.params.sender;
  swap.origin = event.transaction.from;
  swap.recipient = event.params.recipient;
  swap.amount0 = amount0;
  swap.amount1 = amount1;
  swap.amountUSD = volumeUSD;
  swap.amountFeeUSD = protocolFeeAmounts.usd;
  swap.tick = BigInt.fromI32(event.params.tick as i32);
  swap.sqrtPriceX96 = event.params.sqrtPriceX96;
  swap.logIndex = event.logIndex;

  let poolContract = PoolABI.bind(event.address);
  let feeGrowthGlobal0X128 = poolContract.feeGrowthGlobal0X128();
  let feeGrowthGlobal1X128 = poolContract.feeGrowthGlobal1X128();
  pool.feeGrowthGlobal0X128 = feeGrowthGlobal0X128 as BigInt;
  pool.feeGrowthGlobal1X128 = feeGrowthGlobal1X128 as BigInt;

  let pancakeDayData = updatePancakeDayData(event);

  let poolYearData = updatePoolYearData(event);
  let poolMonthData = updatePoolMonthData(event);
  let poolWeekData = updatePoolWeekData(event);
  let poolDayData = updatePoolDayData(event);
  let poolHourData = updatePoolHourData(event);

  let token0DayData = updateTokenDayData(token0, event);
  let token1DayData = updateTokenDayData(token1, event);
  let token0HourData = updateTokenHourData(token0, event);
  let token1HourData = updateTokenHourData(token1, event);

  pancakeDayData.volumeETH = pancakeDayData.volumeETH.plus(volumeETH);
  pancakeDayData.volumeUSD = pancakeDayData.volumeUSD.plus(volumeUSD);
  pancakeDayData.feesUSD = pancakeDayData.feesUSD.plus(feesUSD);
  pancakeDayData.protocolFeesUSD = pancakeDayData.protocolFeesUSD.plus(protocolFeeAmounts.usd);

  poolYearData.volumeUSD = poolYearData.volumeUSD.plus(volumeUSD);
  poolYearData.volumeToken0 = poolYearData.volumeToken0.plus(amount0Abs);
  poolYearData.volumeToken1 = poolYearData.volumeToken1.plus(amount1Abs);
  poolYearData.feesUSD = poolYearData.feesUSD.plus(feesUSD);
  poolYearData.protocolFeesUSD = poolYearData.protocolFeesUSD.plus(protocolFeeAmounts.usd);

  poolMonthData.volumeUSD = poolMonthData.volumeUSD.plus(volumeUSD);
  poolMonthData.volumeToken0 = poolMonthData.volumeToken0.plus(amount0Abs);
  poolMonthData.volumeToken1 = poolMonthData.volumeToken1.plus(amount1Abs);
  poolMonthData.feesUSD = poolMonthData.feesUSD.plus(feesUSD);
  poolMonthData.protocolFeesUSD = poolMonthData.protocolFeesUSD.plus(protocolFeeAmounts.usd);

  poolWeekData.volumeUSD = poolWeekData.volumeUSD.plus(volumeUSD);
  poolWeekData.volumeToken0 = poolWeekData.volumeToken0.plus(amount0Abs);
  poolWeekData.volumeToken1 = poolWeekData.volumeToken1.plus(amount1Abs);
  poolWeekData.feesUSD = poolWeekData.feesUSD.plus(feesUSD);
  poolWeekData.protocolFeesUSD = poolWeekData.protocolFeesUSD.plus(protocolFeeAmounts.usd);

  poolDayData.volumeUSD = poolDayData.volumeUSD.plus(volumeUSD);
  poolDayData.volumeToken0 = poolDayData.volumeToken0.plus(amount0Abs);
  poolDayData.volumeToken1 = poolDayData.volumeToken1.plus(amount1Abs);
  poolDayData.feesUSD = poolDayData.feesUSD.plus(feesUSD);
  poolDayData.protocolFeesUSD = poolDayData.protocolFeesUSD.plus(protocolFeeAmounts.usd);

  poolHourData.volumeUSD = poolHourData.volumeUSD.plus(volumeUSD);
  poolHourData.volumeToken0 = poolHourData.volumeToken0.plus(amount0Abs);
  poolHourData.volumeToken1 = poolHourData.volumeToken1.plus(amount1Abs);
  poolHourData.feesUSD = poolHourData.feesUSD.plus(feesUSD);
  poolHourData.protocolFeesUSD = poolHourData.protocolFeesUSD.plus(protocolFeeAmounts.usd);

  token0DayData.volume = token0DayData.volume.plus(amount0Abs);
  token0DayData.volumeUSD = token0DayData.volumeUSD.plus(volumeUSD);
  token0DayData.untrackedVolumeUSD = token0DayData.untrackedVolumeUSD.plus(volumeUSDUntracked);
  token0DayData.feesUSD = token0DayData.feesUSD.plus(feesUSD);
  token0DayData.protocolFeesUSD = token0DayData.protocolFeesUSD.plus(protocolFeeAmounts.usd);

  token0HourData.volume = token0HourData.volume.plus(amount0Abs);
  token0HourData.volumeUSD = token0HourData.volumeUSD.plus(volumeUSD);
  token0HourData.untrackedVolumeUSD = token0HourData.untrackedVolumeUSD.plus(volumeUSDUntracked);
  token0HourData.feesUSD = token0HourData.feesUSD.plus(feesUSD);
  token0HourData.protocolFeesUSD = token0HourData.protocolFeesUSD.plus(protocolFeeAmounts.usd);

  token1DayData.volume = token1DayData.volume.plus(amount1Abs);
  token1DayData.volumeUSD = token1DayData.volumeUSD.plus(volumeUSD);
  token1DayData.untrackedVolumeUSD = token1DayData.untrackedVolumeUSD.plus(volumeUSDUntracked);
  token1DayData.feesUSD = token1DayData.feesUSD.plus(feesUSD);
  token1DayData.protocolFeesUSD = token1DayData.protocolFeesUSD.plus(protocolFeeAmounts.usd);

  token1HourData.volume = token1HourData.volume.plus(amount1Abs);
  token1HourData.volumeUSD = token1HourData.volumeUSD.plus(volumeUSD);
  token1HourData.untrackedVolumeUSD = token1HourData.untrackedVolumeUSD.plus(volumeUSDUntracked);
  token1HourData.feesUSD = token1HourData.feesUSD.plus(feesUSD);
  token1HourData.protocolFeesUSD = token1HourData.protocolFeesUSD.plus(protocolFeeAmounts.usd);

  swap.save();
  factory.save();
  pancakeDayData.save();
  pool.save();
  poolDayData.save();
  poolHourData.save();
  token0DayData.save();
  token1DayData.save();
  token0HourData.save();
  token1HourData.save();
  token0.save();
  token1.save();

  let newTick = pool.tick;
  if (newTick === null) {
    log.warning("New tick is null for pool: {}", [pool.id]);
    return;
  }

  let tickSpacing = feeTierToTickSpacing(pool.feeTier);
  let modulo = newTick.mod(tickSpacing);
  if (modulo.equals(ZERO_BI)) {
    loadTickUpdateFeeVarsAndSave(newTick.toI32(), event);
  }

  let numIters = oldTick.minus(newTick).abs().div(tickSpacing);

  if (numIters.gt(BigInt.fromI32(100))) {
    return;
  } else if (newTick.gt(oldTick)) {
    let firstInitialized = oldTick.plus(tickSpacing.minus(modulo));
    for (let i = firstInitialized; i.le(newTick); i = i.plus(tickSpacing)) {
      loadTickUpdateFeeVarsAndSave(i.toI32(), event);
    }
  } else if (newTick.lt(oldTick)) {
    let firstInitialized = oldTick.minus(modulo);
    for (let i = firstInitialized; i.ge(newTick); i = i.minus(tickSpacing)) {
      loadTickUpdateFeeVarsAndSave(i.toI32(), event);
    }
  }
}

export function handleFlash(event: FlashEvent): void {
  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    log.error("Pool not found for address: {}", [event.address.toHexString()]);
    return;
  }

  let poolContract = PoolABI.bind(event.address);
  let feeGrowthGlobal0X128 = poolContract.feeGrowthGlobal0X128();
  let feeGrowthGlobal1X128 = poolContract.feeGrowthGlobal1X128();
  pool.feeGrowthGlobal0X128 = feeGrowthGlobal0X128 as BigInt;
  pool.feeGrowthGlobal1X128 = feeGrowthGlobal1X128 as BigInt;
  pool.save();
}

function updateTickFeeVarsAndSave(tick: Tick, event: ethereum.Event): void {
  let poolAddress = event.address;
  let poolContract = PoolABI.bind(poolAddress);
  let tickResult = poolContract.ticks(tick.tickIdx.toI32());
  tick.feeGrowthOutside0X128 = tickResult.value2;
  tick.feeGrowthOutside1X128 = tickResult.value3;
  tick.save();

  updateTickDayData(tick, event);
}

function loadTickUpdateFeeVarsAndSave(tickId: i32, event: ethereum.Event): void {
  let poolAddress = event.address;
  let tick = Tick.load(poolAddress.toHexString().concat("#").concat(tickId.toString()));
  if (tick !== null) {
    updateTickFeeVarsAndSave(tick, event);
  }
}

export function handleCollect(event: CollectEvent): void {
  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    log.error("Pool not found for address: {}", [event.address.toHexString()]);
    return;
  }

  let factory = Factory.load(FACTORY_ADDRESS);
  if (factory == null) {
    factory = new Factory(FACTORY_ADDRESS);
    factory.totalVolumeETH = ZERO_BD;
    factory.totalVolumeUSD = ZERO_BD;
    factory.untrackedVolumeUSD = ZERO_BD;
    factory.totalFeesUSD = ZERO_BD;
    factory.totalFeesETH = ZERO_BD;
    factory.totalProtocolFeesUSD = ZERO_BD;
    factory.totalProtocolFeesETH = ZERO_BD;
    factory.totalValueLockedETH = ZERO_BD;
    factory.totalValueLockedUSD = ZERO_BD;
    factory.totalValueLockedUSDUntracked = ZERO_BD;
    factory.totalValueLockedETHUntracked = ZERO_BD;
    factory.txCount = ZERO_BI;
    factory.owner = ADDRESS_ZERO;
  }

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 == null || token1 == null) {
    log.error("Token0 or Token1 not found for pool: {}", [pool.id]);
    return;
  }

  let transaction = loadTransaction(event);
  if (transaction === null) {
    log.warning("Transaction is null for increase liquidity event: {}", [event.transaction.hash.toHexString()]);
    return;
  }
  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);
  let amounts: AmountType = getAdjustedAmounts(amount0, token0, amount1, token1);

  pool.collectedFeesToken0 = pool.collectedFeesToken0.plus(amount0);
  pool.collectedFeesToken1 = pool.collectedFeesToken1.plus(amount1);
  pool.collectedFeesUSD = pool.collectedFeesUSD.plus(amounts.usd);

  factory.txCount = factory.txCount.plus(ONE_BI);
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);
  pool.txCount = pool.txCount.plus(ONE_BI);

  let collectID = transaction.id.toString() + "#" + pool.txCount.toString();
  let collect = new Collect(collectID);
  collect.transaction = transaction.id;
  collect.timestamp = event.block.timestamp;
  collect.pool = pool.id;
  collect.owner = event.params.owner;
  collect.amount0 = amount0;
  collect.amount1 = amount1;
  collect.amountUSD = amounts.usd;
  collect.tickLower = BigInt.fromI32(event.params.tickLower);
  collect.tickUpper = BigInt.fromI32(event.params.tickUpper);
  collect.logIndex = event.logIndex;

  token0.save();
  token1.save();
  factory.save();
  pool.save();
  collect.save();
}

export function handleCollectProtocol(event: CollectProtocolEvent): void {
  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    log.error("Pool not found for address: {}", [event.address.toHexString()]);
    return;
  }

  let factory = Factory.load(FACTORY_ADDRESS);
  if (factory == null) {
    factory = new Factory(FACTORY_ADDRESS);
    factory.totalVolumeETH = ZERO_BD;
    factory.totalVolumeUSD = ZERO_BD;
    factory.untrackedVolumeUSD = ZERO_BD;
    factory.totalFeesUSD = ZERO_BD;
    factory.totalFeesETH = ZERO_BD;
    factory.totalProtocolFeesUSD = ZERO_BD;
    factory.totalProtocolFeesETH = ZERO_BD;
    factory.totalValueLockedETH = ZERO_BD;
    factory.totalValueLockedUSD = ZERO_BD;
    factory.totalValueLockedUSDUntracked = ZERO_BD;
    factory.totalValueLockedETHUntracked = ZERO_BD;
    factory.txCount = ZERO_BI;
    factory.owner = ADDRESS_ZERO;
  }

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 == null || token1 == null) {
    log.error("Token0 or Token1 not found for pool: {}", [pool.id]);
    return;
  }

  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);

  let oldPoolTVLETH = pool.totalValueLockedETH;
  let oldPoolTVLETHUntracked = pool.totalValueLockedETHUntracked;
  pool.totalValueLockedToken0 = pool.totalValueLockedToken0.minus(amount0);
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1.minus(amount1);
  token0.totalValueLocked = token0.totalValueLocked.minus(amount0);
  token1.totalValueLocked = token1.totalValueLocked.minus(amount1);
  updateDerivedTVLAmounts(pool, factory, token0, token1, oldPoolTVLETH, oldPoolTVLETHUntracked);

  factory.txCount = factory.txCount.plus(ONE_BI);
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);
  pool.txCount = pool.txCount.plus(ONE_BI);

  token0.save();
  token1.save();
  factory.save();
  pool.save();
}
