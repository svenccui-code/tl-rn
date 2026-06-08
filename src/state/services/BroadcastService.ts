import { bus } from '../bus/eventBus';
import { useTxStore } from '../stores/TxStore';

// Broadcast fn injected (default wires to the signing adapter at container time).
export class BroadcastService {
  constructor(private broadcastFn: (caip2: string, signedRawTx: string) => Promise<string>) {}
  async send(caip2: string, signedRawTx: string, summary: string): Promise<string> {
    const hash = await this.broadcastFn(caip2, signedRawTx);
    useTxStore.getState().addPending({ caip2, hash, summary });
    bus.emit('tx/submitted', { caip2, hash });
    return hash;
  }
}
