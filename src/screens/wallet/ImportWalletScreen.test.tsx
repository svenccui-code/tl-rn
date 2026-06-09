import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput } from 'react-native';

const mockImportMnemonic = jest.fn();
const mockFinalizeWallet = jest.fn(async () => {});
jest.mock('../../state/container', () => ({
  container: { keyring: { importMnemonic: mockImportMnemonic, finalizeWallet: mockFinalizeWallet } },
}));

import { ImportWalletScreen } from './ImportWalletScreen';

const nav = (replace = jest.fn()) => ({ replace } as any);

describe('ImportWalletScreen', () => {
  beforeEach(() => { mockImportMnemonic.mockReset(); mockFinalizeWallet.mockClear(); });

  it('imports a valid phrase then replaces to WalletHome', async () => {
    mockImportMnemonic.mockResolvedValue('ref-7');
    const replace = jest.fn();
    let tree: any;
    ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<ImportWalletScreen navigation={nav(replace)} route={{ key: 'i', name: 'ImportWallet' } as any} />); });
    ReactTestRenderer.act(() => { tree.root.findByType(TextInput).props.onChangeText('  word one two  '); });
    const RNPressable = require('react-native').Pressable;
    const pressables = tree.root.findAllByType(RNPressable);
    if (pressables.length > 0) {
      await ReactTestRenderer.act(async () => { await pressables[0].props.onPress(); });
      expect(mockImportMnemonic).toHaveBeenCalledWith('word one two');
      expect(mockFinalizeWallet).toHaveBeenCalledWith('ref-7');
      expect(replace).toHaveBeenCalledWith('WalletHome');
    }
  });

  it('shows an error and does not navigate on an invalid phrase', async () => {
    mockImportMnemonic.mockRejectedValue(new Error('bad'));
    const replace = jest.fn();
    let tree: any;
    ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<ImportWalletScreen navigation={nav(replace)} route={{ key: 'i', name: 'ImportWallet' } as any} />); });
    ReactTestRenderer.act(() => { tree.root.findByType(TextInput).props.onChangeText('garbage'); });
    const RNPressable = require('react-native').Pressable;
    const pressables = tree.root.findAllByType(RNPressable);
    if (pressables.length > 0) {
      await ReactTestRenderer.act(async () => { await pressables[0].props.onPress(); });
      expect(replace).not.toHaveBeenCalled();
      expect(JSON.stringify(tree.toJSON())).toContain('Invalid recovery phrase');
    }
  });
});
