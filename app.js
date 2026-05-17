const detectBtn = document.getElementById("detectBtn");
const startBtn = document.getElementById("startBtn");
const balancesDiv = document.getElementById("balances");
const logsDiv = document.getElementById("logs");
const assetSelect = document.getElementById("assetSelect");
const sponsorSection = document.getElementById("sponsorSection");

let monitorTimer = null;

document.querySelectorAll('input[name="feeMode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    if (radio.value === "sponsor" && radio.checked) {
      sponsorSection.classList.remove("hidden");
    } else if (radio.value === "sender" && radio.checked) {
      sponsorSection.classList.add("hidden");
    }
  });
});

function addLog(msg) {
  const time = new Date().toLocaleTimeString();
  logsDiv.textContent += `\n[${time}] ${msg}`;
  logsDiv.scrollTop = logsDiv.scrollHeight;
}

async function detectBalance() {
  const chain = document.getElementById("chain").value;
  const senderSecret = document.getElementById("senderSecret").value;

  if (!senderSecret) {
    alert("Enter sender wallet secret");
    return;
  }

  balancesDiv.textContent = "Detecting balances...";
  assetSelect.innerHTML = `<option value="">Loading...</option>`;

  try {
    const res = await fetch("/.netlify/functions/monitor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chain,
        senderSecret
      })
    });

    const data = await res.json();

    if (!data.success) {
      balancesDiv.textContent = data.message || "Detection failed";
      return;
    }

    balancesDiv.textContent = "";

    assetSelect.innerHTML = "";

    data.balances.forEach((item) => {
      balancesDiv.textContent += `${item.symbol}: ${item.balance}\n`;

      const opt = document.createElement("option");
      opt.value = item.symbol;
      opt.textContent = item.symbol;
      assetSelect.appendChild(opt);
    });

    addLog("Balance detected successfully");

  } catch (err) {
    balancesDiv.textContent = "Error detecting balance";
    addLog("Balance detection failed");
  }
}

async function executeWithdraw() {
  const chain = document.getElementById("chain").value;
  const senderSecret = document.getElementById("senderSecret").value;
  const receiverAddress = document.getElementById("receiverAddress").value;
  const amountMode = document.getElementById("amountMode").value;
  const amountInput = document.getElementById("amountInput").value;
  const asset = assetSelect.value;
  const autoRetry = document.getElementById("autoRetry").checked;
  const retryAttempts = document.getElementById("retryAttempts").value;
  const retryDelay = document.getElementById("retryDelay").value;
  const sponsorSecret = document.getElementById("sponsorSecret").value;

  const feeMode = document.querySelector(
    'input[name="feeMode"]:checked'
  ).value;

  if (!senderSecret || !receiverAddress || !asset) {
    addLog("Missing required fields");
    return;
  }

  try {
    const res = await fetch("/.netlify/functions/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chain,
        senderSecret,
        receiverAddress,
        amountMode,
        amountInput,
        asset,
        feeMode,
        sponsorSecret,
        autoRetry,
        retryAttempts,
        retryDelay
      })
    });

    const data = await res.json();

    if (data.success) {
      addLog(`Withdrawal success: ${data.txHash}`);
    } else {
      addLog(`Withdrawal failed: ${data.message}`);
    }

  } catch (err) {
    addLog("Withdraw request error");
  }
}

detectBtn.addEventListener("click", detectBalance);

startBtn.addEventListener("click", () => {
  const interval = parseInt(
    document.getElementById("monitorInterval").value
  ) * 1000;

  if (monitorTimer) {
    clearInterval(monitorTimer);
  }

  addLog("Auto monitoring started");

  executeWithdraw();

  monitorTimer = setInterval(() => {
    executeWithdraw();
  }, interval);
});
