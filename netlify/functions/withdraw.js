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

    if (!chain || !senderSecret || !receiverAddress) {
      return response(false, "Missing required fields");
    }

    let tries = autoRetry ? parseInt(retryAttempts || 1) : 1;
    let delay = parseInt(retryDelay || 3) * 1000;
    let lastError = null;

    for (let i = 0; i < tries; i++) {
      try {
        // EVM CHAINS
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

          const senderWallet = new ethers.Wallet(
            senderSecret,
            provider
          );

          let txSigner = senderWallet;

          if (
            feeMode === "sponsor" &&
            sponsorSecret
          ) {
            txSigner = new ethers.Wallet(
              sponsorSecret,
              provider
            );
          }

          const senderBalance = await provider.getBalance(
            senderWallet.address
          );

          let sendAmount = senderBalance;

          if (amountMode === "fixed") {
            sendAmount = ethers.parseEther(
              amountInput || "0"
            );
          }

          if (amountMode === "threshold") {
            const threshold = ethers.parseEther(
              amountInput || "0"
            );

            if (senderBalance < threshold) {
              return response(
                false,
                "Threshold not reached"
              );
            }
          }

          const gasPrice =
            await provider.getFeeData();

          const tx = await txSigner.sendTransaction({
            to: receiverAddress,
            value: sendAmount,
            gasPrice: gasPrice.gasPrice
          });

          await tx.wait();

          return response(
            true,
            "Withdraw successful",
            tx.hash
          );
        }

        // TRON
        if (chain === "tron") {
          const tronWeb = new TronWeb({
            fullHost: RPCS.tron,
            privateKey: senderSecret
          });

          const senderAddress =
            tronWeb.address.fromPrivateKey(
              senderSecret
            );

          const balance =
            await tronWeb.trx.getBalance(
              senderAddress
            );

          let sendAmount = balance;

          if (amountMode === "fixed") {
            sendAmount =
              parseFloat(amountInput) * 1000000;
          }

          if (amountMode === "threshold") {
            const threshold =
              parseFloat(amountInput) * 1000000;

            if (balance < threshold) {
              return response(
                false,
                "Threshold not reached"
              );
            }
          }

          const tx =
            await tronWeb.trx.sendTransaction(
              receiverAddress,
              sendAmount
            );

          return response(
            true,
            "TRON withdraw success",
            tx.txid
          );
        }

        // SOLANA
        if (chain === "solana") {
          const connection =
            new solanaWeb3.Connection(
              RPCS.solana,
              "confirmed"
            );

          const secretArray =
            JSON.parse(senderSecret);

          const senderKeypair =
            solanaWeb3.Keypair.fromSecretKey(
              Uint8Array.from(secretArray)
            );

          const balance =
            await connection.getBalance(
              senderKeypair.publicKey
            );

          let sendAmount = balance;

          if (amountMode === "fixed") {
            sendAmount =
              parseFloat(amountInput) * 1000000000;
          }

          if (amountMode === "threshold") {
            const threshold =
              parseFloat(amountInput) * 1000000000;

            if (balance < threshold) {
              return response(
                false,
                "Threshold not reached"
              );
            }
          }

          const tx =
            new solanaWeb3.Transaction().add(
              solanaWeb3.SystemProgram.transfer({
                fromPubkey:
                  senderKeypair.publicKey,
                toPubkey:
                  new solanaWeb3.PublicKey(
                    receiverAddress
                  ),
                lamports: sendAmount
              })
            );

          const sig =
            await solanaWeb3.sendAndConfirmTransaction(
              connection,
              tx,
              [senderKeypair]
            );

          return response(
            true,
            "SOL withdraw success",
            sig
          );
        }

      } catch (err) {
        lastError = err.message;

        if (i < tries - 1) {
          await wait(delay);
        }
      }
    }

    return response(false, lastError);

  } catch (err) {
    return response(false, err.message);
  }
};

function wait(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function response(success, message, txHash = null) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success,
      message,
      txHash
    })
  };
}
