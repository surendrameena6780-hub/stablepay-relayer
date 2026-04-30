import { BrowserProvider } from "https://esm.sh/ethers@6.13.5";
import { CHAIN } from "./config.js";

function getInjectedEthereum() {
  if (typeof window === "undefined") {
    return null;
  }
  if (window.ethereum) {
    return window.ethereum;
  }
  return null;
}

export function hasInjectedWallet() {
  return Boolean(getInjectedEthereum());
}

export function createBrowserProvider() {
  const ethereum = getInjectedEthereum();
  if (!ethereum) {
    throw new Error("No injected wallet detected. Open this page inside Trust Wallet or another wallet browser.");
  }
  return new BrowserProvider(ethereum);
}

export async function connectWallet() {
  const ethereum = getInjectedEthereum();

  if (!ethereum) {
    throw new Error("Trust Wallet was not detected. Open the site inside the Trust Wallet dApp browser.");
  }

  // FIXED: Force BNB Chain BEFORE requesting accounts
  // This prevents the wallet from defaulting to Ethereum
  await ensureBnbChain();

  const accounts = await ethereum.request({ method: "eth_requestAccounts" });

  if (!accounts?.length) {
    throw new Error("No wallet account was returned by the provider.");
  }

  return accounts[0];
}

export async function getCurrentAccount() {
  const ethereum = getInjectedEthereum();
  if (!ethereum) {
    return null;
  }
  const accounts = await ethereum.request({ method: "eth_accounts" });
  return accounts?.[0] ?? null;
}

export async function getCurrentChainId() {
  const provider = createBrowserProvider();
  const network = await provider.getNetwork();
  return Number(network.chainId);
}

export async function ensureBnbChain() {
  const ethereum = getInjectedEthereum();

  if (!ethereum) {
    throw new Error("No injected wallet detected.");
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN.hexId }],
    });
  } catch (error) {
    if (error?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN.hexId,
            chainName: CHAIN.name,
            nativeCurrency: CHAIN.nativeCurrency,
            rpcUrls: CHAIN.rpcUrls,
            blockExplorerUrls: CHAIN.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

export function onWalletEvent(eventName, handler) {
  const ethereum = getInjectedEthereum();
  if (!ethereum?.on) {
    return () => {};
  }
  ethereum.on(eventName, handler);
  return () => ethereum.removeListener?.(eventName, handler);
}