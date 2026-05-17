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

    const {
      chain,
      senderSecret,
      receiverAddress,
      amountMode,
      amountInput,
      feeMode,
      sponsorSecret,
      autoRetry,
      retryAttempts,
      retryDelay
    } = body;

    let tries = autoRetry ? parseInt(retryAttempts || 1) : 1;
    let delay = parseInt(retryDelay || 3) * 1000;
    let lastError = null;

    for (let i = 0; i < tries; i++) {
      try {
        if (
          ["ethereum","bsc","polygon","arbitrum","optimism","base"].includes(chain)
        ) {
          const provider = new ethers.JsonRpcProvider(RPCS[chain]);
          const senderWallet = new ethers.Wallet(senderSecret, provider);

          const balance = await provider.getBalance(senderWallet.address);

          let amount = balance;

          if (amountMode === "fixed") {
            amount = ethers.parseEther(amountInput || "0");
          }

          if (amountMode === "threshold") {
            const threshold = ethers.parseEther(amountInput || "0");

            if (balance < threshold) {
              return ok("Threshold not reached");
            }
          }

          const tx = await senderWallet.sendTransaction({
            to: receiverAddress,
            value: amount
          });

          await tx.wait();

          return success(tx.hash);
        }

        if (chain === "tron") {
          const tronWeb = new TronWeb({
            fullHost: RPCS.tron,
            privateKey: senderSecret
          });

          const tx = await tronWeb.trx.sendTransaction(
            receiverAddress,
            1000000
          );

          return success(tx.txid);
        }

      } catch (e) {
        lastError = e.message;

        if (i < tries - 1) {
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    return fail(lastError);

  } catch (e) {
    return fail(e.message);
  }
};

function success(hash) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      txHash: hash
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

function ok(msg) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: false,
      message: msg
    })
  };
}
