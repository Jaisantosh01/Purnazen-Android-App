import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

// Chat asks Mild/Moderate/Severe once; midpoints become therapy_feedback.painBefore
// so we don't re-ask with a 0–10 slider before the video.
const SEVERITY_TO_PAIN = {
  mild: 2,
  moderate: 5,
  severe: 8,
};

function painBeforeFromHistory(history) {
  for (const item of history) {
    if (item.type !== 'user') continue;
    const t = String(item.text || '').toLowerCase();
    for (const [key, value] of Object.entries(SEVERITY_TO_PAIN)) {
      if (t.includes(key)) return value;
    }
  }
  return null;
}

const ChatAssistantScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { startQuestionId, reliefTitle } = route.params;

  const [flow, setFlow] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentQuestionId, setCurrentQuestionId] = useState(startQuestionId);
  const [loading, setLoading] = useState(true);

  const scrollViewRef = useRef();

  const navigateToVideos = useCallback((groupId, baseline = null) => {
    if (groupId) {
      navigation.navigate('VideoPlayer', {
        groupId,
        groupTitle: reliefTitle,
        // Everything reached from a Quick Relief card is a relief run, not a
        // wellness one — this is what the session gets filed as.
        sessionType: 'relief',
        painBefore: baseline?.painBefore ?? null,
        painDescription: baseline?.painDescription ?? null,
      });
    } else {
      navigation.navigate('Relief');
    }
  }, [navigation, reliefTitle]);

  const handleBrowseSession = useCallback((finalMsg) => {
    const groupId = finalMsg?.videoGroupId;
    if (!groupId) {
      navigateToVideos(null);
      return;
    }
    // Map the chatbot severity answer → painBefore (posted by VideoPlayer).
    navigateToVideos(groupId, {
      painBefore: painBeforeFromHistory(history),
    });
  }, [navigateToVideos, history]);

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.CHAT_FLOW(startQuestionId))
      .then(res => {
        setFlow(res.data);
        const startQ = res.data[startQuestionId];
        if (startQ) {
          setHistory([{ type: 'bot', text: `Hi! I'm here to help with your ${reliefTitle.toLowerCase()}. Let me ask you a few quick questions to recommend the best acupressure therapy.`, id: 'welcome' }, { type: 'bot', ...startQ }]);
        }
      })
      .catch(err => {
        console.error('Chat flow error:', err);
      })
      .finally(() => setLoading(false));
  }, [startQuestionId, reliefTitle]);

  const handleOptionSelect = (option) => {
    // Add user selection to history
    const nextHistory = [...history, { type: 'user', text: option.optionText }];

    if (option.nextQuestionId && flow[option.nextQuestionId]) {
      const nextQ = flow[option.nextQuestionId];
      setHistory([...nextHistory, { type: 'bot', ...nextQ }]);
      setCurrentQuestionId(option.nextQuestionId);
    } else {
      // Final option selected
      setHistory([...nextHistory, { type: 'bot', text: "Thank you! I've found the perfect session for you.", isFinal: true, videoGroupId: option.videoGroupId }]);
    }
  };

  useEffect(() => {
    // Auto-scroll to bottom when history changes
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [history]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderBubble = (item, index) => {
    const isBot = item.type === 'bot';
    const isLast = index === history.length - 1;
    const showOptionsInBubble = isBot && item.options && isLast && !item.isFinal;

    return (
      <View key={index}>
        <View style={[styles.bubbleContainer, isBot ? styles.botContainer : styles.userContainer]}>
          {isBot && (
            <View style={styles.botIcon}>
              <MCIcon name="robot-outline" size={20} color={colors.primary} />
            </View>
          )}
          <View style={[styles.bubble, isBot ? styles.botBubble : styles.userBubble]}>
            <Text style={[styles.bubbleText, isBot ? styles.botText : styles.userText]}>
              {item.questionText || item.text}
            </Text>
          </View>
        </View>

        {showOptionsInBubble && (
          <View style={styles.optionsInlineContainer}>
            {item.options.map((opt, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.optionBtn}
                onPress={() => handleOptionSelect(opt)}
                activeOpacity={0.85}
              >
                <Text style={styles.optionText}>{opt.optionText}</Text>
                <MCIcon name="arrow-right" size={16} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="M-Heal Assistant"
        subtitle="Always here to help"
        variant="light"
        onBack={() => navigation.goBack()}
        right={
          <View style={styles.headerIcon}>
            <MCIcon name="robot-outline" size={20} color={colors.primary} />
          </View>
        }
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {history.map(renderBubble)}
      </ScrollView>

      {history[history.length - 1]?.isFinal && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
           <TouchableOpacity
            style={styles.startSessionBtn}
            onPress={() => {
              const finalMsg = history[history.length - 1];
              handleBrowseSession(finalMsg);
            }}
           >
             <Text style={styles.startSessionText}>Browse Sessions</Text>
             <MCIcon name="arrow-right" size={20} color={colors.white} />
           </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default ChatAssistantScreen;

const makeStyles = colors => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.card,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  bubbleContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    maxWidth: '85%',
  },
  botContainer: {
    alignSelf: 'flex-start',
  },
  userContainer: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  botIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  botBubble: {
    backgroundColor: colors.primaryFaint,
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  botText: {
    color: colors.textPrimary,
  },
  userText: {
    color: colors.white,
  },
  optionsInlineContainer: {
    marginLeft: 40,
    marginBottom: 20,
    gap: 8,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  startSessionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 10,
  },
  startSessionText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
});
