import { createContainer } from './container';
import { bus } from './bus/eventBus';
import { useTxStore } from './stores/TxStore';

describe('createContainer', () => {
  it('constructs services and wires tx/submitted -> TxStatusService.track', async () => {
    const c = createContainer({
      broadcastFn: async () => '0xhash',
      pollOnce: async () => ({ confirmed: true, success: true }),
    });
    expect(c.keyring).toBeDefined();
    expect(c.balance).toBeDefined();
    expect(c.broadcast).toBeDefined();
    expect(c.txStatus).toBeDefined();
    useTxStore.setState({ byHash: { '0xhash': { caip2: 'eip155:1', hash: '0xhash', summary: 's', status: 'pending' } } });
    bus.emit('tx/submitted', { caip2: 'eip155:1', hash: '0xhash' });
    await new Promise((r) => setTimeout(r, 0));
    expect(useTxStore.getState().byHash['0xhash'].status).toBe('confirmed');
  });
});
