import { bus } from '../bus/eventBus';
import { useTxStore } from '../stores/TxStore';
import { BroadcastService } from './BroadcastService';

describe('BroadcastService', () => {
  beforeEach(() => useTxStore.setState({ byHash: {} }));
  it('broadcasts via injected fn, records pending tx, emits tx/submitted', async () => {
    const emitted: any[] = [];
    const h = (p: any) => emitted.push(p);
    bus.on('tx/submitted', h);
    const svc = new BroadcastService(async () => '0xhash');
    const hash = await svc.send('eip155:1', '0xsignedraw', 'send 1 ETH');
    expect(hash).toBe('0xhash');
    expect(useTxStore.getState().byHash['0xhash'].status).toBe('pending');
    expect(emitted).toEqual([{ caip2: 'eip155:1', hash: '0xhash' }]);
    bus.off('tx/submitted', h);
  });
});
