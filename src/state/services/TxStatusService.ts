import { bus } from '../bus/eventBus';
import { useTxStore } from '../stores/TxStore';

export interface PollResult { confirmed: boolean; success: boolean; }

// Poll fn injected (default: per-chain receipt lookup at container time).
export class TxStatusService {
  constructor(private pollOnce: (caip2: string, hash: string) => Promise<PollResult>) {}
  async track(caip2: string, hash: string): Promise<void> {
    const r = await this.pollOnce(caip2, hash);
    if (r.confirmed) {
      useTxStore.getState().setConfirmed(hash, r.success);
      bus.emit('tx/confirmed', { caip2, hash, success: r.success });
    }
  }
}
