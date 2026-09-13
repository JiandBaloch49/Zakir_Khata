import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useAuthStore } from '../../store/authStore';
import { executeGlobalSearch, SearchResult } from '../../services/database/searchDb';
import { formatCurrency } from '../../utils/calculations';
import { format } from 'date-fns';

type Props = StackScreenProps<any, any>;

// Helper to highlight matching text
const HighlightedText = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <Text>{text}</Text>;
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <Text>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <Text key={i} className="bg-yellow-200 text-gray-900">{part}</Text> 
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
};

export const GlobalSearchScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2 && user) {
        setLoading(true);
        try {
          const data = await executeGlobalSearch(searchQuery, user.id);
          setResults(data);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, user]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    results.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return groups;
  }, [results]);

  const handleResultPress = (item: SearchResult) => {
    switch (item.type) {
      case 'customer':
        navigation.navigate('CustomerDetail', { customerId: item.id });
        break;
      case 'khata':
        // Navigation expects customerId or specific transaction context, let's go to Ledger
        navigation.navigate('KhataTab'); 
        break;
      case 'bill':
        navigation.navigate('BillBook');
        break;
      case 'product':
        navigation.navigate('StockBook');
        break;
      case 'expense':
        navigation.navigate('ExpensesTab');
        break;
      case 'staff':
        navigation.navigate('StaffDetail', { staffId: item.id });
        break;
    }
  };

  const getSectionIcon = (type: string) => {
    switch(type) {
      case 'customer': return '👥';
      case 'khata': return '📔';
      case 'bill': return '🧾';
      case 'product': return '📦';
      case 'expense': return '💸';
      case 'staff': return '👔';
      default: return '📄';
    }
  };

  const getSectionTitle = (type: string) => {
    switch(type) {
      case 'customer': return 'Customers';
      case 'khata': return 'Khata Entries';
      case 'bill': return 'Bills';
      case 'product': return 'Products';
      case 'expense': return 'Expenses';
      case 'staff': return 'Staff Members';
      default: return 'Results';
    }
  };

  return (
    <View className="flex-1 bg-gray-50 pt-2 px-4">
      
      {/* Search Input */}
      <View className="bg-white flex-row items-center px-4 py-3 rounded-xl border border-gray-200 shadow-sm mb-4">
        <Text className="text-xl mr-3">🔍</Text>
        <TextInput
          className="flex-1 text-lg text-gray-800"
          placeholder="Search anything..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
            <Text className="text-gray-400 text-lg">✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-gray-500 mt-4">Searching database...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {Object.keys(groupedResults).length === 0 ? (
            searchQuery.length >= 2 ? (
              <View className="items-center justify-center py-20">
                <Text className="text-4xl mb-4">🤷‍♂️</Text>
                <Text className="text-xl text-gray-500 font-medium">No results found</Text>
              </View>
            ) : (
              <View className="items-center justify-center py-20">
                <Text className="text-4xl mb-4">🌍</Text>
                <Text className="text-xl text-gray-400 font-medium text-center px-10">
                  Search across your entire business data instantly.
                </Text>
              </View>
            )
          ) : (
            Object.entries(groupedResults).map(([type, items]) => (
              <View key={type} className="mb-6">
                <View className="flex-row items-center mb-3 ml-1">
                  <Text className="text-xl mr-2">{getSectionIcon(type)}</Text>
                  <Text className="text-lg font-bold text-gray-800">{getSectionTitle(type)}</Text>
                  <View className="ml-2 bg-gray-200 px-2 py-0.5 rounded-full">
                    <Text className="text-gray-600 text-xs font-bold">{items.length}</Text>
                  </View>
                </View>

                {items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleResultPress(item)}
                    className="bg-white p-4 rounded-xl border border-gray-100 mb-2 shadow-sm flex-row items-center"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-base font-bold text-gray-800" numberOfLines={1}>
                        <HighlightedText text={item.title} query={searchQuery} />
                      </Text>
                      <Text className="text-sm text-gray-500 mt-1" numberOfLines={1}>
                        <HighlightedText text={item.subtitle} query={searchQuery} />
                      </Text>
                    </View>
                    
                    <View className="items-end">
                      {item.amount !== undefined && (
                        <Text className="text-base font-bold text-gray-800 mb-1">
                          {formatCurrency(item.amount)}
                        </Text>
                      )}
                      {item.date && (
                        <Text className="text-xs text-gray-400">
                          {format(new Date(item.date), 'dd MMM yyyy')}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
          <View className="h-10" />
        </ScrollView>
      )}
    </View>
  );
};
