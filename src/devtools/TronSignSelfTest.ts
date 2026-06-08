import { TronWeb } from 'tronweb';
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { GOLDEN } from '../crypto/goldenVectors';
import { buildTrxTransfer, makeTronWeb } from '../tron/build';
import { tronTxId } from '../tron/txId';
import type { Endpoints } from '../tron/types';

export type Line = { name: string; ok: boolean; detail: string };

// Nile testnet RPC is used here because the golden mnemonic (all-zeros BIP39) has a zero
// TRX balance on mainnet, and mainnet /wallet/createtransaction validates balance before
// returning a raw_data_hex. Nile skips balance checks, which is appropriate for a
// proof-of-mechanism self-test that never broadcasts. The mechanism under test — derive
// address, build tx, verify txID == sha256(raw_data_hex), sign locally — is
// chain-agnostic; only the RPC host differs.
const NILE_RPC: Endpoints = {
  primary: 'https://nile.trongrid.io',
  fallback: [],
};

// Any non-self address; never broadcast.
const BURN_ADDR = 'TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH';

export async function runTronSignSelfTest(): Promise<Line[]> {
  const out: Line[] = [];
  const ref = await SecureKeyring.importMnemonic(GOLDEN.mnemonic);
  const from = await SecureKeyring.deriveAddress(ref, 195);
  out.push({ name: 'derive TRON', ok: from === GOLDEN.tron.expectedAddress, detail: from });

  // Real, read-only: sendTrx does NOT broadcast or cost anything.
  const tw = makeTronWeb(NILE_RPC);
  const tx = await buildTrxTransfer(tw, from, BURN_ADDR, 1000000n);
  const localTxId = tronTxId(tx.raw_data_hex);
  out.push({ name: 'txID == sha256(raw_data_hex)', ok: localTxId === tx.txID, detail: tx.txID.slice(0, 16) + '…' });

  // tronweb's transactionBuilder returns owner_address as hex (e.g. 41xxxx).
  // Normalise to base58 before comparing with the derived address.
  const ownerRaw = tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address;
  const owner = typeof ownerRaw === 'string' && ownerRaw.startsWith('41')
    ? TronWeb.address.fromHex(ownerRaw)
    : ownerRaw;
  out.push({ name: 'owner_address == golden', ok: owner === from, detail: String(owner) });

  const sig = await SecureKeyring.signHash(ref, 195, '0x' + localTxId); // sign the LOCAL txID
  const bare = sig.startsWith('0x') ? sig.slice(2) : sig;
  out.push({ name: 'signHash 65-byte signature', ok: bare.length === 130, detail: bare.slice(0, 16) + '…' });

  await SecureKeyring.deleteWallet(ref);
  return out; // deliberately NOT broadcast — zero funds at risk.
}
