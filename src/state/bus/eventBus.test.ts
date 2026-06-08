import { bus } from './eventBus';

describe('typed event bus', () => {
  it('delivers a typed event to subscribers', () => {
    const seen: string[] = [];
    const handler = (p: { caip2: string }) => seen.push(p.caip2);
    bus.on('chain/switched', handler);
    bus.emit('chain/switched', { caip2: 'eip155:1' });
    bus.off('chain/switched', handler);
    bus.emit('chain/switched', { caip2: 'eip155:56' });
    expect(seen).toEqual(['eip155:1']);
  });
});
