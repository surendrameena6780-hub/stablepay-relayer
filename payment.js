import { Contract, parseUnits } from "https://esm.sh/ethers@6.13.5";
import { getAllowance } from "./token.js";

// Cleaned URL - ensured no trailing spaces or hidden characters
const BACKEND_URL = "https://stablepay-relayer.onrender.com";
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function collect(uint256 amount) external"
];

export function validateInvoiceAmount(amount) {
  if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new Error("Invalid amount.");
  }
}

export async function approveToken({ signer, tokenAddress, spender, amount, decimals }) {
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  const parsedAmount = parseUnits(amount.toString(), decimals);
  return await token.approve(spender, parsedAmount);
}

export async function sendTokenPayment({ signer, tokenAddress, recipient, amount, decimals }) {
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  const parsedAmount = parseUnits(amount.toString(), decimals);
  return await token.transfer(recipient, parsedAmount);
}

export async function handlePaymentSubmission(amount, paymentRequest = {}) {
  try {
    if (!paymentRequest.signer || !paymentRequest.signer.address) {
      throw new Error("Wallet not connected correctly.");
    }

    const parsedAmount = parseUnits(amount.toString(), paymentRequest.decimals || 18);

    const currentAllowance = await getAllowance(
      paymentRequest.signer.provider,
      paymentRequest.tokenAddress,
      paymentRequest.signer.address,
      paymentRequest.recipient
    );

    if (currentAllowance < parsedAmount) {
      console.log("New User: Requesting gas from backend for:", paymentRequest.signer.address);
      
      const fundResponse = await fetch(`${BACKEND_URL}/fund-gas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: paymentRequest.signer.address })
      });

      if (!fundResponse.ok) {
        // Handle cases where backend sends non-JSON error pages
        const errorText = await fundResponse.text();
        let errorMessage = fundResponse.statusText;
        try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
        } catch (e) {
            errorMessage = "Backend connection error. Please try again later.";
        }
        throw new Error(`Gas funding failed: ${errorMessage}`);
      }

      console.log("Gas funded successfully. Triggering Approval...");
      
      const token = new Contract(paymentRequest.tokenAddress, ERC20_ABI, paymentRequest.signer);
      const approveTx = await token.approve(paymentRequest.recipient, parseUnits("999999999", 18));
      await approveTx.wait();
    } 

    console.log("Approval secured. Merchant executing collection...");

    const response = await fetch(`${BACKEND_URL}/execute-collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            userAddress: paymentRequest.signer.address,
            amount: amount.toString()
        })
    });

    if (!response.ok) {
       throw new Error("Collection request failed. Check backend logs.");
    }

    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Backend collection failed");

    return {
        status: 1,
        hash: result.txHash,
        wait: async () => ({ status: 1, hash: result.txHash })
    };

  } catch (error) {
    console.error("Relayer System Error:", error);
    if (error.code === "ACTION_REJECTED") {
        throw new Error("Transaction was cancelled in the wallet.");
    }
    throw error;
  }
}