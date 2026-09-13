import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { changePassword } from '../../services/database/userDb';
import { useAuthStore } from '../../store/authStore';

export const ChangePasswordScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (!user) return;

    Alert.alert('Confirm', 'Are you sure you want to update your password?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Update',
        onPress: async () => {
          setLoading(true);
          try {
            await changePassword(user.id, newPassword);
            Alert.alert('Success', 'Your password has been updated successfully.', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
          } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to update password. Please try again.');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              This will update your account password. Next time you log in, please use the new password.
            </Text>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              secureTextEntry
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleUpdate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>UPDATE PASSWORD</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EA580C', paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { width: 36 },
  backArrow: { fontSize: 22, color: '#fff', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  form: { padding: 20 },
  infoBox: { backgroundColor: '#FFF7ED', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#FDBA74' },
  infoText: { color: '#9A3412', fontSize: 13, lineHeight: 20 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  btn: { backgroundColor: '#EA580C', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
