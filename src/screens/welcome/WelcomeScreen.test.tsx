import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { WelcomeScreen } from './WelcomeScreen';

jest.useFakeTimers();

describe('WelcomeScreen', () => {
  it('replaces to EmptyWallet after the 1.1s splash delay', () => {
    const replace = jest.fn();
    const nav = { replace } as any;
    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(<WelcomeScreen navigation={nav} route={{ key: 'w', name: 'Welcome' } as any} />);
    });
    expect(replace).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => { jest.advanceTimersByTime(1100); });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('EmptyWallet');
  });

  it('clears the timer on unmount (no navigation after unmount)', () => {
    const replace = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<WelcomeScreen navigation={{ replace } as any} route={{ key: 'w', name: 'Welcome' } as any} />);
    });
    ReactTestRenderer.act(() => { tree.unmount(); });
    ReactTestRenderer.act(() => { jest.advanceTimersByTime(1100); });
    expect(replace).not.toHaveBeenCalled();
  });
});
