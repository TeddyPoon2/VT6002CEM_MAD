import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '@env';

const AUTH_KEY = 'userAuth';

const BACKUP_FREQ_KEY = 'backupFrequency';
const LAST_BACKUP_KEY = 'lastBackup';

const SettingsScreen = () => {
  const [user, setUser] = useState<{ email: string; token: string } | null>(null);
  const [backupFrequency, setBackupFrequency] = useState<string>('manual');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string>('');
  const navigation = useNavigation();

  useEffect(() => {
    // Load auth state and backup settings from AsyncStorage
    const loadAuth = async () => {
      const data = await AsyncStorage.getItem(AUTH_KEY);
      if (data) setUser(JSON.parse(data));
      const freq = await AsyncStorage.getItem(BACKUP_FREQ_KEY);
      if (freq) setBackupFrequency(freq);
      const last = await AsyncStorage.getItem(LAST_BACKUP_KEY);
      if (last) setLastBackup(last);
    };
    loadAuth();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  const handleBackupNow = async () => {
    if (!user) return;
    setBackupStatus('Backing up...');
    try {
      const [expenses, accounts] = await Promise.all([
        AsyncStorage.getItem('expenses'),
        AsyncStorage.getItem('accounts'),
      ]);
      const res = await fetch(`${API_URL}/backup`, {
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
      const data = await res.json();
      if (res.ok && data.success) {
        const now = new Date().toISOString();
        await AsyncStorage.setItem(LAST_BACKUP_KEY, now);
        setLastBackup(now);
        setBackupStatus('Backup successful!');
      } else {
        setBackupStatus('Backup failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err: any) {
      setBackupStatus('Backup failed: ' + (err.message || 'Network error'));
    } finally {
      setTimeout(() => setBackupStatus(''), 3000);
    }
  };

  const handleRestore = async () => {
    if (!user) return;
    setBackupStatus('Restoring...');
    try {
      const res = await fetch(`${API_URL}/restore`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await AsyncStorage.setItem('expenses', JSON.stringify(data.expenses || []));
        await AsyncStorage.setItem('accounts', JSON.stringify(data.accounts || []));
        setBackupStatus('Restore complete!');
        // Optionally update lastBackup
        if (data.updatedAt) {
          await AsyncStorage.setItem(LAST_BACKUP_KEY, data.updatedAt);
          setLastBackup(data.updatedAt);
        }
      } else {
        setBackupStatus('Restore failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err: any) {
      setBackupStatus('Restore failed: ' + (err.message || 'Network error'));
    } finally {
      setTimeout(() => setBackupStatus(''), 3000);
    }
  };


  useEffect(() => {
    AsyncStorage.setItem(BACKUP_FREQ_KEY, backupFrequency);
  }, [backupFrequency]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home' as never)}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Settings</Text>
        <Text style={styles.itemHeader}>Account</Text>
        {user ? (
          <>
            <Text style={styles.status}>Logged in as: {user.email}</Text>
            <TouchableOpacity style={styles.button} onPress={handleLogout}>
              <Text style={styles.buttonText}>Log Out</Text>
            </TouchableOpacity>
          {/* Backup & Sync Section */}
          <View style={{marginTop: 30}}>
            <Text style={styles.itemHeader}>Backup & Sync</Text>
            <Text style={styles.label}>Backup Frequency</Text>
            <View style={styles.frequencyRow}>
              {['manual','daily','weekly','monthly'].map(freq => (
                <TouchableOpacity
                  key={freq}
                  style={[styles.freqButton, backupFrequency === freq && styles.freqButtonSelected]}
                  onPress={() => setBackupFrequency(freq)}
                >
                  <Text style={[styles.freqButtonText, backupFrequency === freq && styles.freqButtonTextSelected]}>{freq.charAt(0).toUpperCase() + freq.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.button} onPress={handleBackupNow}>
              <Text style={styles.buttonText}>Backup Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleRestore}>
              <Text style={styles.buttonText}>Restore Data</Text>
            </TouchableOpacity>
            <Text style={styles.status}>Last Backup: {lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}</Text>
            {backupStatus ? <Text style={styles.status}>{backupStatus}</Text> : null}
          </View>
          </>
        ) : (
          <>
            <Text style={styles.description}>You are not logged in</Text>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login' as never)}>
              <Text style={styles.buttonText}>To Login</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  frequencyRow: {
    flexDirection: 'row',
    marginVertical: 10,
    justifyContent: 'space-around',
  },
  freqButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007BFF',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  freqButtonSelected: {
    backgroundColor: '#007BFF',
  },
  freqButtonText: {
    color: '#007BFF',
    fontWeight: 'bold',
  },
  freqButtonTextSelected: {
    color: '#fff',
  },
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  itemHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  label: {
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  status: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
  },
  backButtonText: {
    color: '#007BFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
});

export default SettingsScreen;
