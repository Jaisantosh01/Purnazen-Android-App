import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';

const ChatAssistantScreen = ({ route, navigation }) => {
  const { startQuestionId, reliefTitle } = route.params;

  const [flow, setFlow] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentQuestionId, setCurrentQuestionId] = useState(startQuestionId);
  const [loading, setLoading] = useState(true);

  const scrollViewRef = useRef();

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
  }, [startQuestionId]);

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
        <ActivityIndicator size="large" color={COLORS.primary} />
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
              <MCIcon name="robot-outline" size={20} color={COLORS.primary} />
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
              >
                <Text style={styles.optionText}>{opt.optionText}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerIcon}>
            <MCIcon name="robot-outline" size={20} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>M-Heal Assistant</Text>
            <Text style={styles.headerSub}>Always here to help</Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {history.map(renderBubble)}
      </ScrollView>

      {history[history.length - 1]?.isFinal && (
        <View style={styles.footer}>
           <TouchableOpacity 
            style={styles.startSessionBtn}
            onPress={() => {
              const finalMsg = history[history.length - 1];
              if (finalMsg.videoGroupId) {
                navigation.navigate('VideoPlayer', {
                  groupId: finalMsg.videoGroupId,
                  groupTitle: reliefTitle
                });
              } else {
                navigation.navigate('Relief');
              }
            }}
           >
             <Text style={styles.startSessionText}>Browse Sessions</Text>
             <MCIcon name="arrow-right" size={20} color={COLORS.white} />
           </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default ChatAssistantScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textMuted,
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
    backgroundColor: COLORS.primaryLight,
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
    backgroundColor: '#edf7f3',
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  botText: {
    color: COLORS.textPrimary,
  },
  userText: {
    color: COLORS.white,
  },
  optionsInlineContainer: {
    marginLeft: 40,
    marginBottom: 20,
    gap: 8,
  },
  optionBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  optionText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  startSessionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 10,
  },
  startSessionText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: COLORS.white,
  },
});
