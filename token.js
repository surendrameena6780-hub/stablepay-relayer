import { Contract, formatUnits } from "https://esm.sh/ethers@6.13.5";

const ERC20_READ_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export async function getAllowance(provider, tokenAddress, ownerAddress, spenderAddress) {
  const token = new Contract(tokenAddress, ERC20_READ_ABI, provider);
  return await token.allowance(ownerAddress, spenderAddress);
}

export async function readTokenState(provider, tokenAddress, ownerAddress) {
  const token = new Contract(tokenAddress, ERC20_READ_ABI, provider);
  const [symbol, decimals, rawBalance] = await Promise.all([
    token.symbol(),
    token.decimals(),
    token.balanceOf(ownerAddress),
  ]);

  return {
    symbol,
    decimals,
    rawBalance,
    formattedBalance: formatUnits(rawBalance, decimals),
  };
}