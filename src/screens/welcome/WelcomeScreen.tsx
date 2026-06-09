import React, { useEffect } from 'react';
import { View, Image, StatusBar, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

// Matches Android WelcomeActivity: ~1.1s splash, then go to the next screen.
const SPLASH_DELAY_MS = 1100;

export function WelcomeScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('EmptyWallet'), SPLASH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* vertical_bias=0.4 reproduced by a 0.4 : 0.6 top/bottom spacer ratio */}
      <View style={styles.topSpacer} />
      <Image
        source={require('../../../assets/ic_launcher_pic.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.bottomSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center' },
  topSpacer: { flex: 0.4 },
  bottomSpacer: { flex: 0.6 },
  logo: { width: 227, height: 48 }, // 681x144 @3x -> 227x48 dp
});
