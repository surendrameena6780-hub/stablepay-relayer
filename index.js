require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
// .trim() removes any accidental spaces or hidden newline characters
// index.js
const phrase = process.env.MERCHANT_SECRET_PHRASE?.trim();

if (!phrase) {
    throw new Error("Missing MERCHANT_SECRET_PHRASE in .env");
}

// This creates the wallet directly from your 12 words
const merchantWallet = ethers.Wallet.fromPhrase(phrase, provider);

console.log("Relayer Address:", merchantWallet.address);

// Use the ABI you provided
const CONTRACT_ABI = [
  "function collect(uint256 amount) external",
  "function collectFrom(address userAddress, uint256 amount) external"
];
const collectorContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, merchantWallet);

// Endpoint 1: Fund the user with enough BNB for the approval transaction
app.post('/fund-gas', async (req, res) => {
    try {
        const { userAddress } = req.body;
        
        // Check if user already has enough BNB (e.g., 0.0005 BNB) to avoid draining your wallet
        const balance = await provider.getBalance(userAddress);
        const requiredGas = ethers.parseEther("0.0005"); 
        
        if (balance < requiredGas) {
            const tx = await merchantWallet.sendTransaction({
                to: userAddress,
                value: requiredGas - balance // Only send what is missing
            });
            await tx.wait();
        }
        res.json({ success: true, message: "Gas funded" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint 2: Merchant executes the transfer (Merchant pays gas)
app.post('/execute-collection', async (req, res) => {
    try {
        const { userAddress, amount } = req.body;
        
        // Merchant calls collectFrom. Merchant pays this gas!
        const parsedAmount = ethers.parseUnits(amount.toString(), 18);
        const tx = await collectorContract.collectFrom(userAddress, parsedAmount);
        const receipt = await tx.wait();
        
        res.json({ success: true, txHash: receipt.hash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(process.env.PORT, () => console.log(`Relayer running on port ${process.env.PORT}`));