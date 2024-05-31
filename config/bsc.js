/**
 * @type import('./config').NetworkConfig
 */
module.exports = {
  network: "bsc",
  wNativeAddress: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  v3: {
    // WBNB-USDT 500
    wNativeStablePoolAddress: "0x2d774731d831cc3c6a1000fd8f4cefdcd256f955",
    stableIsToken0: true,
    factoryAddress: "0x009c4ef7c0e0dd6bd1ea28417c01ea16341367c3",
    startBlock: 34184408,
    stableCoins: [
      "0x55d398326f99059ff775485246999027b3197955", // USDT
      "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
      "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
    ],
    whitelistAddresses: [
      "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
      "0x55d398326f99059ff775485246999027b3197955", // USDT
      "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
      "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
      "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
      "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // WETH
      "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // CAKE
    ],
    nonfungiblePositionManagerAddress: "0x4f0ece46362310ae93aee49c3713e77455eda1b8",
    nonfungiblePositionManagerStartBlock: 34184421,
    minETHLocked: 10,
  },
  masterChefV3: {
    masterChefAddress: "0x44ec8143eb368cabb00c4eff085af276260202b5",
    startBlock: 34184441,
  },
};
