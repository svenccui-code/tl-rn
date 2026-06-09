import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { EmptyWalletScreen } from './EmptyWalletScreen';

it('renders the placeholder without crashing', () => {
  let tree: any;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<EmptyWalletScreen navigation={{ navigate: jest.fn() } as any} route={{ key: 'e', name: 'EmptyWallet' } as any} />);
  });
  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain('Create / Import Wallet');
});
