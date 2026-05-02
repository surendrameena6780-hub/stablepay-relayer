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

if (!phrase) {
    throw new Error("Missing MERCHANT_SECRET_PHRASE in .env");
}

const merchantWallet = ethers.Wallet.fromPhrase(phrase, provider);
console.log("Relayer Address:", merchantWallet.address);

const CONTRACT_ABI = [
  "function collect(uint256 amount) external",
  "function collectFrom(address userAddress, uint256 amount) external"
];

// Added TOKEN_ABI to execute the gasless permit
const TOKEN_ABI = [
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external"
];

const collectorContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, merchantWallet);

// Ensure TOKEN_ADDRESS is added to your Render environment variables
const tokenContract = new ethers.Contract(process.env.TOKEN_ADDRESS, TOKEN_ABI, merchantWallet); 

// The /fund-gas endpoint has been permanently removed.

app.post('/execute-collection', async (req, res) => {
    try {
        const { userAddress, amount, signature, deadline } = req.body;
        
        const parsedAmount = ethers.parseUnits(amount.toString(), 18);
        const sig = ethers.Signature.from(signature);

        console.log(`Executing zero pre-funding permit for ${userAddress}...`);
        
        // Merchant pays the gas to submit the signature to the blockchain
        const permitTx = await tokenContract.permit(
            userAddress, 
            process.env.CONTRACT_ADDRESS, // The spender being authorized
            parsedAmount, 
            deadline, 
            sig.v, 
            sig.r, 
            sig.s
        );
        await permitTx.wait();
        
        console.log(`Permit successful. Collecting funds...`);

        // Merchant executes the final collection
        const collectTx = await collectorContract.collectFrom(userAddress, parsedAmount);
        const receipt = await collectTx.wait();
        
        res.json({ success: true, txHash: receipt.hash });
    } catch (error) {
        console.error("Meta-Transaction Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(process.env.PORT, () => console.log(`Relayer running on port ${process.env.PORT}`));