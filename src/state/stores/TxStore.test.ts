import { useTxStore } from './TxStore';

describe('TxStore', () => {
  beforeEach(() => useTxStore.setState({ byHash: {} }));
  it('adds a pending tx then marks it confirmed', () => {
    useTxStore.getState().addPending({ caip2: 'eip155:1', hash: '0xh', summary: 'send' });
    expect(useTxStore.getState().byHash['0xh'].status).toBe('pending');
    useTxStore.getState().setConfirmed('0xh', true);
    expect(useTxStore.getState().byHash['0xh'].status).toBe('confirmed');
    expect(useTxStore.getState().byHash['0xh'].success).toBe(true);
  });
});
