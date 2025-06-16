import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ShowModal from './ShowModal';
import { getExpenses, saveExpenses, getAccounts, saveAccounts } from './storage';
import { Account, Expense } from '../types';

const HomeScreen = () => {
  // const API_URL = 'http://localhost:3000';
  // const navigation = useNavigation();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'expense' | 'account'>("expense");
  const [editItem, setEditItem] = useState<Expense | Account | null>(null);

  useEffect(() => {
    loadAccounts();
    loadExpenses();
  }, []);

  // Load accounts from local storage
  const loadAccounts = async () => {
    try {
      const result = await getAccounts();
      setAccounts(result);
      if (!selectedAccount && result.length > 0 && result[0].id) {
        setSelectedAccount(result[0].id!);
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
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
      console.error("Failed to load expenses:", error);
      Alert.alert('Error', 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  };


  // update account balance
  const updateAccountBalance = async (accountId: string, amount: number) => {
    const accountIndex = accounts.findIndex(acc => acc.id === accountId);
    if (accountIndex !== -1) {
      const updatedAccounts = [...accounts];
      const prevBalance = updatedAccounts[accountIndex].balance || 0;
      updatedAccounts[accountIndex] = {
        ...updatedAccounts[accountIndex],
        balance: prevBalance - amount,
      };
      setAccounts(updatedAccounts);
      await saveAccounts(updatedAccounts);
    }
  };
  // Expense handlers
  const handleAddExpense = async (expense: Expense) => {
    try {
      const newExpense = { ...expense, accountId: selectedAccount || '', id: Date.now().toString() };
      const updatedExpenses = [...expenses, newExpense];
      setExpenses(updatedExpenses);
      await saveExpenses(updatedExpenses);
      await updateAccountBalance(newExpense.accountId, newExpense.amount);
    } catch (error) {
      console.error("Failed to add expense:", error);
      Alert.alert('Error', 'Failed to add expense.');
    }
  };


  const handleUpdateExpense = async (expense: Expense) => {
    try {
      const updatedList = expenses.map((e) => (e.id === expense.id ? expense : e));
      setExpenses(updatedList);
      await saveExpenses(updatedList);
      await updateAccountBalance(expense.accountId, expense.amount);
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
      // Restore account balance
      if (expenseToDelete) {
        await updateAccountBalance(expenseToDelete.accountId, expenseToDelete.amount);
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
      setSelectedAccount(newAccount.id);
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


  const renderExpense = ({ item }: { item: Expense }) => {
    if (selectedAccount && item.accountId !== selectedAccount) return null;
    const date = new Date(item.date ?? item.createdAt ?? '');
    return (
      <TouchableOpacity style={styles.itemContainer} onPress={() => handleExpensePress(item)}>
        <Text style={styles.title}>{item.category || 'Expense'}</Text>
        <Text style={styles.description}>${item.amount} - {item.description}</Text>
        <Text style={styles.meta}>{date.toLocaleDateString()} {date.toLocaleTimeString()}</Text>
        <TouchableOpacity onPress={() => handleDeleteExpense(item.id ?? '')}>
          <Text style={{ color: 'red', marginTop: 4 }}>Delete</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderAccount = ({ item }: { item: Account }) => (
    <TouchableOpacity style={styles.itemContainer} onPress={() => setSelectedAccount(item.id ?? '')}>
      <Text style={styles.title}>{item.name} ({item.type})</Text>
      <Text style={styles.meta}>Balance: ${item.balance || 0}</Text>
      <TouchableOpacity onPress={() => handleAccountPress(item)}>
        <Text style={{ color: 'blue', marginTop: 4 }}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleDeleteAccount(item.id ?? '')}>
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
    <View style={styles.container}>
      <Text style={styles.header}>Accounts</Text>
      <FlatList
        data={accounts}
        renderItem={renderAccount}
        keyExtractor={(item) => item.id ? item.id : ''}
        horizontal
        extraData={selectedAccount}
        style={{ maxHeight: 120, }}
        ItemSeparatorComponent={() => <View style={{ width: 5 }} />}
      />
      <TouchableOpacity style={styles.addButton} onPress={() => { setModalType('account'); setEditItem(null); setModalVisible(true); }}>
        <Text style={styles.buttonText}>Add Account</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Expenses</Text>
      <FlatList
        data={expenses
          .filter(e => !selectedAccount || e.accountId === selectedAccount)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
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
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default HomeScreen;