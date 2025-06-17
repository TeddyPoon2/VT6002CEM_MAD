import React, { useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { Account, Expense } from '../types';

type ShowModalProps = {
  visible: boolean;
  setVisible: (v: boolean) => void;
  type: 'expense' | 'account';
  initialData?: Expense | Account | null;
  accounts?: Account[];
  selectedAccount?: string | null;
  onSubmit: (data: Expense | Account) => void;
};

const CATEGORY_HISTORY_KEY = 'expense_category_history';
const ITEM_HISTORY_KEY = 'expense_item_history';

const ShowModal = ({ visible, setVisible, type, initialData, accounts = [], selectedAccount, onSubmit }: ShowModalProps) => {
  // Expense fields
  const expenseFields = {
    amount: '',
    date: '',
    category: '',
    description: '',
    item: '',
    accountId: selectedAccount || undefined,
  };
  const [expense, setExpense] = useState(expenseFields);
  const [categoryHistory, setCategoryHistory] = useState<string[]>([]);
  type ItemHistoryEntry = { category: string; item: string };
  const [itemHistory, setItemHistory] = useState<ItemHistoryEntry[]>([]);

  const categoryInputRef = useRef<TextInput>(null);
  const itemInputRef = useRef<TextInput>(null);
  // Account fields
  const accountFields = {
    name: '',
    type: '',
    balance: '',
  };

  // Location loading state
  const [locLoading, setLocLoading] = useState(false);

  const [account, setAccount] = useState(accountFields);

  const updateExpenseField = (field: keyof Expense, value: string) => {
    setExpense({ ...expense, [field]: value });
  };

  const updateAccountField = (field: keyof Account, value: string) => {
    setAccount({ ...account, [field]: value });
  };

  // Handler to get current location and fill description
  const handleGetLocation = async () => {
    try {
      setLocLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to get your current location.');
        setLocLoading(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let address = '';
      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (geocode && geocode.length > 0) {
          const g = geocode[0];
          // address = `${g.name || ''} ${g.street || ''} ${g.city || ''} ${g.region || ''} ${g.country || ''}`.replace(/\s+/g, ' ').trim();
          address = g.city || '';
        }
      } catch (e) { }
      if (!address) {
        address = `Lat: ${loc.coords.latitude}, Lng: ${loc.coords.longitude}`;
      }
      setExpense(e => ({ ...e, description: address }));
    } catch (err) {
      Alert.alert('Error', 'Failed to get location.');
    } finally {
      setLocLoading(false);
    }
  };

  // Load histories from AsyncStorage
  React.useEffect(() => {
    (async () => {
      const cat = await AsyncStorage.getItem(CATEGORY_HISTORY_KEY);
      const itm = await AsyncStorage.getItem(ITEM_HISTORY_KEY);
      setCategoryHistory(cat ? JSON.parse(cat) : []);
      setItemHistory(
        itm
          ? JSON.parse(itm).filter(
            (h: any) => h && typeof h.category === 'string' && typeof h.item === 'string'
          )
          : []
      ); // Now array of {category, item} objects
    })();
  }, [visible]);

  React.useEffect(() => {
    if (type === 'expense' && initialData) {
      const exp = initialData as Expense;
      setExpense({
        amount: exp.amount?.toString() || '',
        date: exp.date || '',
        category: exp.category || '',
        description: exp.description || '',
        item: exp.item || '',
        accountId: exp.accountId || selectedAccount || '',
      });
    } else if (type === 'account' && initialData) {
      const acc = initialData as Account;
      setAccount({
        name: acc.name || '',
        type: acc.type || '',
        balance: acc.balance?.toString() || '',
      });
    } else {
      // For new expense, set date to now
      setExpense({ ...expenseFields, date: new Date().toISOString() });
      setAccount(accountFields);
    }
  }, [visible, type, initialData, selectedAccount]);

  const handleSubmit = async () => {
    if (type === 'expense') {
      if (!expense.amount || !expense.date || !expense.category || !expense.item || !expense.accountId) {
        Alert.alert('Error', 'All fields are required');
        return;
      }
      // Save to history if new
      let newCategoryHistory = categoryHistory;
      let newItemHistory = itemHistory;
      if (expense.category && !categoryHistory.includes(expense.category)) {
        newCategoryHistory = [expense.category, ...categoryHistory].slice(0, 10);
        setCategoryHistory(newCategoryHistory);
        await AsyncStorage.setItem(CATEGORY_HISTORY_KEY, JSON.stringify(newCategoryHistory));
      }
      // Save item-category pair if new
      if (expense.item && expense.category && !itemHistory.some(h => h.item === expense.item && h.category === expense.category)) {
        newItemHistory = [{ category: expense.category, item: expense.item }, ...itemHistory].slice(0, 20);
        setItemHistory(newItemHistory);
        await AsyncStorage.setItem(ITEM_HISTORY_KEY, JSON.stringify(newItemHistory));
      }
      onSubmit({
        ...(initialData || {}),
        amount: parseFloat(expense.amount),
        date: expense.date,
        category: expense.category,
        description: expense.description,
        item: expense.item,
        accountId: expense.accountId,
      });
    } else {
      if (!account.name || !account.type) {
        Alert.alert('Error', 'All fields are required');
        return;
      }
      onSubmit({
        ...(initialData || {}),
        name: account.name,
        type: account.type,
        balance: account.balance ? parseFloat(account.balance) : 0,
      });
    }
    setVisible(false);
  };

  const handleClose = () => {
    setVisible(false);
  };


  return (
    <Modal animationType="slide" transparent={true} visible={visible}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior="padding"
        keyboardVerticalOffset={10}
      >
        <SafeAreaView style={{ width: '100%', height: '100%', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={styles.modalContainer}>
            <ScrollView style={{ width: '100%' }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              <Text style={styles.modalTitle}>{type === 'expense' ? (initialData ? 'Edit Expense' : 'Add Expense') : (initialData ? 'Edit Account' : 'Add Account')}</Text>
              {type === 'expense' ? (
                <>
                  <Text style={styles.label}>Amount</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={expense.amount}
                    onChangeText={(value) => updateExpenseField('amount', value)}
                  />
                  <Text style={styles.label}>Date & Time</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <DateTimePicker
                      style={styles.datePickButton}
                      accentColor="#fff"
                      value={expense.date ? new Date(expense.date) : new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          let current = expense.date ? new Date(expense.date) : new Date();
                          current.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                          updateExpenseField('date', current.toISOString());
                        }
                      }}
                    />
                    <DateTimePicker
                      style={styles.datePickButton}
                      accentColor='#fff'
                      value={expense.date ? new Date(expense.date) : new Date()}
                      mode="time"
                      display="default"
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                          let current = expense.date ? new Date(expense.date) : new Date();
                          current.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
                          updateExpenseField('date', current.toISOString());
                        }
                      }}
                    />
                  </View>
                  <Text style={styles.label}>Category</Text>
                  {categoryHistory.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyBar}>
                      {categoryHistory.map((cat, idx) => (
                        <TouchableOpacity
                          key={cat + idx}
                          style={styles.historyChip}
                          onPress={() => {
                            updateExpenseField('category', cat);
                            categoryInputRef.current?.blur();
                          }}
                        >
                          <Text style={styles.historyChipText}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                  <TextInput
                    ref={categoryInputRef}
                    style={styles.input}
                    value={expense.category}
                    onChangeText={(value) => updateExpenseField('category', value)}
                  />
                  <Text style={styles.label}>Item</Text>
                  {itemHistory.length > 0 && expense.category && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyBar}>
                      {itemHistory
                        .filter(h =>
                          h &&
                          typeof h.category === 'string' &&
                          typeof h.item === 'string' &&
                          typeof expense.category === 'string' &&
                          h.category.trim().toLowerCase() === expense.category.trim().toLowerCase()
                        )
                        .map((entry, idx) => (
                          <TouchableOpacity
                            key={entry.item + idx}
                            style={styles.historyChip}
                            onPress={() => {
                              updateExpenseField('item', entry.item);
                              itemInputRef.current?.blur();
                            }}
                          >
                            <Text style={styles.historyChipText}>{entry.item}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  )}
                  <TextInput
                    ref={itemInputRef}
                    style={styles.input}
                    value={expense.item}
                    onChangeText={(value) => updateExpenseField('item', value)}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.label, { marginTop: 5 }]}>Description</Text>
                    <TouchableOpacity
                      style={{ backgroundColor: '#007BFF', padding: 5, borderRadius: 5, marginBottom: 10 }}
                      onPress={handleGetLocation}
                      disabled={locLoading}
                    >
                      <Text style={{ color: 'white' }}>{locLoading ? '...' : 'Get Location'}</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    multiline
                    style={[styles.descriptionInput]}
                    value={expense.description}
                    onChangeText={(value) => updateExpenseField('description', value)}
                  />
                  <Text style={styles.label}>Account</Text>
                  <View style={{ width: '100%', marginBottom: 10 }}>
                    {accounts.length > 0 ? (
                      <>
                        {accounts.map((a) => (
                          <TouchableOpacity
                            key={a.id}
                            style={{ padding: 6, backgroundColor: expense.accountId === a.id ? '#007BFF' : '#eee', marginBottom: 4, borderRadius: 5 }}
                            onPress={() => updateExpenseField('accountId', a.id!)}
                          >
                            <Text style={{ color: expense.accountId === a.id ? 'white' : 'black' }}>{a.name} ({a.type})</Text>
                          </TouchableOpacity>
                        ))}
                      </>
                    ) : <Text>No accounts found</Text>}
                  </View>
                  <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.closeButton]} onPress={handleClose}>
                    <Text style={styles.buttonText}>Close</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Account Name</Text>
                  <TextInput
                    style={styles.input}
                    value={account.name}
                    onChangeText={(value) => updateAccountField('name', value)}
                  />
                  <Text style={styles.label}>Type (e.g. Bank, Wallet)</Text>
                  <TextInput
                    style={styles.input}
                    value={account.type}
                    onChangeText={(value) => updateAccountField('type', value)}
                  />
                  <Text style={styles.label}>Balance</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={account.balance}
                    onChangeText={(value) => updateAccountField('balance', value)}
                  />
                  <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.closeButton]} onPress={handleClose}>
                    <Text style={styles.buttonText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}


const styles = StyleSheet.create({
  historyBar: {
    flexDirection: 'row',
    marginBottom: 4,
    marginTop: 2,
    paddingHorizontal: 2,
    minHeight: 36,
  },
  historyChip: {
    backgroundColor: '#222',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyChipText: {
    color: '#fff',
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '80%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  button: {
    width: '100%',
    padding: 10,
    backgroundColor: '#007BFF',
    alignItems: 'center',
    borderRadius: 5,
    marginBottom: 10,
  },
  closeButton: {
    backgroundColor: '#D9534F',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  label: {
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  datePickButton: {
    backgroundColor: '#007BFF',
    borderRadius: 5,
    marginBottom: 10,
  },
  descriptionInput: {
    flex: 1,
    height: 100,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
});

export default ShowModal;