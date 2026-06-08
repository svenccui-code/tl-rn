import { encodeFunctionData, type Hex } from 'viem';

const ERC20_BALANCE_OF = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }],
}] as const;

export function erc20BalanceOfData(address: string): string {
  return encodeFunctionData({ abi: ERC20_BALANCE_OF, functionName: 'balanceOf', args: [address as Hex] });
}

export function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}
