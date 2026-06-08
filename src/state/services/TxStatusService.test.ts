import { bus } from '../bus/eventBus';
import { useTxStore } from '../stores/TxStore';
import { TxStatusService } from './TxStatusService';

describe('TxStatusService', () => {
  beforeEach(() => useTxStore.setState({ byHash: { '0xh': { caip2: 'eip155:1', hash: '0xh', summary: 's', status: 'pending' } } }));
  it('marks confirmed and emits tx/confirmed when the poller reports success', async () => {
    const emitted: any[] = [];
    const h = (p: any) => emitted.push(p);
    bus.on('tx/confirmed', h);
    const svc = new TxStatusService(async () => ({ confirmed: true, success: true }));
    await svc.track('eip155:1', '0xh');
    expect(useTxStore.getState().byHash['0xh'].status).toBe('confirmed');
    expect(emitted).toEqual([{ caip2: 'eip155:1', hash: '0xh', success: true }]);
    bus.off('tx/confirmed', h);
  });
});
