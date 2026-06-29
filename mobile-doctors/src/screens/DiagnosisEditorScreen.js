import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import useConsultationStore from '../store/consultationStore';
import { showError } from '../utils/toast';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const DiagnosisEditorScreen = ({ route, navigation }) => {
  const { mode = 'create', recordId } = route.params || {};

  const records = useConsultationStore(s => s.diagnoses);
  const addRecord = useConsultationStore(s => s.addDiagnosis);
  const updateRecord = useConsultationStore(s => s.updateDiagnosis);

  const existing = mode === 'edit' ? records.find(r => r.id === recordId) : null;
  const [text, setText] = useState(existing?.content || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      if (mode === 'edit' && recordId) {
        await updateRecord(recordId, trimmed);
      } else {
        await addRecord(trimmed);
      }
      navigation.goBack();
    } catch (err) {
      showError(err?.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={mode === 'edit' ? 'Edit Diagnosis' : 'Diagnosis'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.editorWrap}>
          <View style={styles.labelRow}>
            <MCIcon name="stethoscope" size={18} color={COLORS.primary} />
            <Text style={styles.labelText}>Diagnosis</Text>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Enter diagnosis details…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            textAlignVertical="top"
            autoFocus
            value={text}
            onChangeText={setText}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, (!text.trim() || saving) && styles.btnDisabled]}
            activeOpacity={0.85}
            disabled={!text.trim() || saving}
            onPress={handleSave}>
            <MCIcon name="content-save-outline" size={20} color={COLORS.white} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default DiagnosisEditorScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },
  editorWrap: { flex: 1, padding: SPACING.lg, paddingBottom: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  labelText: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 24,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    textAlignVertical: 'top',
  },
  footer: { padding: SPACING.lg },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },
});
