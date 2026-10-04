/**
 * ÖZARA Mobile: Profile & 30-Question Questionnaire Modal
 * Full privacy controls, autosave, Question 18 mandatory badge, and Question 23 golden lock shield
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClub } from '../context/ClubContext';
import {
  ApiService,
  UserProfile,
  QuestionnaireAnswer,
  resolveImageUrl,
  CURRENT_ACCESS_CONDITIONS_VERSION,
} from '../services/api';
import { OzaraTheme } from '../constants/ozara-theme';
import { Ionicons } from '@expo/vector-icons';

export const ProfileDrawerModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    profileDrawerUserId,
    closeProfile,
    currentUserId,
    currentUser,
    refreshUserData,
    openConditions,
  } = useClub();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'questionnaire' | 'overview'>('questionnaire');

  // Local answer changes before save
  const [answersState, setAnswersState] = useState<Record<number, { value: string; visibility: 'shared' | 'private' }>>({});
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);

  // Access requests for Founder role (Elena Ermolov)
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);

  const loadAccessRequests = async () => {
    if (currentUser?.role !== 'FOUNDER') return;
    try {
      const data = await ApiService.getAccessRequests();
      setAccessRequests(data);
    } catch (err) {
      console.warn('Could not load access requests:', err);
    }
  };

  const handleApproveRequest = async (reqId: string, email: string) => {
    try {
      setApprovingRequestId(reqId);
      const res = await ApiService.approveAccessRequest({
        requestId: reqId,
        email,
        approvedBy: currentUser?.email || 'ermolov.elena@gmail.com',
      });
      if (res.success) {
        if (Platform.OS === 'web') {
          window.alert(`Approved! Token ${res.token} issued and dispatched to ${email}.`);
        } else {
          Alert.alert('Access Approved', `Token ${res.token} issued and dispatched to ${email}.`);
        }
        loadAccessRequests();
      }
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert(err.message || 'Approval failed');
      else Alert.alert('Error', err.message);
    } finally {
      setApprovingRequestId(null);
    }
  };

  const isOpen = !!profileDrawerUserId;
  const isSelf = profileDrawerUserId === currentUserId;

  const loadProfile = async () => {
    if (!profileDrawerUserId) return;
    try {
      setLoading(true);
      const data = await ApiService.getProfile(profileDrawerUserId, currentUserId);
      setProfile(data);

      // Populate local answer state
      const initialMap: Record<number, { value: string; visibility: 'shared' | 'private' }> = {};
      data.answers?.forEach(a => {
        initialMap[a.question_id] = {
          value: a.value_text || (typeof a.value === 'string' ? a.value : ''),
          visibility: a.visibility || 'shared',
        };
      });
      setAnswersState(initialMap);
    } catch (err: any) {
      console.warn('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProfile();
      if (currentUser?.role === 'FOUNDER') {
        loadAccessRequests();
      }
    } else {
      setProfile(null);
    }
  }, [profileDrawerUserId]);

  const handleSaveAnswer = async (questionId: number) => {
    if (!profileDrawerUserId || !isSelf) return;
    const item = answersState[questionId];
    if (!item) return;

    try {
      setSavingQuestionId(questionId);
      const res = await ApiService.saveAnswer(
        profileDrawerUserId,
        questionId,
        item.value,
        item.visibility
      );
      if (res.success && res.is_complete !== undefined) {
        setProfile(prev => (prev ? { ...prev, is_complete: res.is_complete } : prev));
        refreshUserData();
      }
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Could not save answer');
    } finally {
      setSavingQuestionId(null);
    }
  };

  const handleToggleVisibility = async (questionId: number) => {
    if (!isSelf) return;
    if (questionId === 23) {
      Alert.alert('Confidential Field', 'Question 23 is permanently locked to Private for founder review only.');
      return;
    }
    const current = answersState[questionId];
    const newVis = current?.visibility === 'private' ? 'shared' : 'private';
    setAnswersState(prev => ({
      ...prev,
      [questionId]: {
        value: current?.value || '',
        visibility: newVis,
      },
    }));

    try {
      setSavingQuestionId(questionId);
      await ApiService.saveAnswer(
        profileDrawerUserId!,
        questionId,
        current?.value || '',
        newVis
      );
    } catch (err: any) {
      console.warn('Visibility error:', err);
    } finally {
      setSavingQuestionId(null);
    }
  };

  const hasAcceptedConditions =
    currentUser?.accepted_access_conditions_version === CURRENT_ACCESS_CONDITIONS_VERSION;

  const handleQuickAcceptConditions = async () => {
    if (!profileDrawerUserId) return;
    try {
      const res = await ApiService.acceptConditions(
        profileDrawerUserId,
        CURRENT_ACCESS_CONDITIONS_VERSION
      );
      if (res.success) {
        await refreshUserData();
        if (Platform.OS === 'web') {
          window.alert(`Access Conditions v${CURRENT_ACCESS_CONDITIONS_VERSION} accepted.`);
        } else {
          Alert.alert('Terms Accepted', `Access Conditions v${CURRENT_ACCESS_CONDITIONS_VERSION} recorded.`);
        }
      }
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(`Error: ${err.message || 'Could not record acceptance'}`);
      } else {
        Alert.alert('Error', err.message || 'Could not record acceptance');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={closeProfile}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={closeProfile} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>
            {isSelf ? 'My Club Profile' : `${profile?.full_name || 'Member'} Profile`}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {loading || !profile ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={OzaraTheme.colors.accentCyan} />
            <Text style={styles.loaderText}>Loading verified credentials...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]}>
            {/* Profile Overview Card */}
            <View style={styles.profileHeaderCard}>
              <Image
                source={{ uri: resolveImageUrl(profile.avatar_url) }}
                style={styles.headerAvatar}
              />
              <View style={styles.headerMeta}>
                <View style={styles.headerNameRow}>
                  <Text style={styles.headerFullName}>{profile.full_name}</Text>
                </View>
                <Text style={styles.headerHeadline}>{profile.headline}</Text>
                <View style={styles.headerBadgesRow}>
                  <View style={styles.miniBadge}>
                    <Ionicons name="location-outline" size={11} color={OzaraTheme.colors.textMuted} />
                    <Text style={styles.miniBadgeText}>
                      {profile.city}, {profile.country}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.completionBadge,
                      profile.is_complete ? styles.completionGreen : styles.completionAmber,
                    ]}>
                    <Text
                      style={[
                        styles.completionText,
                        profile.is_complete ? styles.textGreen : styles.textAmber,
                      ]}>
                      {profile.is_complete ? 'Verified Complete' : 'Incomplete (Q18 Required)'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Question 18 Mandatory Callout (if incomplete) */}
            {!profile.is_complete && isSelf && (
              <View style={styles.q18Banner}>
                <Text style={styles.q18BannerIcon}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.q18BannerTitle}>Mandatory Completion Requirement</Text>
                  <Text style={styles.q18BannerDesc}>
                    Question 18 ("12-month strategic milestone") is required to mark your profile verified.
                  </Text>
                </View>
              </View>
            )}

            {/* Sub-tab Navigation */}
            <View style={styles.tabButtonsRow}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'questionnaire' && styles.tabButtonActive]}
                onPress={() => setActiveTab('questionnaire')}>
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === 'questionnaire' && styles.tabButtonTextActive,
                  ]}>
                  30 Questions ({profile.answers?.length || 0}/30)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'overview' && styles.tabButtonActive]}
                onPress={() => setActiveTab('overview')}>
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === 'overview' && styles.tabButtonTextActive,
                  ]}>
                  Taxonomies &amp; Travel
                </Text>
              </TouchableOpacity>
            </View>

            {/* 30-Question Questionnaire View */}
            {activeTab === 'questionnaire' && (
              <View style={styles.questionsContainer}>
                {profile.answers?.map(q => {
                  const local = answersState[q.question_id] || {
                    value: q.value_text || '',
                    visibility: q.visibility || 'shared',
                  };
                  const isQ18 = q.question_id === 18;
                  const isQ23 = q.question_id === 23;
                  const isSaving = savingQuestionId === q.question_id;

                  return (
                    <View
                      key={q.question_id}
                      style={[
                        styles.questionCard,
                        isQ18 && styles.questionCardQ18,
                        isQ23 && styles.questionCardQ23,
                      ]}>
                      {/* Question Top Row */}
                      <View style={styles.questionHeader}>
                        <View style={styles.questionNumBadge}>
                          <Text style={styles.questionNumText}>Q{q.question_id}</Text>
                        </View>
                        {isQ18 && (
                          <View style={styles.mandatoryBadge}>
                            <Text style={styles.mandatoryBadgeText}>★ REQUIRED FOR COMPLETION</Text>
                          </View>
                        )}
                        {isQ23 && (
                          <View style={styles.confidentialBadge}>
                            <Ionicons name="lock-closed" size={10} color="#f59e0b" />
                            <Text style={styles.confidentialBadgeText}>PERMANENTLY PRIVATE</Text>
                          </View>
                        )}

                        {/* Visibility Pill Toggle */}
                        {isSelf && (
                          <TouchableOpacity
                            style={[
                              styles.visibilityPill,
                              local.visibility === 'private' ? styles.visPrivate : styles.visShared,
                            ]}
                            onPress={() => handleToggleVisibility(q.question_id)}
                            disabled={isQ23}>
                            <Ionicons
                              name={local.visibility === 'private' ? 'lock-closed' : 'globe-outline'}
                              size={11}
                              color={local.visibility === 'private' ? '#f59e0b' : '#38bdf8'}
                            />
                            <Text
                              style={[
                                styles.visibilityText,
                                local.visibility === 'private' ? styles.textAmber : styles.textCyan,
                              ]}>
                              {local.visibility === 'private' ? 'Private' : 'Shared'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Question Prompt */}
                      <Text style={styles.questionPrompt}>{q.question_prompt}</Text>

                      {/* Question 23 Confidentiality Shield */}
                      {isQ23 && (
                        <View style={styles.q23ShieldBox}>
                          <Ionicons name="shield-checkmark" size={13} color="#f59e0b" />
                          <Text style={styles.q23ShieldText}>
                            Confidential to founders (Alexandra, Julia, Elena). Never exposed to search, public profiles, or AI match payloads.
                          </Text>
                        </View>
                      )}

                      {/* Input / Display */}
                      {isSelf ? (
                        <View style={styles.inputWrap}>
                          <TextInput
                            style={styles.answerInput}
                            placeholder="Share your perspective or operating experience..."
                            placeholderTextColor={OzaraTheme.colors.textMuted}
                            multiline
                            value={local.value}
                            onChangeText={val =>
                              setAnswersState(prev => ({
                                ...prev,
                                [q.question_id]: { ...local, value: val },
                              }))
                            }
                            onBlur={() => handleSaveAnswer(q.question_id)}
                          />
                          <View style={styles.autosaveRow}>
                            <Text style={styles.autosaveHint}>
                              {isSaving ? 'Autosaving changes...' : 'Autosaved on blur'}
                            </Text>
                            {isSaving && <ActivityIndicator size="small" color={OzaraTheme.colors.accentCyan} />}
                          </View>
                        </View>
                      ) : (
                        <View style={styles.readOnlyAnswerBox}>
                          {q.is_redacted ? (
                            <View style={styles.redactedBox}>
                              <Ionicons name="lock-closed" size={12} color="#f59e0b" />
                              <Text style={styles.redactedText}>{q.value_text}</Text>
                            </View>
                          ) : (
                            <Text style={styles.readOnlyText}>
                              {local.value || 'Not shared yet.'}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Overview / Taxonomies View */}
            {activeTab === 'overview' && (
              <View style={styles.overviewContainer}>
                {/* Expertise */}
                <View style={styles.taxSection}>
                  <Text style={styles.taxSectionTitle}>Core Expertise &amp; Capabilities</Text>
                  <View style={styles.taxPillsRow}>
                    {profile.taxonomies?.expertise?.map((item, idx) => (
                      <View key={idx} style={styles.taxPill}>
                        <Text style={styles.taxPillText}>{item}</Text>
                      </View>
                    )) || <Text style={styles.emptyText}>None listed.</Text>}
                  </View>
                </View>

                {/* Industries */}
                <View style={styles.taxSection}>
                  <Text style={styles.taxSectionTitle}>Industries &amp; Sectors</Text>
                  <View style={styles.taxPillsRow}>
                    {profile.taxonomies?.industries?.map((item, idx) => (
                      <View key={idx} style={styles.taxPill}>
                        <Text style={styles.taxPillText}>{item}</Text>
                      </View>
                    )) || <Text style={styles.emptyText}>None listed.</Text>}
                  </View>
                </View>

                {/* Offers */}
                <View style={styles.taxSection}>
                  <Text style={styles.taxSectionTitle}>What I Can Offer to Peers</Text>
                  <View style={styles.taxPillsRow}>
                    {profile.taxonomies?.offers?.map((item, idx) => (
                      <View key={idx} style={[styles.taxPill, styles.offerPill]}>
                        <Text style={styles.taxPillText}>{item}</Text>
                      </View>
                    )) || <Text style={styles.emptyText}>None listed.</Text>}
                  </View>
                </View>

                {/* Needs */}
                <View style={styles.taxSection}>
                  <Text style={styles.taxSectionTitle}>Active Strategic Introductions Needed</Text>
                  <View style={styles.taxPillsRow}>
                    {profile.taxonomies?.needs?.map((item, idx) => (
                      <View key={idx} style={[styles.taxPill, styles.needPill]}>
                        <Text style={styles.taxPillText}>{item}</Text>
                      </View>
                    )) || <Text style={styles.emptyText}>None listed.</Text>}
                  </View>
                </View>

                {/* Active Travel Plans */}
                <View style={styles.taxSection}>
                  <Text style={styles.taxSectionTitle}>Upcoming Travel Plans (Active Only)</Text>
                  {profile.travel_plans && profile.travel_plans.length > 0 ? (
                    profile.travel_plans.map((t, idx) => (
                      <View key={idx} style={styles.travelItem}>
                        <Ionicons name="airplane-outline" size={14} color={OzaraTheme.colors.accentCyan} />
                        <Text style={styles.travelCity}>{t.city}, {t.country}</Text>
                        <Text style={styles.travelDates}>
                          {t.start_date} → {t.end_date}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No upcoming travel registered.</Text>
                  )}
                </View>
              </View>
            )}

            {/* Account Settings & Legal / Governance Card */}
            <View style={styles.legalSettingsCard}>
              <View style={styles.legalSettingsHeader}>
                <Ionicons name="shield-checkmark" size={15} color={OzaraTheme.colors.accentViolet} />
                <Text style={styles.legalSettingsTitle}>Account Governance &amp; Legal</Text>
              </View>

              <TouchableOpacity
                style={styles.legalRowBtn}
                onPress={() => {
                  closeProfile();
                  openConditions('tabs');
                }}
                activeOpacity={0.75}>
                <View style={styles.legalRowLeft}>
                  <Ionicons name="document-text-outline" size={18} color="#ffffff" />
                  <View style={styles.legalRowTextWrap}>
                    <Text style={styles.legalRowLabel}>Access Conditions</Text>
                    <Text style={styles.legalRowSub}>Platform terms, risk disclosures &amp; eligibility</Text>
                  </View>
                </View>
                <View style={styles.legalRowRight}>
                  {hasAcceptedConditions ? (
                    <View style={styles.versionAcceptedBadge}>
                      <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                      <Text style={styles.versionAcceptedText}>v{CURRENT_ACCESS_CONDITIONS_VERSION}</Text>
                    </View>
                  ) : (
                    <View style={styles.versionPendingBadge}>
                      <Ionicons name="alert-circle" size={11} color="#F59E0B" />
                      <Text style={styles.versionPendingText}>Action Required</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={OzaraTheme.colors.textMuted} />
                </View>
              </TouchableOpacity>

              {isSelf && !hasAcceptedConditions && (
                <TouchableOpacity
                  style={styles.quickAcceptBtn}
                  onPress={handleQuickAcceptConditions}
                  activeOpacity={0.85}>
                  <Text style={styles.quickAcceptText}>
                    Accept Current Terms (v{CURRENT_ACCESS_CONDITIONS_VERSION})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Founder Review Desk: Access Requests & Invitation Tokens */}
            {currentUser?.role === 'FOUNDER' && (
              <View style={styles.accessRequestsCard}>
                <View style={styles.accessRequestsHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="key" size={15} color={OzaraTheme.colors.accentCyan} />
                    <Text style={styles.accessRequestsTitle}>Membership Access Requests</Text>
                  </View>
                  <View style={styles.founderTag}>
                    <Text style={styles.founderTagText}>FOUNDER DESK</Text>
                  </View>
                </View>
                <Text style={styles.accessRequestsSubtitle}>
                  Confidential applicant queue routed to Elena Ermolov and the founding committee.
                </Text>

                {accessRequests.length === 0 ? (
                  <Text style={styles.emptyRequestsText}>No access requests in queue.</Text>
                ) : (
                  accessRequests.slice(0, 6).map((reqItem) => (
                    <View key={reqItem.id} style={styles.reqItemCard}>
                      <View style={styles.reqItemTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reqItemName}>{reqItem.full_name || 'Prospective Member'}</Text>
                          <Text style={styles.reqItemEmail}>{reqItem.email}</Text>
                          {!!reqItem.role_or_headline && (
                            <Text style={styles.reqItemRole}>{reqItem.role_or_headline}</Text>
                          )}
                          {!!reqItem.notes && (
                            <Text style={styles.reqItemNotes}>"{reqItem.notes}"</Text>
                          )}
                        </View>
                        <View style={[
                          styles.reqStatusBadge,
                          reqItem.status === 'approved' ? styles.reqStatusApproved :
                          reqItem.status === 'claimed' ? styles.reqStatusClaimed : styles.reqStatusPending
                        ]}>
                          <Text style={styles.reqStatusBadgeText}>
                            {reqItem.status === 'approved' ? 'APPROVED' :
                             reqItem.status === 'claimed' ? 'CLAIMED' : 'PENDING'}
                          </Text>
                        </View>
                      </View>

                      {reqItem.status === 'approved' && (
                        <View style={styles.issuedTokenRow}>
                          <Text style={styles.issuedTokenLabel}>Token:</Text>
                          <Text style={styles.issuedTokenCode}>{reqItem.token}</Text>
                        </View>
                      )}

                      {reqItem.status === 'pending_admin_approval' && (
                        <TouchableOpacity
                          style={[styles.approveReqBtn, approvingRequestId === reqItem.id && { opacity: 0.6 }]}
                          onPress={() => handleApproveRequest(reqItem.id, reqItem.email)}
                          disabled={approvingRequestId === reqItem.id}
                          activeOpacity={0.85}>
                          <Ionicons name="checkmark-circle-outline" size={14} color="#000000" style={{ marginRight: 4 }} />
                          <Text style={styles.approveReqBtnText}>
                            {approvingRequestId === reqItem.id ? 'Issuing...' : 'Approve & Send Token'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: OzaraTheme.colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  loaderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.xl,
    padding: 16,
    marginBottom: 16,
  },
  headerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderMedium,
  },
  headerMeta: {
    flex: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerFullName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerHeadline: {
    fontSize: 12,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  headerBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: OzaraTheme.radius.full,
  },
  miniBadgeText: {
    fontSize: 11,
    color: OzaraTheme.colors.textSecondary,
  },
  completionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: OzaraTheme.radius.full,
  },
  completionGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.accentEmerald,
  },
  completionAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.accentWarning,
  },
  completionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textGreen: {
    color: OzaraTheme.colors.accentEmerald,
  },
  textAmber: {
    color: '#fbbf24',
  },
  textCyan: {
    color: OzaraTheme.colors.accentCyan,
  },
  q18Banner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: OzaraTheme.radius.lg,
    padding: 12,
    marginBottom: 16,
  },
  q18BannerIcon: {
    fontSize: 18,
  },
  q18BannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fbbf24',
    marginBottom: 2,
  },
  q18BannerDesc: {
    fontSize: 11,
    color: '#fef3c7',
    lineHeight: 15,
  },
  tabButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: OzaraTheme.radius.full,
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: OzaraTheme.colors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#000000',
  },
  questionsContainer: {
    gap: 14,
  },
  questionCard: {
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.lg,
    padding: 14,
  },
  questionCardQ18: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
  },
  questionCardQ23: {
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(212, 175, 55, 0.04)',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  questionNumBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  questionNumText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  mandatoryBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mandatoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fbbf24',
  },
  confidentialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidentialBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: OzaraTheme.colors.accentGold,
  },
  visibilityPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: OzaraTheme.radius.full,
    borderWidth: 1,
  },
  visShared: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  visPrivate: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  visibilityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  questionPrompt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    lineHeight: 18,
    marginBottom: 10,
  },
  q23ShieldBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    padding: 8,
    borderRadius: OzaraTheme.radius.sm,
    marginBottom: 10,
  },
  q23ShieldText: {
    fontSize: 11,
    color: '#fef3c7',
    lineHeight: 15,
    flex: 1,
  },
  inputWrap: {
    gap: 6,
  },
  answerInput: {
    backgroundColor: OzaraTheme.colors.backgroundInput,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.md,
    padding: 10,
    fontSize: 12.5,
    color: '#ffffff',
    minHeight: 65,
    textAlignVertical: 'top',
  },
  autosaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  autosaveHint: {
    fontSize: 10,
    color: OzaraTheme.colors.textMuted,
  },
  readOnlyAnswerBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: OzaraTheme.radius.sm,
    padding: 10,
  },
  readOnlyText: {
    fontSize: 12.5,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 17,
  },
  redactedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  redactedText: {
    fontSize: 11.5,
    color: '#fbbf24',
    fontStyle: 'italic',
  },
  overviewContainer: {
    gap: 16,
  },
  taxSection: {
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.lg,
    padding: 14,
  },
  taxSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10,
  },
  taxPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  taxPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: OzaraTheme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  offerPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  needPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  taxPillText: {
    fontSize: 11,
    color: '#d1d5db',
  },
  travelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
  },
  travelCity: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  travelDates: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
  },
  emptyText: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
    fontStyle: 'italic',
  },
  legalSettingsCard: {
    marginTop: 20,
    marginBottom: 24,
    backgroundColor: OzaraTheme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: OzaraTheme.radius.lg,
    padding: 16,
  },
  legalSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  legalSettingsTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  legalRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  legalRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  legalRowTextWrap: {
    flex: 1,
  },
  legalRowLabel: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600',
  },
  legalRowSub: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  legalRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  versionAcceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  versionAcceptedText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  versionPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  versionPendingText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
  },
  quickAcceptBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.accentViolet,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  quickAcceptText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  accessRequestsCard: {
    marginTop: 18,
    marginBottom: 20,
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 16,
    padding: 16,
  },
  accessRequestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  accessRequestsTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  founderTag: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  founderTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: OzaraTheme.colors.accentCyan,
    letterSpacing: 0.8,
  },
  accessRequestsSubtitle: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 11,
    marginBottom: 14,
    lineHeight: 16,
  },
  emptyRequestsText: {
    color: OzaraTheme.colors.textDim,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  reqItemCard: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  reqItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  reqItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  reqItemEmail: {
    fontSize: 11,
    color: OzaraTheme.colors.accentCyan,
    marginTop: 1,
  },
  reqItemRole: {
    fontSize: 11,
    color: OzaraTheme.colors.textSecondary,
    marginTop: 3,
  },
  reqItemNotes: {
    fontSize: 10.5,
    color: OzaraTheme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  reqStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reqStatusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  reqStatusApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  reqStatusClaimed: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  reqStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  issuedTokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  issuedTokenLabel: {
    fontSize: 10.5,
    color: OzaraTheme.colors.textMuted,
    fontWeight: '600',
  },
  issuedTokenCode: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#34d399',
    letterSpacing: 1.5,
  },
  approveReqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OzaraTheme.colors.accentCyan,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  approveReqBtnText: {
    color: '#000000',
    fontSize: 11.5,
    fontWeight: '700',
  },
});
