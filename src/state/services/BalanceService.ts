import { getChain } from '../../chain-registry/chains';
import { getAdapter } from '../../chain-adapter/getAdapter';
import type { ReadOnlyChainAdapter } from '../../chain-adapter/types';
import { useAssetsStore } from '../stores/AssetsStore';

// Stateless: reads via adapter, writes AssetsStore. Adapter factory injected for testability.
export class BalanceService {
  constructor(
    private adapterFor: (caip2: string) => ReadOnlyChainAdapter =
      (caip2) => getAdapter(getChain(caip2)!),
  ) {}

  async refreshNative(caip2: string, address: string): Promise<void> {
    const bal = await this.adapterFor(caip2).getNativeBalance(address);
    useAssetsStore.getState().setNativeBalance(caip2, address, bal);
  }
}
