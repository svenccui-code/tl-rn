import { tronTxId } from './txId';
import type { TronUnsignedTx } from './types';

export interface TronIntent { owner?: string; to?: string; amount?: number | bigint; contract?: string; }

// SECURITY GATE: never sign a node-provided txID without recomputing it locally,
// and never sign without confirming the decoded contract params match the caller's intent.
export function verifyTronTx(tx: TronUnsignedTx, intent: TronIntent): void {
  const recomputed = tronTxId(tx.raw_data_hex);
  if (recomputed !== tx.txID) {
    throw new Error(`txID mismatch: node ${tx.txID} != local ${recomputed}`);
  }
  const value = tx.raw_data?.contract?.[0]?.parameter?.value ?? {};
  if (intent.owner && value.owner_address && value.owner_address !== intent.owner) {
    throw new Error(`intent owner mismatch: ${value.owner_address} != ${intent.owner}`);
  }
  if (intent.to && value.to_address && value.to_address !== intent.to) {
    throw new Error(`intent to mismatch: ${value.to_address} != ${intent.to}`);
  }
  if (intent.amount != null && value.amount != null && BigInt(value.amount) !== BigInt(intent.amount)) {
    throw new Error(`intent amount mismatch: ${value.amount} != ${intent.amount}`);
  }
}
