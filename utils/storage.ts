import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, Account } from '../types';

const EXPENSES_KEY = 'expenses';
const ACCOUNTS_KEY = 'accounts';

// EXPENSES CRUD
export const getExpenses = async (): Promise<Expense[]> => {
  const data = await AsyncStorage.getItem(EXPENSES_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveExpenses = async (expenses: Expense[]): Promise<void> => {
  await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
};

// ACCOUNTS CRUD
export const getAccounts = async (): Promise<Account[]> => {
  const data = await AsyncStorage.getItem(ACCOUNTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveAccounts = async (accounts: Account[]): Promise<void> => {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

// Utility to clear all local data (for dev/testing)
export const clearAllData = async () => {
  await AsyncStorage.multiRemove([EXPENSES_KEY, ACCOUNTS_KEY]);
};
