import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

const LOGO = require('../../../assets/ic_launcher_pic.png');
const ICON_CREATE = require('../../../assets/ic_add_method_create.png');
const ICON_IMPORT = require('../../../assets/ic_add_method_import.png');

type Props = NativeStackScreenProps<RootStackParamList, 'EmptyWallet'>;

// Simplified from Android EmptyWalletActivity: logo + title + subtitle + Create/Import.
export function EmptyWalletScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Well-Rounded TRON Features</Text>
        <Text style={styles.subtitle}>Full support for TRX and all types of Mainnet tokens and functions</Text>
      </View>
      <View style={styles.buttons}>
        <Pressable style={[styles.btn, styles.btnLight]} onPress={() => navigation.navigate('CreateWallet')}>
          <Image source={ICON_CREATE} style={styles.btnIcon} resizeMode="contain" />
          <Text style={styles.btnLightText}>Create Wallet</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnDark]} onPress={() => navigation.navigate('ImportWallet')}>
          <Image source={ICON_IMPORT} style={styles.btnIcon} resizeMode="contain" />
          <Text style={styles.btnDarkText}>Import Wallet</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40 },
  hero: { flex: 1, justifyContent: 'center' },
  logo: { width: 227, height: 48, marginBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1A212B' },
  subtitle: { fontSize: 14, color: '#9BA4B6', marginTop: 10, lineHeight: 20 },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, height: 54, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnLight: { backgroundColor: '#F4F4F7' },
  btnDark: { backgroundColor: '#1A212B' },
  btnIcon: { width: 20, height: 20 },
  btnLightText: { fontSize: 14, fontWeight: 'bold', color: '#1A212B' },
  btnDarkText: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },
});
