import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { container } from '../../state/container';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportWallet'>;

export function ImportWalletScreen({ navigation }: Props) {
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onImport = async () => {
    const normalized = phrase.trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    setError('');
    setBusy(true);
    try {
      const ref = await container.keyring.importMnemonic(normalized);
      await container.keyring.finalizeWallet(ref);
      navigation.replace('WalletHome');
    } catch {
      setError('Invalid recovery phrase');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Import Wallet</Text>
      <Text style={styles.label}>Recovery phrase</Text>
      <TextInput
        style={styles.input}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Enter your 12-word recovery phrase"
        placeholderTextColor="#9BA4B6"
        value={phrase}
        onChangeText={setPhrase}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.btn, (!phrase || busy) && styles.btnDisabled]}
        disabled={!phrase || busy}
        onPress={onImport}>
        <Text style={styles.btnText}>Import</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', padding: 20, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A212B', marginBottom: 24 },
  label: { fontSize: 14, color: '#1A212B', marginBottom: 8 },
  input: { minHeight: 120, borderWidth: 1, borderColor: '#F4F4F7', borderRadius: 10, padding: 12, fontSize: 16, color: '#1A212B', textAlignVertical: 'top', backgroundColor: '#FAFAFB' },
  error: { color: '#E5494D', fontSize: 13, marginTop: 8 },
  btn: { height: 54, borderRadius: 10, backgroundColor: '#1A212B', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
});
