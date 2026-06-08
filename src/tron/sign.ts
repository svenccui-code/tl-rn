import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import type { TronSignedTx, TronUnsignedTx } from './types';

const TRON_COIN_TYPE = 195;

async function signTxId(txID: string, walletRef: string): Promise<string> {
  const sig = await SecureKeyring.signHash(walletRef, TRON_COIN_TYPE, '0x' + txID);
  return sig.startsWith('0x') ? sig.slice(2) : sig;   // TRON signatures are bare hex
}

export async function signTronTx(tx: TronUnsignedTx, walletRef: string): Promise<TronSignedTx> {
  return { ...tx, signature: [await signTxId(tx.txID, walletRef)] };
}

// Multisig: each permission key signs the same txID; signatures appended in order.
export async function signTronTxMulti(tx: TronUnsignedTx, walletRefs: string[]): Promise<TronSignedTx> {
  const signature: string[] = [];
  for (const ref of walletRefs) signature.push(await signTxId(tx.txID, ref));
  return { ...tx, signature };
}
