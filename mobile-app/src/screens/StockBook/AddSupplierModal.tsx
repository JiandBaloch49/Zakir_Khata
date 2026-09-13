import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';

interface Props {
  navigation: any;
  route?: { params?: { supplierId?: string; edit?: boolean } };
}

export const AddSupplierModal = ({ navigation, route }: Props) => {
  const isEdit = route?.params?.edit ?? false;
  const supplierId = route?.params?.supplierId;
  const { user } = useAuthStore();
  const { addSupplier, updateSupplier, selectedSupplier, loadSupplierById } = useSupplierStore();

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEdit && supplierId) {
      loadSupplierById(supplierId).then(() => {});
    }
  }, [isEdit, supplierId]);

  useEffect(() => {
    if (isEdit && selectedSupplier) {
      setName(selectedSupplier.name || '');
      setBusinessName(selectedSupplier.business_name || '');
      setPhone(selectedSupplier.phone || '');
      setEmail(selectedSupplier.email || '');
      setAddress(selectedSupplier.address || '');
      setCity(selectedSupplier.city || '');
      setNotes(selectedSupplier.notes || '');
    }
  }, [selectedSupplier, isEdit]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Supplier name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !user) return;
    setLoading(true);
    try {
      if (isEdit && supplierId) {
        await updateSupplier(supplierId, user.id, {
          name: name.trim(),
          business_name: businessName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        Alert.alert('Updated', 'Supplier updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        await addSupplier(
          user.id, name.trim(),
          phone.trim() || undefined,
          businessName.trim() || undefined,
          address.trim() || undefined,
          email.trim() || undefined,
          city.trim() || undefined,
          notes.trim() || undefined,
        );
        Alert.alert('Added', 'Supplier added successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to save supplier. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Supplier' : 'Add Supplier'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={false} contentContainerStyle={styles.form}>
        <Field label="Supplier Name *" value={name} onChange={setName} placeholder="e.g. Ali Traders" error={errors.name} />
        <Field label="Business / Shop Name" value={businessName} onChange={setBusinessName} placeholder="e.g. Ali General Store" />
        <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="03001234567" keyboardType="phone-pad" />
        <Field label="Email Address" value={email} onChange={setEmail} placeholder="supplier@email.com" keyboardType="email-address" />
        <Field label="City" value={city} onChange={setCity} placeholder="e.g. Lahore" />
        <Field label="Address" value={address} onChange={setAddress} placeholder="Full address..." multiline />
        <Field label="Notes" value={notes} onChange={setNotes} placeholder="Any notes about this supplier..." multiline />

        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{isEdit ? 'UPDATE SUPPLIER' : 'SAVE SUPPLIER'}</Text>}
        </TouchableOpacity>
      </ScreenContainer>
    </SafeAreaView>
  );
};

const Field = ({ label, value, onChange, placeholder, keyboardType = 'default', multiline = false, error = '' }: any) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMulti, error ? styles.inputErr : null]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      placeholderTextColor={Colors.textGray}
    />
    {!!error && <Text style={styles.errText}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36 },
  backArrow: { fontSize: 22, color: Colors.textWhite, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },
  form: { padding: 20, paddingBottom: 40 },
  fieldWrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textWhite, marginBottom: 6 },
  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textWhite,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  inputErr: { borderColor: Colors.error },
  errText: { fontSize: 12, color: Colors.error, marginTop: 4 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
});
