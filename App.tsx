import React from 'react';
import { StyleSheet, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './screens/HomeScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@env';
import SettingsScreen from './screens/SettingsScreen';
import LoginScreen from './screens/LoginScreen';
import SummaryScreen from './screens/SummaryScreen';

const Stack = createStackNavigator();

const AUTH_KEY = 'userAuth';
const BACKUP_FREQ_KEY = 'backupFrequency';
const LAST_BACKUP_KEY = 'lastBackup';

export default function App() {
  // Auto-backup on app open
  React.useEffect(() => {
    const checkAndBackup = async () => {
      try {
        const [userData, freq, last] = await Promise.all([
          AsyncStorage.getItem(AUTH_KEY),
          AsyncStorage.getItem(BACKUP_FREQ_KEY),
          AsyncStorage.getItem(LAST_BACKUP_KEY),
        ]);
        if (!userData || !freq || freq === 'manual') return;
        const user = JSON.parse(userData);
        // determine if backup due
        const now = Date.now();
        let due = false;
        if (!last) {
          due = true;
        } else {
          const lastTime = new Date(last).getTime();
          const diff = now - lastTime;
          const day = 24 * 60 * 60 * 1000;
          if (freq === 'daily' && diff >= day) due = true;
          if (freq === 'weekly' && diff >= 7 * day) due = true;
          if (freq === 'monthly' && diff >= 30 * day) due = true;
        }
        if (!due) return;
        const [expenses, accounts] = await Promise.all([
          AsyncStorage.getItem('expenses'),
          AsyncStorage.getItem('accounts'),
        ]);
        await fetch(`${API_URL}/backup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            expenses: expenses ? JSON.parse(expenses) : [],
            accounts: accounts ? JSON.parse(accounts) : [],
          }),
        });
        await AsyncStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
        Alert.alert('Backup successful!');
      } catch (err) {
        Alert.alert('Backup failed', 'Failed to backup. Please try again later.');
      }
    };
    checkAndBackup();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Summary" component={SummaryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
