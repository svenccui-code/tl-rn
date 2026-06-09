import { container } from '../state/container';
import { useWalletStore } from '../state/stores/WalletStore';
import { GOLDEN } from '../crypto/goldenVectors';

export type Line = { name: string; ok: boolean; detail: string };

export async function runOnboardingSelfTest(): Promise<Line[]> {
  const out: Line[] = [];
  // createWallet: fresh 12-word mnemonic + a usable wallet (derivable addresses)
  const created = await container.keyring.createWallet();
  const words = created.mnemonic.trim().split(/\s+/);
  out.push({ name: 'createWallet 12 words', ok: words.length === 12, detail: `${words.length} words` });
  await container.keyring.finalizeWallet(created.walletRef);
  const createdTron = useWalletStore.getState().accounts.find(a => a.caip2 === 'tron:728126428')?.address ?? '';
  out.push({ name: 'created wallet derives TRON addr', ok: createdTron.startsWith('T') && createdTron.length === 34, detail: createdTron });
  // import the golden mnemonic -> WalletStore shows the golden addresses
  const ref = await container.keyring.importMnemonic(GOLDEN.mnemonic);
  await container.keyring.finalizeWallet(ref);
  const accts = useWalletStore.getState().accounts;
  const evm = accts.find(a => a.caip2 === 'eip155:1')?.address;
  const tron = accts.find(a => a.caip2 === 'tron:728126428')?.address;
  out.push({ name: 'import golden -> EVM', ok: evm === GOLDEN.evm.expectedAddress, detail: String(evm) });
  out.push({ name: 'import golden -> TRON', ok: tron === GOLDEN.tron.expectedAddress, detail: String(tron) });
  return out;
}
