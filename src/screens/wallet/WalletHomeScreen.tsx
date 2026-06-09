import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useWalletStore } from '../../state/stores/WalletStore';

type Props = NativeStackScreenProps<RootStackParamList, 'WalletHome'>;

export function WalletHomeScreen(_props: Props) {
  const accounts = useWalletStore(s => s.accounts);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>My Wallet</Text>
      {accounts.length === 0 ? (
        <Text style={styles.empty}>No accounts</Text>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={a => a.caip2}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.chain}>{item.name}</Text>
              <Text style={styles.addr} numberOfLines={1} ellipsizeMode="middle">{item.address}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', padding: 20, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A212B', marginBottom: 20 },
  empty: { fontSize: 14, color: '#9BA4B6' },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F4F4F7' },
  chain: { fontSize: 15, fontWeight: '600', color: '#1A212B' },
  addr: { fontSize: 13, color: '#9BA4B6', marginTop: 4 },
});
