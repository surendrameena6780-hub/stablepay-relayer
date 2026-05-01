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

// Updated ABI for your new Gasless Hub
const CONTRACT_ABI = [
  "function collectWithSignature(address user, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
  "function collectFrom(address userAddress, uint256 amount) external"
];
const collectorContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, merchantWallet);

// 100% GASLESS RELAY: User signs for free, Server pays gas
app.post('/relay-payment', async (req, res) => {
    try {
        const { userAddress, amount, signature, deadline } = req.body;
        
        // Break signature into v, r, s components for the contract
        const sig = ethers.Signature.from(signature);
        const parsedAmount = ethers.parseUnits(amount.toString(), 18);

        console.log(`Executing gasless relay for: ${userAddress}`);

        // Your server pays the BNB gas here!
        const tx = await collectorContract.collectWithSignature(
            userAddress,
            parsedAmount,
            deadline,
            sig.v, sig.r, sig.s,
            { 
              gasLimit: 350000, // Increased to prevent revert during complex execution
              gasPrice: (await provider.getFeeData()).gasPrice 
            }
        );

        const receipt = await tx.wait();
        console.log("Success! Hash:", receipt.hash);
        res.json({ success: true, txHash: receipt.hash });
    } catch (error) {
        console.error("Relay Error (Revert):", error.message);
        // If it reverts, it's usually because the user hasn't approved the contract[cite: 8]
        res.status(500).json({ error: error.message });
    }
});

// Admin App logic preserved
app.post('/execute-collection', async (req, res) => {
    try {
        const { userAddress, amount } = req.body;
        const parsedAmount = ethers.parseUnits(amount.toString(), 18);
        const tx = await collectorContract.collectFrom(userAddress, parsedAmount, { gasLimit: 200000 });
        const receipt = await tx.wait();
        res.json({ success: true, txHash: receipt.hash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(process.env.PORT, () => console.log("Gasless Relayer LIVE"));