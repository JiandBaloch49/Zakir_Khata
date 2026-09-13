import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { updateUser, deactivateUser, SubStaffRow } from '../../services/database/userDb';

import { getManagedAccounts, createManagedAccount, accountPasswordProblem } from '../../services/database/managedAccountDb';

export const SubStaffScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [parents, setParents] = useState<SubStaffRow[]>([]);
  const [accountType, setAccountType] = useState<'staff' | 'substaff'>('staff');
  const [parentStaffId, setParentStaffId] = useState('');

  const [active, setActive] = useState<SubStaffRow[]>([]);
  const [removed, setRemoved] = useState<SubStaffRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) loadSubStaff();
  }, [user?.id]);

  const loadSubStaff = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = await getManagedAccounts();
      setIsAdmin(result.isAdmin);
      setCanCreate(result.canCreate);
      setParents(result.parents);
      setActive(result.active);
      setRemoved(result.removed);
    } catch (e) {
      if (__DEV__) console.error('Failed to load sub-staff:', e);
      Alert.alert('Error', 'Could not load sub-staff.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setAccountType('staff');
    setParentStaffId('');
    setName('');
    setPhone('');
    setPassword('');
    setShowForm(false);
  };

  const startEdit = (item: SubStaffRow) => {
    setEditingId(item.id);
    setName(item.name);
    setPhone(item.phone);
    setPassword('');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!user || !canCreate) return;

    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please enter a name and phone number');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await updateUser(editingId, { name: name.trim(), phone: phone.trim() });
        Alert.alert('Saved', 'Sub-staff details updated');
      } else {
        const pwProblem = accountPasswordProblem(password);
        if (pwProblem) {
          Alert.alert('Weak Password', pwProblem);
          setSubmitting(false);
          return;
        }
        await createManagedAccount({
          name, phone, password,
          accountType: isAdmin ? accountType : 'substaff',
          parentStaffId: isAdmin && accountType === 'substaff' ? parentStaffId : undefined,
        });
        Alert.alert('Success', 'Account created successfully');
      }
      resetForm();
      loadSubStaff();
    } catch (e: any) {
      if (__DEV__) console.error('[SubStaff] save failed:', e);
      Alert.alert(
        'Error',
        e?.message || (editingId
          ? 'Failed to update sub-staff.'
          : 'Failed to register sub-staff. Phone number might already exist.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = (item: SubStaffRow) => {
    Alert.alert(
      `Remove ${item.name}?`,
      `${item.name} will no longer be able to log in.\n\nAll of their past entries are KEPT and stay visible in your books. Nothing is deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Access', style: 'destructive',
          onPress: async () => {
            try {
              await deactivateUser(item.id);
              if (editingId === item.id) resetForm();
              Alert.alert('Access Removed', `${item.name} can no longer log in. Their entries are kept.`);
              loadSubStaff();
            } catch (e: any) {
              if (__DEV__) console.error('[SubStaff] remove failed:', e);
              Alert.alert('Error', e?.message || 'Failed to remove access.');
            }
          },
        },
      ]
    );
  };

  const renderActiveItem = ({ item }: { item: SubStaffRow }) => (
    <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100 flex-row justify-between items-center">
      <View className="flex-1 pr-2">
        <Text className="font-semibold text-gray-800 text-base">{item.name}</Text>
        <Text className="text-gray-500 text-sm">{item.phone}</Text>
        {isAdmin && !!item.parentName && (
          <Text className="text-gray-400 text-xs mt-0.5">{item.parentId === user?.id ? 'Staff' : 'Sub-staff of ' + item.parentName}</Text>
        )}
        <Text className="text-gray-400 text-xs mt-0.5">Joined: {new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <View className="flex-row">
        <TouchableOpacity
          onPress={() => startEdit(item)}
          className="bg-gray-100 px-3 py-1.5 rounded-lg mr-2"
        >
          <Text className="text-gray-700 font-semibold text-xs">Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleRemove(item)}
          className="bg-red-50 px-3 py-1.5 rounded-lg"
        >
          <Text className="text-red-600 font-semibold text-xs">Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRemovedItem = ({ item }: { item: SubStaffRow }) => (
    <View className="bg-gray-100 rounded-xl p-4 mb-3 border border-gray-200 flex-row justify-between items-center">
      <View className="flex-1 pr-2">
        <Text className="font-semibold text-gray-500 text-base">{item.name}</Text>
        <Text className="text-gray-400 text-sm">{item.phone}</Text>
        {isAdmin && !!item.parentName && (
          <Text className="text-gray-400 text-xs mt-0.5">{item.parentId === user?.id ? 'Staff' : 'Sub-staff of ' + item.parentName}</Text>
        )}
      </View>
      <View className="bg-gray-200 px-3 py-1.5 rounded-lg">
        <Text className="text-gray-600 font-semibold text-xs">Removed</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-primary px-4 pt-4 pb-4">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-white font-bold text-xl">{isAdmin ? 'Staff & Sub-Staff Management' : 'Sub-Staff Management'}</Text>
          <TouchableOpacity onPress={loadSubStaff}>
            <Text className="text-white font-semibold">Refresh</Text>
          </TouchableOpacity>
        </View>

        {canCreate && <TouchableOpacity
          className="bg-white rounded-xl py-3 items-center shadow-sm"
          onPress={() => (showForm ? resetForm() : setShowForm(true))}
        >
          <Text className="text-primary font-bold text-base">
            {showForm ? '✕ Close Form' : isAdmin ? '+ Create Account' : '+ Register Sub-Staff'}
          </Text>
        </TouchableOpacity>}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1">
          {showForm && canCreate && (
            <View className="bg-white px-4 py-4 border-b border-gray-200 shadow-sm">
              <Text className="text-gray-700 font-semibold mb-2">
                {editingId ? 'Edit Account' : isAdmin ? 'Create Staff Account' : 'Register Sub-Staff Account'}
              </Text>
              {!editingId && isAdmin && (
                <View className="mb-3">
                  <View className="flex-row mb-3">
                    {(['staff', 'substaff'] as const).map(kind => (
                      <TouchableOpacity key={kind} onPress={() => { setAccountType(kind); setParentStaffId(''); }}
                        className={`px-3 py-2 rounded-lg mr-2 ${accountType === kind ? 'bg-primary' : 'bg-gray-100'}`}>
                        <Text className={`font-semibold ${accountType === kind ? 'text-white' : 'text-gray-700'}`}>{kind === 'staff' ? 'Staff' : 'Sub-Staff'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {accountType === 'substaff' && (
                    <View>
                      <Text className="text-gray-700 font-semibold mb-2">Parent Staff</Text>
                      {!parents.length && <Text className="text-gray-500 text-sm mb-2">Create a staff account first.</Text>}
                      {parents.map(parent => (
                        <TouchableOpacity key={parent.id} onPress={() => setParentStaffId(parent.id)}
                          className={`px-4 py-3 rounded-xl mb-2 border ${parentStaffId === parent.id ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200'}`}>
                          <Text className={`font-semibold ${parentStaffId === parent.id ? 'text-white' : 'text-gray-700'}`}>{parent.name} · {parent.phone}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-3 mb-3 text-gray-800 border border-gray-200"
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
              />
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-3 mb-3 text-gray-800 border border-gray-200"
                placeholder="Phone Number (e.g. 03001234567)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              {!editingId && (
                <TextInput
                  className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-gray-800 border border-gray-200"
                  placeholder="Login Password (min 8, 1 capital, 1 number)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              )}
              <TouchableOpacity
                className={`bg-primary py-3.5 rounded-xl items-center ${submitting ? 'opacity-70' : ''}`}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text className="text-white font-bold text-base">
                  {submitting
                    ? (editingId ? 'Saving...' : 'Registering...')
                    : (editingId ? 'Save Changes' : 'Register Account')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View className="px-4 py-4">
            <Text className="text-gray-500 font-medium text-sm mb-3">
              {isAdmin ? 'Staff & Sub-Staff Accounts' : 'Sub-Staff Accounts'}
            </Text>
            {loading ? (
              <ActivityIndicator size="large" color="#00A651" className="mt-8" />
            ) : active.length === 0 ? (
              <View className="bg-white rounded-xl p-8 items-center border border-gray-100 shadow-sm mt-4">
                <Text className="text-gray-400 text-base">{!canCreate ? 'Only owners and staff can manage accounts.' : 'No accounts registered'}</Text>
              </View>
            ) : (
              <FlatList
                data={active}
                renderItem={renderActiveItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />
            )}

            {!loading && removed.length > 0 && (
              <View className="mt-6">
                <Text className="text-gray-500 font-medium text-sm mb-1">Removed</Text>
                <Text className="text-gray-400 text-xs mb-3">
                  These accounts can no longer log in. Their past entries are kept and still appear in your books.
                </Text>
                <FlatList
                  data={removed}
                  renderItem={renderRemovedItem}
                  keyExtractor={item => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
