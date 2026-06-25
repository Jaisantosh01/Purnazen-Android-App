import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar, ActivityIndicator, Modal, Alert, TextInput, ScrollView, Pressable } from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';
import { ROLE_ICONS, WELLNESS_ICONS } from '../constants/icons';
import { ListSkeleton } from '../components/SkeletonLoader';

const VideoManagementScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('sessions');
  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupIcon, setGroupIcon] = useState(ROLE_ICONS[0]);
  const [iconModalVisible, setIconModalVisible] = useState(false);
  const [iconTarget, setIconTarget] = useState('group');

  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDuration, setSessionDuration] = useState('');
  const [sessionIcon, setSessionIcon] = useState('meditation');
  const [sessionVideoGroupId, setSessionVideoGroupId] = useState(null);
  const [sessionIconModalVisible, setSessionIconModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchVideoGroups();
      fetchSessions();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchVideoGroups = () => {
    setGroupsLoading(true);
    apiClient.get(ENDPOINTS.VIDEO_GROUPS)
      .then(res => setGroups(res.data?.groups || []))
      .catch(() => Alert.alert('Error', 'Failed to fetch video groups'))
      .finally(() => setGroupsLoading(false));
  };

  const fetchSessions = () => {
    setSessionsLoading(true);
    apiClient.get(ENDPOINTS.ALL_SESSIONS)
      .then(res => setSessions(res.data?.sessions || []))
      .catch(() => Alert.alert('Error', 'Failed to fetch sessions'))
      .finally(() => setSessionsLoading(false));
  }

  const handleSaveGroup = () => {
    if (!groupTitle || !groupDescription) { Alert.alert('Error', 'Please fill in all fields'); return; }
    
    const payload = { title: groupTitle, description: groupDescription, icon: groupIcon };

    if (isEditingGroup && editingGroup) {
      apiClient.put(`${ENDPOINTS.VIDEO_GROUPS}/${editingGroup.id}`, payload)
        .then(() => { setGroupModalVisible(false); setIsEditingGroup(false); setEditingGroup(null); fetchVideoGroups(); })
        .catch(() => Alert.alert('Error', 'Failed to update'));
    } else {
      apiClient.post(ENDPOINTS.VIDEO_GROUPS, payload)
        .then(() => { setGroupModalVisible(false); fetchVideoGroups(); })
        .catch(() => Alert.alert('Error', 'Failed to add'));
    }
  };

  const handleDeleteGroup = (groupId) => {
    Alert.alert('Delete Group', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        apiClient.delete(`${ENDPOINTS.VIDEO_GROUPS}/${groupId}`)
          .then(fetchVideoGroups)
          .catch(() => Alert.alert('Error', 'Failed to delete'));
      }}
    ]);
  };

  const openEditGroupModal = (group) => {
    setEditingGroup(group);
    setGroupTitle(group.title);
    setGroupDescription(group.description);
    setGroupIcon(group.icon || ROLE_ICONS[0]);
    setIsEditingGroup(true);
    setGroupModalVisible(true);
  };

  const openAddGroupModal = () => {
    setGroupTitle('');
    setGroupDescription('');
    setGroupIcon(ROLE_ICONS[0]);
    setIsEditingGroup(false);
    setEditingGroup(null);
    setGroupModalVisible(true);
  };

  const handleSaveSession = () => {
    if (!sessionTitle || !sessionDuration) { Alert.alert('Error', 'Please fill in title and duration'); return; }
    
    const payload = {
      title: sessionTitle,
      duration: sessionDuration,
      icon: sessionIcon,
      video_group_id: sessionVideoGroupId,
    };

    if (isEditingSession && editingSession) {
      apiClient.put(`${ENDPOINTS.ALL_SESSIONS}/${editingSession.id}`, payload)
        .then(() => { setSessionModalVisible(false); setIsEditingSession(false); setEditingSession(null); fetchSessions(); })
        .catch(() => Alert.alert('Error', 'Failed to update session'));
    } else {
      apiClient.post(ENDPOINTS.ALL_SESSIONS, payload)
        .then(() => { setSessionModalVisible(false); fetchSessions(); })
        .catch(() => Alert.alert('Error', 'Failed to add session'));
    }
  };

  const handleDeleteSession = (sessionId) => {
    Alert.alert('Delete Session', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        apiClient.delete(`${ENDPOINTS.ALL_SESSIONS}/${sessionId}`)
          .then(fetchSessions)
          .catch(() => Alert.alert('Error', 'Failed to delete session'));
      }}
    ]);
  };

  const openEditSessionModal = (session) => {
    setEditingSession(session);
    setSessionTitle(session.title);
    setSessionDuration(session.duration);
    setSessionIcon(session.icon || 'meditation');
    setSessionVideoGroupId(session.videoGroupId);
    setIsEditingSession(true);
    setSessionModalVisible(true);
  };

  const openAddSessionModal = () => {
    setSessionTitle('');
    setSessionDuration('');
    setSessionIcon('meditation');
    setSessionVideoGroupId(null);
    setIsEditingSession(false);
    setEditingSession(null);
    setSessionModalVisible(true);
  };

  const groupRenderHiddenItem = (data, rowMap) => (
    <View style={styles.rowBack}>
      <TouchableOpacity style={[styles.backBtn, styles.deleteBack]} onPress={() => { handleDeleteGroup(data.item.id); rowMap[data.item.id]?.closeRow(); }}><MCIcon name="delete" size={24} color={COLORS.white} /></TouchableOpacity>
      <TouchableOpacity style={[styles.backBtn, styles.editBack]} onPress={() => { openEditGroupModal(data.item); rowMap[data.item.id]?.closeRow(); }}><MCIcon name="pencil" size={24} color={COLORS.white} /></TouchableOpacity>
    </View>
  );

  const sessionRenderHiddenItem = (data, rowMap) => (
    <View style={styles.rowBack}>
      <TouchableOpacity style={[styles.backBtn, styles.deleteBack]} onPress={() => { handleDeleteSession(data.item.id); rowMap[data.item.id]?.closeRow(); }}><MCIcon name="delete" size={24} color={COLORS.white} /></TouchableOpacity>
      <TouchableOpacity style={[styles.backBtn, styles.editBack]} onPress={() => { openEditSessionModal(data.item); rowMap[data.item.id]?.closeRow(); }}><MCIcon name="pencil" size={24} color={COLORS.white} /></TouchableOpacity>
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity style={[styles.tab, activeTab === 'sessions' && styles.activeTab]} onPress={() => setActiveTab('sessions')}>
        <Text style={[styles.tabText, activeTab === 'sessions' && styles.activeTabText]}>Sessions</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tab, activeTab === 'groups' && styles.activeTab]} onPress={() => setActiveTab('groups')}>
        <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>Video Groups</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Video Management</Text>
        <TouchableOpacity style={styles.addBtn} onPress={activeTab === 'sessions' ? openAddSessionModal : openAddGroupModal}>
          <MCIcon name="plus" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {renderTabBar()}

      {activeTab === 'sessions' && (
        sessionsLoading ? <ListSkeleton count={5} /> :
        <SwipeListView
          data={sessions}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {
              if (item.videoGroupId) {
                navigation.navigate('VideoGroupDetail', { groupId: item.videoGroupId, groupTitle: item.title });
              }
            }}>
              <View style={styles.iconContainer}><MCIcon name={item.icon || 'meditation'} size={24} color={COLORS.primary} /></View>
              <View style={styles.cardContent}>
                <Text style={styles.groupTitle}>{item.title}</Text>
                <Text style={styles.groupDescription}>{item.duration}</Text>
              </View>
              {item.videoGroupId && <MCIcon name="chevron-right" size={24} color={COLORS.textMuted} />}
            </TouchableOpacity>
          )}
          renderHiddenItem={sessionRenderHiddenItem}
          leftOpenValue={75}
          rightOpenValue={-75}
          contentContainerStyle={styles.list}
        />
      )}

      {activeTab === 'groups' && (
        groupsLoading ? <ListSkeleton count={5} /> :
        <SwipeListView
          data={groups}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => navigation.navigate('VideoGroupDetail', { groupId: item.id, groupTitle: item.title })}>
              <View style={styles.iconContainer}><MCIcon name={item.icon || 'folder'} size={24} color={COLORS.primary} /></View>
              <View style={styles.cardContent}>
                <Text style={styles.groupTitle}>{item.title}</Text>
                <Text style={styles.groupDescription}>{item.description}</Text>
              </View>
              <MCIcon name="chevron-right" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
          renderHiddenItem={groupRenderHiddenItem}
          leftOpenValue={75}
          rightOpenValue={-75}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Add/Edit Group Modal */}
      <Modal visible={groupModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{isEditingGroup ? 'Edit Group' : 'Add New Group'}</Text>
                <TextInput style={styles.input} placeholder="Title" value={groupTitle} onChangeText={setGroupTitle} />
                <TextInput style={styles.input} placeholder="Description" value={groupDescription} onChangeText={setGroupDescription} multiline />
                
                <Text style={styles.label}>Select Icon</Text>
                <TouchableOpacity style={styles.iconInput} onPress={() => { setIconTarget('group'); setIconModalVisible(true); }}>
                    <MCIcon name={groupIcon} size={24} color={COLORS.primary} />
                    <Text style={{marginLeft: 10}}>{groupIcon}</Text>
                </TouchableOpacity>

                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalBtn} onPress={() => setGroupModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSaveGroup}><Text style={{color: COLORS.white}}>{isEditingGroup ? 'Save' : 'Add'}</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* Add/Edit Session Modal */}
      <Modal visible={sessionModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.scrollModalContent}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{isEditingSession ? 'Edit Session' : 'Add New Session'}</Text>

              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} placeholder="Session title" value={sessionTitle} onChangeText={setSessionTitle} />

              <Text style={styles.label}>Duration</Text>
              <TextInput style={styles.input} placeholder="e.g. 20 min" value={sessionDuration} onChangeText={setSessionDuration} />

              <Text style={styles.label}>Icon</Text>
              <TouchableOpacity style={styles.iconInput} onPress={() => { setIconTarget('session'); setSessionIconModalVisible(true); }}>
                <MCIcon name={sessionIcon} size={24} color={COLORS.primary} style={{marginRight: 10}} />
                <Text style={{flex: 1}}>{sessionIcon}</Text>
                <MCIcon name="chevron-down" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>

              <Text style={styles.label}>Video Group (optional)</Text>
              <View style={styles.groupPickerContainer}>
                {groups
                  .filter(g => g.is_active !== false)
                  .map(g => (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.groupOption, sessionVideoGroupId === g.id && styles.groupOptionSelected]}
                      onPress={() => setSessionVideoGroupId(sessionVideoGroupId === g.id ? null : g.id)}
                    >
                      <MCIcon name={g.icon || 'folder'} size={18} color={sessionVideoGroupId === g.id ? COLORS.white : COLORS.primary} />
                      <Text style={[styles.groupOptionText, sessionVideoGroupId === g.id && styles.groupOptionTextSelected]}>{g.title}</Text>
                      {sessionVideoGroupId === g.id && <MCIcon name="check" size={18} color={COLORS.white} />}
                    </TouchableOpacity>
                  ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setSessionModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSaveSession}><Text style={{color: COLORS.white}}>{isEditingSession ? 'Save' : 'Add'}</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Icon Selector Modal (for groups) */}
      <Modal visible={iconModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
                <FlatList 
                    data={ROLE_ICONS}
                    numColumns={5}
                    renderItem={({item}) => (
                        <TouchableOpacity style={styles.iconOption} onPress={() => { setGroupIcon(item); setIconModalVisible(false); }}>
                            <MCIcon name={item} size={24} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                    )}
                />
            </View>
        </View>
      </Modal>

      {/* Icon Selector Modal (for sessions) */}
      <Modal visible={sessionIconModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlayCentered} onPress={() => setSessionIconModalVisible(false)}>
          <Pressable style={styles.iconPickerCard} onPress={() => {}}>
            <View style={styles.wellnessIconGrid}>
              {WELLNESS_ICONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.wellnessIconBox,
                    sessionIcon === icon && styles.wellnessIconBoxSelected
                  ]}
                  onPress={() => {
                    setSessionIcon(icon);
                    setSessionIconModalVisible(false);
                  }}
                >
                  <MCIcon
                    name={icon}
                    size={26}
                    color={sessionIcon === icon ? COLORS.white : COLORS.textPrimary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 56, padding: 20, backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  list: { padding: 16 },
  card: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  cardContent: { flex: 1 },
  groupTitle: { fontSize: 16, fontWeight: '700' },
  groupDescription: { color: COLORS.textSecondary, marginTop: 4 },
  addBtn: { backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowBack: { flexDirection: 'row', justifyContent: 'space-between', flex: 1, alignItems: 'center', marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  backBtn: { width: 75, height: '100%', justifyContent: 'center', alignItems: 'center' },
  editBack: { backgroundColor: COLORS.primary },
  deleteBack: { backgroundColor: COLORS.danger },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modalCard: {
  backgroundColor: COLORS.white,
  padding: 20,
  borderRadius: 16,
},
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#EEE', borderRadius: 8, padding: 12, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  iconInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EEE', borderRadius: 8, padding: 12, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: '#EEE' },
  saveBtn: { backgroundColor: COLORS.primary },
  iconOption: { padding: 10, borderRadius: 8, backgroundColor: '#f0f0f0', margin: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, marginHorizontal: 4 },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  activeTabText: { color: COLORS.white },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 16, color: COLORS.textMuted },
  scrollModalContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  groupPickerContainer: { marginBottom: 12 },
  groupOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', marginBottom: 6 },
  groupOptionSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  groupOptionText: { marginLeft: 10, flex: 1, fontSize: 14 },
  groupOptionTextSelected: { color: COLORS.white },
  wellnessIconGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: 8 },
  wellnessIconBox: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#f0f0f0', margin: 5, alignItems: 'center', justifyContent: 'center' },
  wellnessIconBoxSelected: { backgroundColor: COLORS.primary },
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  iconPickerCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, maxWidth: 400, width: '100%' }
});

export default VideoManagementScreen;
