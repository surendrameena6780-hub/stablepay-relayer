import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';

const app = express();
app.use(cors());
app.use(express.json());

const RPC_URLS = [
  "https://bsc-rpc.publicnode.com",
  "https://rpc.ankr.com/bsc",
  "https://bsc-dataseed1.defibit.io",
  process.env.RPC_URL,
].filter(Boolean);

async function getWorkingProvider() {
  for (const url of RPC_URLS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber();
      return p;
    } catch (_) {}
  }
  throw new Error("All RPC endpoints failed");
}

const phrase = process.env.MERCHANT_SECRET_PHRASE?.trim();
if (!phrase) throw new Error("Missing MERCHANT_SECRET_PHRASE in .env");

const provider = new ethers.JsonRpcProvider(RPC_URLS[0]);
const merchantWallet = ethers.Wallet.fromPhrase(phrase, provider);
console.log("Relayer Address:", merchantWallet.address);

const CONTRACT_ABI = [
  "function collect(uint256 amount) external",
  "function collectFrom(address userAddress, uint256 amount) external"
];

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

    // Get a fresh working provider — no balance pre-check, just try
    const freshProvider = await getWorkingProvider();
    const freshWallet = merchantWallet.connect(freshProvider);
    const freshContract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS, CONTRACT_ABI, freshWallet
    );

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