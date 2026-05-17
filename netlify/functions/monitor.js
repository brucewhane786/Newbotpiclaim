const { ethers } = require("ethers");
const TronWeb = require("tronweb");

const RPCS = {
  ethereum: "https://rpc.ankr.com/eth",
  bsc: "https://rpc.ankr.com/bsc",
  polygon: "https://rpc.ankr.com/polygon",
  arbitrum: "https://rpc.ankr.com/arbitrum",
  optimism: "https://rpc.ankr.com/optimism",
  base: "https://rpc.ankr.com/base",
  tron: "https://api.trongrid.io"
};

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { chain, senderSecret } = body;

    if (
      ["ethereum","bsc","polygon","arbitrum","optimism","base"].includes(chain)
    ) {
      const provider = new ethers.JsonRpcProvider(RPCS[chain]);
      const wallet = new ethers.Wallet(senderSecret, provider);
      const bal = await provider.getBalance(wallet.address);

      return ok([
        {
          symbol: getSymbol(chain),
          balance: ethers.formatEther(bal)
        }
      ]);
    }

    if (chain === "tron") {
      const tronWeb = new TronWeb({
        fullHost: RPCS.tron,
        privateKey: senderSecret
      });

      const addr = tronWeb.address.fromPrivateKey(senderSecret);
      const bal = await tronWeb.trx.getBalance(addr);

      return ok([
        {
          symbol: "TRX",
          balance: bal / 1000000
        }
      ]);
    }

    return fail("Unsupported chain");

  } catch (e) {
    return fail(e.message);
  }
};

function ok(balances) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      balances
    })
  };
}

function fail(msg) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: false,
      message: msg
    })
  };
}

function getSymbol(chain) {
  return {
    ethereum: "ETH",
    bsc: "BNB",
    polygon: "MATIC",
    arbitrum: "ETH",
    optimism: "ETH",
    base: "ETH"
  }[chain];
}
