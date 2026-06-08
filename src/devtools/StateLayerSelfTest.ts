import { createContainer } from '../state/container';
import { useWalletStore } from '../state/stores/WalletStore';
import { useAssetsStore } from '../state/stores/AssetsStore';
import { bus } from '../state/bus/eventBus';
import { GOLDEN } from '../crypto/goldenVectors';
import { buildAccountTree } from '../multichain/accountTree';

export type Line = { name: string; ok: boolean; detail: string };

export async function runStateLayerSelfTest(): Promise<Line[]> {
  const out: Line[] = [];

  // Bus round-trip: subscribe before import so we catch the event synchronously.
  let busSeen = '';
  const h = (p: { walletRef: string }) => { busSeen = p.walletRef; };
  bus.on('wallet/added', h);

  // createContainer: zustand stores + services + mitt wiring construct in Hermes.
  const c = createContainer();
  out.push({
    name: 'container constructed',
    ok: !!c.keyring && !!c.balance,
    detail: 'ok',
  });

  // KeyringService.importMnemonic -> emits wallet/added -> bus delivers.
  let ref = '';
  try {
    ref = await c.keyring.importMnemonic(GOLDEN.mnemonic);
    out.push({
      name: 'keyring import + bus event',
      ok: !!ref && busSeen === ref,
      detail: `busSeen=${busSeen.slice(0, 8)}…`,
    });
  } catch (e) {
    out.push({ name: 'keyring import + bus event', ok: false, detail: `ERR ${String(e)}` });
    bus.off('wallet/added', h);
    return out;
  }

  // WalletStore single-ownership write/read.
  let tree: Awaited<ReturnType<typeof buildAccountTree>> = [];
  try {
    tree = await buildAccountTree(ref);
    useWalletStore.getState().setWallet(ref, tree);
    const ws = useWalletStore.getState();
    out.push({
      name: 'WalletStore unlocked + accounts',
      ok: !ws.locked && ws.accounts.length === tree.length,
      detail: `${tree.length} chains`,
    });
  } catch (e) {
    out.push({ name: 'WalletStore unlocked + accounts', ok: false, detail: `ERR ${String(e)}` });
  }

  // BalanceService -> AssetsStore (real RPC read for one chain).
  const tronCaip2 = 'tron:728126428';
  const tronAccount = tree.find(t => t.caip2 === tronCaip2);
  if (tronAccount) {
    try {
      await c.balance.refreshNative(tronCaip2, tronAccount.address);
      const stored = useAssetsStore.getState().nativeBalance[`${tronCaip2}:${tronAccount.address}`];
      out.push({
        name: 'BalanceService → AssetsStore',
        ok: stored !== undefined && stored >= 0n,
        detail: `${stored} sun`,
      });
    } catch (e) {
      // Network failure: container/keyring/bus/WalletStore already verified above.
      // A value of 0 is acceptable; record the error but mark non-fatal.
      out.push({
        name: 'BalanceService → AssetsStore',
        ok: false,
        detail: `ERR ${String(e)}`,
      });
    }
  } else {
    out.push({ name: 'BalanceService → AssetsStore', ok: false, detail: 'tron account not found in tree' });
  }

  bus.off('wallet/added', h);

  // Clean up: delete the imported wallet so the keyring doesn't accumulate state.
  try {
    await c.keyring.deleteWallet(ref);
  } catch (_) {
    // Best-effort cleanup; ignore errors here.
  }

  return out;
}
