import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
} from 'react-native';
import Video from 'react-native-video';
import reliefService from '../services/reliefService';
import therapyService from '../services/therapyService';
import { SessionPlayerSkeleton } from '../components/SkeletonLoader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const ReliefPlayer = ({ session, navigation }) => {
  const [isPlaying, setIsPlaying]           = useState(false);
  const [currentStep, setCurrentStep]       = useState(0);
  const [timeLeft, setTimeLeft]             = useState(session.steps[0].duration);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentCycle, setCurrentCycle]     = useState(1);
  const timerRef                            = useRef(null);
  const progressAnim                        = useRef(new Animated.Value(0)).current;

  const steps      = session.steps;
  const totalSteps = steps.length;

  const handleStepComplete = useCallback(() => {
    setCompletedSteps(prev => [...prev, currentStep]);
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
      setTimeLeft(steps[currentStep + 1].duration);
    } else if (currentCycle < session.totalCycles) {
      setCurrentCycle(prev => prev + 1);
      setCurrentStep(0); setCompletedSteps([]);
      setTimeLeft(session.steps[0].duration);
      progressAnim.setValue(0);
    } else {
      setIsPlaying(false);
      clearInterval(timerRef.current);
      therapyService.saveSession({
        title: session.title, type: 'relief',
        date: new Date().toISOString(), duration: session.duration,
        status: 'Completed', painBefore: null, painAfter: null,
      }).catch(err => console.log('Save session failed:', err.message));
    }
  }, [currentStep, totalSteps, steps, currentCycle, session, progressAnim]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { handleStepComplete(); return steps[currentStep]?.duration || 30; }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, currentStep, handleStepComplete, steps]);

  useEffect(() => {
    const stepDuration = steps[currentStep]?.duration || 30;
    Animated.timing(progressAnim, {
      toValue: (stepDuration - timeLeft) / stepDuration,
      duration: 500, useNativeDriver: false,
    }).start();
  }, [timeLeft, currentStep, progressAnim, steps]);

  const handleRestart = () => {
    clearInterval(timerRef.current);
    setIsPlaying(false); setCurrentStep(0);
    setTimeLeft(steps[0].duration); setCompletedSteps([]); setCurrentCycle(1);
    progressAnim.setValue(0);
  };

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{session.title}</Text>
          <Text style={styles.headerSubtitle}>{session.duration} session</Text>
        </View>
        <Text style={styles.cycleText}>Cycle {currentCycle}/{session.totalCycles}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.animationArea}>
          {session.videoUrl ? (
            <Video source={{ uri: session.videoUrl }} style={styles.video}
              paused={!isPlaying} resizeMode="contain" repeat={false} onEnd={handleStepComplete} />
          ) : (
            <View style={styles.iconCircle}>
              <Text style={styles.poseIcon}>{session.icon}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.floatingPlayBtn} onPress={() => setIsPlaying(p => !p)} activeOpacity={0.85}>
            <Text style={styles.floatingPlayIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.stepCount}>Step {currentStep + 1} of {totalSteps}</Text>
            <Text style={styles.timerText}>{timeLeft}s</Text>
          </View>
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
          <View style={styles.dotsRow}>
            {steps.map((_, index) => (
              <View key={index} style={[
                styles.dot,
                index === currentStep && styles.dotActive,
                completedSteps.includes(index) && styles.dotCompleted,
              ]} />
            ))}
          </View>
        </View>

        <View style={styles.currentStepCard}>
          <View style={styles.stepNumberCircle}>
            <Text style={styles.stepNumber}>{currentStep + 1}</Text>
          </View>
          <View style={styles.stepInfo}>
            <Text style={styles.stepName}>{steps[currentStep].name}</Text>
            <Text style={styles.stepDescription}>{steps[currentStep].description}</Text>
          </View>
        </View>

        <View style={styles.sessionStepsSection}>
          <Text style={styles.sessionStepsLabel}>SESSION STEPS</Text>
          {steps.map((step, index) => {
            const isActive    = index === currentStep;
            const isCompleted = completedSteps.includes(index);
            return (
              <View key={step.id} style={[styles.stepRow, isActive && styles.stepRowActive]}>
                <View style={[
                  styles.stepRowNumber,
                  isCompleted && styles.stepRowNumberCompleted,
                  isActive && styles.stepRowNumberActive,
                ]}>
                  {isCompleted
                    ? <Text style={styles.checkIcon}>✓</Text>
                    : <Text style={[styles.stepRowNumberText, isActive && styles.stepRowNumberTextActive]}>{index + 1}</Text>}
                </View>
                <View style={styles.stepRowInfo}>
                  <Text style={[styles.stepRowName, isActive && styles.stepRowNameActive]}>{step.name}</Text>
                  <Text style={styles.stepRowDuration}>{step.duration}s</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.restartBtn} onPress={handleRestart} activeOpacity={0.85}>
          <Text style={styles.restartIcon}>↺</Text>
          <Text style={styles.restartText}>Restart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.startBtn} onPress={() => setIsPlaying(p => !p)} activeOpacity={0.85}>
          <Text style={styles.startBtnIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          <Text style={styles.startBtnText}>{isPlaying ? 'Pause' : 'Start'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ReliefSessionScreen = ({ navigation, route }) => {
  const reliefKey = route?.params?.reliefKey || route?.params?.reliefTitle || 'Headache';
  const [session, setSession]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    reliefService.getReliefSession(reliefKey)
      .then(data => { setSession(data); setIsLoading(false); })
      .catch(err => { setError(err.message || 'Failed to load session'); setIsLoading(false); });
  }, [reliefKey]);

  if (isLoading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Loading…</Text>
          </View>
          <View style={styles.backBtn} />
        </View>
        <SessionPlayerSkeleton />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorState}>
          <MCIcon name="alert-circle-outline" size={60} color="#EF4444" />
          <Text style={styles.errorTitle}>Session not found</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.errorRetryBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ReliefPlayer session={session} navigation={navigation} />
    </>
  );
};

export default ReliefSessionScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceMuted,
  },
  backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon:      { fontSize: 22, color: COLORS.textPrimary },
  headerCenter:  { alignItems: 'center' },
  headerTitle:   { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  headerSubtitle:{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  cycleText:     { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  animationArea: {
    width: '100%', height: 350, backgroundColor: COLORS.black,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  poseIcon: { fontSize: 40 },
  video:    { width: '100%', height: '100%' },
  floatingPlayBtn: {
    position: 'absolute', bottom: SPACING.lg, right: SPACING.lg,
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  floatingPlayIcon: { fontSize: 18, color: COLORS.white },

  progressCard: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg, marginTop: SPACING.lg, padding: SPACING.lg,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stepCount:  { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  timerText:  { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  progressBarBg: {
    height: 6, backgroundColor: 'rgba(31,167,122,0.2)',
    borderRadius: 3, marginBottom: 12, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  dotsRow:     { flexDirection: 'row', gap: 6 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(31,167,122,0.3)' },
  dotActive:   { backgroundColor: COLORS.primary, width: 10, height: 10, borderRadius: 5 },
  dotCompleted:{ backgroundColor: COLORS.primary },

  currentStepCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg, marginTop: SPACING.md, padding: SPACING.lg, elevation: 1,
  },
  stepNumberCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primaryLight, alignItems: 'center',
    justifyContent: 'center', marginRight: SPACING.md,
  },
  stepNumber:      { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  stepInfo:        { flex: 1 },
  stepName:        { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  stepDescription: { fontSize: 13, color: COLORS.textSecondary },

  sessionStepsSection: { marginHorizontal: SPACING.lg, marginTop: SPACING.xl },
  sessionStepsLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1, marginBottom: SPACING.md,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: RADIUS.sm,
    padding: 14, marginBottom: SPACING.sm, elevation: 1,
  },
  stepRowActive:          { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary },
  stepRowNumber:          { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  stepRowNumberActive:    { backgroundColor: COLORS.primary },
  stepRowNumberCompleted: { backgroundColor: COLORS.primary },
  stepRowNumberText:      { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  stepRowNumberTextActive:{ color: COLORS.white },
  checkIcon:       { fontSize: 14, color: COLORS.white, fontWeight: '700' },
  stepRowInfo:     { flex: 1 },
  stepRowName:     { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  stepRowNameActive: { color: COLORS.primary },
  stepRowDuration: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  bottomBar: {
    flexDirection: 'row', position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.surfaceMuted, gap: SPACING.md, elevation: 10,
  },
  restartBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 14, gap: 6,
  },
  restartIcon: { fontSize: 16, color: COLORS.textSecondary },
  restartText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  startBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, gap: SPACING.sm,
  },
  startBtnIcon: { fontSize: 16, color: COLORS.white },
  startBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  errorState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xxl, gap: SPACING.sm,
  },
  errorTitle:    { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.lg },
  errorText:     { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  errorRetryBtn: {
    marginTop: SPACING.md, backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
