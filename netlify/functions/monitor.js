const { ethers } = require("ethers");
const TronWeb = require("tronweb");
const solanaWeb3 = require("@solana/web3.js");

const RPCS = {
  ethereum: "https://rpc.ankr.com/eth",
  bsc: "https://rpc.ankr.com/bsc",
  polygon: "https://rpc.ankr.com/polygon",
  arbitrum: "https://rpc.ankr.com/arbitrum",
  optimism: "https://rpc.ankr.com/optimism",
  base: "https://rpc.ankr.com/base",
  tron: "https://api.trongrid.io",
  solana: "https://api.mainnet-beta.solana.com"
};

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { chain, senderSecret } = body;

    if (!chain || !senderSecret) {
      return response(false, "Missing chain or sender secret");
    }

    // EVM chains
    if (
      [
        "ethereum",
        "bsc",
        "polygon",
        "arbitrum",
        "optimism",
        "base"
      ].includes(chain)
    ) {
      const provider = new ethers.JsonRpcProvider(RPCS[chain]);
      const wallet = new ethers.Wallet(senderSecret, provider);

      const nativeBalance = await provider.getBalance(wallet.address);

      const balances = [
        {
          symbol: getNativeSymbol(chain),
          balance: ethers.formatEther(nativeBalance)
        }
      ];

      return response(true, "Balance detected", balances);
    }

    // TRON
    if (chain === "tron") {
      const tronWeb = new TronWeb({
        fullHost: RPCS.tron,
        privateKey: senderSecret
      });

      const address = tronWeb.address.fromPrivateKey(senderSecret);

      const trxBalance = await tronWeb.trx.getBalance(address);

      return response(true, "Balance detected", [
        {
          symbol: "TRX",
          balance: trxBalance / 1000000
        }
      ]);
    }

    // SOLANA
    if (chain === "solana") {
      const connection = new solanaWeb3.Connection(
        RPCS.solana,
        "confirmed"
      );

      const secretArray = JSON.parse(senderSecret);

      const keypair = solanaWeb3.Keypair.fromSecretKey(
        Uint8Array.from(secretArray)
      );

      const balance = await connection.getBalance(
        keypair.publicKey
      );

      return response(true, "Balance detected", [
        {
          symbol: "SOL",
          balance: balance / 1000000000
        }
      ]);
    }

    return response(false, "Unsupported chain");

  } catch (err) {
    return response(false, err.message);
  }
};

function response(success, message, balances = []) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success,
      message,
      balances
    })
  };
}

function getNativeSymbol(chain) {
  const map = {
    ethereum: "ETH",
    bsc: "BNB",
    polygon: "MATIC",
    arbitrum: "ETH",
    optimism: "ETH",
    base: "ETH"
  };

  return map[chain] || "NATIVE";
}
