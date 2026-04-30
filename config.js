export const CHAIN = {
  id: 56,
  hexId: "0x38",
  name: "BNB Smart Chain",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  rpcUrls: ["https://bsc-dataseed.binance.org/"],
  blockExplorerUrls: ["https://bscscan.com"],
};

export const MERCHANT = {
  name: "StablePay Storefront",
  address: "0x3749f9D9Eea2Cb0E5A5f3C10f92Ae39B7Bca9561",
};

export const TOKEN = {
  address: "0x55d398326f99059fF775485246999027B3197955",
  symbol: "USDT",
  displayName: "Tether USD",
};

export const DEFAULT_INVOICE = {
  amount: "1",
  currency: TOKEN.symbol,
  memo: "Order #1048",
};

export function getInvoiceConfig() {
  const params = new URLSearchParams(window.location.search);
  const requestedAmount = params.get("amount")?.trim();
  const requestedMemo = params.get("memo")?.trim();

  return {
    amount: requestedAmount || DEFAULT_INVOICE.amount,
    currency: DEFAULT_INVOICE.currency,
    memo: requestedMemo || DEFAULT_INVOICE.memo,
    fallbackAmount: DEFAULT_INVOICE.amount,
    usesWalletBalance: !requestedAmount,
  };
}

export function shortAddress(address, size = 4) {
  if (!address || address.length < size * 2 + 2) {
    return address || "-";
  }

  return `${address.slice(0, size + 2)}...${address.slice(-size)}`;
}

export function explorerTxUrl(hash) {
  return `${CHAIN.blockExplorerUrls[0]}/tx/${hash}`;
}