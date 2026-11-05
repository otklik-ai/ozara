/**
 * ÖZARA Mobile: Polished Professional Networking Profile & Questionnaire Editor
 * - Default view: Premium, modern professional networking profile (Header, About Me,
 *   Professional Background, Current Focus, Let's Connect, What I Can Offer,
 *   Locations & Community, Beyond Work, Contact & Connections).
 * - "Edit Profile" toggles into the Questionnaire Editor organized into canonical sections (A-E).
 * - Strict privacy enforcement: Private answers omitted from peer profiles; Q23 permanently locked.
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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClub } from '../context/ClubContext';
import {
  ApiService,
  UserProfile,
  resolveImageUrl,
  CURRENT_ACCESS_CONDITIONS_VERSION,
} from '../services/api';
import { OzaraTheme } from '../constants/ozara-theme';
import { AdminDashboardView } from './AdminDashboardView';
import {
  CANONICAL_QUESTIONS,
  SCREEN_DEFINITIONS,
  ALL_COUNTRIES_LIST,
  US_STATES_LIST,
  Q6_REFERRAL_OPTIONS,
} from '../screens/SignUpScreen';

// Canonical 6 screens for questionnaire editing
const CANONICAL_SECTIONS = [
  { id: 'all', title: 'All Screens (1–6)' },
  { id: '1', title: '1. Contact', questionIds: [1, 2, 3, 4, 5, 6] },
  { id: '2', title: '2. Profile', questionIds: [7, 8, 9, 10, 11] },
  { id: '3', title: '3. Residence & Family', questionIds: [12, 13, 14, 15, 16] },
  { id: '4', title: '4. Wealth Profile', questionIds: [17, 18, 19, 20] },
  { id: '5', title: '5. Current Setup', questionIds: [21, 22, 23] },
  { id: '6', title: '6. Interests & Next Step', questionIds: [24, 25] },
];

export const ProfileDrawerModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    profileDrawerUserId,
    closeProfile,
    currentUserId,
    currentUser,
    refreshUserData,
    openConditions,
    signOut,
  } = useClub();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // View mode: 'profile' (default read-only networking view), 'editor' (questionnaire), 'admin' (Admin Dashboard)
  const [viewMode, setViewMode] = useState<'profile' | 'editor' | 'admin'>('profile');
  const [editorSection, setEditorSection] = useState<string>('all');

  // Local answer changes before save
  const [answersState, setAnswersState] = useState<Record<number, { value: string; visibility: 'shared' | 'private' }>>({});
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);
  const [openQ24Dropdown, setOpenQ24Dropdown] = useState<'chapter' | 'involvement' | null>(null);
  const [isDrawerWhatsAppCountryPickerOpen, setIsDrawerWhatsAppCountryPickerOpen] = useState(false);
  const [drawerWhatsAppCountrySearchQuery, setDrawerWhatsAppCountrySearchQuery] = useState('');

  // Access requests for Founder / Admin role (Alexandra, Julia, Elena)
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [decliningRequestId, setDecliningRequestId] = useState<string | null>(null);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);

  // New invitation state
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteName, setNewInviteName] = useState('');
  const [newInviteDays, setNewInviteDays] = useState('14');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

  // Connection and contact methods state
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactMethods, setContactMethods] = useState<any | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('none');
  const [localZoomLink, setLocalZoomLink] = useState<string>('');
  const [updatingConnection, setUpdatingConnection] = useState(false);

  const handleRequestConnection = async () => {
    if (!profileDrawerUserId || !currentUserId) return;
    try {
      setUpdatingConnection(true);
      await ApiService.requestConnection(currentUserId, profileDrawerUserId);
      setConnectionStatus('pending_sent');
      loadProfile();
    } catch (err: any) {
      const msg = err.message || 'Could not send request';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Connection Request', msg);
    } finally {
      setUpdatingConnection(false);
    }
  };

  const handleCancelConnection = async () => {
    if (!profileDrawerUserId || !currentUserId) return;
    try {
      setUpdatingConnection(true);
      await ApiService.cancelConnection(currentUserId, profileDrawerUserId);
      setConnectionStatus('none');
      loadProfile();
    } catch (err: any) {
      const msg = err.message || 'Could not cancel request';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Cancel Request', msg);
    } finally {
      setUpdatingConnection(false);
    }
  };

  const handleAcceptConnection = async () => {
    if (!profileDrawerUserId || !currentUserId) return;
    try {
      setUpdatingConnection(true);
      await ApiService.acceptConnection(currentUserId, profileDrawerUserId);
      setConnectionStatus('accepted');
      loadProfile();
    } catch (err: any) {
      const msg = err.message || 'Could not accept connection';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Accept Connection', msg);
    } finally {
      setUpdatingConnection(false);
    }
  };

  const handleDeclineConnection = async () => {
    if (!profileDrawerUserId || !currentUserId) return;
    try {
      setUpdatingConnection(true);
      await ApiService.declineConnection(currentUserId, profileDrawerUserId);
      setConnectionStatus('declined');
      loadProfile();
    } catch (err: any) {
      const msg = err.message || 'Could not decline connection';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Decline Connection', msg);
    } finally {
      setUpdatingConnection(false);
    }
  };

  const handleOpenContactMethods = async () => {
    if (!profileDrawerUserId || !currentUserId) return;
    try {
      setLoadingContact(true);
      const res = await ApiService.getContactMethods(currentUserId, profileDrawerUserId);
      setContactMethods(res);
      setContactModalOpen(true);
    } catch (err: any) {
      const msg = err.message || 'Contact details are private until connection acceptance.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Contact Methods', msg);
    } finally {
      setLoadingContact(false);
    }
  };

  const loadAccessRequests = async () => {
    if (currentUser?.role !== 'FOUNDER' && currentUser?.role !== 'ADMIN') return;
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
        const msg = `Approved! Token ${res.token} issued and dispatched to ${email}.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Access Approved', msg);
        loadAccessRequests();
      }
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert(err.message || 'Approval failed');
      else Alert.alert('Error', err.message);
    } finally {
      setApprovingRequestId(null);
    }
  };

  const handleDeclineRequest = async (reqId: string, email: string) => {
    try {
      setDecliningRequestId(reqId);
      const res = await ApiService.declineAccessRequest({
        requestId: reqId,
        email,
        declinedBy: currentUser?.email || 'ermolov.elena@gmail.com',
      });
      if (res.success) {
        if (Platform.OS === 'web') window.alert(`Request for ${email} has been declined.`);
        else Alert.alert('Request Declined', `Request for ${email} has been declined.`);
        loadAccessRequests();
      }
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert(err.message || 'Decline failed');
      else Alert.alert('Error', err.message);
    } finally {
      setDecliningRequestId(null);
    }
  };

  const handleRevokeInvitation = async (id: string, token: string) => {
    try {
      setRevokingTokenId(id);
      const res = await ApiService.revokeInvitation({
        id,
        token,
        revokedBy: currentUser?.email || 'ermolov.elena@gmail.com',
      });
      if (res.success) {
        if (Platform.OS === 'web') window.alert(`Token ${token} has been revoked.`);
        else Alert.alert('Invitation Revoked', `Token ${token} has been revoked.`);
        loadAccessRequests();
      }
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert(err.message || 'Revoke failed');
      else Alert.alert('Error', err.message);
    } finally {
      setRevokingTokenId(null);
    }
  };

  const handleCreateNewInvite = async () => {
    if (!newInviteEmail.trim()) {
      if (Platform.OS === 'web') window.alert('Please enter an applicant email.');
      else Alert.alert('Missing Email', 'Please enter an applicant email.');
      return;
    }
    try {
      setIsCreatingInvite(true);
      const res = await ApiService.createInvitation({
        email: newInviteEmail.trim(),
        fullName: newInviteName.trim() || undefined,
        createdBy: currentUser?.id || 'admin',
        expiresInDays: parseInt(newInviteDays, 10) || 14,
      });
      if (res.success) {
        const msg = `Created invitation token ${res.token} for ${res.email} (expires in ${newInviteDays} days).`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Invitation Generated', msg);
        setNewInviteEmail('');
        setNewInviteName('');
        setShowCreateInvite(false);
        loadAccessRequests();
      }
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert(err.message || 'Creation failed');
      else Alert.alert('Error', err.message);
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const isOpen = !!profileDrawerUserId;
  const isSelf = profileDrawerUserId === currentUserId;
  const isFounder = currentUser?.role === 'FOUNDER' || currentUser?.role === 'ADMIN';

  const loadProfile = async () => {
    if (!profileDrawerUserId) return;
    try {
      setLoading(true);
      const data = await ApiService.getProfile(profileDrawerUserId, currentUserId);
      setProfile(data);
      setConnectionStatus(data.connection_status || 'none');
      setLocalZoomLink(data.zoom_link || '');

      // Populate local answer state for all 25 questions
      const initialMap: Record<number, { value: string; visibility: 'shared' | 'private' }> = {};
      data.answers?.forEach(a => {
        const qDef = CANONICAL_QUESTIONS.find(q => q.id === a.question_id);
        const isSwitch = qDef?.visibility_mode === 'switch';
        initialMap[a.question_id] = {
          value: a.value_text || (typeof a.value === 'string' ? a.value : ''),
          visibility: isSwitch ? (a.visibility || 'private') : 'private',
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
      setViewMode('profile');
      setEditorSection('all');
      loadProfile();
      if (currentUser?.role === 'FOUNDER' || currentUser?.role === 'ADMIN') {
        loadAccessRequests();
      }
    } else {
      setProfile(null);
    }
  }, [profileDrawerUserId]);

  const handleSaveAnswer = async (questionId: number, overrideVal?: string, overrideVis?: 'shared' | 'private') => {
    if (!profileDrawerUserId || !isSelf) return;
    const item = answersState[questionId];
    const valToSave = overrideVal !== undefined ? overrideVal : (item?.value || '');
    const qDef = CANONICAL_QUESTIONS.find(q => q.id === questionId);
    const isSwitch = qDef?.visibility_mode === 'switch';
    const isPrivateMode =
      (questionId === 7 ? valToSave : answersState[7]?.value) === 'Private (browse deals and events only)';
    const visToSave: 'shared' | 'private' =
      !isSwitch || isPrivateMode ? 'private' : (overrideVis || item?.visibility || 'private');

    try {
      setSavingQuestionId(questionId);
      const res = await ApiService.saveAnswer(
        profileDrawerUserId,
        questionId,
        valToSave,
        visToSave
      );
      if (questionId === 7 && valToSave === 'Private (browse deals and events only)') {
        setAnswersState(prev => {
          const next = { ...prev };
          for (const swId of [8, 9, 10, 11, 12, 24]) {
            if (next[swId]) next[swId] = { ...next[swId], visibility: 'private' };
          }
          return next;
        });
      }
      if (res.success && res.is_complete !== undefined) {
        setProfile(prev => (prev ? { ...prev, is_complete: res.is_complete } : prev));
        refreshUserData();
      }
    } catch (err: any) {
      const msg = err.message || 'Could not save answer';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Save Error', msg);
    } finally {
      setSavingQuestionId(null);
    }
  };

  const handleToggleVisibility = async (questionId: number) => {
    if (!isSelf) return;
    const qDef = CANONICAL_QUESTIONS.find(q => q.id === questionId);
    if (!qDef || qDef.visibility_mode !== 'switch') {
      const msg = 'This question is Team only (visible only to Founders/Admins and you) and cannot be made public.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Team Only Field', msg);
      return;
    }
    if (answersState[7]?.value === 'Private (browse deals and events only)') {
      const msg = "Your profile mode (Question 7) is set to 'Private (browse deals and events only)'. Switch Question 7 to 'Visible to members' first to turn on individual visibility switches.";
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Profile Mode is Private', msg);
      return;
    }
    const current = answersState[questionId];
    const newVis = current?.visibility === 'shared' ? 'private' : 'shared';
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
      refreshUserData();
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

  // Helper to extract clean answer value respecting privacy
  const getAnswer = (qId: number): string => {
    const local = answersState[qId];
    const original = profile?.answers?.find(a => a.question_id === qId);
    if (!local && !original) return '';

    const vis = local?.visibility || original?.visibility || 'shared';
    const isRedacted = original?.is_redacted;

    // For peer members (not self and not founder), hide private answers
    if (!isSelf && !isFounder) {
      if (vis === 'private' || isRedacted) return '';
    }

    const raw = local?.value !== undefined ? local.value : (original?.value_text || '');
    if (!raw || raw === 'skipped' || raw === '[Private]' || raw.startsWith('[Confidential')) return '';
    return raw;
  };

  const isFieldPrivate = (qId: number): boolean => {
    const local = answersState[qId];
    const original = profile?.answers?.find(a => a.question_id === qId);
    return (local?.visibility || original?.visibility) === 'private';
  };

  // Safe external URL opener
  const openExternalUrl = (url: string) => {
    if (!url) return;
    const normalized = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url.trim()}`;
    Linking.openURL(normalized).catch(err => console.warn('Could not open URL:', err));
  };

  // Extract 25-question fields
  const parseList = (raw: string): string[] => {
    if (!raw || raw === 'skipped') return [];
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
      } catch {}
    }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed.countries)) {
          const states = Array.isArray(parsed.us_states) && parsed.us_states.length > 0
            ? [`US States: ${parsed.us_states.join(', ')}`]
            : [];
          return [...parsed.countries, ...states];
        }
        if (Array.isArray(parsed.tags)) return parsed.tags.map(String).filter(Boolean);
      } catch {}
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  };

  const formatAnswerForDisplay = (qId: number, raw: string): string => {
    if (!raw || raw === 'skipped' || raw === 'unanswered') return '';
    if (qId === 4 && raw.startsWith('{')) {
      try {
        const p = JSON.parse(raw);
        return [
          p.telegram ? `Telegram: ${p.telegram}` : '',
          p.whatsapp ? `WhatsApp: ${p.whatsapp}` : '',
        ].filter(Boolean).join(' · ');
      } catch {}
    }
    if (qId === 6 && raw.startsWith('{')) {
      try {
        const p = JSON.parse(raw);
        return [p.source, p.detail].filter(Boolean).join(' — ');
      } catch {}
    }
    if (qId === 14 && raw.startsWith('{')) {
      try {
        const p = JSON.parse(raw);
        const c = Array.isArray(p.countries) ? p.countries.join(', ') : '';
        const st = Array.isArray(p.us_states) && p.us_states.length > 0 ? ` (US State: ${p.us_states.join(', ')})` : '';
        return `${c}${st}`;
      } catch {}
    }
    return raw;
  };

  const q7ProfileMode = getAnswer(7) || profile?.profile_mode || 'Visible to members';
  const isPrivateProfileMode = q7ProfileMode === 'Private (browse deals and events only)';
  const q9MainRole = getAnswer(9);
  const q10ShortBio = getAnswer(10);
  const q11OpenTo = parseList(getAnswer(11));
  const q12Residence = parseList(getAnswer(12));
  const q24Interests = parseList(getAnswer(24));

  const professionalTitleAndOrg = q9MainRole || profile?.headline || 'Verified Member';
  const q2Location = q12Residence.length > 0
    ? q12Residence.join(', ')
    : `${profile?.city || ''}${profile?.country ? `, ${profile.country}` : ''}`;

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={closeProfile}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarInner}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                if (viewMode === 'editor') {
                  setViewMode('profile');
                } else {
                  closeProfile();
                }
              }}
              activeOpacity={0.7}
              accessibilityLabel={viewMode === 'editor' ? 'Back to profile view' : 'Close profile'}>
              <Ionicons name={viewMode === 'editor' ? "arrow-back" : "close"} size={22} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.topBarTitleBox}>
              <Text style={styles.topBarTitle}>
                {viewMode === 'editor'
                  ? 'Edit Member Questionnaire (25 Questions)'
                  : isSelf
                  ? 'My Club Profile'
                  : `${profile?.full_name || 'Member'} Profile`}
              </Text>
              {viewMode === 'editor' && (
                <Text style={styles.topBarSubTitle}>Edit any answer or visibility switch at any time</Text>
              )}
            </View>

            {isSelf ? (
              viewMode === 'profile' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {isFounder && (
                    <TouchableOpacity
                      style={styles.topBarAdminBtn}
                      onPress={() => setViewMode('admin')}
                      activeOpacity={0.75}>
                      <Ionicons name="shield-checkmark" size={13} color="#f59e0b" />
                      <Text style={styles.topBarAdminText}>Admin</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.topBarEditBtn}
                    onPress={() => setViewMode('editor')}
                    activeOpacity={0.75}>
                    <Ionicons name="create-outline" size={14} color="#38bdf8" />
                    <Text style={styles.topBarEditText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.topBarDoneBtn}
                  onPress={() => {
                    setViewMode('profile');
                    loadProfile();
                  }}
                  activeOpacity={0.8}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#10b981" />
                  <Text style={styles.topBarDoneText}>Done</Text>
                </TouchableOpacity>
              )
            ) : (
              <View style={{ width: 36 }} />
            )}
          </View>
        </View>

        {viewMode === 'admin' ? (
          <AdminDashboardView onClose={() => setViewMode('profile')} />
        ) : (
          <>
            {loading || !profile ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator size="large" color={OzaraTheme.colors.accentCyan} />
                <Text style={styles.loaderText}>Loading verified credentials...</Text>
              </View>
            ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 30 }]}>

            {/* ========================================================================= */}
            {/* VIEW MODE: POLISHED PROFESSIONAL NETWORKING PROFILE (DEFAULT)             */}
            {/* ========================================================================= */}
            {viewMode === 'profile' && (
              <>
                {/* 1. PROFILE HEADER */}
                <View style={styles.netHeaderSection}>
                  <View style={styles.netHeaderTopRow}>
                    <View style={styles.netAvatarWrapper}>
                      <Image
                        source={{ uri: resolveImageUrl(profile.avatar_url) }}
                        style={styles.netAvatar}
                      />
                      {profile.is_complete && (
                        <View style={styles.netVerifiedBadgeIcon}>
                          <Ionicons name="checkmark-circle" size={17} color="#10b981" />
                        </View>
                      )}
                    </View>

                    <View style={styles.netHeaderInfo}>
                      <View style={styles.netNameBadgeRow}>
                        <Text style={styles.netFullName}>{profile.full_name}</Text>
                        <View style={styles.netMemberBadge}>
                          <Ionicons
                            name={profile.is_complete ? "shield-checkmark" : "alert-circle"}
                            size={11}
                            color={profile.is_complete ? "#10b981" : "#f59e0b"}
                            style={{ marginRight: 3 }}
                          />
                          <Text
                            style={[
                              styles.netMemberBadgeText,
                              profile.is_complete ? styles.textGreen : styles.textAmber,
                            ]}>
                            {profile.is_complete ? 'Verified Member' : 'Incomplete'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.netHeadlineText} numberOfLines={2}>
                        {professionalTitleAndOrg}
                      </Text>

                      {q2Location ? (
                        <View style={styles.netLocationRow}>
                          <Ionicons name="location-outline" size={12} color="#64748b" />
                          <Text style={styles.netLocationText}>{q2Location}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {!isSelf && (
                    <View style={styles.netHeaderActionRow}>
                      {connectionStatus === 'accepted' ? (
                        <TouchableOpacity
                          style={[styles.netConnectPrimaryBtn, { backgroundColor: '#0284c7' }]}
                          onPress={handleOpenContactMethods}
                          disabled={loadingContact}
                          activeOpacity={0.85}>
                          {loadingContact ? (
                            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                          ) : (
                            <Ionicons name="chatbubbles-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                          )}
                          <Text style={styles.netConnectPrimaryBtnText}>Message</Text>
                        </TouchableOpacity>
                      ) : connectionStatus === 'pending_sent' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[styles.netConnectPrimaryBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' }]}>
                            <Ionicons name="time-outline" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                            <Text style={[styles.netConnectPrimaryBtnText, { color: '#cbd5e1' }]}>Requested</Text>
                          </View>
                          <TouchableOpacity
                            onPress={handleCancelConnection}
                            disabled={updatingConnection}
                            style={{ paddingVertical: 6, paddingHorizontal: 8 }}
                            activeOpacity={0.7}>
                            <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '500' }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      ) : connectionStatus === 'pending_received' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            style={[styles.netConnectPrimaryBtn, { backgroundColor: '#10b981' }]}
                            onPress={handleAcceptConnection}
                            disabled={updatingConnection}
                            activeOpacity={0.85}>
                            <Ionicons name="checkmark-circle-outline" size={14} color="#000000" style={{ marginRight: 5 }} />
                            <Text style={[styles.netConnectPrimaryBtnText, { color: '#000000' }]}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.netConnectPrimaryBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.25)' }]}
                            onPress={handleDeclineConnection}
                            disabled={updatingConnection}
                            activeOpacity={0.85}>
                            <Ionicons name="close-circle-outline" size={14} color="#ef4444" style={{ marginRight: 5 }} />
                            <Text style={[styles.netConnectPrimaryBtnText, { color: '#ef4444' }]}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.netConnectPrimaryBtn}
                          onPress={handleRequestConnection}
                          disabled={updatingConnection}
                          activeOpacity={0.85}>
                          <Ionicons name="person-add-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                          <Text style={styles.netConnectPrimaryBtnText}>
                            {updatingConnection ? 'Connecting...' : 'Connect'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {/* Incomplete Required Questions Banner (Profile Owner Only) */}
                {!profile.is_complete && isSelf && (
                  <View style={styles.q18SlimBanner}>
                    <Ionicons name="warning-outline" size={15} color="#f59e0b" />
                    <Text style={styles.q18SlimText}>
                      Complete the 6 required onboarding questions (Name, Email, Phone, Referral, Profile Mode, Next Step) to mark your profile verified.
                    </Text>
                    <TouchableOpacity
                      style={styles.q18SlimBtn}
                      onPress={() => {
                        setViewMode('editor');
                        setEditorSection('all');
                      }}
                      activeOpacity={0.8}>
                      <Text style={styles.q18SlimBtnText}>Complete</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 2. VISIBLE MEMBER PROFILE (What the member switched on in Screen 2, Q12, Q24) */}
                <View style={styles.netSection}>
                  <Text style={styles.netSectionTitle}>Member Profile</Text>
                  {isSelf && (
                    <Text style={styles.netSectionSubtext}>
                      Profile Mode (Q7): {q7ProfileMode}. Other verified members see only the answers you switch to Visible.
                    </Text>
                  )}

                  {q9MainRole ? (
                    <View style={styles.netFieldRow}>
                      <Text style={styles.netFieldLabel}>Main Role</Text>
                      <Text style={styles.netFieldValue}>
                        {q9MainRole}
                        {(isSelf || isFounder) && isFieldPrivate(9) ? ' (Private)' : ''}
                      </Text>
                    </View>
                  ) : null}

                  {q10ShortBio ? (
                    <View style={styles.netFieldRow}>
                      <Text style={styles.netFieldLabel}>Bio</Text>
                      <Text style={styles.netFieldValue}>
                        {q10ShortBio}
                        {(isSelf || isFounder) && isFieldPrivate(10) ? ' (Private)' : ''}
                      </Text>
                    </View>
                  ) : null}

                  {q11OpenTo.length > 0 && (
                    <View style={styles.netFieldRow}>
                      <Text style={styles.netFieldLabel}>Open To</Text>
                      <Text style={styles.netInlineTags}>
                        {q11OpenTo.join(' · ')}
                        {(isSelf || isFounder) && isFieldPrivate(11) ? ' (Private)' : ''}
                      </Text>
                    </View>
                  )}

                  {q12Residence.length > 0 && (
                    <View style={styles.netFieldRow}>
                      <Text style={styles.netFieldLabel}>Residence</Text>
                      <Text style={styles.netInlineTags}>
                        {q12Residence.join(' · ')}
                        {(isSelf || isFounder) && isFieldPrivate(12) ? ' (Private)' : ''}
                      </Text>
                    </View>
                  )}

                  {q24Interests.length > 0 && (
                    <View style={styles.netFieldRow}>
                      <Text style={styles.netFieldLabel}>Interests</Text>
                      <Text style={styles.netInlineTags}>
                        {q24Interests.join(' · ')}
                        {(isSelf || isFounder) && isFieldPrivate(24) ? ' (Private)' : ''}
                      </Text>
                    </View>
                  )}

                  {!q9MainRole && !q10ShortBio && q11OpenTo.length === 0 && q12Residence.length === 0 && q24Interests.length === 0 && (
                    <Text style={styles.netPrivacyNotice}>
                      {isSelf
                        ? 'Your switchable profile fields (Q8–Q12, Q24) are currently empty or set to Private. Click Edit to update or switch on what other members can see.'
                        : 'This member keeps their detailed profile fields private.'}
                    </Text>
                  )}
                </View>

                {/* 3. TEAM-ONLY ANSWERS (Strictly Restricted to Founders/Admins & Self) */}
                {(isSelf || isFounder) && (
                  <View style={styles.netSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={styles.netSectionTitle}>Team-Only Answers (Confidential)</Text>
                      <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.14)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.35)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '700' }}>
                          🔒 FOUNDERS/ADMINS &amp; YOU ONLY
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.netSectionSubtext}>
                      Screens 3 to 5 are AES-256-GCM encrypted at rest and never visible to other members.
                    </Text>

                    {[1, 2, 3, 4, 5, 6, 7, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25].map((qId) => {
                      const qDef = CANONICAL_QUESTIONS.find((x) => x.id === qId);
                      const val = formatAnswerForDisplay(qId, getAnswer(qId));
                      if (!val) return null;
                      return (
                        <View key={qId} style={styles.netFieldRow}>
                          <Text style={[styles.netFieldLabel, { width: 130 }]} numberOfLines={2}>
                            Q{qId}. {qDef?.prompt}
                          </Text>
                          <Text style={styles.netFieldValue}>{val}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Account Governance & Legal */}
                <View style={styles.legalSettingsCard}>
                  <Text style={styles.netSectionTitle}>Account Governance &amp; Legal</Text>

                  <TouchableOpacity
                    style={styles.legalRowBtn}
                    onPress={() => {
                      closeProfile();
                      openConditions('tabs');
                    }}
                    activeOpacity={0.75}>
                    <View style={styles.legalRowLeft}>
                      <Ionicons name="document-text-outline" size={16} color="#94a3b8" />
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
                      <Ionicons name="chevron-forward" size={15} color={OzaraTheme.colors.textMuted} />
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
                {(currentUser?.role === 'FOUNDER' || currentUser?.role === 'ADMIN') && (
                  <View style={styles.accessRequestsCard}>
                    <View style={styles.accessRequestsHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="key" size={15} color={OzaraTheme.colors.accentCyan} />
                        <Text style={styles.accessRequestsTitle}>Membership Committee Desk</Text>
                      </View>
                      <View style={styles.founderTag}>
                        <Text style={styles.founderTagText}>FOUNDER CONSOLE</Text>
                      </View>
                    </View>
                    <Text style={styles.accessRequestsSubtitle}>
                      Confidential applicant queue and invitation governance for Alexandra, Julia, and Elena.
                    </Text>

                    <TouchableOpacity
                      style={styles.openAdminDeskBtn}
                      onPress={() => setViewMode('admin')}
                      activeOpacity={0.85}>
                      <Ionicons name="shield-checkmark" size={16} color="#000000" />
                      <Text style={styles.openAdminDeskBtnText}>Open Admin Dashboard &amp; Events Desk</Text>
                      <Ionicons name="arrow-forward" size={14} color="#000000" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Bottom Sign Out Action for Active Member */}
                {isSelf && (
                  <View style={styles.signOutContainer}>
                    <TouchableOpacity
                      style={styles.signOutFullBtn}
                      onPress={() => {
                        closeProfile();
                        signOut();
                      }}
                      activeOpacity={0.85}>
                      <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                      <Text style={styles.signOutFullBtnText}>Sign Out of ÖZARA</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* ========================================================================= */}
            {/* VIEW MODE: 25-QUESTION, 6-SCREEN QUESTIONNAIRE EDITOR                     */}
            {/* ========================================================================= */}
            {viewMode === 'editor' && (
              <View style={styles.editorContainer}>
                <View style={styles.editorBanner}>
                  <View style={styles.editorBannerLeft}>
                    <Ionicons name="sparkles" size={16} color="#38bdf8" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.editorBannerTitle}>25-Question Member Onboarding &amp; Profile</Text>
                      <Text style={styles.editorBannerDesc}>
                        Edit any answer and any visibility switch at any time. Team-only answers are seen only by Founders/Admins.
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.editorBannerDoneBtn}
                    onPress={() => {
                      setViewMode('profile');
                      loadProfile();
                    }}
                    activeOpacity={0.8}>
                    <Text style={styles.editorBannerDoneBtnText}>View Profile</Text>
                  </TouchableOpacity>
                </View>

                {/* Screen Filter Pills (1 to 6) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabsScroll}>
                  {CANONICAL_SECTIONS.map(sec => {
                    const isActive = editorSection === sec.id;
                    return (
                      <TouchableOpacity
                        key={sec.id}
                        style={[styles.sectionTabPill, isActive && styles.sectionTabPillActive]}
                        onPress={() => setEditorSection(sec.id)}
                        activeOpacity={0.75}>
                        <Text style={[styles.sectionTabPillText, isActive && styles.sectionTabPillTextActive]}>
                          {sec.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {editorSection === '4' && (
                  <View style={[styles.q23ShieldBox, { marginBottom: 14 }]}>
                    <Ionicons name="shield-checkmark" size={14} color="#38bdf8" />
                    <Text style={[styles.q23ShieldText, { color: '#e2e8f0' }]}>
                      Only our team sees this. It helps us show you relevant deals and services.
                    </Text>
                  </View>
                )}

                {/* Question Cards Stack (Q1 to Q25) */}
                <View style={styles.questionsContainer}>
                  {CANONICAL_QUESTIONS.filter(qDef => {
                    if (editorSection === 'all') return true;
                    const targetSec = CANONICAL_SECTIONS.find(s => s.id === editorSection);
                    return targetSec && targetSec.questionIds ? targetSec.questionIds.includes(qDef.id) : true;
                  }).map(qDef => {
                    const qId = qDef.id;
                    const local = answersState[qId] || {
                      value: '',
                      visibility: 'private',
                    };
                    const currentVal = local.value === 'skipped' ? '' : (local.value || '');
                    const isSwitchable = qDef.visibility_mode === 'switch';
                    const effectiveVis: 'shared' | 'private' =
                      !isSwitchable || isPrivateProfileMode ? 'private' : (local.visibility || 'private');
                    const isSaving = savingQuestionId === qId;

                    const exclusiveOptions = [
                      'Prefer not to say',
                      'None yet',
                      'Nobody yet',
                      'None of these',
                      'Not sure',
                    ];

                    return (
                      <View key={qId} style={styles.questionCard}>
                        {/* Top Row: Question Number, Required Badge, and Visibility Control */}
                        <View style={styles.questionHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={styles.questionNumBadge}>
                              <Text style={styles.questionNumText}>
                                Screen {qDef.screen} · Q{qId}
                              </Text>
                            </View>
                            {qDef.is_required && (
                              <View style={styles.mandatoryBadge}>
                                <Text style={styles.mandatoryBadgeText}>REQUIRED</Text>
                              </View>
                            )}
                          </View>

                          {isSelf && (
                            qDef.visibility_mode === 'team_only' ? (
                              <View style={[styles.visibilityPill, styles.visPrivate]}>
                                <Ionicons name="lock-closed" size={11} color="#f59e0b" />
                                <Text style={[styles.visibilityText, styles.textAmber]}>
                                  Team only
                                </Text>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={[
                                  styles.visibilityPill,
                                  effectiveVis === 'private' ? styles.visPrivate : styles.visShared,
                                ]}
                                onPress={() => handleToggleVisibility(qId)}>
                                <Ionicons
                                  name={effectiveVis === 'private' ? 'lock-closed' : 'eye-outline'}
                                  size={11}
                                  color={effectiveVis === 'private' ? '#f59e0b' : '#38bdf8'}
                                />
                                <Text
                                  style={[
                                    styles.visibilityText,
                                    effectiveVis === 'private' ? styles.textAmber : styles.textCyan,
                                  ]}>
                                  {isPrivateProfileMode
                                    ? 'Private (locked by Q7)'
                                    : effectiveVis === 'private'
                                    ? 'Private · Switch'
                                    : 'Visible · Switch'}
                                </Text>
                              </TouchableOpacity>
                            )
                          )}
                        </View>

                        <Text style={styles.questionPrompt}>{qDef.prompt}</Text>

                        <View style={styles.inputWrap}>
                          {/* Q1, Q2, Q3: Text / Email / Phone */}
                          {(qId === 1 || qId === 2 || qId === 3) && (
                            <TextInput
                              style={[styles.answerInput, { minHeight: 42, paddingVertical: 10 }]}
                              placeholder={qDef.placeholder || ''}
                              placeholderTextColor={OzaraTheme.colors.textMuted}
                              value={currentVal}
                              onChangeText={val =>
                                setAnswersState(prev => ({
                                  ...prev,
                                  [qId]: { ...local, value: val },
                                }))
                              }
                              onBlur={() => handleSaveAnswer(qId)}
                            />
                          )}

                          {/* Q4: Telegram and WhatsApp (Two text fields) */}
                          {qId === 4 && (() => {
                            let tgVal = '';
                            let waVal = '';
                            if (currentVal) {
                              try {
                                const p = JSON.parse(currentVal);
                                tgVal = p.telegram || '';
                                waVal = p.whatsapp || '';
                              } catch {
                                tgVal = currentVal;
                              }
                            }
                            const updateQ4 = (nextTg: string, nextWa: string, saveNow = false) => {
                              const nextStr = (!nextTg.trim() && !nextWa.trim())
                                ? ''
                                : JSON.stringify({ telegram: nextTg, whatsapp: nextWa });
                              setAnswersState(prev => ({
                                ...prev,
                                [4]: { ...local, value: nextStr },
                              }));
                              if (saveNow) handleSaveAnswer(4, nextStr);
                            };
                            return (
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TextInput
                                  style={[styles.answerInput, { flex: 1, minHeight: 42, paddingVertical: 10 }]}
                                  placeholder="Telegram: @handle or number"
                                  placeholderTextColor={OzaraTheme.colors.textMuted}
                                  value={tgVal}
                                  onChangeText={txt => updateQ4(txt, waVal, false)}
                                  onBlur={() => updateQ4(tgVal, waVal, true)}
                                />
                                <TextInput
                                  style={[styles.answerInput, { flex: 1, minHeight: 42, paddingVertical: 10 }]}
                                  placeholder="WhatsApp: @handle or number"
                                  placeholderTextColor={OzaraTheme.colors.textMuted}
                                  value={waVal}
                                  onChangeText={txt => updateQ4(tgVal, txt, false)}
                                  onBlur={() => updateQ4(tgVal, waVal, true)}
                                />
                              </View>
                            );
                          })()}

                          {/* Q6: How did you hear about us? (Dropdown + text) */}
                          {qId === 6 && (() => {
                            let sourceVal = '';
                            let detailVal = '';
                            if (currentVal) {
                              try {
                                const p = JSON.parse(currentVal);
                                sourceVal = p.source || '';
                                detailVal = p.detail || '';
                              } catch {
                                sourceVal = currentVal;
                              }
                            }
                            const updateQ6 = (nextSource: string, nextDetail: string, saveNow = false) => {
                              const nextStr = (!nextSource && !nextDetail)
                                ? ''
                                : JSON.stringify({ source: nextSource, detail: nextDetail });
                              setAnswersState(prev => ({
                                ...prev,
                                [6]: { ...local, value: nextStr },
                              }));
                              if (saveNow) handleSaveAnswer(6, nextStr);
                            };
                            return (
                              <View style={{ gap: 8 }}>
                                <View style={styles.chipsWrap}>
                                  {Q6_REFERRAL_OPTIONS.map(opt => {
                                    const isSel = sourceVal === opt;
                                    return (
                                      <TouchableOpacity
                                        key={opt}
                                        style={[styles.chipPill, isSel && styles.chipPillSelected]}
                                        onPress={() => updateQ6(opt, detailVal, true)}>
                                        <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                                          {opt}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                                <TextInput
                                  style={[styles.answerInput, { minHeight: 42, paddingVertical: 10 }]}
                                  placeholder="Referrer name or details (Team only — referrer is never notified)"
                                  placeholderTextColor={OzaraTheme.colors.textMuted}
                                  value={detailVal}
                                  onChangeText={txt => updateQ6(sourceVal, txt, false)}
                                  onBlur={() => updateQ6(sourceVal, detailVal, true)}
                                />
                              </View>
                            );
                          })()}

                          {/* Q8: Profile photo */}
                          {qId === 8 && (
                            <Text style={styles.questionHelperText}>
                              {isPrivateProfileMode
                                ? 'Profile mode is set to Private — no photo is shown to other members.'
                                : 'Your profile portrait visibility is controlled by the Private / Visible switch above.'}
                            </Text>
                          )}

                          {/* Q10: Company and short bio (300 chars max) */}
                          {qId === 10 && (
                            <View>
                              <TextInput
                                style={[styles.answerInput, { minHeight: 80 }]}
                                placeholder={qDef.placeholder || 'Company and short bio (max 300 characters)'}
                                placeholderTextColor={OzaraTheme.colors.textMuted}
                                multiline
                                maxLength={300}
                                value={currentVal}
                                onChangeText={val => {
                                  if (val.length <= 300) {
                                    setAnswersState(prev => ({
                                      ...prev,
                                      [10]: { ...local, value: val },
                                    }));
                                  }
                                }}
                                onBlur={() => handleSaveAnswer(10)}
                              />
                              <View style={styles.charCounterRow}>
                                <Text style={styles.charCounterText}>{currentVal.length}/300</Text>
                              </View>
                            </View>
                          )}

                          {/* Single-Select & Dropdown Questions: Q5, Q7, Q9, Q15, Q16, Q17, Q18, Q25 (Zero free text on Screens 4 & 5) */}
                          {(qDef.field_type === 'dropdown' || qDef.field_type === 'single') && (
                            <View style={styles.chipsWrap}>
                              {(qDef.options || []).map(opt => {
                                const isSel = currentVal === opt;
                                return (
                                  <TouchableOpacity
                                    key={opt}
                                    style={[styles.chipPill, isSel && styles.chipPillSelected]}
                                    onPress={() => {
                                      setAnswersState(prev => ({
                                        ...prev,
                                        [qId]: { ...local, value: opt },
                                      }));
                                      handleSaveAnswer(qId, opt);
                                    }}
                                    activeOpacity={0.75}>
                                    <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                                      {opt}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}

                          {/* Multi-Select Questions: Q11, Q19, Q20, Q21, Q22, Q23, Q24 (Zero free text on Screens 4 & 5) */}
                          {qDef.field_type === 'multi' && (() => {
                            const selectedList = parseList(currentVal);
                            return (
                              <View style={styles.chipsWrap}>
                                {(qDef.options || []).map(opt => {
                                  const isSel = selectedList.includes(opt);
                                  return (
                                    <TouchableOpacity
                                      key={opt}
                                      style={[styles.chipPill, isSel && styles.chipPillSelected]}
                                      onPress={() => {
                                        let next: string[];
                                        if (isSel) {
                                          next = selectedList.filter(x => x !== opt);
                                        } else if (exclusiveOptions.includes(opt)) {
                                          next = [opt];
                                        } else {
                                          next = [
                                            ...selectedList.filter(x => !exclusiveOptions.includes(x)),
                                            opt,
                                          ];
                                        }
                                        const valStr = next.join(', ');
                                        setAnswersState(prev => ({
                                          ...prev,
                                          [qId]: { ...local, value: valStr },
                                        }));
                                        handleSaveAnswer(qId, valStr);
                                      }}
                                      activeOpacity={0.75}>
                                      <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                                        {isSel ? `✓ ${opt}` : opt}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            );
                          })()}

                          {/* Country Multi-Select Questions: Q12, Q13, Q14 */}
                          {(qDef.field_type === 'country_multi' || qDef.field_type === 'country_tax_multi') && (() => {
                            let selectedCountries: string[] = [];
                            let selectedUsStates: string[] = [];
                            if (qId === 14 && currentVal.trim().startsWith('{')) {
                              try {
                                const p = JSON.parse(currentVal);
                                selectedCountries = Array.isArray(p.countries) ? p.countries : [];
                                selectedUsStates = Array.isArray(p.us_states) ? p.us_states : [];
                              } catch {}
                            } else {
                              selectedCountries = parseList(currentVal);
                            }

                            const updateCountries = (nextC: string[], nextSt: string[]) => {
                              let valStr = '';
                              if (qId === 14) {
                                const cleanSt = nextC.includes('United States') ? nextSt : [];
                                valStr = cleanSt.length > 0
                                  ? JSON.stringify({ countries: nextC, us_states: cleanSt })
                                  : nextC.join(', ');
                              } else {
                                valStr = nextC.join(', ');
                              }
                              setAnswersState(prev => ({
                                ...prev,
                                [qId]: { ...local, value: valStr },
                              }));
                              handleSaveAnswer(qId, valStr);
                            };

                            return (
                              <View style={{ gap: 8 }}>
                                <View style={styles.chipsWrap}>
                                  {ALL_COUNTRIES_LIST.slice(0, 30).map(country => {
                                    const isSel = selectedCountries.includes(country);
                                    return (
                                      <TouchableOpacity
                                        key={country}
                                        style={[styles.chipPill, isSel && styles.chipPillSelected]}
                                        onPress={() => {
                                          const nextC = isSel
                                            ? selectedCountries.filter(c => c !== country)
                                            : [...selectedCountries, country];
                                          updateCountries(nextC, selectedUsStates);
                                        }}>
                                        <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                                          {isSel ? `✓ ${country}` : country}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                                {qId === 14 && selectedCountries.includes('United States') && (
                                  <View style={{ marginTop: 6 }}>
                                    <Text style={styles.subFieldLabel}>Select US State(s) for Tax Residency:</Text>
                                    <View style={styles.chipsWrap}>
                                      {US_STATES_LIST.map(st => {
                                        const isStSel = selectedUsStates.includes(st);
                                        return (
                                          <TouchableOpacity
                                            key={st}
                                            style={[styles.chipPill, isStSel && styles.chipPillSelected]}
                                            onPress={() => {
                                              const nextSt = isStSel
                                                ? selectedUsStates.filter(x => x !== st)
                                                : [...selectedUsStates, st];
                                              updateCountries(selectedCountries, nextSt);
                                            }}>
                                            <Text style={[styles.chipText, isStSel && styles.chipTextSelected]}>
                                              {isStSel ? `✓ ${st}` : st}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                  </View>
                                )}
                              </View>
                            );
                          })()}

                          <View style={styles.autosaveRow}>
                            <Text style={styles.autosaveHint}>
                              {isSaving ? 'Saving changes...' : 'Saved automatically'}
                            </Text>
                            {isSaving && <ActivityIndicator size="small" color={OzaraTheme.colors.accentCyan} />}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Floating Bottom Done Editing Button */}
                <View style={styles.editorBottomDoneWrap}>
                  <TouchableOpacity
                    style={styles.editorBottomDoneBtn}
                    onPress={() => {
                      setViewMode('profile');
                      loadProfile();
                    }}
                    activeOpacity={0.85}>
                    <Ionicons name="checkmark-circle" size={18} color="#000000" />
                    <Text style={styles.editorBottomDoneBtnText}>Done Editing — View Profile</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
            )}
          </>
        )}

        {/* Contact Methods Sheet / Modal */}
        {contactModalOpen && (
          <View style={styles.contactModalOverlay}>
            <View style={styles.contactModalCard}>
              <View style={styles.contactModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactModalTitle}>
                    Connect with {contactMethods?.full_name || profile?.full_name}
                  </Text>
                  <Text style={styles.contactModalSubtitle}>
                    Available contact channels approved by this member
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setContactModalOpen(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View style={styles.contactMethodsList}>
                {/* WhatsApp */}
                {contactMethods?.methods?.whatsapp ? (
                  <TouchableOpacity
                    style={styles.contactMethodItem}
                    onPress={() => {
                      const phoneClean = contactMethods.methods.whatsapp.replace(/[^0-9]/g, '');
                      const url = `https://wa.me/${phoneClean}`;
                      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open WhatsApp'));
                    }}
                    activeOpacity={0.8}>
                    <View style={[styles.contactMethodIconBox, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                      <Ionicons name="logo-whatsapp" size={20} color="#22c55e" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactMethodName}>WhatsApp</Text>
                      <Text style={styles.contactMethodDetail}>{contactMethods.methods.whatsapp}</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color="#64748b" />
                  </TouchableOpacity>
                ) : null}

                {/* Telegram */}
                {contactMethods?.methods?.telegram ? (
                  <TouchableOpacity
                    style={styles.contactMethodItem}
                    onPress={() => {
                      const handleClean = contactMethods.methods.telegram.replace(/^@/, '').trim();
                      const url = `https://t.me/${handleClean}`;
                      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Telegram'));
                    }}
                    activeOpacity={0.8}>
                    <View style={[styles.contactMethodIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                      <Ionicons name="paper-plane-outline" size={19} color="#38bdf8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactMethodName}>Telegram</Text>
                      <Text style={styles.contactMethodDetail}>
                        {contactMethods.methods.telegram.startsWith('@')
                          ? contactMethods.methods.telegram
                          : `@${contactMethods.methods.telegram}`}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color="#64748b" />
                  </TouchableOpacity>
                ) : null}

                {/* Email */}
                {contactMethods?.methods?.email ? (
                  <TouchableOpacity
                    style={styles.contactMethodItem}
                    onPress={() => {
                      const subject = encodeURIComponent(`ÖZARA Club: Connecting with ${currentUser?.full_name || 'fellow member'}`);
                      const url = `mailto:${contactMethods.methods.email}?subject=${subject}`;
                      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open email client'));
                    }}
                    activeOpacity={0.8}>
                    <View style={[styles.contactMethodIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                      <Ionicons name="mail-outline" size={20} color="#f59e0b" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactMethodName}>Email</Text>
                      <Text style={styles.contactMethodDetail}>{contactMethods.methods.email}</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color="#64748b" />
                  </TouchableOpacity>
                ) : null}

                {/* Zoom */}
                {contactMethods?.methods?.zoom?.enabled ? (
                  contactMethods.methods.zoom.meeting_link ? (
                    <TouchableOpacity
                      style={styles.contactMethodItem}
                      onPress={() => {
                        Linking.openURL(contactMethods.methods.zoom.meeting_link).catch(() =>
                          Alert.alert('Error', 'Could not open Zoom link')
                        );
                      }}
                      activeOpacity={0.8}>
                      <View style={[styles.contactMethodIconBox, { backgroundColor: 'rgba(129, 140, 248, 0.15)' }]}>
                        <Ionicons name="videocam-outline" size={20} color="#818cf8" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactMethodName}>Zoom Meeting</Text>
                        <Text style={styles.contactMethodDetail}>Open direct video room</Text>
                      </View>
                      <Ionicons name="open-outline" size={16} color="#64748b" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.contactMethodItem}
                      onPress={() => {
                        const draft = `Hi ${contactMethods.full_name}, I'd love to connect for a 20-minute Zoom call. What days or times work best for you?`;
                        if (contactMethods.methods.email) {
                          const url = `mailto:${contactMethods.methods.email}?subject=${encodeURIComponent('Request for Zoom Call')}&body=${encodeURIComponent(draft)}`;
                          Linking.openURL(url);
                        } else if (contactMethods.methods.whatsapp) {
                          const phoneClean = contactMethods.methods.whatsapp.replace(/[^0-9]/g, '');
                          const url = `https://wa.me/${phoneClean}?text=${encodeURIComponent(draft)}`;
                          Linking.openURL(url);
                        } else if (contactMethods.methods.telegram) {
                          const handleClean = contactMethods.methods.telegram.replace(/^@/, '').trim();
                          const url = `https://t.me/${handleClean}`;
                          Linking.openURL(url);
                        } else {
                          Alert.alert('Request Zoom Call', `You can send a message to ${contactMethods.full_name} through the Chapter Team.`);
                        }
                      }}
                      activeOpacity={0.8}>
                      <View style={[styles.contactMethodIconBox, { backgroundColor: 'rgba(129, 140, 248, 0.15)' }]}>
                        <Ionicons name="videocam-outline" size={20} color="#818cf8" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactMethodName}>Request a Zoom call</Text>
                        <Text style={styles.contactMethodDetail}>Send an invitation to arrange video call</Text>
                      </View>
                      <Ionicons name="send-outline" size={16} color="#64748b" />
                    </TouchableOpacity>
                  )
                ) : null}

                {/* If none available or through team */}
                {(!contactMethods?.methods?.whatsapp && !contactMethods?.methods?.telegram && !contactMethods?.methods?.email && !contactMethods?.methods?.zoom?.enabled) && (
                  <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={24} color="#64748b" style={{ marginBottom: 6 }} />
                    <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                      This member prefers introduction routed through Chapter Leadership (Alexandra &amp; Julia).
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: OzaraTheme.colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitleBox: {
    flex: 1,
    marginHorizontal: 12,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  topBarSubTitle: {
    fontSize: 11,
    color: OzaraTheme.colors.accentCyan,
    marginTop: 1,
  },
  topBarEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    gap: 4,
  },
  topBarAdminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    gap: 4,
  },
  topBarAdminText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
  },
  openAdminDeskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 12,
  },
  openAdminDeskBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  topBarEditText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38bdf8',
  },
  topBarDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    gap: 4,
  },
  topBarDoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
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
    paddingHorizontal: 20,
    paddingTop: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },

  /* ========================================================================= */
  /* SLIM MINIMALIST NETWORKING PROFILE STYLES                                 */
  /* ========================================================================= */
  netHeaderSection: {
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  netHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  netAvatarWrapper: {
    position: 'relative',
  },
  netAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#1e293b',
  },
  netVerifiedBadgeIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: OzaraTheme.colors.background,
    borderRadius: 10,
  },
  netHeaderInfo: {
    flex: 1,
  },
  netNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  netFullName: {
    fontSize: 21,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  netMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  netMemberBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textGreen: {
    color: '#10b981',
  },
  textAmber: {
    color: '#f59e0b',
  },
  netHeadlineText: {
    fontSize: 13.5,
    fontWeight: '400',
    color: '#cbd5e1',
    marginTop: 4,
    lineHeight: 19,
  },
  netLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  netLocationText: {
    fontSize: 12.5,
    color: '#94a3b8',
  },
  netDotDivider: {
    fontSize: 12,
    color: '#475569',
    marginHorizontal: 2,
  },
  netChapterText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#c084fc',
  },
  netWebsiteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
    alignSelf: 'flex-start',
  },
  netWebsiteLinkText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#38bdf8',
    maxWidth: 240,
  },
  netHeaderActionRow: {
    marginTop: 14,
  },
  netConnectPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0284c7',
    alignSelf: 'flex-start',
  },
  netConnectPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },

  /* MINIMALIST SECTIONS (DIVIDER-BASED) */
  netSection: {
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  netSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    color: '#64748b',
    marginBottom: 12,
  },
  netSectionSubtext: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginBottom: 10,
    lineHeight: 18,
  },
  netLeadParagraph: {
    fontSize: 14.5,
    fontStyle: 'italic',
    color: '#f1f5f9',
    lineHeight: 22,
    marginBottom: 8,
  },
  netBodyParagraph: {
    fontSize: 13.5,
    color: '#cbd5e1',
    lineHeight: 21,
  },

  /* TYPOGRAPHIC FIELD ROWS */
  netFieldRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
    gap: 12,
  },
  netFieldLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748b',
    width: 95,
  },
  netFieldValue: {
    fontSize: 13.5,
    fontWeight: '400',
    color: '#f1f5f9',
    flex: 1,
    lineHeight: 20,
  },
  netInlineTags: {
    fontSize: 13.5,
    fontWeight: '400',
    color: '#cbd5e1',
    flex: 1,
    lineHeight: 21,
  },

  /* TRAVEL & FOOTNOTES */
  netTravelLine: {
    fontSize: 13,
    lineHeight: 20,
  },
  netTravelCityText: {
    fontWeight: '500',
    color: '#f1f5f9',
  },
  netTravelDatesText: {
    color: '#64748b',
  },
  netPrivacyNotice: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 8,
    lineHeight: 16,
    fontStyle: 'italic',
  },

  /* OWNER INLINE PROMPTS */
  netInlinePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  netInlinePromptText: {
    fontSize: 12.5,
    color: '#475569',
    fontStyle: 'italic',
  },

  /* Q18 SLIM BANNER */
  q18SlimBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    marginTop: 12,
    marginBottom: 4,
    gap: 10,
  },
  q18SlimText: {
    fontSize: 12,
    color: '#f59e0b',
    flex: 1,
    lineHeight: 16,
  },
  q18SlimBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  q18SlimBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },

  /* ========================================================================= */
  /* QUESTIONNAIRE EDITOR STYLES                                               */
  /* ========================================================================= */
  editorContainer: {
    flex: 1,
  },
  editorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  editorBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  editorBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  editorBannerDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    lineHeight: 15,
  },
  editorBannerDoneBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editorBannerDoneBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  sectionTabsScroll: {
    marginBottom: 14,
  },
  sectionTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 8,
  },
  sectionTabPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  sectionTabPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  sectionTabPillTextActive: {
    color: '#38bdf8',
  },
  questionsContainer: {
    gap: 12,
  },
  questionCard: {
    backgroundColor: '#0b111e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 14,
  },
  questionCardQ18: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  questionCardQ23: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: '#12110c',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  questionNumBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  questionNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  mandatoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  mandatoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
  },
  visibilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  visShared: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  visPrivate: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  visibilityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  textCyan: {
    color: '#38bdf8',
  },
  questionPrompt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    lineHeight: 19,
    marginBottom: 4,
  },
  questionHelperText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
    lineHeight: 16,
  },
  q23ShieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  q23ShieldText: {
    fontSize: 11,
    color: '#f59e0b',
    flex: 1,
    lineHeight: 15,
  },
  inputWrap: {
    marginTop: 6,
  },
  answerInput: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#ffffff',
    lineHeight: 18,
  },
  charCounterRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  charCounterText: {
    fontSize: 10,
    color: '#64748b',
  },
  subFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipPillSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderColor: '#38bdf8',
  },
  chipText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  autosaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 6,
  },
  autosaveHint: {
    fontSize: 10,
    color: '#64748b',
  },

  /* DROPDOWNS FOR Q24 */
  twoDropdownRow: {
    flexDirection: 'row',
    gap: 10,
  },
  twoDropdownCol: {
    flex: 1,
    position: 'relative',
  },
  drawerDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  drawerDropdownTriggerActive: {
    borderColor: '#38bdf8',
  },
  drawerDropdownTriggerText: {
    fontSize: 12,
    color: '#ffffff',
  },
  drawerDropdownPlaceholder: {
    color: '#64748b',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    width: '100%',
  },
  phoneCountryPickerContainer: {
    position: 'relative',
  },
  phoneCountryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  phoneCountryTriggerActive: {
    borderColor: OzaraTheme.colors.accentCyan,
  },
  phoneCountryFlag: {
    fontSize: 15,
  },
  phoneCountryDialCode: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ffffff',
  },
  phoneCountryDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: 270,
    zIndex: 99999,
    backgroundColor: '#090e1a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 8px 10px -6px rgba(0, 0, 0, 0.7)',
      } as any,
      default: {
        elevation: 20,
      },
    }),
  },
  dropdownSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#060a14',
  },
  dropdownSearchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    paddingVertical: 2,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  drawerDropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    zIndex: 999,
    maxHeight: 180,
  },
  drawerDropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  drawerDropdownOptionSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  drawerDropdownOptionText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  drawerDropdownOptionTextSelected: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  editorBottomDoneWrap: {
    marginTop: 20,
    marginBottom: 10,
  },
  editorBottomDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
    borderRadius: 12,
  },
  editorBottomDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },

  /* ========================================================================= */
  /* LEGAL, GOVERNANCE & ADMIN DESK                                            */
  /* ========================================================================= */
  legalSettingsCard: {
    backgroundColor: '#0b111e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 14,
    marginTop: 10,
  },
  legalSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  legalSettingsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  legalRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  legalRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  legalRowTextWrap: {
    flex: 1,
  },
  legalRowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  legalRowSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
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
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  versionAcceptedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  versionPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  versionPendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f59e0b',
  },
  quickAcceptBtn: {
    marginTop: 10,
    backgroundColor: OzaraTheme.colors.accentViolet,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAcceptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* FOUNDER CONSOLE */
  accessRequestsCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    padding: 14,
    marginTop: 14,
  },
  accessRequestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  accessRequestsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  founderTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  founderTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#38bdf8',
  },
  accessRequestsSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
  },
  toggleCreateInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  toggleCreateInviteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
  },
  createInviteForm: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  createInviteHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  createInviteInput: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#ffffff',
  },
  expirationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expirationLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  dayChoiceBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  dayChoiceBtnActive: {
    backgroundColor: '#38bdf8',
  },
  dayChoiceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  dayChoiceTextActive: {
    color: '#000000',
  },
  generateInviteBtn: {
    backgroundColor: '#38bdf8',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  generateInviteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  emptyRequestsText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  reqItemCard: {
    backgroundColor: '#030712',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    marginBottom: 8,
  },
  reqItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reqItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  reqItemEmail: {
    fontSize: 11,
    color: '#38bdf8',
  },
  reqItemRole: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  reqItemLinkedin: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  reqItemNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#cbd5e1',
    marginTop: 4,
  },
  reqItemExpires: {
    fontSize: 10,
    color: '#f59e0b',
    marginTop: 4,
  },
  reqStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reqStatusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  reqStatusApproved: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  reqStatusClaimed: { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
  reqStatusDeclined: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  reqStatusRevoked: { backgroundColor: 'rgba(148, 163, 184, 0.2)' },
  reqStatusPending: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  approvedActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  issuedTokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  issuedTokenLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  issuedTokenCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  revokeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  revokeBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ef4444',
  },
  pendingActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  approveReqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  approveReqBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  declineReqBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  declineReqBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },
  signOutContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  signOutFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  signOutFullBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  contactModalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  contactModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0b1120',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
  },
  contactModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  contactModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  contactModalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  contactMethodsList: {
    gap: 10,
  },
  contactMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  contactMethodIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactMethodName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  contactMethodDetail: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
