import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
  ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { CountryCodePicker } from '../../components/CountryCodePicker';
import { themeColors } from '../../theme/theme';
import { AmbientBackground } from '../../components/AmbientBackground';

const EyeIcon = ({ visible }: { visible: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    {visible ? (
      <>
        <Path
          d="M1 12C1 12 5 5 12 5C19 5 23 12 23 12C23 12 19 19 12 19C5 19 1 12 1 12Z"
          stroke="#b0bec5"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={12} r={3} stroke="#b0bec5" strokeWidth={2} />
      </>
    ) : (
      <>
        <Path
          d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12A18.45 18.45 0 0 1 5.06 5.06"
          stroke="#b0bec5"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M9.9 4.24A9.12 9.12 0 0 1 12 4C19 4 23 12 23 12A18.5 18.5 0 0 1 20.71 15.68"
          stroke="#b0bec5"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M14.12 14.12A3 3 0 1 1 9.88 9.88"
          stroke="#b0bec5"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line
          x1="1"
          y1="1"
          x2="23"
          y2="23"
          stroke="#1dd1a1"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </>
    )}
  </Svg>
);

export const LoginScreen = ({ navigation }: any) => {
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+92');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [passError, setPassError] = useState('');
  const { login, loading } = useAuthStore();
  const { language, setLanguage, t } = useLanguageStore();


  const isUrdu = language === 'ur';

  const validate = () => {
    let ok = true;
    const cleanPhone = phone.replace(/\s/g, '');
    if (!cleanPhone) { setPhoneError(t('errPhone')); ok = false; } else { setPhoneError(''); }
    if (!password) { setPassError(t('errPass')); ok = false; } else { setPassError(''); }
    return ok;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    
    const cleanPhone = phone.replace(/\s/g, '');
    const result = await login(countryCode + cleanPhone, password);
    if (result === 'invalid') {
      Alert.alert(t('errorTitle'), t('wrongCreds'));
    }
  };

  return (
    <AmbientBackground style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Top bar: Language Toggle ── */}
            <View style={styles.topBar}>
              <Text style={styles.topBarLabel}>🌐 Language</Text>
              <View style={styles.segmented}>
                <TouchableOpacity
                  style={[styles.segBtn, language === 'en' && styles.segBtnActive]}
                  onPress={() => setLanguage('en')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segBtnText, language === 'en' && styles.segBtnTextActive]}>
                    EN
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segBtn, language === 'ur' && styles.segBtnActive]}
                  onPress={() => setLanguage('ur')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segBtnText, language === 'ur' && styles.segBtnTextActive]}>
                    اردو
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Header ── */}
            <View style={styles.header}>
              <View style={styles.logoCircle}>
                <Image
                  source={require('../../../assets/favicon.png')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.appName}>AL REEF</Text>
              <Text style={styles.appTagline}>{t('appTagline')}</Text>
            </View>

            {/* ── Dark Ambient Card ── */}
            <View style={styles.card}>
              <Text style={[styles.cardTitle, isUrdu && styles.rtl]}>{t('cardTitle')}</Text>
              <Text style={[styles.cardSub, isUrdu && styles.rtl]}>{t('cardSub')}</Text>

              {/* Phone */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.label, isUrdu && styles.rtl]}>{t('labelPhone')}</Text>
                <View style={{ flexDirection: isUrdu ? 'row-reverse' : 'row' }}>
                  <CountryCodePicker selectedCode={countryCode} onSelect={setCountryCode} />
                  <TextInput
                    style={[styles.input, phoneError ? styles.inputError : null, { flex: 1 }]}
                    placeholder="3001234567"
                    placeholderTextColor={themeColors.text_secondary}
                    value={phone}
                    onChangeText={v => { setPhone(v); setPhoneError(''); }}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    textAlign={isUrdu ? 'right' : 'left'}
                  />
                </View>
                {!!phoneError && (
                  <Text style={[styles.errText, isUrdu && styles.rtl]}>{phoneError}</Text>
                )}
              </View>

              {/* Password */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.label, isUrdu && styles.rtl]}>{t('labelPassword')}</Text>
                <View style={styles.passRow}>
                  <TextInput
                    style={[
                      styles.input,
                      { flex: 1, marginBottom: 0 },
                      passError ? styles.inputError : null,
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor={themeColors.text_secondary}
                    value={password}
                    onChangeText={v => { setPassword(v); setPassError(''); }}
                    secureTextEntry={!showPassword}
                    textAlign={isUrdu ? 'right' : 'left'}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(v => !v)}
                  >
                    <EyeIcon visible={showPassword} />
                  </TouchableOpacity>
                </View>
                {!!passError && (
                  <Text style={[styles.errText, isUrdu && styles.rtl]}>{passError}</Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
                style={{ marginTop: 8 }}
              >
                <LinearGradient
                  colors={['#00A651', '#1dd1a1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.loginBtnText}>{t('loginBtn')}</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flexGrow: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(23, 32, 43, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  topBarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: themeColors.text_secondary,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 20, 25, 0.7)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  segBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 17,
  },
  segBtnActive: {
    backgroundColor: themeColors.primary,
  },
  segBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: themeColors.text_secondary,
  },
  segBtnTextActive: {
    color: '#fff',
  },

  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
  },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1dd1a1', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6, shadowRadius: 16, elevation: 10,
    overflow: 'hidden',
  },
  logoImage: { width: 90, height: 90, borderRadius: 45 },
  appName: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  appTagline: { fontSize: 13, color: themeColors.text_secondary, marginTop: 4 },

  rtl: { textAlign: 'right' },

  card: {
    flex: 1,
    backgroundColor: 'rgba(26, 31, 46, 0.90)',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardSub: { fontSize: 13, color: themeColors.text_secondary, marginBottom: 24 },

  fieldWrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: themeColors.text_secondary, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(23, 32, 43, 0.85)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: '#fff', minHeight: 48,
  },
  inputError: { borderColor: themeColors.error },
  errText: { fontSize: 12, color: themeColors.error, marginTop: 4 },

  passRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    backgroundColor: 'rgba(23, 32, 43, 0.85)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12, padding: 13, minHeight: 48, justifyContent: 'center',
  },

  loginBtn: {
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#1dd1a1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
    minHeight: 48, justifyContent: 'center',
  },
  loginBtnDisabled: { opacity: 0.5 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

});
