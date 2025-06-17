import React from 'react';
import { View, Text, ScrollView, Dimensions, SafeAreaView, StyleSheet,TouchableOpacity } from 'react-native';
import { PieChart, BarChart, LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, Account } from '../types';
import { useNavigation } from '@react-navigation/native';

const screenWidth = Dimensions.get('window').width;
const chartWidth = Math.min(screenWidth - 40, 600);

const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.7,
  useShadowColorFromDataset: false,
};

const chartTypes = [
  { key: 'category', label: 'By Category' },
  { key: 'day', label: 'By Day' },
  { key: 'cumulative', label: 'Cumulative' },
  { key: 'account', label: 'By Account' },
  { key: 'item', label: 'By Item' },
];

const colorPalettes = {
  category: ['#007BFF', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#17a2b8'],
  day: ['#ff9800', '#ff5722', '#4caf50', '#2196f3', '#9c27b0', '#e91e63'],
  cumulative: ['#673ab7', '#3f51b5', '#00bcd4', '#009688', '#8bc34a', '#ffeb3b'],
  account: ['#f44336', '#e91e63', '#9c27b0', '#3f51b5', '#2196f3', '#00bcd4'],
  item: ['#795548', '#607d8b', '#ff9800', '#8bc34a', '#00bcd4', '#9c27b0'],
};

const SummaryScreen = () => {
  const navigation = useNavigation();
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [selectedChart, setSelectedChart] = React.useState<'category'|'day'|'cumulative'|'account'|'item'>('category');

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const exp = await AsyncStorage.getItem('expenses');
        const acc = await AsyncStorage.getItem('accounts');
        setExpenses(exp ? JSON.parse(exp) : []);
        setAccounts(acc ? JSON.parse(acc) : []);
      })();
    }, [])
  );

  // Pie Chart: Expenses by Category
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (typeof e.amount === 'number' ? e.amount : parseFloat(e.amount));
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.keys(categoryTotals).map((cat, i) => ({
    name: cat,
    amount: categoryTotals[cat],
    color: colorPalettes.category[i % colorPalettes.category.length],
    legendFontColor: '#333',
    legendFontSize: 14,
  }));

  // Bar Chart: Expenses over time (by day)
  const byDay: Record<string, number> = {};
  expenses.forEach(e => {
    const d = e.date ? e.date.slice(0, 10) : 'Unknown';
    byDay[d] = (byDay[d] || 0) + (typeof e.amount === 'number' ? e.amount : parseFloat(e.amount));
  });
  const barLabels = Object.keys(byDay).sort();
  const barData = barLabels.map(l => byDay[l]);

  // Pie Chart: Expenses by Account
  const accountTotals = expenses.reduce((acc, e) => {
    acc[e.accountId || 'Unknown'] = (acc[e.accountId || 'Unknown'] || 0) + (typeof e.amount === 'number' ? e.amount : parseFloat(e.amount));
    return acc;
  }, {} as Record<string, number>);
  const accountPieData = Object.keys(accountTotals).map((aid, i) => {
    const account = accounts.find(a => a.id === aid);
    const name = account ? `${account.name} (${account.type})` : 'Unknown';
    return {
      name: name,
      amount: accountTotals[aid],
      color: colorPalettes.account[i % colorPalettes.account.length],
      legendFontColor: '#333',
      legendFontSize: 14,
    };
  });

  // Pie Chart: Expenses by Item
  const itemTotals = expenses.reduce((acc, e) => {
    if (e.item) acc[e.item] = (acc[e.item] || 0) + (typeof e.amount === 'number' ? e.amount : parseFloat(e.amount));
    return acc;
  }, {} as Record<string, number>);
  const itemPieData = Object.keys(itemTotals).map((item, i) => ({
    name: item,
    amount: itemTotals[item],
    color: colorPalettes.item[i % colorPalettes.item.length],
    legendFontColor: '#333',
    legendFontSize: 14,
  }));

  // Line Chart: Cumulative Expenses Over Time
  let cumulative = 0;
  const lineLabels = barLabels;
  const lineData = barLabels.map(l => {
    cumulative += byDay[l];
    return cumulative;
  });

  // Chart rendering logic based on selection
  let chartSection = null;
  if (selectedChart === 'category') {
    chartSection = pieData.length > 0 ? (
      <View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <PieChart
          data={pieData.map(d => ({
            name: `$${d.amount} ${d.name}`,
            population: d.amount as number,
            color: d.color,
            legendFontColor: d.legendFontColor,
            legendFontSize: d.legendFontSize,
          }))}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          accessor={'population'}
          backgroundColor={'transparent'}
          paddingLeft={'100'}
          absolute
          hasLegend={false}
        />
        </View>
        <View style={styles.customLegend}>
          {pieData.map((d, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: d.color }]} />
              <Text style={styles.legendLabel}>{`${d.name} - $${d.amount}`}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : <Text>No expense data for categories.</Text>;
  } else if (selectedChart === 'day') {
    chartSection = barLabels.length > 0 ? (
      <BarChart
        data={{
          labels: barLabels,
          datasets: [{ data: barData }],
        }}
        width={chartWidth}
        height={220}
        chartConfig={{
          ...chartConfig,
          color: (opacity = 1) => colorPalettes.day[0],
        }}
        // verticalLabelRotation={30}
        fromZero
        yAxisLabel={'$'}
        yAxisSuffix={''}
      />
    ) : <Text>No daily expense data.</Text>;
  } else if (selectedChart === 'cumulative') {
    chartSection = lineLabels.length > 0 ? (
      <LineChart
        data={{
          labels: lineLabels,
          datasets: [{ data: lineData }],
        }}
        width={chartWidth}
        height={220}
        chartConfig={{
          ...chartConfig,
          color: (opacity = 1) => colorPalettes.cumulative[0],
        }}
        // verticalLabelRotation={30}
        fromZero
        bezier
        yAxisLabel={'$'}
        yAxisSuffix={''}
      />
    ) : <Text>No cumulative data.</Text>;
  } else if (selectedChart === 'account') {
    chartSection = accountPieData.length > 0 ? (
      <View>
        <PieChart
          data={accountPieData.map(d => ({
            name: d.name,
            population: d.amount as number,
            color: d.color,
            legendFontColor: d.legendFontColor,
            legendFontSize: d.legendFontSize,
          }))}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          accessor={'population'}
          backgroundColor={'transparent'}
          paddingLeft={'100'}
          absolute
          hasLegend={false}
        />
        <View style={styles.customLegend}>
          {accountPieData.map((d, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: d.color }]} />
              <Text style={styles.legendLabel}>{`${d.name} - $${d.amount}`}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : <Text>No expense data for accounts.</Text>;
  } else if (selectedChart === 'item') {
    chartSection = itemPieData.length > 0 ? (
      <View>
        <PieChart
          data={itemPieData.map(d => ({
            name: d.name,
            population: d.amount as number,
            color: d.color,
            legendFontColor: d.legendFontColor,
            legendFontSize: d.legendFontSize,
          }))}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          accessor={'population'}
          backgroundColor={'transparent'}
          paddingLeft={'100'}
          absolute
          hasLegend={false}
        />
        <View style={styles.customLegend}>
          {itemPieData.map((d, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: d.color }]} />
              <Text style={styles.legendLabel}>{`${d.name} - $${d.amount}`}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : <Text>No expense data for items.</Text>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
      <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.header}>Expense Summary</Text>
        <View style={styles.chipSection}>
          {chartTypes.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.chip, selectedChart === c.key ? styles.chipSelected : null]}
              onPress={() => setSelectedChart(c.key as any)}
            >
              <Text style={[styles.chipText, selectedChart === c.key ? styles.chipTextSelected : null]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ marginTop: 10 }}>
          {chartSection}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  customLegend: {
    flexDirection: 'column',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 2,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  legendLabel: {
    fontSize: 14,
    color: '#333',
  },
  chipSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 12,
    gap: 8,
    maxWidth: 600,
    alignSelf: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#007BFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    marginHorizontal: 4,
    marginBottom: 6,
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: '#007BFF',
    borderColor: '#0056b3',
  },
  chipText: {
    color: '#007BFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  chipTextSelected: {
    color: '#fff',
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
});

export default SummaryScreen;
