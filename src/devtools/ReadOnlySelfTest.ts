import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { GOLDEN } from '../crypto/goldenVectors';
import { CHAINS, getChain } from '../chain-registry/chains';
import { buildAccountTree } from '../multichain/accountTree';
import { getAdapter } from '../chain-adapter/getAdapter';

export type Line = { name: string; ok: boolean; detail: string };

export async function runReadOnlySelfTest(): Promise<Line[]> {
  const out: Line[] = [];
  const ref = await SecureKeyring.importMnemonic(GOLDEN.mnemonic);

  const tree = await buildAccountTree(ref);
  for (const acct of tree) {
    const expected =
      getChain(acct.caip2)!.family === 'evm' ? GOLDEN.evm.expectedAddress : GOLDEN.tron.expectedAddress;
    out.push({ name: `derive ${acct.name}`, ok: acct.address === expected, detail: acct.address });
  }

  // Real balance reads — must resolve (>= 0n). Network errors fail the line.
  for (const config of CHAINS) {
    const adapter = getAdapter(config);
    const addr = tree.find(t => t.caip2 === config.caip2)!.address;
    try {
      const bal = await adapter.getNativeBalance(addr);
      out.push({ name: `balance ${config.name}`, ok: bal >= 0n, detail: `${bal} ${config.nativeSymbol}` });
    } catch (e) {
      out.push({ name: `balance ${config.name}`, ok: false, detail: `ERR ${String(e)}` });
    }
  }

  await SecureKeyring.deleteWallet(ref);
  return out;
}
