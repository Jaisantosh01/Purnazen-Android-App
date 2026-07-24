import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput, ScrollView, Pressable } from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { ROLE_ICONS, WELLNESS_ICONS } from '../constants/icons';
import { ListSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import SwipeRowActions, { SWIPE_LEFT_OPEN, SWIPE_RIGHT_OPEN } from '../components/SwipeRowActions';
import { showAlert, showConfirm } from '../utils/alert';
import { ICONS_PER_PAGE } from '../constants/icons';

/** Inactive marker for list rows — legible on both palettes (see cardDisabled). */
const DisabledBadge = ({ styles }) => (
  <View style={styles.disabledBadge}>
    <Text style={styles.disabledBadgeText}>Disabled</Text>
  </View>
);

const VideoManagementScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const [groupIconPage, setGroupIconPage] = useState(0);
  const [groupIsActive, setGroupIsActive] = useState(true);

  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionIcon, setSessionIcon] = useState('meditation');
  const [sessionVideoGroupId, setSessionVideoGroupId] = useState(null);
  const [sessionCalculatedDuration, setSessionCalculatedDuration] = useState('');
  const [sessionIconModalVisible, setSessionIconModalVisible] = useState(false);
  const [sessionIconPage, setSessionIconPage] = useState(0);
  const [sessionIsActive, setSessionIsActive] = useState(true);
  const [sessionSortMode, setSessionSortMode] = useState(false);
  const [sortedSessions, setSortedSessions] = useState([]);
  const [sessionSortOriginal, setSessionSortOriginal] = useState([]);
  const hasSessionSortChanges = sessionSortMode &&
    JSON.stringify(sortedSessions.map(s => s.id)) !== JSON.stringify(sessionSortOriginal);
  const totalIconPages = Math.ceil(WELLNESS_ICONS.length / ICONS_PER_PAGE);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchVideoGroups();
      fetchSessions();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchVideoGroups = () => {
    setGroupsLoading(true);
    apiClient.get(ENDPOINTS.VIDEO_GROUPS, { params: { active_only: false } })
      .then(res => setGroups(res.data?.groups || []))
      .catch(() => showAlert('Error', 'Failed to fetch video groups'))
      .finally(() => setGroupsLoading(false));
  };

  const fetchSessions = () => {
    setSessionsLoading(true);
    apiClient.get(ENDPOINTS.ALL_SESSIONS, { params: { active_only: false } })
      .then(res => setSessions(res.data?.sessions || []))
      .catch(() => showAlert('Error', 'Failed to fetch sessions'))
      .finally(() => setSessionsLoading(false));
  }

  const handleSaveGroup = () => {
    if (!groupTitle || !groupDescription) { showAlert('Error', 'Please fill in all fields'); return; }
    
    const payload = { title: groupTitle, description: groupDescription, icon: groupIcon, is_active: groupIsActive };

    if (isEditingGroup && editingGroup) {
      apiClient.put(`${ENDPOINTS.VIDEO_GROUPS}/${editingGroup.id}`, payload)
        .then(() => { setGroupModalVisible(false); setIsEditingGroup(false); setEditingGroup(null); fetchVideoGroups(); })
        .catch(() => showAlert('Error', 'Failed to update'));
    } else {
      apiClient.post(ENDPOINTS.VIDEO_GROUPS, payload)
        .then(() => { setGroupModalVisible(false); fetchVideoGroups(); })
        .catch(() => showAlert('Error', 'Failed to add'));
    }
  };

  /**
   * Permanent delete behind a themed confirm dialog.
   *
   * The API refuses a hard delete (409) when user history points at the
   * content — destroying it would take watch history and feedback with it. In
   * that case we don't dead-end: the follow-up offers to disable instead,
   * which hides it from the apps and leaves the row visibly disabled here.
   */
  const confirmHardDelete = ({ kind, name, url, refresh }) => {
    showConfirm(
      `Delete ${kind}`,
      `Permanently delete "${name}"? This cannot be undone.`,
      async () => {
        try {
          await apiClient.delete(url, { params: { hard: true } });
          refresh();
        } catch (err) {
          if (err?.response?.status === 409) {
            showConfirm(
              'Cannot delete permanently',
              err.response?.data?.message || `This ${kind.toLowerCase()} is in use.`,
              async () => {
                try {
                  await apiClient.delete(url);
                  refresh();
                } catch {
                  showAlert('Error', `Failed to disable ${kind.toLowerCase()}`);
                }
              },
              { confirmLabel: 'Disable instead' },
            );
            return;
          }
          showAlert('Error', err?.response?.data?.message || `Failed to delete ${kind.toLowerCase()}`);
        }
      },
      { confirmLabel: 'Delete', destructive: true },
    );
  };

  const handleDeleteGroup = (group) =>
    confirmHardDelete({
      kind: 'Group',
      name: group.title,
      url: `${ENDPOINTS.VIDEO_GROUPS}/${group.id}`,
      refresh: fetchVideoGroups,
    });

  const openEditGroupModal = (group) => {
    setEditingGroup(group);
    setGroupTitle(group.title || '');
    setGroupDescription(group.description || '');
    setGroupIcon(group.icon || ROLE_ICONS[0]);
    setGroupIsActive(group.isActive !== false);
    setIsEditingGroup(true);
    setGroupModalVisible(true);
  };

  const openAddGroupModal = () => {
    setGroupTitle('');
    setGroupDescription('');
    setGroupIcon(ROLE_ICONS[0]);
    setGroupIsActive(true);
    setIsEditingGroup(false);
    setEditingGroup(null);
    setGroupModalVisible(true);
  };

  const handleSaveSession = async () => {
    if (!sessionTitle) { showAlert('Error', 'Please fill in title'); return; }

    const payload = {
      title: sessionTitle,
      icon: sessionIcon,
      video_group_id: sessionVideoGroupId,
      is_active: sessionIsActive,
    };

    if (isEditingSession && editingSession) {
      apiClient.put(`${ENDPOINTS.ALL_SESSIONS}/${editingSession.id}`, payload)
        .then(() => { setSessionModalVisible(false); setIsEditingSession(false); setEditingSession(null); fetchSessions(); })
        .catch(() => showAlert('Error', 'Failed to update session'));
    } else {
      apiClient.post(ENDPOINTS.ALL_SESSIONS, payload)
        .then(() => { setSessionModalVisible(false); fetchSessions(); })
        .catch(() => showAlert('Error', 'Failed to add session'));
    }
  };

  const handleDeleteSession = (session) =>
    confirmHardDelete({
      kind: 'Session',
      name: session.title,
      url: `${ENDPOINTS.ALL_SESSIONS}/${session.id}`,
      refresh: fetchSessions,
    });

  const toggleSessionSortMode = () => {
    if (!sessionSortMode) {
      setSortedSessions([...sessions]);
      setSessionSortOriginal(sessions.map(s => s.id));
    } else {
      setSortedSessions([]);
    }
    setSessionSortMode(prev => !prev);
  };

  const saveSessionOrder = async () => {
    try {
      await Promise.all(sortedSessions.map((s, i) =>
        apiClient.put(`${ENDPOINTS.ALL_SESSIONS}/${s.id}`, { sort_order: i })
      ));
      setSessionSortMode(false);
      fetchSessions();
      showAlert('Saved', 'Session order updated');
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to save order');
    }
  };

  const openEditSessionModal = (session) => {
    setEditingSession(session);
    setSessionTitle(session.title);
    setSessionIcon(session.icon || 'meditation');
    setSessionVideoGroupId(session.videoGroupId);
    setSessionCalculatedDuration(session.duration || '');
    setSessionIsActive(session.isActive !== false);
    setIsEditingSession(true);
    setSessionModalVisible(true);
  };

  const openAddSessionModal = () => {
    setSessionTitle('');
    setSessionIcon('meditation');
    setSessionVideoGroupId(null);
    setSessionCalculatedDuration('');
    setSessionIsActive(true);
    setIsEditingSession(false);
    setEditingSession(null);
    setSessionModalVisible(true);
  };

  /**
   * Swipe layer shared by both tabs: swipe right reveals Edit on the left,
   * swipe left reveals Delete on the right. The row is closed before the
   * action runs so the dialog never opens on top of a half-open row.
   */
  const renderSwipeActions = (item, rowMap, { onEdit, onDelete }) => {
    if (!item) return <View style={styles.rowBack} />;
    return (
      <SwipeRowActions
        containerStyle={styles.rowBack}
        onClose={() => rowMap[item.id]?.closeRow()}
        onEdit={() => onEdit(item)}
        onDelete={() => onDelete(item)}
      />
    );
  };

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
      <ScreenHeader
        title="Video Management"
        onBack={() => navigation.goBack()}
        underColor={colors.card}
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('UploadVideo', {})}
              accessibilityLabel="Upload or manage program videos"
            >
              <MCIcon name="cloud-upload-outline" size={22} color={colors.headerText} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={activeTab === 'sessions' ? openAddSessionModal : openAddGroupModal}>
              <MCIcon name="plus" size={24} color={colors.headerText} />
            </TouchableOpacity>
          </View>
        }
      />

      {renderTabBar()}

      {activeTab === 'sessions' && (
        sessionsLoading ? <ListSkeleton count={5} /> :
        sessionSortMode ? (
          <View style={{ flex: 1 }}>
            <View style={styles.sortBanner}>
              <MCIcon name="drag-variant" size={18} color={colors.warning} />
              <Text style={styles.sortBannerText}>Drag the handle to reorder sessions</Text>
            </View>
            <DraggableFlatList
              data={sortedSessions}
              onDragEnd={({ data }) => setSortedSessions(data)}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item, drag, isActive, getIndex }) => (
                <ScaleDecorator>
                  <TouchableOpacity activeOpacity={1} onLongPress={drag} delayLongPress={0}>
                    <View style={[styles.card, isActive && { backgroundColor: colors.primaryLight }]}>
                      <View style={styles.iconContainer}><MCIcon name={item.icon || 'meditation'} size={24} color={colors.primary} /></View>
                      <View style={styles.cardContent}>
                        <Text style={styles.groupTitle}>{item.title}</Text>
                        <Text style={styles.groupDescription}>{item.duration}</Text>
                      </View>
                      <MCIcon name="drag-variant" size={24} color={colors.textMuted} style={{ paddingHorizontal: 12 }} />
                    </View>
                  </TouchableOpacity>
                </ScaleDecorator>
              )}
              contentContainerStyle={styles.list}
            />
            <View style={styles.sortFooter}>
              <Text style={styles.sortFooterText}>{sortedSessions.length} session{sortedSessions.length !== 1 ? 's' : ''}</Text>
              <TouchableOpacity
                style={[styles.sortSaveBtn, !hasSessionSortChanges && styles.sortSaveBtnDisabled]}
                disabled={!hasSessionSortChanges}
                onPress={saveSessionOrder}
              >
                <MCIcon name="content-save" size={18} color={hasSessionSortChanges ? colors.white : colors.textMuted} />
                <Text style={[styles.sortSaveText, !hasSessionSortChanges && styles.sortSaveTextDisabled]}>
                  Save Order
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
        <SwipeListView
          data={sessions}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => {
            const disabled = item.isActive === false;
            return (
              <View style={[styles.card, disabled && styles.cardDisabled]}>
                <TouchableOpacity activeOpacity={0.7} style={styles.cardMain} onPress={() => {
                  if (item.videoGroupId) {
                    navigation.navigate('VideoGroupDetail', { groupId: item.videoGroupId, groupTitle: item.title });
                  }
                }}
                onLongPress={toggleSessionSortMode}
                >
                  <View style={[styles.iconContainer, disabled && styles.iconContainerDisabled]}>
                    <MCIcon name={item.icon || 'meditation'} size={24} color={disabled ? colors.textMuted : colors.primary} />
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.groupTitle, disabled && styles.textDisabled]} numberOfLines={1}>{item.title}</Text>
                      {disabled && <DisabledBadge styles={styles} />}
                    </View>
                    <Text style={[styles.groupDescription, disabled && styles.textDisabled]}>{item.duration}</Text>
                  </View>
                  {item.videoGroupId && <MCIcon name="chevron-right" size={24} color={colors.textMuted} />}
                </TouchableOpacity>
              </View>
            );
          }}
          renderHiddenItem={(data, rowMap) =>
            renderSwipeActions(data.item, rowMap, {
              onEdit: openEditSessionModal,
              onDelete: handleDeleteSession,
            })
          }
          leftOpenValue={SWIPE_LEFT_OPEN}
          rightOpenValue={SWIPE_RIGHT_OPEN}
          closeOnRowPress={true}
          closeOnRowOpen={true}
          closeOnRowBeginSwipe={true}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
        />
      ))}
 
      {activeTab === 'groups' && (
        groupsLoading ? <ListSkeleton count={5} /> :
        <SwipeListView
          data={groups}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => {
            const disabled = item.isActive === false;
            return (
              <View style={[styles.card, disabled && styles.cardDisabled]}>
                <TouchableOpacity activeOpacity={0.7} style={styles.cardMain} onPress={() => navigation.navigate('VideoGroupDetail', { groupId: item.id, groupTitle: item.title })}>
                  <View style={[styles.iconContainer, disabled && styles.iconContainerDisabled]}>
                    <MCIcon name={item.icon || 'folder'} size={24} color={disabled ? colors.textMuted : colors.primary} />
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.groupTitle, disabled && styles.textDisabled]} numberOfLines={1}>{item.title}</Text>
                      {disabled && <DisabledBadge styles={styles} />}
                    </View>
                    <Text style={[styles.groupDescription, disabled && styles.textDisabled]} numberOfLines={1}>{item.description}</Text>
                  </View>
                  <MCIcon name="chevron-right" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          }}
          renderHiddenItem={(data, rowMap) =>
            renderSwipeActions(data.item, rowMap, {
              onEdit: openEditGroupModal,
              onDelete: handleDeleteGroup,
            })
          }
          leftOpenValue={SWIPE_LEFT_OPEN}
          rightOpenValue={SWIPE_RIGHT_OPEN}
          closeOnRowPress={true}
          closeOnRowOpen={true}
          closeOnRowBeginSwipe={true}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Add/Edit Group Modal */}
      <Modal visible={groupModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{isEditingGroup ? 'Edit Group' : 'Add New Group'}</Text>
                <Text style={styles.label}>Title <Text style={{color: '#EF4444'}}>*</Text></Text>
                <TextInput style={styles.input} placeholder="Title" placeholderTextColor={colors.textMuted} value={groupTitle} onChangeText={setGroupTitle} />
                <Text style={styles.label}>Description <Text style={{color: '#EF4444'}}>*</Text></Text>
                <TextInput style={styles.input} placeholder="Description" placeholderTextColor={colors.textMuted} value={groupDescription} onChangeText={setGroupDescription} multiline />
                
                <Text style={styles.label}>Select Icon</Text>
                <TouchableOpacity style={styles.iconInput} onPress={() => { setIconTarget('group'); setIconModalVisible(true); }}>
                    <MCIcon name={groupIcon} size={24} color={colors.primary} />
                    <Text style={{marginLeft: 10, color: colors.textPrimary}}>{groupIcon}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.checkRow} onPress={() => setGroupIsActive(!groupIsActive)}>
                  <MCIcon name={groupIsActive ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={groupIsActive ? colors.primary : colors.textMuted} />
                  <Text style={[styles.checkLabel, !groupIsActive && { color: colors.textMuted }]}>Active</Text>
                </TouchableOpacity>

                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalBtn} onPress={() => setGroupModalVisible(false)}><Text style={{color: colors.textPrimary}}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.saveBtn, (!groupTitle.trim() || !groupDescription.trim()) && { opacity: 0.5 }]}
                      disabled={!groupTitle.trim() || !groupDescription.trim()}
                      onPress={handleSaveGroup}
                    >
                      <Text style={{color: colors.white}}>{isEditingGroup ? 'Save' : 'Add'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* Add/Edit Session Modal */}
      <Modal visible={sessionModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView style={styles.sessionModalBody} contentContainerStyle={styles.sessionModalBodyContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{isEditingSession ? 'Edit Session' : 'Add New Session'}</Text>

              <Text style={styles.label}>Title <Text style={{color: '#EF4444'}}>*</Text></Text>
              <TextInput style={styles.input} placeholder="Session title" placeholderTextColor={colors.textMuted} value={sessionTitle} onChangeText={setSessionTitle} />

              {!!sessionCalculatedDuration && (
                <>
                  <Text style={styles.label}>Duration (auto-calculated)</Text>
                  <Text style={[styles.input, { backgroundColor: colors.surfaceMuted }]}>{sessionCalculatedDuration}</Text>
                </>
              )}

              <Text style={styles.label}>Icon <Text style={{color: '#EF4444'}}>*</Text></Text>
              <TouchableOpacity style={styles.iconInput} onPress={() => { setIconTarget('session'); setSessionIconModalVisible(true); }}>
                <MCIcon name={sessionIcon} size={24} color={colors.primary} style={{marginRight: 10}} />
                <Text style={{flex: 1, color: colors.textPrimary}}>{sessionIcon}</Text>
                <MCIcon name="chevron-down" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.checkRow} onPress={() => setSessionIsActive(!sessionIsActive)}>
                <MCIcon name={sessionIsActive ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={sessionIsActive ? colors.primary : colors.textMuted} />
                <Text style={[styles.checkLabel, !sessionIsActive && { color: colors.textMuted }]}>Active</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Video Group <Text style={{color: '#EF4444'}}>*</Text></Text>

              <View style={styles.groupPickerContainer}>
                <ScrollView style={styles.groupPickerScroll} nestedScrollEnabled>
                  {groups
                    .filter(g => g.isActive !== false)
                    .map(g => (
                      <TouchableOpacity
                        key={g.id}
                        style={[styles.groupOption, sessionVideoGroupId === g.id && styles.groupOptionSelected]}
                        onPress={async () => {
                          if (sessionVideoGroupId === g.id) {
                            setSessionVideoGroupId(null);
                            setSessionCalculatedDuration('');
                          } else {
                            setSessionVideoGroupId(g.id);
                            try {
                              const res = await apiClient.get(ENDPOINTS.VIDEO_GROUP_CATALOG(g.id));
                              const videos = res?.data?.data?.videos || [];
                              const totalSecs = videos.reduce((s, v) => s + (parseInt(v.duration, 10) || 0), 0);
                              const mins = Math.floor(totalSecs / 60);
                              const secs = totalSecs % 60;
                              if (mins > 0 && secs > 0) setSessionCalculatedDuration(`${mins} min ${secs} sec`);
                              else if (mins > 0) setSessionCalculatedDuration(`${mins} min`);
                              else setSessionCalculatedDuration(`${secs} sec`);
                            } catch {
                              setSessionCalculatedDuration('');
                            }
                          }
                        }}
                      >
                        <MCIcon name={g.icon || 'folder'} size={18} color={sessionVideoGroupId === g.id ? colors.white : colors.primary} />
                        <Text style={[styles.groupOptionText, sessionVideoGroupId === g.id && styles.groupOptionTextSelected]}>{g.title}</Text>
                        {sessionVideoGroupId === g.id && <MCIcon name="check" size={18} color={colors.white} />}
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setSessionModalVisible(false)}><Text style={{color: colors.textPrimary}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, (!sessionTitle.trim() || !sessionVideoGroupId) && { opacity: 0.5 }]}
                disabled={!sessionTitle.trim() || !sessionVideoGroupId}
                onPress={handleSaveSession}
              >
                <Text style={{color: colors.white}}>{isEditingSession ? 'Save' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Icon Selector Modal (for groups) */}
      <Modal visible={iconModalVisible} transparent animationType="fade" onRequestClose={() => setIconModalVisible(false)}>
        <Pressable style={styles.modalOverlayCentered} onPress={() => setIconModalVisible(false)}>
          <Pressable style={styles.iconPickerCard} onPress={() => {}}>
            <View style={styles.wellnessIconGrid}>
              {ROLE_ICONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.wellnessIconBox, groupIcon === icon && styles.wellnessIconBoxSelected]}
                  onPress={() => { setGroupIcon(icon); setIconModalVisible(false); }}
                >
                  <MCIcon name={icon} size={26} color={groupIcon === icon ? colors.white : colors.textPrimary} />
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Icon Selector Modal (for sessions) */}
      <Modal visible={sessionIconModalVisible} transparent animationType="fade" onRequestClose={() => setSessionIconModalVisible(false)}>
        <Pressable style={styles.modalOverlayCentered} onPress={() => setSessionIconModalVisible(false)}>
          <Pressable style={styles.iconPickerCard} onPress={() => {}}>
            <View style={styles.wellnessIconGrid}>
              {WELLNESS_ICONS.slice(sessionIconPage * ICONS_PER_PAGE, (sessionIconPage + 1) * ICONS_PER_PAGE).map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.wellnessIconBox, sessionIcon === icon && styles.wellnessIconBoxSelected]}
                  onPress={() => { setSessionIcon(icon); setSessionIconModalVisible(false); }}
                >
                  <MCIcon name={icon} size={26} color={sessionIcon === icon ? colors.white : colors.textPrimary} />
                </TouchableOpacity>
              ))}
            </View>
            {totalIconPages > 1 && (
              <View style={styles.iconPagination}>
                <TouchableOpacity
                  style={[styles.iconPageBtn, sessionIconPage === 0 && { opacity: 0.3 }]}
                  disabled={sessionIconPage === 0}
                  onPress={() => setSessionIconPage(p => p - 1)}
                >
                  <MCIcon name="chevron-left" size={20} color={colors.textPrimary} />
                  <Text style={styles.iconPageText}>Prev</Text>
                </TouchableOpacity>
                <Text style={styles.iconPageIndicator}>{sessionIconPage + 1} / {totalIconPages}</Text>
                <TouchableOpacity
                  style={[styles.iconPageBtn, sessionIconPage >= totalIconPages - 1 && { opacity: 0.3 }]}
                  disabled={sessionIconPage >= totalIconPages - 1}
                  onPress={() => setSessionIconPage(p => p + 1)}
                >
                  <Text style={styles.iconPageText}>Next</Text>
                  <MCIcon name="chevron-right" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
  // Disabled rows are marked, not tinted. A background swap can't carry this:
  // surfaceMuted is all but identical to card in light mode and *lighter* than
  // it in dark, where it reads as highlighted — the opposite of the intent. So
  // the card keeps its own surface (text contrast stays correct in both
  // themes) and the state is carried by the badge + muted content + flat edge.
  cardDisabled: { borderColor: colors.borderStrong, borderStyle: 'dashed', elevation: 0 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  iconContainerDisabled: { backgroundColor: colors.surfaceMuted },
  cardContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  groupDescription: { color: colors.textSecondary, marginTop: 4 },
  textDisabled: { color: colors.textMuted },
  disabledBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  disabledBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  // Only spacing/rounding here — the swipe layer itself lives in SwipeRowActions.
  rowBack: { marginBottom: 12, borderRadius: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modalCard: {
  backgroundColor: colors.card,
  padding: 20,
  borderRadius: 16,
},
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, color: colors.textPrimary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 12, color: colors.textPrimary },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.textPrimary },
  iconInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  saveBtn: { backgroundColor: colors.primary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingVertical: 6 },
  checkLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  iconOption: { padding: 10, borderRadius: 8, backgroundColor: colors.surfaceMuted, margin: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.card, paddingHorizontal: 16, paddingBottom: 12, paddingTop:10 ,borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, marginHorizontal: 4 },
  activeTab: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  activeTabText: { color: colors.white },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 16, color: colors.textMuted },
  scrollModalContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  sessionModalBody: { maxHeight: 420 },
  sessionModalBodyContent: { paddingBottom: 8 },
  groupPickerContainer: { marginBottom: 12 },
  groupPickerScroll: { maxHeight: 220 },
  groupOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  groupOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  groupOptionText: { marginLeft: 10, flex: 1, fontSize: 14, color: colors.textPrimary },
  groupOptionTextSelected: { color: colors.white },
  wellnessIconGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: 8 },
  wellnessIconBox: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.surfaceMuted, margin: 5, alignItems: 'center', justifyContent: 'center' },
  wellnessIconBoxSelected: { backgroundColor: colors.primary },
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  iconPickerCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, maxWidth: 400, width: '100%' },
  iconPagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  iconPageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  iconPageText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  iconPageIndicator: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  sortBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.warning + '18' },
  sortBannerText: { fontSize: 13, color: colors.warning, fontWeight: '600' },
  dragHandle: { paddingHorizontal: 12, paddingVertical: 16, justifyContent: 'center', alignItems: 'center' },
  sortFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  sortFooterText: { fontSize: 13, color: colors.textMuted },
  sortSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  // Same reasoning as cardDisabled: a real surface + muted content, not an
  // opacity fade that turns to mud on the dark palette.
  sortSaveBtnDisabled: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  sortSaveText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  sortSaveTextDisabled: { color: colors.textMuted },
});

export default VideoManagementScreen;
