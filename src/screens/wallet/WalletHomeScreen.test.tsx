import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useWalletStore } from '../../state/stores/WalletStore';
import { WalletHomeScreen } from './WalletHomeScreen';

describe('WalletHomeScreen', () => {
  it('lists the accounts from WalletStore', () => {
    useWalletStore.setState({
      walletRef: 'r', locked: false,
      accounts: [
        { caip2: 'eip155:1', name: 'Ethereum', address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94', nativeSymbol: 'ETH' },
        { caip2: 'tron:728126428', name: 'TRON', address: 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH', nativeSymbol: 'TRX' },
      ],
    });
    let tree: any;
    ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<WalletHomeScreen navigation={{} as any} route={{ key: 'h', name: 'WalletHome' } as any} />); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Ethereum');
    expect(json).toContain('TRON');
    expect(json).toContain('TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH');
  });

  it('shows an empty state when there are no accounts', () => {
    useWalletStore.setState({ walletRef: undefined, locked: true, accounts: [] });
    let tree: any;
    ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<WalletHomeScreen navigation={{} as any} route={{ key: 'h', name: 'WalletHome' } as any} />); });
    expect(JSON.stringify(tree.toJSON())).toContain('No accounts');
  });
});
