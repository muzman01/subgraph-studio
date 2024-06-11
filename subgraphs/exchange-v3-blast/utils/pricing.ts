import { ONE_BD, ZERO_BD, ZERO_BI } from "./constants";
import { Bundle, Pool, Token } from "../generated/schema";
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { exponentToBigDecimal, safeDiv } from "./index";

export const WETH_ADDRESS = "0x4200000000000000000000000000000000000023";
export const USDC_WETH_03_POOL = "0xe3fD328d808c7e96d56a3991dfe5B88973d06202";
export const STABLE_IS_TOKEN0 = "true" as string;

// token where amounts should contribute to tracked volume and liquidity
// usually tokens that many tokens are paired with s
export const WHITELIST_TOKENS: string[] = [
  "0x4200000000000000000000000000000000000023", // WBNB
  "0x4200000000000000000000000000000000000022", // USDT
  "0xc4f417f390a39895ba09090a8a43c38dd696b183", // quad
];

export const STABLE_COINS: string[] = [
  "0x4200000000000000000000000000000000000022", // BUSD
];

let MINIMUM_ETH_LOCKED = BigDecimal.fromString("5");
const Q192 = BigInt.fromI32(2).pow(192 as u8);

export function sqrtPriceX96ToTokenPrices(sqrtPriceX96: BigInt, token0: Token, token1: Token): BigDecimal[] {
  let num = sqrtPriceX96.times(sqrtPriceX96).toBigDecimal();
  let denom = BigDecimal.fromString(Q192.toString());
  let price1 = num.div(denom).times(exponentToBigDecimal(token0.decimals)).div(exponentToBigDecimal(token1.decimals));
  let price0 = safeDiv(BigDecimal.fromString("1"), price1);
  return [price0, price1];
}

export function getEthPriceInUSD(
  stablecoinWrappedNativePoolAddress: string = USDC_WETH_03_POOL,
  stablecoinIsToken0: boolean = true // true is stablecoin is token0, false if stablecoin is token1
): BigDecimal {
  const stablecoinWrappedNativePool = Pool.load(stablecoinWrappedNativePoolAddress);

  if (stablecoinWrappedNativePool !== null) {
    log.info("Price Token Tüğrkce", [
      stablecoinWrappedNativePool.token0Price.toString(),
      stablecoinWrappedNativePool.token1Price.toString(),
    ]);
    return stablecoinIsToken0 ? stablecoinWrappedNativePool.token0Price : stablecoinWrappedNativePool.token1Price;
  } else {
    log.error("Pool not found for stablecoinWrappedNativePoolAddress: {}", [stablecoinWrappedNativePoolAddress]);
    return ZERO_BD;
  }
}

export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WETH_ADDRESS) {
    return ONE_BD;
  }
  let whiteList = token.whitelistPools;
  let largestLiquidityETH = ZERO_BD;
  let priceSoFar = ZERO_BD;
  let bundle = Bundle.load("1");

  if (bundle === null) {
    return ZERO_BD;
  }

  if (STABLE_COINS.includes(token.id)) {
    priceSoFar = safeDiv(ONE_BD, bundle.ethPriceUSD);
  } else {
    for (let i = 0; i < whiteList.length; ++i) {
      let poolAddress = whiteList[i];
      let pool = Pool.load(poolAddress);

      if (pool === null || pool.liquidity.equals(ZERO_BI)) {
        continue;
      }

      if (pool.token0 == token.id) {
        let token1 = Token.load(pool.token1);
        if (token1 === null) {
          continue;
        }
        let ethLocked = pool.totalValueLockedToken1.times(token1.derivedETH || ZERO_BD);
        if (
          ethLocked.gt(largestLiquidityETH) &&
          (ethLocked.gt(MINIMUM_ETH_LOCKED) || WHITELIST_TOKENS.includes(pool.token0))
        ) {
          largestLiquidityETH = ethLocked;
          priceSoFar = pool.token1Price.times(token1.derivedETH || ZERO_BD);
        }
      }
      if (pool.token1 == token.id) {
        let token0 = Token.load(pool.token0);
        if (token0 === null) {
          continue;
        }
        let ethLocked = pool.totalValueLockedToken0.times(token0.derivedETH || ZERO_BD);
        if (
          ethLocked.gt(largestLiquidityETH) &&
          (ethLocked.gt(MINIMUM_ETH_LOCKED) || WHITELIST_TOKENS.includes(pool.token1))
        ) {
          largestLiquidityETH = ethLocked;
          priceSoFar = pool.token0Price.times(token0.derivedETH || ZERO_BD);
        }
      }
    }
  }
  return priceSoFar;
}

export function getTrackedAmountUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load("1");
  if (bundle === null) {
    return ZERO_BD;
  }

  let price0USD = token0.derivedETH.times(bundle.ethPriceUSD || ZERO_BD);
  let price1USD = token1.derivedETH.times(bundle.ethPriceUSD || ZERO_BD);

  if (WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD));
  }

  if (WHITELIST_TOKENS.includes(token0.id) && !WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(price0USD).times(BigDecimal.fromString("2"));
  }

  if (!WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount1.times(price1USD).times(BigDecimal.fromString("2"));
  }

  return ZERO_BD;
}

export function getTrackedAmountETH(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let derivedETH0 = token0.derivedETH || ZERO_BD;
  let derivedETH1 = token1.derivedETH || ZERO_BD;

  if (WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(derivedETH0).plus(tokenAmount1.times(derivedETH1));
  }

  if (WHITELIST_TOKENS.includes(token0.id) && !WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(derivedETH0).times(BigDecimal.fromString("2"));
  }

  if (!WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount1.times(derivedETH1).times(BigDecimal.fromString("2"));
  }

  return ZERO_BD;
}

export class AmountType {
  eth: BigDecimal;
  usd: BigDecimal;
  ethUntracked: BigDecimal;
  usdUntracked: BigDecimal;
}

export function getAdjustedAmounts(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): AmountType {
  let derivedETH0 = token0.derivedETH || ZERO_BD;
  let derivedETH1 = token1.derivedETH || ZERO_BD;
  let bundle = Bundle.load("1");

  if (bundle === null) {
    return { eth: ZERO_BD, usd: ZERO_BD, ethUntracked: ZERO_BD, usdUntracked: ZERO_BD };
  }

  let eth = ZERO_BD;
  let ethUntracked = tokenAmount0.times(derivedETH0).plus(tokenAmount1.times(derivedETH1));

  if (WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    eth = ethUntracked;
  }

  if (WHITELIST_TOKENS.includes(token0.id) && !WHITELIST_TOKENS.includes(token1.id)) {
    eth = tokenAmount0.times(derivedETH0).times(BigDecimal.fromString("2"));
  }

  if (!WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    eth = tokenAmount1.times(derivedETH1).times(BigDecimal.fromString("2"));
  }

  let usd = eth.times(bundle.ethPriceUSD || ZERO_BD);
  let usdUntracked = ethUntracked.times(bundle.ethPriceUSD || ZERO_BD);

  return { eth, usd, ethUntracked, usdUntracked };
}
