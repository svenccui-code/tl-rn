import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import type { RootStackParamList } from './src/navigation/types';
import { WelcomeScreen } from './src/screens/welcome/WelcomeScreen';
import { EmptyWalletScreen } from './src/screens/wallet/EmptyWalletScreen';
import { CreateWalletScreen } from './src/screens/wallet/CreateWalletScreen';
import { ImportWalletScreen } from './src/screens/wallet/ImportWalletScreen';
import { WalletHomeScreen } from './src/screens/wallet/WalletHomeScreen';
import { DevSelfTestScreen } from './src/screens/dev/DevSelfTestScreen';

enableScreens();
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="EmptyWallet" component={EmptyWalletScreen} />
          <Stack.Screen name="CreateWallet" component={CreateWalletScreen} />
          <Stack.Screen name="ImportWallet" component={ImportWalletScreen} />
          <Stack.Screen name="WalletHome" component={WalletHomeScreen} />
          <Stack.Screen name="DevSelfTest" component={DevSelfTestScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
