import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { tronTxId } from './txId';
import type { TronSignedTx, TronUnsignedTx } from './types';

const TRON_COIN_TYPE = 195;

// Always sign the locally-recomputed txID (sha256 of raw_data_hex), NEVER the
// node-provided tx.txID — defense in depth so a tampered tx.txID can never be signed.
async function signLocalTxId(tx: TronUnsignedTx, walletRef: string): Promise<string> {
  const localTxId = tronTxId(tx.raw_data_hex);
  const sig = await SecureKeyring.signHash(walletRef, TRON_COIN_TYPE, '0x' + localTxId);
  return sig.startsWith('0x') ? sig.slice(2) : sig; // TRON signatures are bare hex
}

export async function signTronTx(tx: TronUnsignedTx, walletRef: string): Promise<TronSignedTx> {
  return { ...tx, signature: [await signLocalTxId(tx, walletRef)] };
}

// Multisig: each permission key signs the same locally-recomputed txID; signatures appended in order.
export async function signTronTxMulti(tx: TronUnsignedTx, walletRefs: string[]): Promise<TronSignedTx> {
  const signature: string[] = [];
  for (const ref of walletRefs) signature.push(await signLocalTxId(tx, ref));
  return { ...tx, signature };
}
