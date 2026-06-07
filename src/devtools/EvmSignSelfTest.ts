import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { GOLDEN } from '../crypto/goldenVectors';
import { EVM_GOLDEN } from '../evm/evmGolden';
import { eip1559SigningHash, assembleSignedEip1559 } from '../evm/tx';

export type Line = { name: string; ok: boolean; detail: string };

export async function runEvmSignSelfTest(): Promise<Line[]> {
  const out: Line[] = [];
  const ref = await SecureKeyring.importMnemonic(GOLDEN.mnemonic);
  const hash = eip1559SigningHash(EVM_GOLDEN.tx);
  out.push({ name: 'signing hash', ok: hash === EVM_GOLDEN.signingHash, detail: hash });
  const sig = await SecureKeyring.signHash(ref, 60, hash); // real TWCore signature
  const raw = assembleSignedEip1559(EVM_GOLDEN.tx, sig);
  out.push({ name: 'signed rawTx == ethers golden', ok: raw === EVM_GOLDEN.signedRawTx, detail: raw.slice(0, 28) + '…' });
  await SecureKeyring.deleteWallet(ref);
  return out;
}
