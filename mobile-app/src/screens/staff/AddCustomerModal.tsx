import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { addCustomer, updateCustomer, canViewCnic } from '../../services/database/customerDb';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { CustomerAvatar } from '../../components/ui/CustomerAvatar';
import { pickCustomerPhoto, persistCustomerPhoto } from '../../utils/customerPhoto';

const GREEN = '#00A651';
const GRAY_BG = '#F3F4F6';

export const AddCustomerModal = ({ navigation, route }: any) => {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const [cnic, setCnic] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showCnic, setShowCnic] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user?.id) canViewCnic(user.id).then(setShowCnic).catch(() => setShowCnic(false)); }, [user?.id]);

  const onSaveCallback = route.params?.onSave;

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      return Alert.alert('Error', 'Please enter customer name');
    }

    setLoading(true);
    try {
      // Validation (phone/email/CNIC format) lives in addCustomer so every add path
      // enforces the same rules; a thrown message is shown as-is below.
      const newCustomer = await addCustomer({
        user_id: user.id,
        name, phone, notes, email, address, city,
        ...(showCnic ? { cnic } : {}),
      });
      if (photoUri) {
        // Copy out of the picker cache into app storage, then point the row at the copy.
        const durable = await persistCustomerPhoto(photoUri, newCustomer.id);
        await updateCustomer(newCustomer.id, user.id, { photo_local_path: durable });
        newCustomer.photo_local_path = durable;
      }
      
      if (onSaveCallback) {
        onSaveCallback(newCustomer);
      } else {
        Alert.alert('Success', 'Customer added successfully');
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenContainer scrollable={true} hasTabBar={true}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add New Customer</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photo</Text>
            <TouchableOpacity style={styles.photoRow} onPress={async () => { const uri = await pickCustomerPhoto(); if (uri) setPhotoUri(uri); }}>
              <CustomerAvatar name={name || '?'} uri={photoUri} style={styles.avatar} textStyle={styles.avatarText} />
              <Text style={styles.photoHint}>{photoUri ? 'Change Photo' : 'Add Photo (optional)'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ali Khan"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 0300 1234567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. ali@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {showCnic && <View style={styles.inputGroup}>
            <Text style={styles.label}>CNIC</Text>
            <TextInput
              style={styles.input}
              placeholder="12345-1234567-1"
              value={cnic}
              onChangeText={setCnic}
              keyboardType="numbers-and-punctuation"
              maxLength={15}
            />
          </View>}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Shop / street address"
              value={address}
              onChangeText={setAddress}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Lahore"
              value={city}
              onChangeText={setCity}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Any additional details..."
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.btnGreen, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Saving...' : 'Save Customer'}</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GRAY_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  form: { flex: 1, padding: 16 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#4B5563', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#111827'
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  photoHint: { fontSize: 14, color: GREEN, fontWeight: '600' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  btnGreen: { backgroundColor: GREEN, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
