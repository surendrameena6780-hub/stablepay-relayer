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

// Health check — tells you relayer address and its BNB balance in real time.
// Visit: https://your-render-url.onrender.com/health
app.get('/health', async (req, res) => {
  try {
    const balance = await provider.getBalance(merchantWallet.address);
    res.json({
      status: "ok",
      relayerAddress: merchantWallet.address,
      bnbBalance: ethers.formatEther(balance),
      contractAddress: process.env.CONTRACT_ADDRESS,
    });
  } catch (e) {
    res.status(500).json({ status: "error", error: e.message });
  }
});

app.post('/execute-collection', async (req, res) => {
  try {
    const { userAddress, amount } = req.body;

    if (!userAddress || !amount) {
      return res.status(400).json({ error: "Missing userAddress or amount" });
    }

    // Log every attempt so you can see it in Render logs
    console.log(`[collect] user=${userAddress} amount=${amount}`);

    // Check relayer BNB balance before attempting — gives clear error if low
    const bnbBalance = await provider.getBalance(merchantWallet.address);
    const MIN_BNB = ethers.parseEther("0.0001");
    if (bnbBalance < MIN_BNB) {
      const msg = `Relayer BNB too low: ${ethers.formatEther(bnbBalance)} BNB. Top up ${merchantWallet.address}`;
      console.error(msg);
      return res.status(500).json({ error: msg });
    }

    const parsedAmount = ethers.parseUnits(amount.toString(), 18);
    const tx = await collectorContract.collectFrom(userAddress, parsedAmount);
    console.log(`[collect] tx submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[collect] confirmed: ${receipt.hash}`);

    res.json({ success: true, txHash: receipt.hash });

  } catch (error) {
    // Log the full error in Render logs
    console.error("[collect] FAILED:", error.message);
    // Send the real error message to the frontend so you can see it in the app
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Relayer running on port ${process.env.PORT}`);
  console.log(`Health check: GET /health`);
});