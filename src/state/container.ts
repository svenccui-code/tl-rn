import { KeyringService } from './services/KeyringService';
import { BalanceService } from './services/BalanceService';
import { BroadcastService } from './services/BroadcastService';
import { TxStatusService, PollResult } from './services/TxStatusService';
import { bus } from './bus/eventBus';

export interface ContainerDeps {
  broadcastFn?: (caip2: string, signedRawTx: string) => Promise<string>;
  pollOnce?: (caip2: string, hash: string) => Promise<PollResult>;
}

// DI assembly (the lightweight "Engine init"): construct stateless services, inject deps,
// wire cross-domain bus subscriptions. Defaults wire to real adapters; tests inject fakes.
export function createContainer(deps: ContainerDeps = {}) {
  const keyring = new KeyringService();
  const balance = new BalanceService();
  const broadcast = new BroadcastService(
    deps.broadcastFn ??
      (async (caip2, raw) => {
        const { getSigningAdapter } = await import('../chain-adapter/EvmSigningAdapter');
        const { getChain } = await import('../chain-registry/chains');
        return getSigningAdapter(getChain(caip2)!).broadcast(raw);
      }),
  );
  // Real per-chain receipt polling is a follow-up; default is a safe no-op (never fakes a confirmation).
  const txStatus = new TxStatusService(
    deps.pollOnce ?? (async () => ({ confirmed: false, success: false })),
  );

  // Cross-domain wiring: after a tx is submitted, start tracking its confirmation.
  bus.on('tx/submitted', ({ caip2, hash }) => {
    void txStatus.track(caip2, hash);
  });

  return { keyring, balance, broadcast, txStatus };
}

// App-wide singleton, constructed once at module load. Screens import this.
export const container = createContainer();
