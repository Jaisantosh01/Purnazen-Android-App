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
import {
  YOGA_SESSION,
  MEDITATION_SESSION,
  BREATHING_SESSION,
  MORNING_ROUTINE_SESSION,
  EVENING_WIND_DOWN_SESSION,
  FULL_BODY_STRETCH_SESSION,
} from '../data/yogaSessionData';
import wellnessService from '../services/wellnessService';
import therapyService from '../services/therapyService';


const SESSION_MAP = {
  YogaSession:           YOGA_SESSION,
  MeditationSession:     MEDITATION_SESSION,
  BreathingSession:      BREATHING_SESSION,
  MorningRoutineSession: MORNING_ROUTINE_SESSION,
  EveningWindDown:       EVENING_WIND_DOWN_SESSION,
  FullBodyStretch:       FULL_BODY_STRETCH_SESSION,
};
const YogaSessionScreen = ({ navigation, route }) => {
  const sessionKey = route?.params?.sessionKey || 'YogaSession';
  const SESSION = SESSION_MAP[sessionKey] || YOGA_SESSION;

  const [isPlaying, setIsPlaying]       = useState(false);
  const [currentStep, setCurrentStep]   = useState(0);
  const [timeLeft, setTimeLeft]         = useState(SESSION.steps[0].duration);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [sessionData, setSessionData]   = useState(null);
  const timerRef                        = useRef(null);
  const progressAnim                    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await wellnessService.getSession(sessionKey);
        setSessionData(data);
      } catch (err) {
        console.log('Session fetch failed, using local data:', err.message);
      }
    };
    fetchSession();
  }, [sessionKey]);

  const activeSession = sessionData || SESSION;

  const steps = activeSession.steps;
  const totalSteps = steps.length;

  // Timer logic
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleStepComplete();
            return steps[currentStep]?.duration || 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, currentStep, handleStepComplete, steps]);

  // Progress bar animation
  useEffect(() => {
    const stepDuration = steps[currentStep]?.duration || 60;
    const progress = (stepDuration - timeLeft) / stepDuration;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [timeLeft, currentStep, progressAnim, steps]);

  const handleStepComplete = useCallback(() => {
    setCompletedSteps(prev => [...prev, currentStep]);
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
      setTimeLeft(steps[currentStep + 1].duration);
    } else {
      if (currentCycle < activeSession.totalCycles) {
        setCurrentCycle(prev => prev + 1);
        setCurrentStep(0);
        setCompletedSteps([]);
        setTimeLeft(activeSession.steps[0].duration);
        progressAnim.setValue(0);
      } else {
        setIsPlaying(false);
        clearInterval(timerRef.current);
        therapyService.saveSession({
          title:      activeSession.title,
          type:       'wellness',
          date:       new Date().toISOString(),
          duration:   activeSession.duration,
          status:     'Completed',
          painBefore: null,
          painAfter:  null,
        }).catch(err => console.log('Save session failed:', err.message));
      }
    }
  }, [currentStep, totalSteps, steps, currentCycle, activeSession, progressAnim]);

  const handleRestart = () => {
    clearInterval(timerRef.current);
    setIsPlaying(false);
    setCurrentStep(0);
    setTimeLeft(steps[0].duration);
    setCompletedSteps([]);
    setCurrentCycle(1);
    progressAnim.setValue(0);
  };

  const handlePlayPause = () => {
    setIsPlaying(prev => !prev);
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{activeSession.title}</Text>
          <Text style={styles.headerSubtitle}>{activeSession.duration}</Text>
        </View>
        <Text style={styles.cycleText}>
          Cycle {currentCycle}/{activeSession.totalCycles}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Video / Animation Area */}
        <View style={styles.animationArea}>
          {activeSession.videoUrl ? (
            <Video
              source={{ uri: activeSession.videoUrl }}
              style={styles.video}
              paused={!isPlaying}
              resizeMode="cover"
              repeat={false}
              onEnd={handleStepComplete}
            />
          ) : (
            <View style={styles.iconCircle}>
              <Text style={styles.poseIcon}>{activeSession.icon}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.floatingPlayBtn}
            onPress={handlePlayPause}
            activeOpacity={0.85}
          >
            <Text style={styles.floatingPlayIcon}>
              {isPlaying ? '⏸' : '▶'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.stepCount}>
              Step {currentStep + 1} of {totalSteps}
            </Text>
            <Text style={styles.timerText}>{timeLeft}s</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarBg}>
            <Animated.View
              style={[styles.progressBarFill, { width: progressWidth }]}
            />
          </View>

          {/* Step Dots */}
          <View style={styles.dotsRow}>
            {steps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentStep && styles.dotActive,
                  completedSteps.includes(index) && styles.dotCompleted,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Current Step Card */}
        <View style={styles.currentStepCard}>
          <View style={styles.stepNumberCircle}>
            <Text style={styles.stepNumber}>{currentStep + 1}</Text>
          </View>
          <View style={styles.stepInfo}>
            <Text style={styles.stepName}>{steps[currentStep].name}</Text>
            <Text style={styles.stepDescription}>
              {steps[currentStep].description}
            </Text>
          </View>
        </View>

        {/* Session Steps List */}
        <View style={styles.sessionStepsSection}>
          <Text style={styles.sessionStepsLabel}>SESSION STEPS</Text>
          {steps.map((step, index) => {
            const isActive    = index === currentStep;
            const isCompleted = completedSteps.includes(index);
            return (
              <View
                key={step.id}
                style={[
                  styles.stepRow,
                  isActive && styles.stepRowActive,
                ]}
              >
                <View style={[
                  styles.stepRowNumber,
                  isCompleted && styles.stepRowNumberCompleted,
                  isActive && styles.stepRowNumberActive,
                ]}>
                  {isCompleted ? (
                    <Text style={styles.checkIcon}>✓</Text>
                  ) : (
                    <Text style={[
                      styles.stepRowNumberText,
                      isActive && styles.stepRowNumberTextActive,
                    ]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                <View style={styles.stepRowInfo}>
                  <Text style={[
                    styles.stepRowName,
                    isActive && styles.stepRowNameActive,
                  ]}>
                    {step.name}
                  </Text>
                  <Text style={styles.stepRowDuration}>{step.duration}s</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.restartBtn}
          onPress={handleRestart}
          activeOpacity={0.85}
        >
          <Text style={styles.restartIcon}>↺</Text>
          <Text style={styles.restartText}>Restart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.startBtn}
          onPress={handlePlayPause}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnIcon}>
            {isPlaying ? '⏸' : '▶'}
          </Text>
          <Text style={styles.startBtnText}>
            {isPlaying ? 'Pause' : 'Start'}
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default YogaSessionScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: '#1a1a1a',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  cycleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1FA77A',
  },

  // Animation Area
  animationArea: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#e8f8f2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  poseIcon: {
    fontSize: 40,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  floatingPlayBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1FA77A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1FA77A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  floatingPlayIcon: {
    fontSize: 18,
    color: '#fff',
  },

  // Progress Card
  progressCard: {
    backgroundColor: '#e8f8f2',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  timerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1FA77A',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(31,167,122,0.2)',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1FA77A',
    borderRadius: 3,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(31,167,122,0.3)',
  },
  dotActive: {
    backgroundColor: '#1FA77A',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotCompleted: {
    backgroundColor: '#1FA77A',
  },

  // Current Step Card
  currentStepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  stepNumberCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8f8f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1FA77A',
  },
  stepInfo: {
    flex: 1,
  },
  stepName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: '#6b7280',
  },

  // Session Steps List
  sessionStepsSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sessionStepsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  stepRowActive: {
    backgroundColor: '#e8f8f2',
    borderWidth: 1,
    borderColor: '#1FA77A',
  },
  stepRowNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepRowNumberActive: {
    backgroundColor: '#1FA77A',
  },
  stepRowNumberCompleted: {
    backgroundColor: '#1FA77A',
  },
  stepRowNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  stepRowNumberTextActive: {
    color: '#fff',
  },
  checkIcon: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
  stepRowInfo: {
    flex: 1,
  },
  stepRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  stepRowNameActive: {
    color: '#1FA77A',
  },
  stepRowDuration: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
    elevation: 10,
  },
  restartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 6,
  },
  restartIcon: {
    fontSize: 16,
    color: '#6b7280',
  },
  restartText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  startBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1FA77A',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  startBtnIcon: {
    fontSize: 16,
    color: '#fff',
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});