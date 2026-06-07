import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { GOLDEN } from '../crypto/goldenVectors';

export type Line = { name: string; ok: boolean; detail: string };

export async function runBridgeSelfTest(): Promise<Line[]> {
  const out: Line[] = [];
  const ref = await SecureKeyring.importMnemonic(GOLDEN.mnemonic);
  out.push({ name: 'importMnemonic', ok: !!ref && !ref.includes(' '), detail: `ref=${ref.slice(0, 8)}…` });

  const evm = await SecureKeyring.deriveAddress(ref, GOLDEN.evm.coinType);
  out.push({ name: 'EVM address', ok: evm === GOLDEN.evm.expectedAddress, detail: evm });

  const tron = await SecureKeyring.deriveAddress(ref, GOLDEN.tron.coinType);
  out.push({ name: 'TRON address', ok: tron === GOLDEN.tron.expectedAddress, detail: tron });

  const validTron = SecureKeyring.validateAddress(tron, GOLDEN.tron.coinType);
  out.push({ name: 'validateAddress(TRON)', ok: validTron === true, detail: String(validTron) });

  const sig = await SecureKeyring.signHash(ref, GOLDEN.tron.coinType, GOLDEN.signDigestHex);
  out.push({ name: 'signHash(TRON)', ok: sig === GOLDEN.tron.expectedSignatureHex, detail: sig });

  // Contract guard: nothing returned may look like a 12-word mnemonic.
  const leaked = out.some(l => /(\b\w+\b\s){11}\w+/.test(l.detail));
  out.push({ name: 'no-private-key-leak', ok: !leaked, detail: leaked ? 'LEAK!' : 'clean' });

  await SecureKeyring.deleteWallet(ref);
  return out;
}
