import React, { useState } from 'react';
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

const ShowModal = ({ visible, setVisible, type, initialData, accounts = [], selectedAccount, onSubmit }: ShowModalProps) => {
  // Expense fields
  const expenseFields = {
    amount: '',
    date: '',
    category: '',
    description: '',
    accountId: selectedAccount || undefined,
  };
  const [expense, setExpense] = useState(expenseFields);
  // Account fields
  const accountFields = {
    name: '',
    type: '',
    balance: '',
  };
  const [account, setAccount] = useState(accountFields);

  const updateExpenseField = (field: keyof Expense, value: string) => {
    setExpense({ ...expense, [field]: value });
  };

  const updateAccountField = (field: keyof Account, value: string) => {
    setAccount({ ...account, [field]: value });
  };

  React.useEffect(() => {
    if (type === 'expense' && initialData) {
      const exp = initialData as Expense;
      setExpense({
        amount: exp.amount?.toString() || '',
        date: exp.date || '',
        category: exp.category || '',
        description: exp.description || '',
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

  const handleSubmit = () => {
    if (type === 'expense') {
      if (!expense.amount || !expense.date || !expense.category || !expense.description || !expense.accountId) {
        Alert.alert('Error', 'All fields are required');
        return;
      }
      onSubmit({
        ...(initialData || {}),
        amount: parseFloat(expense.amount),
        date: expense.date,
        category: expense.category,
        description: expense.description,
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
                  <TextInput
                    style={styles.input}
                    value={expense.category}
                    onChangeText={(value) => updateExpenseField('category', value)}
                  />
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={styles.input}
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
});

export default ShowModal;