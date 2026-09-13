import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useSyncStore } from '../../store/useSyncStore';
import { getDatabase } from '../../services/database/db';
import { format } from 'date-fns';

type Props = StackScreenProps<any, any>;

interface SyncQueueItem {
  id: string;
  table_name: string;
  operation: string;
  status: string;
  error_message: string;
  created_at: string;
  retry_count: number;
}

interface SyncMetadata {
  table_name: string;
  last_synced_at: string;
  pending_count: number;
}

export const SyncCenterScreen: React.FC<Props> = ({ navigation }) => {
  const { isOnline, isSyncing, pendingCount, processSyncQueue } = useSyncStore();
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [metadata, setMetadata] = useState<SyncMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSyncData = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      
      // Load pending/failed queue
      const queue = await db.getAllAsync<SyncQueueItem>(
        `SELECT id, table_name, operation, status, error_message, created_at, retry_count 
         FROM sync_queue 
         ORDER BY created_at DESC 
         LIMIT 50`
      );
      setQueueItems(queue);

      // Load metadata
      const meta = await db.getAllAsync<SyncMetadata>(
        `SELECT table_name, last_synced_at, pending_count FROM sync_metadata`
      );
      setMetadata(meta);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadSyncData);
    return unsubscribe;
  }, [navigation]);

  const handleManualSync = async () => {
    await processSyncQueue();
    await loadSyncData();
  };

  const handleDismissAllFailed = async () => {
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM sync_queue WHERE status = 'failed'`);
      await loadSyncData();
    } catch (err) {
      console.error('Failed to dismiss items:', err);
    }
  };

  const failedItems = queueItems.filter(q => q.status === 'failed');
  const pendingItems = queueItems.filter(q => q.status === 'pending');

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView 
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSyncData} />}
      >
        
        {/* Connection Status Card */}
        <View className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 flex-row items-center">
          <View className={`w-14 h-14 rounded-full items-center justify-center mr-4 ${isOnline ? 'bg-emerald-100' : 'bg-red-100'}`}>
            <Text className="text-2xl">{isOnline ? '🌐' : '📵'}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 font-medium mb-1">Network Status</Text>
            <Text className={`text-xl font-bold ${isOnline ? 'text-emerald-700' : 'text-red-700'}`}>
              {isOnline ? 'Online / Connected' : 'Offline Mode'}
            </Text>
          </View>
        </View>

        {/* Sync Summary */}
        <View className="flex-row justify-between mb-6">
          <View className="bg-white flex-1 p-4 rounded-2xl shadow-sm border border-gray-100 mr-2 items-center">
            <Text className="text-gray-500 font-medium mb-2 text-center">Pending</Text>
            <Text className="text-3xl font-bold text-amber-600">{pendingItems.length}</Text>
          </View>
          <View className="bg-white flex-1 p-4 rounded-2xl shadow-sm border border-gray-100 mx-2 items-center">
            <Text className="text-gray-500 font-medium mb-2 text-center">Failed</Text>
            <Text className="text-3xl font-bold text-red-600">{failedItems.length}</Text>
          </View>
          <View className="bg-white flex-1 p-4 rounded-2xl shadow-sm border border-gray-100 ml-2 items-center justify-center">
            {isSyncing ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <TouchableOpacity onPress={handleManualSync} disabled={!isOnline || isSyncing} className="items-center w-full">
                <Text className={`text-3xl ${isOnline ? 'text-blue-600' : 'text-gray-300'}`}>🔄</Text>
                <Text className={`text-xs font-bold mt-2 ${isOnline ? 'text-blue-600' : 'text-gray-400'}`}>SYNC</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Failed Operations Error Log */}
        {failedItems.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-red-700 font-bold text-lg">⚠️ Failed Operations</Text>
              <View className="flex-row items-center">
                <TouchableOpacity onPress={handleDismissAllFailed} className="mr-4">
                  <Text className="text-gray-500 font-bold">Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleManualSync}>
                  <Text className="text-blue-600 font-bold">Retry All</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {failedItems.map(item => (
              <View key={item.id} className="bg-red-50 p-4 rounded-xl border border-red-100 mb-2">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="font-bold text-red-800 uppercase text-xs tracking-wider">
                    {item.operation} {item.table_name}
                  </Text>
                  <Text className="text-xs text-red-600 font-medium">Retry: {item.retry_count}</Text>
                </View>
                <Text className="text-red-700 text-sm mt-1">{item.error_message}</Text>
                <Text className="text-red-400 text-xs mt-2">{format(new Date(item.created_at), 'dd MMM, HH:mm')}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pending Operations Log */}
        {pendingItems.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-amber-700 font-bold text-lg">⏳ Pending Operations</Text>
            </View>
            
            {pendingItems.map(item => (
              <View key={item.id} className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-2">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="font-bold text-amber-800 uppercase text-xs tracking-wider">
                    {item.operation} {item.table_name}
                  </Text>
                  <Text className="text-xs text-amber-600 font-medium">{format(new Date(item.created_at), 'HH:mm:ss')}</Text>
                </View>
                <Text className="text-amber-700 text-sm mt-1">
                  Waiting to sync with online database...
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Table Metadata */}
        <View className="mb-10">
          <Text className="text-gray-800 font-bold text-lg mb-3">Table Status</Text>
          <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {metadata.length === 0 ? (
              <View className="p-6 items-center">
                <Text className="text-gray-400">No sync metadata available yet.</Text>
              </View>
            ) : (
              metadata.map((meta, index) => (
                <View 
                  key={meta.table_name} 
                  className={`p-4 flex-row justify-between items-center ${index < metadata.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <View>
                    <Text className="font-bold text-gray-800 text-base capitalize">{meta.table_name.replace('_', ' ')}</Text>
                    <Text className="text-gray-500 text-xs mt-1">
                      Last Synced: {meta.last_synced_at ? format(new Date(meta.last_synced_at), 'dd MMM, HH:mm') : 'Never'}
                    </Text>
                  </View>
                  {meta.pending_count > 0 && (
                    <View className="bg-amber-100 px-3 py-1 rounded-full">
                      <Text className="text-amber-800 text-xs font-bold">{meta.pending_count} pending</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </View>

      </ScrollView>
    </View>
  );
};
