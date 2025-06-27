import React, { useEffect, useState } from 'react';
import { Image } from 'react-native'; // For weather icon
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, RefreshControl, Modal, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticateBiometric } from '../utils/biometric';
import { useNavigation } from '@react-navigation/native';
import ShowModal from './ShowModal';
import { getExpenses, saveExpenses, getAccounts, saveAccounts } from './storage';
import { Account, Expense } from '../types';
import Entypo from '@expo/vector-icons/Entypo';
import * as Location from 'expo-location';
import { WEATHER_API_KEY } from '@env';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'expense' | 'account'; id: string } | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'expense' | 'account'>("expense");
  const [editItem, setEditItem] = useState<Expense | Account | null>(null);
  const [showBalance, setShowBalance] = useState(true);

  // Weather state
  const [weather, setWeather] = useState<{ temp: number; icon: string; desc: string } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Calculate total balance
  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  // Biometric toggle handler
  const handleBalanceToggle = async () => {
    if (showBalance) {
      setShowBalance(false);
      return;
    }
    // Only check biometrics if toggling ON
    const setting = await AsyncStorage.getItem('requireBiometricForBalance');
    if (setting === 'true') {
      const ok = await authenticateBiometric();
      if (!ok) {
        Alert.alert('Authentication failed', 'Could not verify your identity.');
        return;
      }
    }
    setShowBalance(true);
  };


  useEffect(() => {
    loadAccounts();
    loadExpenses();
    fetchWeather();
  }, []);

  // Fetch weather from OpenWeatherMap
  const fetchWeather = async () => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const location = await Location.getCurrentPositionAsync({});
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${location.coords.latitude}&lon=${location.coords.longitude}&appid=${WEATHER_API_KEY}&units=metric`
      );
      if (!response.ok) throw new Error('Failed to fetch weather');
      const data = await response.json();
      setWeather({
        temp: data.main.temp,
        icon: data.weather[0].icon,
        desc: data.weather[0].description,
      });
    } catch (e: any) {
      setWeatherError(e.message || 'Weather unavailable');
    } finally {
      setWeatherLoading(false);
    }
  };

  // Load accounts from local storage
  const loadAccounts = async () => {
    try {
      const result = await getAccounts();
      setAccounts(result);
      if (!selectedAccount && result.length > 0 && result[0].id) {
        setSelectedAccount(result[0].id!);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load accounts.');
    }
  };

  // Load expenses from local storage
  const loadExpenses = async () => {
    setLoading(true);
    try {
      const result = await getExpenses();
      setExpenses(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  };


  // update account balance
  const updateAccountBalance = async (accountId: string, amount: number, isDebit = true) => {
    setAccounts(prevAccounts => {
      const accountIndex = prevAccounts.findIndex(acc => acc.id === accountId);
      if (accountIndex !== -1) {
        const updatedAccounts = [...prevAccounts];
        const prevBalance = updatedAccounts[accountIndex].balance || 0;
        const newBalance = isDebit ? prevBalance - amount : prevBalance + amount;
        updatedAccounts[accountIndex] = {
          ...updatedAccounts[accountIndex],
          balance: newBalance,
        };
        // Save asynchronously, don't await in setState
        saveAccounts(updatedAccounts);
        return updatedAccounts;
      }
      return prevAccounts;
    });
  };

  // Expense handlers
  const handleAddExpense = async (expense: Expense) => {
    try {
      const newExpense = { ...expense, id: Date.now().toString() };
      const updatedExpenses = [...expenses, newExpense];
      setExpenses(updatedExpenses);
      await saveExpenses(updatedExpenses);
      // Debit the account (subtract the expense amount)
      await updateAccountBalance(newExpense.accountId, newExpense.amount, true);
    } catch (error) {
      Alert.alert('Error', 'Failed to add expense.');
    }
  };



  const handleUpdateExpense = async (expense: Expense) => {
    try {
      // Find the original expense to handle account changes
      const originalExpense = expenses.find(e => e.id === expense.id);
      if (!originalExpense) {
        Alert.alert('Error', 'Could not find original expense');
        return;
      }

      // Update the expenses list
      const updatedList = expenses.map((e) => (e.id === expense.id ? expense : e));
      setExpenses(updatedList);
      await saveExpenses(updatedList);

      // Handle account balance updates
      if (originalExpense.accountId !== expense.accountId) {
        // Always refund the original account by the original amount
        await updateAccountBalance(originalExpense.accountId, originalExpense.amount, false);
        // Always debit the new account by the new amount
        await updateAccountBalance(expense.accountId, expense.amount, true);
      } else if (originalExpense.amount !== expense.amount) {
        // Same account, amount changed - adjust only the difference
        const diff = expense.amount - originalExpense.amount;
        if (diff > 0) {
          await updateAccountBalance(expense.accountId, diff, true); // subtract the extra
        } else if (diff < 0) {
          await updateAccountBalance(expense.accountId, -diff, false); // add back the difference
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update expense.');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      // Find the expense to be deleted
      const expenseToDelete = expenses.find((e) => e.id === id);
      const updatedExpenses = expenses.filter((e) => e.id !== id);
      setExpenses(updatedExpenses);
      await saveExpenses(updatedExpenses);
      // Restore account balance (add the amount back)
      if (expenseToDelete) {
        await updateAccountBalance(expenseToDelete.accountId, expenseToDelete.amount, false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete expense.');
    }
  };

  // Account handlers
  const handleAddAccount = async (account: Account) => {
    try {
      const newAccount = { ...account, id: Date.now().toString() };
      const updated = [...accounts, newAccount];
      setAccounts(updated);
      await saveAccounts(updated);
    } catch (error) {
      Alert.alert('Error', 'Failed to add account.');
    }
  };

  const handleUpdateAccount = async (account: Account) => {
    try {
      const updatedList = accounts.map((a) => (a.id === account.id ? account : a));
      setAccounts(updatedList);
      await saveAccounts(updatedList);
    } catch (error) {
      Alert.alert('Error', 'Failed to update account.');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      const updated = accounts.filter((a) => a.id !== id);
      setAccounts(updated);
      await saveAccounts(updated);
      if (selectedAccount === id && updated.length > 0) {
        setSelectedAccount(updated[0].id ?? '');
      }
      // Delete only expenses associated with this account
      const updatedExpenses = expenses.filter((e) => e.accountId !== id);
      setExpenses(updatedExpenses);
      await saveExpenses(updatedExpenses);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAccounts();
    await loadExpenses();
    setRefreshing(false);
  };

  const handleExpensePress = (expense: Expense) => {
    setEditItem(expense);
    setModalType('expense');
    setModalVisible(true);
  };

  const handleAccountPress = (account: Account) => {
    setEditItem(account);
    setModalType('account');
    setModalVisible(true);
  };

  // Use all expenses without filtering by account
  const sortedExpenses = React.useMemo(() => {
    return [...expenses].sort((a, b) =>
      new Date(b.date || b.createdAt || '').getTime() -
      new Date(a.date || a.createdAt || '').getTime()
    );
  }, [expenses]);

  const renderExpense = ({ item }: { item: Expense }) => {
    const date = new Date(item.date ?? item.createdAt ?? '');
    // Find the account name for this expense
    const account = accounts.find(acc => acc.id === item.accountId);
    const accountName = account ? account.name : 'Unknown Account';
    return (
      <TouchableOpacity style={styles.itemContainer} onPress={() => handleExpensePress(item)}>
        <Text style={styles.title}>{item.category || 'Expense'}</Text>
        <Text style={styles.itemDetail}>${item.amount} - {item.item || 'No item'}</Text>
        {item.description && (
          <Text style={styles.description}>{item.description}</Text>
        )}
        <Text style={styles.meta}>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        <Text style={styles.accountName}>Account: {accountName} ({account?.type})</Text>
        <TouchableOpacity onPress={() => {
          setDeleteTarget({ type: 'expense', id: item.id ?? '' });
          setConfirmVisible(true);
        }}>
          <Text style={{ color: 'red', marginTop: 4 }}>Delete</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderAccount = ({ item }: { item: Account }) => (
    <TouchableOpacity style={styles.itemContainer} onPress={() => handleAccountPress(item)}>
      <Text style={styles.title}>{item.name} ({item.type})</Text>
      <Text style={styles.meta}>Balance: {showBalance ? `$${item.balance || 0}` : '••••••'}</Text>
      <TouchableOpacity onPress={() => {
        setDeleteTarget({ type: 'account', id: item.id ?? '' });
        setConfirmVisible(true);
      }}>
        <Text style={{ color: 'red', marginTop: 4 }}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        {/* Weather + Balance */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
            {weatherLoading ? (
              <ActivityIndicator size="small" color="#0000ff" />
            ) : weatherError ? (
              <Text style={{ color: 'red', marginRight: 10 }}>{weatherError}</Text>
            ) : weather ? (
              <>
                <Image
                  source={{ uri: `https://openweathermap.org/img/wn/${weather.icon}@2x.png` }}
                  style={{ width: 36, height: 36, marginRight: 8 }}
                  accessibilityLabel={weather.desc}
                />
                <Text style={{ fontSize: 16, marginRight: 8 }}>{weather.temp}°C</Text>
              </>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginRight: 10 }}>Total Balance:</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginRight: 10 }}>
              {showBalance ? `$${totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '••••••'}
            </Text>
            <TouchableOpacity onPress={handleBalanceToggle} accessibilityLabel={showBalance ? 'Hide balance' : 'Show balance'}>
              <Entypo name={showBalance ? 'eye-with-line' : 'eye'} size={24} color="black" />
            </TouchableOpacity>
          </View>
        </View>
        <View>
          <TouchableOpacity
            style={styles.gearButton}
            onPress={() => navigation.navigate('Settings' as never)}
            accessibilityLabel="Settings"
          >
            <Entypo name="cog" size={24} color="black" />
          </TouchableOpacity>
          <Text style={styles.header}>Accounts</Text>
          <TouchableOpacity
            style={styles.summaryButton}
            onPress={() => navigation.navigate('Summary' as never)}
            accessibilityLabel="Settings"
          >
            <Text style={{ color: 'white' }}>Summary</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={accounts}
          renderItem={renderAccount}
          keyExtractor={(item) => item.id ? item.id : ''}
          horizontal
          extraData={selectedAccount}
          style={{ height: 120, }}
          ItemSeparatorComponent={() => <View style={{ width: 5 }} />}
        />
        <TouchableOpacity style={styles.addButton} onPress={() => { setModalType('account'); setEditItem(null); setModalVisible(true); }}>
          <Text style={styles.buttonText}>Add Account</Text>
        </TouchableOpacity>

        <Text style={styles.header}>Expenses</Text>
        <FlatList
          data={sortedExpenses}
          renderItem={renderExpense}
          keyExtractor={(item) => item.id ? item.id : ''}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        />
        <TouchableOpacity style={styles.addButton} onPress={() => { setModalType('expense'); setEditItem(null); setModalVisible(true); }}>
          <Text style={styles.buttonText}>Add Expense</Text>
        </TouchableOpacity>
        <ShowModal
          visible={modalVisible}
          setVisible={(v) => {
            setModalVisible(v);
            if (!v) setEditItem(null);
          }}
          type={modalType}
          initialData={editItem}
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSubmit={async (item: Expense | Account) => {
            if (modalType === 'expense') {
              if (editItem) await handleUpdateExpense(item as Expense);
              else await handleAddExpense(item as Expense);
            } else {
              if (editItem) await handleUpdateAccount(item as Account);
              else await handleAddAccount(item as Account);
            }
            setModalVisible(false);
            setEditItem(null);
          }}
        />
        {/* Confirm Delete Modal */}
        <Modal
          visible={confirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmVisible(false)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmContainer}>
              <Text style={styles.confirmText}>Are you sure you want to delete this {deleteTarget?.type}?</Text>
              {deleteTarget?.type === 'account' && (
                <Text style={styles.confirmText}>This will also delete all expenses associated with it.</Text>
              )}
              <View style={{ flexDirection: 'row', marginTop: 20 }}>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: '#d9534f' }]}
                  onPress={async () => {
                    setConfirmVisible(false);
                    if (deleteTarget) {
                      if (deleteTarget.type === 'expense') await handleDeleteExpense(deleteTarget.id);
                      if (deleteTarget.type === 'account') await handleDeleteAccount(deleteTarget.id);
                      setDeleteTarget(null);
                    }
                  }}
                >
                  <Text style={styles.confirmButtonText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: '#aaa', marginLeft: 10 }]}
                  onPress={() => {
                    setConfirmVisible(false);
                    setDeleteTarget(null);
                  }}
                >
                  <Text style={styles.confirmButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  gearButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    // padding: 8,  
    borderRadius: 20,
    zIndex: 1,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmContainer: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 10,
    alignItems: 'center',
    width: 300,
  },
  confirmText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  confirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  container: {
    flex: 1,
    padding: 10,

  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 10,
    textAlign: 'center',
  },
  itemContainer: {
    padding: 10,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    marginVertical: 5,
  },
  meta: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  accountName: {
    fontSize: 12,
    color: '#0066cc',
    marginTop: 4,
    fontWeight: '500',
  },
  itemDetail: {
    fontSize: 14,
    color: '#444',
    marginTop: 2,
  },
  addButton: {
    padding: 10,
    backgroundColor: '#007BFF',
    alignItems: 'center',
    borderRadius: 5,
    marginBottom: 20,
    marginTop: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  summaryButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#007BFF',
    alignItems: 'center',
    borderRadius: 5,
    padding: 5,
  },
});

export default HomeScreen;