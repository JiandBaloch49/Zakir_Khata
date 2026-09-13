import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useActivityStore } from '../../store/useActivityStore';
import { useStaffStore } from '../../store/useStaffStore';
import { TranslateToUrdu } from '../../components/TranslateToUrdu';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

export const AddStaffModal = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { addStaff } = useStaffStore();
  const { logActivity } = useActivityStore();

  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);

  const [nameEn, setNameEn] = useState('');
  const [nameUr, setNameUr] = useState('');
  
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [joiningDate, setJoiningDate] = useState(todayDate());
  const [area, setArea] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!nameEn.trim()) e.nameEn = 'Name required';
    if (!phone.trim()) e.phone = 'Phone required';
    if (!role.trim()) e.role = 'Role required';
    if (!joiningDate.trim()) e.joiningDate = 'Date required';
    if (!area.trim()) e.area = 'Area required';
    if (!businessType.trim()) e.businessType = 'Business type required';

    if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = 'Invalid email';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePickPicture = () => {
    Alert.alert('Image Picker', 'Select profile picture (Placeholder)');
  };

  const handleAddDocument = () => {
    Alert.alert('Document Picker', 'Select document to upload (Placeholder)');
    setDocumentUrls([...documentUrls, `doc_${Date.now()}.pdf`]);
  };

  const handleSubmit = async () => {
    if (!validate() || !user) {
      if (Object.keys(errors).length > 0) {
        Alert.alert('Error', 'Please fix the highlighted fields.');
      }
      return;
    }

    setLoading(true);
    try {
      await addStaff({
        user_id: user.id,
        name_en: nameEn.trim(),
        name_ur: nameUr.trim() || undefined,
        phone: phone.trim(),
        role: role.trim(),
        joining_date: joiningDate,
        area: area.trim(),
        business_type: businessType.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        status: status,
        picture_url: pictureUrl || undefined,
        document_urls: documentUrls.length > 0 ? documentUrls : undefined,
      });
      
      // Log Activity
      await logActivity({
        user_id: user.id,
        user_name: user.name || 'User',
        action: 'create',
        entity_type: 'staff',
        description: `added staff member ${nameEn.trim()}`
      });

      Alert.alert('Success', 'Staff added successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      if (__DEV__) console.error(err);
      Alert.alert('Error', 'Failed to save staff record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Staff</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={styles.form}>
        {/* Picture Section */}
        <View style={styles.pictureContainer}>
          <View style={styles.pictureBox}>
            <Text style={{ fontSize: 44, color: Colors.textGray }}>👤</Text>
          </View>
          <TouchableOpacity style={styles.cameraIconBtn} onPress={handlePickPicture}>
            <Text style={{ fontSize: 18, color: '#fff' }}>📷</Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Staff Name *</Text>
          <TextInput
            style={[styles.input, errors.nameEn ? styles.inputError : null]}
            placeholder="e.g. Ahmed Ali"
            placeholderTextColor={Colors.textGray}
            value={nameEn}
            onChangeText={t => { setNameEn(t); setErrors(p => ({ ...p, nameEn: '' })); }}
            autoFocus
          />
          <TranslateToUrdu value={nameUr} onSave={setNameUr} sourceText={nameEn} />
          {!!errors.nameEn && <Text style={styles.errText}>{errors.nameEn}</Text>}
        </View>

        {/* Phone */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={[styles.input, errors.phone ? styles.inputError : null]}
            placeholder="+92 300 1234567"
            placeholderTextColor={Colors.textGray}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={t => { setPhone(t); setErrors(p => ({ ...p, phone: '' })); }}
          />
          {!!errors.phone && <Text style={styles.errText}>{errors.phone}</Text>}
        </View>

        {/* Role */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Role / Position *</Text>
          <TextInput
            style={[styles.input, errors.role ? styles.inputError : null]}
            placeholder="e.g., Manager, Sales, Driver"
            placeholderTextColor={Colors.textGray}
            value={role}
            onChangeText={t => { setRole(t); setErrors(p => ({ ...p, role: '' })); }}
          />
          {!!errors.role && <Text style={styles.errText}>{errors.role}</Text>}
        </View>

        {/* Joining Date */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Joining Date *</Text>
          <DateField
            style={[styles.input, errors.joiningDate ? styles.inputError : null]}
            value={joiningDate}
            onChange={d => { setJoiningDate(d); setErrors(p => ({ ...p, joiningDate: '' })); }}
          />
          {!!errors.joiningDate && <Text style={styles.errText}>{errors.joiningDate}</Text>}
        </View>

        {/* Area & Business */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[styles.fieldWrap, { flex: 1 }]}>
            <Text style={styles.label}>Area / City *</Text>
            <TextInput
              style={[styles.input, errors.area ? styles.inputError : null]}
              placeholder="e.g., Lahore"
              placeholderTextColor={Colors.textGray}
              value={area}
              onChangeText={t => { setArea(t); setErrors(p => ({ ...p, area: '' })); }}
            />
            {!!errors.area && <Text style={styles.errText}>{errors.area}</Text>}
          </View>

          <View style={[styles.fieldWrap, { flex: 1 }]}>
            <Text style={styles.label}>Business Type *</Text>
            <TextInput
              style={[styles.input, errors.businessType ? styles.inputError : null]}
              placeholder="e.g., Retail"
              placeholderTextColor={Colors.textGray}
              value={businessType}
              onChangeText={t => { setBusinessType(t); setErrors(p => ({ ...p, businessType: '' })); }}
            />
            {!!errors.businessType && <Text style={styles.errText}>{errors.businessType}</Text>}
          </View>
        </View>

        {/* Optional: Email & Address */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Email (Optional)</Text>
          <TextInput
            style={[styles.input, errors.email ? styles.inputError : null]}
            placeholder="email@example.com"
            placeholderTextColor={Colors.textGray}
            keyboardType="email-address"
            value={email}
            onChangeText={t => { setEmail(t); setErrors(p => ({ ...p, email: '' })); }}
          />
          {!!errors.email && <Text style={styles.errText}>{errors.email}</Text>}
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Address (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Complete address"
            placeholderTextColor={Colors.textGray}
            value={address}
            onChangeText={setAddress}
          />
        </View>

        {/* Documents */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Documents (Optional)</Text>
          {documentUrls.map((doc, i) => (
            <View key={i} style={styles.docItem}>
              <Text style={styles.docText}>📎 {doc}</Text>
              <TouchableOpacity onPress={() => setDocumentUrls(documentUrls.filter((_, idx) => idx !== i))}>
                <Text style={{ color: Colors.error, fontWeight: 'bold' }}>X</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.attachBtn} onPress={handleAddDocument}>
            <Text style={{ color: Colors.primaryLight, fontWeight: '600' }}>+ Add Document / Image</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button inside ScreenContainer */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.65 }, { marginTop: 12, marginBottom: 24 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>SAVE STAFF</Text>
          }
        </TouchableOpacity>

      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textWhite, fontWeight: '400' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },

  form: { padding: 16, paddingBottom: 40 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textWhite, marginBottom: 6 },

  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 14, color: Colors.textWhite,
  },
  inputError: { borderColor: Colors.error },
  errText: { fontSize: 12, color: Colors.error, marginTop: 4 },

  pictureContainer: { alignSelf: 'center', marginVertical: 16, position: 'relative' },
  pictureBox: {
    width: 110, height: 110, backgroundColor: Colors.bgInput,
    borderRadius: 55, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  cameraIconBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: Colors.primary, width: 36, height: 36,
    borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.bgCard
  },

  radioBtn: {
    flex: 1, height: 44, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgInput
  },
  radioActive: { borderColor: Colors.primary, backgroundColor: Colors.bgCard },
  radioInactive: { borderColor: Colors.error, backgroundColor: Colors.bgCard },
  radioText: { fontSize: 14, fontWeight: '500', color: Colors.textGray },
  radioTextActive: { color: Colors.primaryLight, fontWeight: '700' },
  radioTextInactive: { color: Colors.error, fontWeight: '700' },

  attachBtn: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.primary,
    borderRadius: 10, height: 46, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgInput
  },
  docItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.bgCard, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 8
  },
  docText: { fontSize: 14, color: Colors.textWhite },

  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, height: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '700', color: Colors.textWhite },
});
