import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EmptyWallet'>;

// Placeholder for the future create/import-wallet entry (Android EmptyWalletActivity).
export function EmptyWalletScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Create / Import Wallet</Text>
      <Text style={styles.sub}>coming soon</Text>
      {__DEV__ && (
        <Pressable onPress={() => navigation.navigate('DevSelfTest')} style={styles.devBtn}>
          <Text style={styles.devText}>Dev self-tests →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: '#1A212B' },
  sub: { fontSize: 14, color: '#8A93A6', marginTop: 8 },
  devBtn: { marginTop: 40, paddingVertical: 8, paddingHorizontal: 16 },
  devText: { fontSize: 14, color: '#2F6BFF' },
});
