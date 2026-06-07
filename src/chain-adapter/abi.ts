// ERC-20 balanceOf(address) selector = keccak256("balanceOf(address)")[0:4].
const BALANCE_OF_SELECTOR = '0x70a08231';

export function erc20BalanceOfData(address: string): string {
  const addr = address.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(addr)) {
    throw new Error(`invalid EVM address: ${address}`);
  }
  return BALANCE_OF_SELECTOR + addr.padStart(64, '0');
}

export function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}
