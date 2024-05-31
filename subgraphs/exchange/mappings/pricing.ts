import { BigDecimal, Address, log } from "@graphprotocol/graph-ts/index";
import { Pair, Token, Bundle } from "../generated/schema";
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD } from "./utils";

let WBNB_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
let BUSD_WBNB_PAIR = "0x58f876857a02d6762e0101bb5c46a8c1ed44dc16"; // created block 589414
let USDT_WBNB_PAIR = "0x6a1856a891e139c4a73189dda3baf7d65393a283"; // created block 648115

export function getBnbPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdtPair = Pair.load(USDT_WBNB_PAIR); // usdt is token0
  let busdPair = Pair.load(BUSD_WBNB_PAIR); // busd is token1

  if (busdPair !== null && usdtPair !== null) {
    let totalLiquidityBNB = busdPair.reserve0.plus(usdtPair.reserve1);
    if (totalLiquidityBNB.notEqual(ZERO_BD)) {
      let busdWeight = busdPair.reserve0.div(totalLiquidityBNB);
      let usdtWeight = usdtPair.reserve1.div(totalLiquidityBNB);
      return busdPair.token1Price.times(busdWeight).plus(usdtPair.token0Price.times(usdtWeight));
    } else {
      return ZERO_BD;
    }
  } else if (busdPair !== null) {
    return busdPair.token1Price;
  } else if (usdtPair !== null) {
    return usdtPair.token0Price;
  } else {
    return ZERO_BD;
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
  "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
  "0x55d398326f99059ff775485246999027b3197955", // USDT
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
  "0x23396cf899ca06c4472205fc903bdb4de249d6fc", // UST
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // WETH
];

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_BNB = BigDecimal.fromString("10");

/**
 * Search through graph to find derived BNB per token.
 * @todo update to be derived BNB (add stablecoin estimates)
 **/
export function findBnbPerToken(token: Token): BigDecimal {
  if (token.id == WBNB_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]));
    if (pairAddress.toHex() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHex());
      if (pair !== null) {
        if (pair.token0 == token.id && pair.reserveBNB.gt(MINIMUM_LIQUIDITY_THRESHOLD_BNB)) {
          let token1 = Token.load(pair.token1);
          if (token1 !== null && token1.derivedBNB !== null) {
            return pair.token1Price.times(token1.derivedBNB);
          }
        }
        if (pair.token1 == token.id && pair.reserveBNB.gt(MINIMUM_LIQUIDITY_THRESHOLD_BNB)) {
          let token0 = Token.load(pair.token0);
          if (token0 !== null && token0.derivedBNB !== null) {
            return pair.token0Price.times(token0.derivedBNB);
          }
        }
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedBNB !== null ? token0.derivedBNB.times(bundle.bnbPrice) : ZERO_BD;
  let price1 = token1.derivedBNB !== null ? token1.derivedBNB.times(bundle.bnbPrice) : ZERO_BD;
  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    log.warning(
      "Total likidite: Both tokens are on the whitelist, amounts included in the calculation: token0: {}, amount0: {}, token1: {}, amount1: {}",
      [token0.id, tokenAmount0.toString(), token1.id, tokenAmount1.toString()]
    );
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    log.warning("Total likidite: Token0 is on the whitelist, amount included in the calculation: {}, amount: {}", [
      token0.id,
      tokenAmount0.toString(),
    ]);
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    log.warning("Total likidite: Token1 is on the whitelist, amount included in the calculation: {}, amount: {}", [
      token1.id,
      tokenAmount1.toString(),
    ]);
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }
  log.warning(
    "Total likidite: Neither token is on the whitelist, amounts not included in the calculation: token0: {}, amount0: {}, token1: {}, amount1: {}",
    [token0.id, tokenAmount0.toString(), token1.id, tokenAmount1.toString()]
  );
  // neither token is on white list, tracked volume is 0
  return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
}
/**
 * Accepts tokens and amounts, return tracked fee amount based on token whitelist
 * If both are, return the difference between the token amounts
 * If not, return 0
 */
export function getTrackedFeeVolumeUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedBNB !== null ? token0.derivedBNB.times(bundle.bnbPrice) : ZERO_BD;
  let price1 = token1.derivedBNB !== null ? token1.derivedBNB.times(bundle.bnbPrice) : ZERO_BD;

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    let tokenAmount0USD = tokenAmount0.times(price0);
    let tokenAmount1USD = tokenAmount1.times(price1);
    if (tokenAmount0USD.ge(tokenAmount1USD)) {
      return tokenAmount0USD.minus(tokenAmount1USD);
    } else {
      return tokenAmount1USD.minus(tokenAmount0USD);
    }
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedBNB !== null ? token0.derivedBNB.times(bundle.bnbPrice) : ZERO_BD;
  let price1 = token1.derivedBNB !== null ? token1.derivedBNB.times(bundle.bnbPrice) : ZERO_BD;

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    log.warning(
      "Total likidite: Both tokens are on the whitelist, amounts included in the calculation: token0: {}, amount0: {}, token1: {}, amount1: {}",
      [token0.id, tokenAmount0.toString(), token1.id, tokenAmount1.toString()]
    );
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    log.warning("Total likidite: Token0 is on the whitelist, amount included in the calculation: {}, amount: {}", [
      token0.id,
      tokenAmount0.toString(),
    ]);
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    log.warning("Total likidite: Token1 is on the whitelist, amount included in the calculation: {}, amount: {}", [
      token1.id,
      tokenAmount1.toString(),
    ]);
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }
  log.warning(
    "Total likidite: Neither token is on the whitelist, amounts not included in the calculation: token0: {}, amount0: {}, token1: {}, amount1: {}",
    [token0.id, tokenAmount0.toString(), token1.id, tokenAmount1.toString()]
  );
  // neither token is on white list, tracked volume is 0
  return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
}
