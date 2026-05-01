// index.js (Render Backend)
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';

const app = express();
app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const merchantWallet = ethers.Wallet.fromPhrase(process.env.MERCHANT_SECRET_PHRASE.trim(), provider);

// New ABI including the Signature function[cite: 12]
const CONTRACT_ABI = [
  "function collectWithSignature(address user, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
  "function collectFrom(address userAddress, uint256 amount) external"
];
const collectorContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, merchantWallet);

// NEW ENDPOINT: The Gasless Relay[cite: 12]
app.post('/relay-payment', async (req, res) => {
    try {
        const { userAddress, amount, signature, deadline } = req.body;
        
        // Break the signature into parts for the contract[cite: 12]
        const sig = ethers.Signature.from(signature);
        const parsedAmount = ethers.parseUnits(amount.toString(), 18);

        // Your server pays the gas here so the user doesn't have to![cite: 12]
        const tx = await collectorContract.collectWithSignature(
            userAddress,
            parsedAmount,
            deadline,
            sig.v, sig.r, sig.s,
            { gasLimit: 200000 }
        );

        const receipt = await tx.wait();
        res.json({ success: true, txHash: receipt.hash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin App still uses this to collect from approved wallets[cite: 8]
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

app.listen(process.env.PORT, () => console.log("Gasless Relayer is LIVE"));