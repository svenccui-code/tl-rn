import { tronTxId } from './txId';
import type { TronUnsignedTx } from './types';

export interface TronIntent {
  owner: string;            // required: the signer/owner address (base58, visible)
  contractType: string;     // required: e.g. 'TransferContract' | 'TriggerSmartContract' | 'FreezeBalanceV2Contract' | 'VoteWitnessContract'
  to?: string;
  amount?: number | bigint;
}

// SECURITY GATE — must run before signing:
//  1. Recompute txID locally from raw_data_hex (never trust the node's txID).
//  2. Require exactly one contract of the expected type.
//  3. Fail CLOSED: every intent field that is set must be present in the tx AND equal.
//
// KNOWN LIMITATION (documented, deferred — architecture D6): intent fields are
// compared against the node's DECODED raw_data JSON, not against a local protobuf
// decode of raw_data_hex. A fully malicious node could desynchronize raw_data (JSON)
// from raw_data_hex. Mitigations: use a trusted/self-operated node, or add local
// protobuf decoding / raw_data_hex reconstruction (future hardening).
export function verifyTronTx(tx: TronUnsignedTx, intent: TronIntent): void {
  const recomputed = tronTxId(tx.raw_data_hex);
  if (recomputed !== tx.txID) {
    throw new Error(`txID mismatch: node ${tx.txID} != local ${recomputed}`);
  }
  const contracts = tx.raw_data?.contract;
  if (!Array.isArray(contracts) || contracts.length !== 1) {
    throw new Error(`expected exactly 1 contract, got ${contracts?.length ?? 0}`);
  }
  const c0 = contracts[0];
  if (!intent.contractType) throw new Error('intent.contractType is required');
  if (c0?.type !== intent.contractType) {
    throw new Error(`contract type mismatch: ${c0?.type} != ${intent.contractType}`);
  }
  const value = c0?.parameter?.value ?? {};
  // Fail-closed: required owner.
  if (!intent.owner) throw new Error('intent.owner is required');
  if (value.owner_address !== intent.owner) {
    throw new Error(`owner mismatch: ${value.owner_address} != ${intent.owner}`);
  }
  // Fail-closed: if `to` requested, it MUST be present and equal.
  if (intent.to != null) {
    if (value.to_address == null || value.to_address !== intent.to) {
      throw new Error(`to mismatch: ${value.to_address} != ${intent.to}`);
    }
  }
  // Fail-closed: if `amount` requested, it MUST be present and equal.
  if (intent.amount != null) {
    if (value.amount == null || BigInt(value.amount) !== BigInt(intent.amount)) {
      throw new Error(`amount mismatch: ${value.amount} != ${intent.amount}`);
    }
  }
}
