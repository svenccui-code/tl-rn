import { tronTxId } from './txId';
import type { TronUnsignedTx } from './types';

// raw_data is built client-side by tronweb from our explicit params, so the contract
// intent is correct by construction. This gate retains the INTEGRITY invariant: the
// txID we are about to sign must equal sha256(raw_data_hex) of the exact bytes built.
// (Closes Phase-3 §5: no node-JSON trust, no hand-rolled protobuf decode.)
export function verifyTronTx(tx: TronUnsignedTx): void {
  if (!tx.raw_data_hex || !tx.txID) throw new Error('malformed tron tx: missing raw_data_hex/txID');
  const local = tronTxId(tx.raw_data_hex);
  if (local !== tx.txID) throw new Error(`txID mismatch: ${tx.txID} != local ${local}`);
}
