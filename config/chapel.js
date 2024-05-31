/**
 * @type import('./config').NetworkConfig
 */
module.exports = {
  network: "chapel",
  wNativeAddress: "0xae13d989dac2f0debff460ac112a837c89baa7cd",
  v3: {
    wNativeStablePoolAddress: "0x5147173e452ae4dd23dcee7baaaaab7318f16f6b",
    stableIsToken0: true,
    factoryAddress: "0x4E49Fc142252fFa5826E36AfeBbB17df91cC2d12",
    startBlock: 35491755,
    stableCoins: [
      "0x828e3fc56dd48e072e3b6f3c4fd4ddb4733c2c5e",
      "0x0fb5d7c73fa349a90392f873a4fa1ecf6a3d0a96",
      "0xab1a4d4f1d656d2450692d237fdd6c7f9146e814",
    ],
    whitelistAddresses: [
      "0xae13d989dac2f0debff460ac112a837c89baa7cd",
      "0x828e3fc56dd48e072e3b6f3c4fd4ddb4733c2c5e",
      "0xc1ed9955c11585f47d0d6bfbc29034349a746a81",
      "0x0fb5d7c73fa349a90392f873a4fa1ecf6a3d0a96",
      "0xab1a4d4f1d656d2450692d237fdd6c7f9146e814",
    ],
    nonfungiblePositionManagerAddress: "0x1073b0B36f72f149a3031A704835D595D0421a83",
    nonfungiblePositionManagerStartBlock: 35491773,
    minETHLocked: 60,
  },
  masterChefV3: {
    masterChefAddress: "0x600341c87c58cc4d20cB60b6Db287553e9399d94",
    startBlock: 35491802,
  },
};
