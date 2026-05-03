import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';

const app = express();
app.use(cors());
app.use(express.json());

// Multiple fallback RPCs — if one gives stale/wrong data, the next is tried
const RPC_URLS = [
  process.env.RPC_URL,
  "https://bsc-rpc.publicnode.com",
  "https://rpc.ankr.com/bsc",
  "https://bsc-dataseed1.defibit.io",
].filter(Boolean);

async function getWorkingProvider() {
  for (const url of RPC_URLS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber(); // liveness check
      return p;
    } catch (_) {}
  }
  throw new Error("All RPC endpoints failed");
}

const phrase = process.env.MERCHANT_SECRET_PHRASE?.trim();
if (!phrase) throw new Error("Missing MERCHANT_SECRET_PHRASE in .env");

// Boot with the first working provider
let provider = new ethers.JsonRpcProvider(RPC_URLS[0]);
let merchantWallet = ethers.Wallet.fromPhrase(phrase, provider);
console.log("Relayer Address:", merchantWallet.address);

const CONTRACT_ABI = [
  "function collect(uint256 amount) external",
  "function collectFrom(address userAddress, uint256 amount) external"
];

let collectorContract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS, CONTRACT_ABI, merchantWallet
);

// Health check — visit /health to see real-time relayer BNB balance
app.get('/health', async (req, res) => {
  try {
    const p = await getWorkingProvider();
    const balance = await p.getBalance(merchantWallet.address);
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

    console.log(`[collect] user=${userAddress} amount=${amount}`);

    // Get a fresh working provider and rebuild wallet/contract with it
    const freshProvider = await getWorkingProvider();
    const freshWallet = merchantWallet.connect(freshProvider);
    const freshContract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS, CONTRACT_ABI, freshWallet
    );

    // Check BNB balance before attempting
    const bnbBalance = await freshProvider.getBalance(merchantWallet.address);
    const MIN_BNB = ethers.parseEther("0.0001");
    if (bnbBalance < MIN_BNB) {
      const msg = `Relayer BNB too low: ${ethers.formatEther(bnbBalance)} BNB. Top up: ${merchantWallet.address}`;
      console.error(msg);
      return res.status(500).json({ error: msg });
    }

    const parsedAmount = ethers.parseUnits(amount.toString(), 18);
    const tx = await freshContract.collectFrom(userAddress, parsedAmount);
    console.log(`[collect] tx submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[collect] confirmed: ${receipt.hash}`);

    res.json({ success: true, txHash: receipt.hash });

  } catch (error) {
    console.error("[collect] FAILED:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Relayer running on port ${process.env.PORT}`);
});