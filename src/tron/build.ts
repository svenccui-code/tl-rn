import { TronWeb } from 'tronweb';
import type { Endpoints, TronUnsignedTx } from './types';

// Guard against silent precision loss when converting bigint sun amounts to JS number.
// Values above Number.MAX_SAFE_INTEGER (~9.007e15 sun) cannot be represented exactly.
function toSafeSunNumber(value: bigint): number {
  if (value < 0n) throw new Error(`negative amount: ${value}`);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`amount exceeds MAX_SAFE_INTEGER and cannot be sent safely: ${value}`);
  }
  return Number(value);
}

export function makeTronWeb(rpc: Endpoints): any {
  return new TronWeb({ fullHost: rpc.primary });
}

export async function buildTrxTransfer(
  tw: any,
  from: string,
  to: string,
  amountSun: bigint,
): Promise<TronUnsignedTx> {
  return tw.transactionBuilder.sendTrx(to, toSafeSunNumber(amountSun), from);
}

export async function buildTrc20Transfer(
  tw: any,
  from: string,
  contract: string,
  to: string,
  amount: bigint,
): Promise<TronUnsignedTx> {
  const { transaction } = await tw.transactionBuilder.triggerSmartContract(
    contract,
    'transfer(address,uint256)',
    { feeLimit: 100_000_000, callValue: 0 },
    [{ type: 'address', value: to }, { type: 'uint256', value: amount.toString() }],
    from,
  );
  return transaction;
}

export async function buildFreezeV2(
  tw: any,
  from: string,
  frozenSun: bigint,
  resource: 'ENERGY' | 'BANDWIDTH',
): Promise<TronUnsignedTx> {
  return tw.transactionBuilder.freezeBalanceV2(toSafeSunNumber(frozenSun), resource, from);
}

export interface VoteEntry { srAddress: string; voteCount: number; }
export async function buildVote(
  tw: any,
  from: string,
  votes: VoteEntry[],
): Promise<TronUnsignedTx> {
  const map: Record<string, number> = {};
  for (const v of votes) map[v.srAddress] = v.voteCount;
  return tw.transactionBuilder.vote(map, from);
}
