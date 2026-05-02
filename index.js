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

// /fund-gas is no longer called by the frontend.
// Kept here only as a safety fallback — can be removed.
app.post('/fund-gas', async (req, res) => {
    res.json({ success: true });
});

// Execute collection after user approves
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