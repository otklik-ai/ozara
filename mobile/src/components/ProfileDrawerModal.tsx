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
  STANDARDIZED_FOCUS_PRIORITIES,
  STANDARDIZED_INDUSTRIES,
  STANDARDIZED_CONNECTION_TYPES,
  STANDARDIZED_INTEREST_GROUPS,
  STANDARDIZED_INTERESTS,
  STANDARDIZED_CHAPTERS,
  STANDARDIZED_INVOLVEMENT_ROLES,
} from '../screens/SignUpScreen';

// Canonical sections for questionnaire editing
const CANONICAL_SECTIONS = [
  { id: 'all', title: 'All Sections' },
  { id: 'A', title: 'A. Where You Are', questionIds: [1, 2, 3, 4, 5, 6] },
  { id: 'B', title: 'B. What You Do', questionIds: [7, 25, 26, 27, 8, 10, 12, 13] },
  { id: 'C', title: 'C. Current Focus', questionIds: [14, 15, 16, 17, 18, 19] },
  { id: 'D', title: 'D. Personal Context', questionIds: [20, 21, 22, 23] },
  { id: 'E', title: 'E. Chapter & Events', questionIds: [24] },
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
      setViewMode('profile'); // Always default to polished networking profile view
      setEditorSection('all');
      loadProfile();
      if (currentUser?.role === 'FOUNDER') {
        loadAccessRequests();
      }
    } else {
      setProfile(null);
    }
  }, [profileDrawerUserId]);

  const handleSaveAnswer = async (questionId: number, overrideVal?: string) => {
    if (!profileDrawerUserId || !isSelf) return;
    const item = answersState[questionId];
    let valToSave = overrideVal !== undefined ? overrideVal : (item?.value || '');

    // Normalize Question 13 (LinkedIn or website) with https://
    if (questionId === 13 && valToSave && valToSave !== 'skipped') {
      const trimmed = valToSave.trim();
      if (trimmed && !/^[a-zA-Z]+:\/\//.test(trimmed)) {
        valToSave = `https://${trimmed}`;
        setAnswersState(prev => ({
          ...prev,
          [13]: { value: valToSave, visibility: item?.visibility || 'shared' },
        }));
      }
    }

    try {
      setSavingQuestionId(questionId);
      const res = await ApiService.saveAnswer(
        profileDrawerUserId,
        questionId,
        valToSave,
        item?.visibility || 'shared'
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

  // Structured data fields parsed from questions
  const q10Sentence = getAnswer(10);
  const q12Background = getAnswer(12);
  const q13Website = getAnswer(13);

  // Q14 priorities & note
  const rawQ14 = getAnswer(14);
  let q14Tags: string[] = [];
  let q14Note = '';
  if (rawQ14) {
    try {
      if (rawQ14.startsWith('{') && rawQ14.endsWith('}')) {
        const parsed = JSON.parse(rawQ14);
        if (Array.isArray(parsed.tags)) q14Tags = parsed.tags;
        if (typeof parsed.note === 'string') q14Note = parsed.note;
      } else {
        q14Note = rawQ14;
      }
    } catch {
      q14Note = rawQ14;
    }
  }

  // Q15 explored industries
  const rawQ15 = getAnswer(15);
  const q15Industries = rawQ15 ? rawQ15.split(';').map(s => s.trim()).filter(Boolean) : [];

  // Q16 connection countries
  const rawQ16 = getAnswer(16);
  const q16Countries = rawQ16 ? rawQ16.split(';').map(s => s.trim()).filter(Boolean) : [];

  // Q17 connection types & note
  const rawQ17 = getAnswer(17);
  let q17Tags: string[] = [];
  let q17Note = '';
  if (rawQ17) {
    try {
      if (rawQ17.startsWith('{') && rawQ17.endsWith('}')) {
        const parsed = JSON.parse(rawQ17);
        if (Array.isArray(parsed.tags)) q17Tags = parsed.tags;
        if (typeof parsed.note === 'string') q17Note = parsed.note;
      } else {
        q17Note = rawQ17;
      }
    } catch {
      q17Note = rawQ17;
    }
  }

  // Q18 offers
  const rawQ18 = getAnswer(18);
  let q18OffersList: string[] = [];
  let q18OfferNote = '';
  if (rawQ18) {
    try {
      if (rawQ18.startsWith('{') && rawQ18.endsWith('}')) {
        const parsed = JSON.parse(rawQ18);
        if (Array.isArray(parsed.tags)) q18OffersList = parsed.tags;
        if (typeof parsed.note === 'string') q18OfferNote = parsed.note;
      } else {
        q18OffersList = rawQ18.split(';').map(s => s.trim()).filter(Boolean);
      }
    } catch {
      q18OffersList = rawQ18.split(';').map(s => s.trim()).filter(Boolean);
    }
  }
  // Combine with taxonomies.offers if available
  const combinedOffers = Array.from(new Set([
    ...q18OffersList,
    ...(profile?.taxonomies?.offers || [])
  ]));

  // Q22 interests
  const rawQ22 = getAnswer(22);
  const q22Interests = rawQ22 ? rawQ22.split(/[,;]/).map(s => s.trim()).filter(Boolean) : [];

  // Q24 Chapter and involvement
  const rawQ24 = getAnswer(24);
  let q24Chapter = '';
  let q24Involvement = '';
  if (rawQ24) {
    if (rawQ24.includes('—')) {
      const parts = rawQ24.split('—').map(s => s.trim());
      q24Chapter = parts[0] || '';
      q24Involvement = parts[1] || '';
    } else if (rawQ24.includes(',')) {
      const parts = rawQ24.split(',').map(s => s.trim());
      q24Chapter = parts[0] || '';
      q24Involvement = parts[1] || '';
    } else if (STANDARDIZED_CHAPTERS.includes(rawQ24)) {
      q24Chapter = rawQ24;
    } else if (STANDARDIZED_INVOLVEMENT_ROLES.includes(rawQ24)) {
      q24Involvement = rawQ24;
    }
  }
  const displayChapter = q24Chapter || profile?.chapter_name || profile?.city || '';

  // Q25 Job title & Q26 Company
  const q25JobTitle = getAnswer(25);
  const q26Company = getAnswer(26);
  const q27Institution = getAnswer(27);

  // Professional Title & Organization composite
  let professionalTitleAndOrg = '';
  if (q25JobTitle && q26Company) {
    professionalTitleAndOrg = `${q25JobTitle} at ${q26Company}`;
  } else if (q25JobTitle) {
    professionalTitleAndOrg = q25JobTitle;
  } else if (q26Company) {
    professionalTitleAndOrg = q26Company;
  } else {
    professionalTitleAndOrg = profile?.headline || '';
  }

  // Q7 Roles & Q8 Industries
  const rawQ7 = getAnswer(7);
  const q7Roles = rawQ7 ? rawQ7.split(';').map(s => s.trim()).filter(Boolean) : (profile?.taxonomies?.roles || []);
  const rawQ8 = getAnswer(8);
  const q8Industries = rawQ8 ? rawQ8.split(';').map(s => s.trim()).filter(Boolean) : (profile?.taxonomies?.industries || []);

  // Locations Q2, Q3, Q4, Q5
  const q2Location = getAnswer(2) || `${profile?.city || ''}${profile?.country ? `, ${profile.country}` : ''}`;
  const rawQ3 = getAnswer(3);
  const q3OtherCities = rawQ3 ? rawQ3.split(';').map(s => s.trim()).filter(Boolean) : [];
  const rawQ4 = getAnswer(4);
  const q4Bases = rawQ4 ? rawQ4.split(';').map(s => s.trim()).filter(Boolean) : [];
  const rawQ5 = getAnswer(5);
  const q5Languages = rawQ5 ? rawQ5.split(';').map(s => s.trim()).filter(Boolean) : [];

  // Contact Q6 & Q19
  const rawQ6 = getAnswer(6);
  const q6Reach = rawQ6 ? rawQ6.split(';').map(s => s.trim()).filter(Boolean) : [];
  const q19DirectContact = getAnswer(19);

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
                  ? 'Edit Club Questionnaire'
                  : isSelf
                  ? 'My Club Profile'
                  : `${profile?.full_name || 'Member'} Profile`}
              </Text>
              {viewMode === 'editor' && (
                <Text style={styles.topBarSubTitle}>Changes autosave in real-time</Text>
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

                      {/* Current Professional Title & Organization */}
                      <Text style={styles.netHeadlineText} numberOfLines={2}>
                        {professionalTitleAndOrg}
                      </Text>

                      {/* Location & Home Chapter */}
                      <View style={styles.netLocationRow}>
                        <Ionicons name="location-outline" size={12} color="#64748b" />
                        <Text style={styles.netLocationText}>
                          {q2Location || `${profile.city}, ${profile.country}`}
                        </Text>
                        {displayChapter ? (
                          <>
                            <Text style={styles.netDotDivider}>·</Text>
                            <Ionicons name="business-outline" size={12} color="#8b5cf6" />
                            <Text style={styles.netChapterText}>
                              {displayChapter.includes('Chapter') ? displayChapter : `${displayChapter} Chapter`}
                            </Text>
                          </>
                        ) : null}
                      </View>

                      {/* Clickable LinkedIn or Website Link */}
                      {q13Website ? (
                        <TouchableOpacity
                          style={styles.netWebsiteLink}
                          onPress={() => openExternalUrl(q13Website)}
                          activeOpacity={0.75}>
                          <Ionicons
                            name={q13Website.toLowerCase().includes('linkedin') ? "logo-linkedin" : "globe-outline"}
                            size={13}
                            color="#38bdf8"
                          />
                          <Text style={styles.netWebsiteLinkText} numberOfLines={1}>
                            {q13Website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                          </Text>
                          <Ionicons name="open-outline" size={11} color="#38bdf8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Header Action: Only peer Connect / Message button for other members; No duplicate Edit Profile button for self */}
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

                {/* Question 18 Requirement Banner (Profile Owner Only) */}
                {!profile.is_complete && isSelf && (
                  <View style={styles.q18SlimBanner}>
                    <Ionicons name="warning-outline" size={15} color="#f59e0b" />
                    <Text style={styles.q18SlimText}>
                      Question 18 ("What can you offer other members?") is required to mark your profile verified.
                    </Text>
                    <TouchableOpacity
                      style={styles.q18SlimBtn}
                      onPress={() => {
                        setViewMode('editor');
                        setEditorSection('C');
                      }}
                      activeOpacity={0.8}>
                      <Text style={styles.q18SlimBtnText}>Complete</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 2. ABOUT ME */}
                {(q10Sentence || q12Background) ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>About</Text>
                    {q10Sentence ? (
                      <Text style={styles.netLeadParagraph}>{q10Sentence}</Text>
                    ) : null}
                    {q12Background ? (
                      <Text style={styles.netBodyParagraph}>{q12Background}</Text>
                    ) : null}
                  </View>
                ) : isSelf ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>About</Text>
                    <TouchableOpacity
                      style={styles.netInlinePrompt}
                      onPress={() => {
                        setViewMode('editor');
                        setEditorSection('B');
                      }}
                      activeOpacity={0.75}>
                      <Ionicons name="add" size={14} color="#64748b" />
                      <Text style={styles.netInlinePromptText}>Add your introduction &amp; professional background</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* 3. PROFESSIONAL BACKGROUND */}
                {(q25JobTitle || q26Company || q7Roles.length > 0 || q8Industries.length > 0 || q27Institution || (profile.taxonomies?.expertise && profile.taxonomies.expertise.length > 0)) ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>Professional Background</Text>

                    {(q25JobTitle || q26Company) && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Role</Text>
                        <Text style={styles.netFieldValue}>
                          {[q25JobTitle, q26Company].filter(Boolean).join(' at ')}
                        </Text>
                      </View>
                    )}

                    {q27Institution ? (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Institution</Text>
                        <Text style={styles.netFieldValue}>{q27Institution}</Text>
                      </View>
                    ) : null}

                    {q7Roles.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Roles</Text>
                        <Text style={styles.netInlineTags}>{q7Roles.join(' · ')}</Text>
                      </View>
                    )}

                    {q8Industries.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Industries</Text>
                        <Text style={styles.netInlineTags}>{q8Industries.join(' · ')}</Text>
                      </View>
                    )}

                    {profile.taxonomies?.expertise && profile.taxonomies.expertise.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Expertise</Text>
                        <Text style={styles.netInlineTags}>{profile.taxonomies.expertise.join(' · ')}</Text>
                      </View>
                    )}
                  </View>
                ) : isSelf ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>Professional Background</Text>
                    <TouchableOpacity
                      style={styles.netInlinePrompt}
                      onPress={() => {
                        setViewMode('editor');
                        setEditorSection('B');
                      }}
                      activeOpacity={0.75}>
                      <Ionicons name="add" size={14} color="#64748b" />
                      <Text style={styles.netInlinePromptText}>Add your professional roles, industries &amp; expertise</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* 4. CURRENT FOCUS */}
                {(q14Tags.length > 0 || q14Note || q15Industries.length > 0) ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>Current Focus</Text>

                    {q14Tags.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Focus Areas</Text>
                        <Text style={styles.netInlineTags}>{q14Tags.join(' · ')}</Text>
                      </View>
                    )}

                    {q14Note ? (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Milestone</Text>
                        <Text style={styles.netFieldValue}>{q14Note}</Text>
                      </View>
                    ) : null}

                    {q15Industries.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Exploring</Text>
                        <Text style={styles.netInlineTags}>{q15Industries.join(' · ')}</Text>
                      </View>
                    )}
                  </View>
                ) : isSelf ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>Current Focus</Text>
                    <TouchableOpacity
                      style={styles.netInlinePrompt}
                      onPress={() => {
                        setViewMode('editor');
                        setEditorSection('C');
                      }}
                      activeOpacity={0.75}>
                      <Ionicons name="add" size={14} color="#64748b" />
                      <Text style={styles.netInlinePromptText}>Add your current strategic focus &amp; milestones</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* 5. LET'S CONNECT */}
                {(q17Tags.length > 0 || q17Note || q16Countries.length > 0) ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>Let's Connect</Text>
                    <Text style={styles.netSectionSubtext}>
                      Collaborators and people this member is interested in meeting right now:
                    </Text>

                    {q17Tags.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Looking For</Text>
                        <Text style={styles.netInlineTags}>{q17Tags.join(' · ')}</Text>
                      </View>
                    )}

                    {q17Note ? (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Specifics</Text>
                        <Text style={styles.netFieldValue}>{q17Note}</Text>
                      </View>
                    ) : null}

                    {q16Countries.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Geographies</Text>
                        <Text style={styles.netInlineTags}>{q16Countries.join(' · ')}</Text>
                      </View>
                    )}
                  </View>
                ) : isSelf ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>Let's Connect</Text>
                    <TouchableOpacity
                      style={styles.netInlinePrompt}
                      onPress={() => {
                        setViewMode('editor');
                        setEditorSection('C');
                      }}
                      activeOpacity={0.75}>
                      <Ionicons name="add" size={14} color="#64748b" />
                      <Text style={styles.netInlinePromptText}>Share who you would like to connect with</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* 6. WHAT I CAN OFFER */}
                {(combinedOffers.length > 0 || q18OfferNote) ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>What I Can Offer</Text>
                    <Text style={styles.netSectionSubtext}>
                      Foundational contributions shared with peers in the club:
                    </Text>

                    {combinedOffers.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Offers</Text>
                        <Text style={styles.netInlineTags}>{combinedOffers.join(' · ')}</Text>
                      </View>
                    )}

                    {q18OfferNote ? (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Details</Text>
                        <Text style={styles.netFieldValue}>{q18OfferNote}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : isSelf ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>What I Can Offer</Text>
                    <TouchableOpacity
                      style={styles.netInlinePrompt}
                      onPress={() => {
                        setViewMode('editor');
                        setEditorSection('C');
                      }}
                      activeOpacity={0.75}>
                      <Ionicons name="add" size={14} color="#10b981" />
                      <Text style={[styles.netInlinePromptText, { color: '#10b981' }]}>
                        Complete Question 18: What can you offer other members? (Required)
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* 7. LOCATIONS & COMMUNITY */}
                {(q2Location || q3OtherCities.length > 0 || q4Bases.length > 0 || q5Languages.length > 0 || displayChapter || q24Involvement || (profile.travel_plans && profile.travel_plans.length > 0)) ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>Locations &amp; Community</Text>

                    {q2Location ? (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Primary City</Text>
                        <Text style={styles.netFieldValue}>{q2Location}</Text>
                      </View>
                    ) : null}

                    {displayChapter ? (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Home Chapter</Text>
                        <Text style={styles.netFieldValue}>
                          {displayChapter} {q24Involvement ? `(${q24Involvement})` : ''}
                        </Text>
                      </View>
                    ) : null}

                    {q3OtherCities.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Other Cities</Text>
                        <Text style={styles.netInlineTags}>{q3OtherCities.join(' · ')}</Text>
                      </View>
                    )}

                    {q4Bases.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Bases</Text>
                        <Text style={styles.netInlineTags}>{q4Bases.join(' · ')}</Text>
                      </View>
                    )}

                    {q5Languages.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Languages</Text>
                        <Text style={styles.netInlineTags}>{q5Languages.join(' · ')}</Text>
                      </View>
                    )}

                    {profile.travel_plans && profile.travel_plans.length > 0 && (
                      <View style={styles.netFieldRow}>
                        <Text style={styles.netFieldLabel}>Travel</Text>
                        <View style={{ flex: 1, gap: 4 }}>
                          {profile.travel_plans.map((t, idx) => (
                            <Text key={idx} style={styles.netTravelLine}>
                              <Text style={styles.netTravelCityText}>{t.city}, {t.country}</Text>
                              <Text style={styles.netTravelDatesText}> · {t.start_date} → {t.end_date}</Text>
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* 8. BEYOND WORK */}
                {q22Interests.length > 0 ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>Beyond Work</Text>
                    <View style={styles.netFieldRow}>
                      <Text style={styles.netFieldLabel}>Interests</Text>
                      <Text style={styles.netInlineTags}>{q22Interests.join(' · ')}</Text>
                    </View>
                  </View>
                ) : isSelf ? (
                  <View style={styles.netSection}>
                    <Text style={styles.netSectionTitle}>Beyond Work</Text>
                    <TouchableOpacity
                      style={styles.netInlinePrompt}
                      onPress={() => {
                        setViewMode('editor');
                        setEditorSection('D');
                      }}
                      activeOpacity={0.75}>
                      <Ionicons name="add" size={14} color="#64748b" />
                      <Text style={styles.netInlinePromptText}>Add your interests outside work (sports, outdoors, arts)</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* 9. CONTACT & COMMUNICATION */}
                <View style={styles.netSection}>
                  <Text style={styles.netSectionTitle}>Contact &amp; Communication</Text>

                  <View style={styles.netFieldRow}>
                    <Text style={styles.netFieldLabel}>Preference</Text>
                    <Text style={styles.netFieldValue}>
                      {profile.contact_preference === 'direct_contact'
                        ? 'Open to direct member contact'
                        : profile.contact_preference === 'through_team'
                        ? 'Through Chapter Leadership / Team'
                        : 'Currently unavailable'}
                    </Text>
                  </View>

                  {q6Reach.length > 0 && (
                    <View style={styles.netFieldRow}>
                      <Text style={styles.netFieldLabel}>Reach Via</Text>
                      <Text style={styles.netInlineTags}>{q6Reach.join(' · ')}</Text>
                    </View>
                  )}

                  {q19DirectContact ? (
                    <View style={styles.netFieldRow}>
                      <Text style={styles.netFieldLabel}>Outreach</Text>
                      <Text style={styles.netFieldValue}>{q19DirectContact}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.netPrivacyNotice}>
                    Member contact details are confidential. Direct and team outreach follow declared preferences.
                  </Text>
                </View>

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

                    {/* Launch Full Admin Dashboard */}
                    <TouchableOpacity
                      style={styles.openAdminDeskBtn}
                      onPress={() => setViewMode('admin')}
                      activeOpacity={0.85}>
                      <Ionicons name="shield-checkmark" size={16} color="#000000" />
                      <Text style={styles.openAdminDeskBtnText}>Open Admin Dashboard &amp; Events Desk</Text>
                      <Ionicons name="arrow-forward" size={14} color="#000000" />
                    </TouchableOpacity>

                    {/* Generate New Invitation Toggle */}
                    <TouchableOpacity
                      style={styles.toggleCreateInviteBtn}
                      onPress={() => setShowCreateInvite(!showCreateInvite)}
                      activeOpacity={0.8}>
                      <Ionicons name={showCreateInvite ? 'close-circle-outline' : 'add-circle-outline'} size={15} color="#38bdf8" />
                      <Text style={styles.toggleCreateInviteText}>
                        {showCreateInvite ? 'Cancel Invitation Issuance' : '+ Generate Single-Use Invitation'}
                      </Text>
                    </TouchableOpacity>

                    {showCreateInvite && (
                      <View style={styles.createInviteForm}>
                        <Text style={styles.createInviteHeader}>Issue Expirable Invitation</Text>
                        <TextInput
                          style={styles.createInviteInput}
                          placeholder="Applicant Email (e.g. founder@venture.co)"
                          placeholderTextColor="#64748b"
                          value={newInviteEmail}
                          onChangeText={setNewInviteEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                        <TextInput
                          style={styles.createInviteInput}
                          placeholder="Applicant Name (optional)"
                          placeholderTextColor="#64748b"
                          value={newInviteName}
                          onChangeText={setNewInviteName}
                        />
                        <View style={styles.expirationRow}>
                          <Text style={styles.expirationLabel}>Expires in (days):</Text>
                          {['7', '14', '30'].map((d) => (
                            <TouchableOpacity
                              key={d}
                              style={[styles.dayChoiceBtn, newInviteDays === d && styles.dayChoiceBtnActive]}
                              onPress={() => setNewInviteDays(d)}>
                              <Text style={[styles.dayChoiceText, newInviteDays === d && styles.dayChoiceTextActive]}>
                                {d}d
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TouchableOpacity
                          style={[styles.generateInviteBtn, isCreatingInvite && { opacity: 0.6 }]}
                          onPress={handleCreateNewInvite}
                          disabled={isCreatingInvite}
                          activeOpacity={0.85}>
                          {isCreatingInvite ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text style={styles.generateInviteBtnText}>Generate &amp; Issue Token</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    {accessRequests.length === 0 ? (
                      <Text style={styles.emptyRequestsText}>No access requests in queue.</Text>
                    ) : (
                      accessRequests.slice(0, 10).map((reqItem) => (
                        <View key={reqItem.id} style={styles.reqItemCard}>
                          <View style={styles.reqItemTop}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.reqItemName}>{reqItem.full_name || 'Prospective Member'}</Text>
                              <Text style={styles.reqItemEmail}>{reqItem.email}</Text>
                              {!!reqItem.role_or_headline && (
                                <Text style={styles.reqItemRole}>{reqItem.role_or_headline}</Text>
                              )}
                              {!!reqItem.linkedin_or_background && (
                                <Text style={styles.reqItemLinkedin}>LinkedIn: {reqItem.linkedin_or_background}</Text>
                              )}
                              {!!reqItem.what_brings_you && (
                                <Text style={styles.reqItemNotes}>"{reqItem.what_brings_you}"</Text>
                              )}
                              {!!reqItem.expires_at && (
                                <Text style={styles.reqItemExpires}>Expires: {reqItem.expires_at.split('T')[0]}</Text>
                              )}
                            </View>
                            <View style={[
                              styles.reqStatusBadge,
                              reqItem.status === 'approved' ? styles.reqStatusApproved :
                              reqItem.status === 'claimed' ? styles.reqStatusClaimed :
                              reqItem.status === 'declined' ? styles.reqStatusDeclined :
                              reqItem.status === 'revoked' ? styles.reqStatusRevoked : styles.reqStatusPending
                            ]}>
                              <Text style={styles.reqStatusBadgeText}>
                                {reqItem.status === 'approved' ? 'APPROVED' :
                                 reqItem.status === 'claimed' ? 'CLAIMED' :
                                 reqItem.status === 'declined' ? 'DECLINED' :
                                 reqItem.status === 'revoked' ? 'REVOKED' : 'PENDING'}
                              </Text>
                            </View>
                          </View>

                          {reqItem.status === 'approved' && !reqItem.is_claimed && (
                            <View style={styles.approvedActionRow}>
                              <View style={styles.issuedTokenRow}>
                                <Text style={styles.issuedTokenLabel}>Token:</Text>
                                <Text style={styles.issuedTokenCode}>{reqItem.token}</Text>
                              </View>
                              <TouchableOpacity
                                style={styles.revokeBtn}
                                onPress={() => handleRevokeInvitation(reqItem.id, reqItem.token)}
                                disabled={revokingTokenId === reqItem.id}
                                activeOpacity={0.8}>
                                <Text style={styles.revokeBtnText}>
                                  {revokingTokenId === reqItem.id ? 'Revoking...' : 'Revoke'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {reqItem.status === 'pending_admin_approval' && (
                            <View style={styles.pendingActionRow}>
                              <TouchableOpacity
                                style={[styles.approveReqBtn, approvingRequestId === reqItem.id && { opacity: 0.6 }]}
                                onPress={() => handleApproveRequest(reqItem.id, reqItem.email)}
                                disabled={approvingRequestId === reqItem.id || decliningRequestId === reqItem.id}
                                activeOpacity={0.85}>
                                <Ionicons name="checkmark-circle-outline" size={14} color="#000000" style={{ marginRight: 4 }} />
                                <Text style={styles.approveReqBtnText}>
                                  {approvingRequestId === reqItem.id ? 'Issuing...' : 'Approve & Send Token'}
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.declineReqBtn, decliningRequestId === reqItem.id && { opacity: 0.6 }]}
                                onPress={() => handleDeclineRequest(reqItem.id, reqItem.email)}
                                disabled={approvingRequestId === reqItem.id || decliningRequestId === reqItem.id}
                                activeOpacity={0.85}>
                                <Text style={styles.declineReqBtnText}>
                                  {decliningRequestId === reqItem.id ? '...' : 'Decline'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))
                    )}
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
            {/* VIEW MODE: QUESTIONNAIRE EDITOR (EDIT PROFILE)                            */}
            {/* ========================================================================= */}
            {viewMode === 'editor' && (
              <View style={styles.editorContainer}>
                {/* Editor Header Banner */}
                <View style={styles.editorBanner}>
                  <View style={styles.editorBannerLeft}>
                    <Ionicons name="sparkles" size={16} color="#38bdf8" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.editorBannerTitle}>Questionnaire Source of Truth</Text>
                      <Text style={styles.editorBannerDesc}>
                        Updates immediately refresh your professional networking profile. Every change autosaves on blur.
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

                {/* Section Filter Pills */}
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

                {/* Question Cards Stack */}
                <View style={styles.questionsContainer}>
                  {profile.answers
                    ?.filter(q => {
                      if (editorSection === 'all') return true;
                      const targetSec = CANONICAL_SECTIONS.find(s => s.id === editorSection);
                      return targetSec && targetSec.questionIds ? targetSec.questionIds.includes(q.question_id) : true;
                    })
                    .map(q => {
                      const local = answersState[q.question_id] || {
                        value: q.value_text || '',
                        visibility: q.visibility || 'shared',
                      };
                      const isQ6 = q.question_id === 6;
                      const isQ12 = q.question_id === 12;
                      const isQ13 = q.question_id === 13;
                      const isQ14 = q.question_id === 14;
                      const isQ15 = q.question_id === 15;
                      const isQ17 = q.question_id === 17;
                      const isQ18 = q.question_id === 18;
                      const isQ22 = q.question_id === 22;
                      const isQ23 = q.question_id === 23;
                      const isQ24 = q.question_id === 24;
                      const isSaving = savingQuestionId === q.question_id;

                      // Parse Q6 contact methods
                      let itemQ6Methods: string[] = [];
                      if (isQ6 && local.value && local.value !== 'skipped') {
                        if (local.value.startsWith('{')) {
                          try {
                            const p = JSON.parse(local.value);
                            if (Array.isArray(p.methods)) itemQ6Methods = p.methods;
                          } catch {}
                        } else {
                          itemQ6Methods = local.value.split(/[,;/]/).map((s: string) => s.trim()).filter(Boolean);
                        }
                      }

                      // Parse Q24 chapter and involvement
                      let itemQ24Chapter = '';
                      let itemQ24Involvement = '';
                      if (isQ24 && local.value && local.value !== 'skipped') {
                        if (local.value.includes('—')) {
                          const parts = local.value.split('—').map((s: string) => s.trim());
                          itemQ24Chapter = parts[0] || '';
                          itemQ24Involvement = parts[1] || '';
                        } else if (local.value.includes(',')) {
                          const parts = local.value.split(',').map((s: string) => s.trim());
                          itemQ24Chapter = parts[0] || '';
                          itemQ24Involvement = parts[1] || '';
                        } else if (STANDARDIZED_CHAPTERS.includes(local.value)) {
                          itemQ24Chapter = local.value;
                        } else if (STANDARDIZED_INVOLVEMENT_ROLES.includes(local.value)) {
                          itemQ24Involvement = local.value;
                        }
                      }

                      // Parse Q22 interests
                      let itemQ22List: string[] = [];
                      if (isQ22 && local.value && local.value !== 'skipped') {
                        itemQ22List = local.value.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
                      }

                      // Parse Q14 priorities & note
                      let itemQ14Tags: string[] = [];
                      let itemQ14Note = '';
                      if (isQ14 && local.value) {
                        try {
                          if (local.value.startsWith('{') && local.value.endsWith('}')) {
                            const p = JSON.parse(local.value);
                            if (Array.isArray(p.tags)) itemQ14Tags = p.tags;
                            if (typeof p.note === 'string') itemQ14Note = p.note;
                          } else {
                            itemQ14Note = local.value;
                          }
                        } catch {
                          itemQ14Note = local.value;
                        }
                      }

                      // Parse Q15 explored industries
                      let itemQ15List: string[] = [];
                      if (isQ15 && local.value && local.value !== 'skipped') {
                        itemQ15List = local.value.split(';').map((s: string) => s.trim()).filter(Boolean);
                      }

                      // Parse Q17 connection types & note
                      let itemQ17Tags: string[] = [];
                      let itemQ17Note = '';
                      if (isQ17 && local.value) {
                        try {
                          if (local.value.startsWith('{') && local.value.endsWith('}')) {
                            const p = JSON.parse(local.value);
                            if (Array.isArray(p.tags)) itemQ17Tags = p.tags;
                            if (typeof p.note === 'string') itemQ17Note = p.note;
                          } else {
                            itemQ17Note = local.value;
                          }
                        } catch {
                          itemQ17Note = local.value;
                        }
                      }

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

                          {/* Helpers */}
                          {isQ12 && (
                            <Text style={styles.questionHelperText}>
                              Share previous companies, education, research, or projects you’re proud of.
                            </Text>
                          )}
                          {isQ17 && (
                            <Text style={styles.questionHelperText}>
                              Choose up to five types of connections.
                            </Text>
                          )}
                          {isQ22 && (
                            <Text style={styles.questionHelperText}>
                              Select personal interests, sports, and creative pursuits outside of work.
                            </Text>
                          )}
                          {isQ23 && (
                            <>
                              <Text style={styles.questionHelperText}>
                                Optional. Share any context or preferences you’d rather leave off your member profile.
                              </Text>
                              <View style={styles.q23ShieldBox}>
                                <Ionicons name="shield-checkmark" size={13} color="#f59e0b" />
                                <Text style={styles.q23ShieldText}>
                                  Confidential to founders (Alexandra, Julia, Elena). Never exposed to search, public profiles, or AI match payloads.
                                </Text>
                              </View>
                            </>
                          )}

                          {/* Input Fields */}
                          <View style={styles.inputWrap}>
                            {isQ6 ? (
                              <View>
                                <Text style={styles.subFieldLabel}>Select Approved Contact Channels:</Text>
                                <View style={styles.chipsWrap}>
                                  {['WhatsApp', 'Email', 'Zoom', 'In app', 'Telegram', 'Through the team'].map((method, idx) => {
                                    const isSel = itemQ6Methods.includes(method);
                                    return (
                                      <TouchableOpacity
                                        key={idx}
                                        style={[styles.chipPill, isSel && styles.chipPillSelected]}
                                        onPress={() => {
                                          const next = isSel ? itemQ6Methods.filter(m => m !== method) : [...itemQ6Methods, method];
                                          const valStr = next.join('; ');
                                          setAnswersState(prev => ({
                                            ...prev,
                                            [6]: { ...local, value: valStr },
                                          }));
                                          handleSaveAnswer(6, valStr);
                                        }}
                                        activeOpacity={0.7}>
                                        <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                                          {method}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>

                                {itemQ6Methods.includes('Zoom') && (
                                  <View style={{ marginTop: 12 }}>
                                    <Text style={styles.subFieldLabel}>Personal Zoom Meeting Link (Optional):</Text>
                                    <TextInput
                                      style={[styles.answerInput, { minHeight: 42, paddingVertical: 10 }]}
                                      placeholder="https://zoom.us/j/... or your personal meeting room"
                                      placeholderTextColor={OzaraTheme.colors.textMuted}
                                      autoCapitalize="none"
                                      keyboardType="url"
                                      value={localZoomLink}
                                      onChangeText={val => setLocalZoomLink(val)}
                                      onBlur={async () => {
                                        try {
                                          if (profileDrawerUserId) {
                                            await ApiService.updateProfile(profileDrawerUserId, { zoom_link: localZoomLink.trim() });
                                          }
                                        } catch (e) {
                                          console.warn('Failed to update zoom_link', e);
                                        }
                                      }}
                                    />
                                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                      If omitted, members can request a Zoom call through your other approved contact methods.
                                    </Text>
                                  </View>
                                )}
                              </View>
                            ) : isQ12 ? (
                              <View>
                                <TextInput
                                  style={[styles.answerInput, { minHeight: 90 }]}
                                  placeholder="Share previous companies, education, research, or projects you’re proud of."
                                  placeholderTextColor={OzaraTheme.colors.textMuted}
                                  multiline
                                  maxLength={600}
                                  value={local.value === 'skipped' ? '' : local.value}
                                  onChangeText={val => {
                                    if (val.length <= 600) {
                                      setAnswersState(prev => ({
                                        ...prev,
                                        [12]: { ...local, value: val },
                                      }));
                                    }
                                  }}
                                  onBlur={() => handleSaveAnswer(12)}
                                />
                                <View style={styles.charCounterRow}>
                                  <Text style={styles.charCounterText}>
                                    {(local.value === 'skipped' ? '' : local.value).length}/600
                                  </Text>
                                </View>
                              </View>
                            ) : isQ13 ? (
                              <View>
                                <TextInput
                                  style={[styles.answerInput, { minHeight: 42, paddingVertical: 10 }]}
                                  placeholder="linkedin.com/in/yourname or your website"
                                  placeholderTextColor={OzaraTheme.colors.textMuted}
                                  multiline={false}
                                  keyboardType="url"
                                  autoCapitalize="none"
                                  autoCorrect={false}
                                  value={local.value === 'skipped' ? '' : local.value}
                                  onChangeText={val =>
                                    setAnswersState(prev => ({
                                      ...prev,
                                      [13]: { ...local, value: val },
                                    }))
                                  }
                                  onBlur={() => {
                                    let val = (local.value || '').trim();
                                    if (val && val !== 'skipped' && !/^[a-zA-Z]+:\/\//.test(val)) {
                                      val = `https://${val}`;
                                      setAnswersState(prev => ({
                                        ...prev,
                                        [13]: { ...local, value: val },
                                      }));
                                    }
                                    handleSaveAnswer(13, val);
                                  }}
                                />
                              </View>
                            ) : isQ14 ? (
                              <View>
                                <Text style={styles.subFieldLabel}>1. Select Strategic Priorities:</Text>
                                <View style={styles.chipsWrap}>
                                  {STANDARDIZED_FOCUS_PRIORITIES.map((chip, idx) => {
                                    const isSel = itemQ14Tags.includes(chip);
                                    return (
                                      <TouchableOpacity
                                        key={idx}
                                        style={[styles.chipPill, isSel && styles.chipPillSelected]}
                                        onPress={() => {
                                          const nextTags = isSel
                                            ? itemQ14Tags.filter(t => t !== chip)
                                            : [...itemQ14Tags, chip];
                                          const composite = JSON.stringify({ tags: nextTags, note: itemQ14Note });
                                          setAnswersState(prev => ({
                                            ...prev,
                                            [14]: { ...local, value: composite },
                                          }));
                                          handleSaveAnswer(14, composite);
                                        }}
                                        activeOpacity={0.7}>
                                        <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                                          {chip}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                                <Text style={[styles.subFieldLabel, { marginTop: 10 }]}>2. Specific Focus Details:</Text>
                                <TextInput
                                  style={[styles.answerInput, { minHeight: 60 }]}
                                  placeholder="e.g. Scaling enterprise partnerships in the GCC region"
                                  placeholderTextColor={OzaraTheme.colors.textMuted}
                                  multiline
                                  value={itemQ14Note}
                                  onChangeText={val => {
                                    const composite = JSON.stringify({ tags: itemQ14Tags, note: val });
                                    setAnswersState(prev => ({
                                      ...prev,
                                      [14]: { ...local, value: composite },
                                    }));
                                  }}
                                  onBlur={() => {
                                    const composite = JSON.stringify({ tags: itemQ14Tags, note: itemQ14Note });
                                    handleSaveAnswer(14, composite);
                                  }}
                                />
                              </View>
                            ) : isQ15 ? (
                              <View>
                                <View style={styles.chipsWrap}>
                                  {STANDARDIZED_INDUSTRIES.map((ind, idx) => {
                                    const isSel = itemQ15List.includes(ind);
                                    return (
                                      <TouchableOpacity
                                        key={idx}
                                        style={[styles.chipPill, isSel && styles.chipPillSelected]}
                                        onPress={() => {
                                          const nextList = isSel
                                            ? itemQ15List.filter(i => i !== ind)
                                            : [...itemQ15List, ind];
                                          const valStr = nextList.join('; ');
                                          setAnswersState(prev => ({
                                            ...prev,
                                            [15]: { ...local, value: valStr },
                                          }));
                                          handleSaveAnswer(15, valStr);
                                        }}
                                        activeOpacity={0.7}>
                                        <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                                          {ind}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </View>
                            ) : isQ17 ? (
                              <View>
                                <Text style={styles.subFieldLabel}>1. Connection Types (Up to 5):</Text>
                                <View style={styles.chipsWrap}>
                                  {STANDARDIZED_CONNECTION_TYPES.map((chip, idx) => {
                                    const isSel = itemQ17Tags.includes(chip);
                                    return (
                                      <TouchableOpacity
                                        key={idx}
                                        style={[styles.chipPill, isSel && styles.chipPillSelected]}
                                        onPress={() => {
                                          let nextTags: string[];
                                          if (isSel) {
                                            nextTags = itemQ17Tags.filter(t => t !== chip);
                                          } else {
                                            if (itemQ17Tags.length >= 5) {
                                              Alert.alert('Selection Limit', 'You can choose up to five types of connections.');
                                              return;
                                            }
                                            nextTags = [...itemQ17Tags, chip];
                                          }
                                          const composite = JSON.stringify({ tags: nextTags, note: itemQ17Note });
                                          setAnswersState(prev => ({
                                            ...prev,
                                            [17]: { ...local, value: composite },
                                          }));
                                          handleSaveAnswer(17, composite);
                                        }}
                                        activeOpacity={0.7}>
                                        <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                                          {chip}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                                <Text style={[styles.subFieldLabel, { marginTop: 10 }]}>2. Anyone Specific (Max 200 chars):</Text>
                                <TextInput
                                  style={[styles.answerInput, { minHeight: 60 }]}
                                  placeholder="e.g. Founders with experience expanding AI products into the UK"
                                  placeholderTextColor={OzaraTheme.colors.textMuted}
                                  multiline
                                  maxLength={200}
                                  value={itemQ17Note}
                                  onChangeText={val => {
                                    if (val.length <= 200) {
                                      const composite = JSON.stringify({ tags: itemQ17Tags, note: val });
                                      setAnswersState(prev => ({
                                        ...prev,
                                        [17]: { ...local, value: composite },
                                      }));
                                    }
                                  }}
                                  onBlur={() => {
                                    const composite = JSON.stringify({ tags: itemQ17Tags, note: itemQ17Note });
                                    handleSaveAnswer(17, composite);
                                  }}
                                />
                                <View style={styles.charCounterRow}>
                                  <Text style={styles.charCounterText}>{itemQ17Note.length}/200</Text>
                                </View>
                              </View>
                            ) : isQ22 ? (
                              <View>
                                {STANDARDIZED_INTEREST_GROUPS.map((group, gIdx) => (
                                  <View key={gIdx} style={{ marginBottom: 12 }}>
                                    <Text style={styles.subFieldLabel}>{group.category}:</Text>
                                    <View style={styles.chipsWrap}>
                                      {group.options.map((opt, oIdx) => {
                                        const isSel = itemQ22List.includes(opt);
                                        return (
                                          <TouchableOpacity
                                            key={oIdx}
                                            style={[styles.chipPill, isSel && styles.chipPillSelected]}
                                            onPress={() => {
                                              const nextList = isSel
                                                ? itemQ22List.filter(i => i !== opt)
                                                : [...itemQ22List, opt];
                                              const valStr = nextList.join('; ');
                                              setAnswersState(prev => ({
                                                ...prev,
                                                [22]: { ...local, value: valStr },
                                              }));
                                              handleSaveAnswer(22, valStr);
                                            }}
                                            activeOpacity={0.7}>
                                            <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                                              {opt}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                  </View>
                                ))}
                              </View>
                            ) : isQ23 ? (
                              <View>
                                <TextInput
                                  style={[styles.answerInput, { minHeight: 110 }]}
                                  placeholder="Share any context or preferences you’d rather leave off your member profile."
                                  placeholderTextColor={OzaraTheme.colors.textMuted}
                                  multiline
                                  maxLength={1000}
                                  value={local.value === 'skipped' ? '' : local.value}
                                  onChangeText={val => {
                                    if (val.length <= 1000) {
                                      setAnswersState(prev => ({
                                        ...prev,
                                        [23]: { ...local, value: val, visibility: 'private' },
                                      }));
                                    }
                                  }}
                                  onBlur={() => handleSaveAnswer(23)}
                                />
                                <View style={styles.charCounterRow}>
                                  <Text style={styles.charCounterText}>
                                    {(local.value === 'skipped' ? '' : local.value).length}/1000
                                  </Text>
                                </View>
                              </View>
                            ) : isQ24 ? (
                              <View style={styles.twoDropdownRow}>
                                <View style={styles.twoDropdownCol}>
                                  <TouchableOpacity
                                    style={[
                                      styles.drawerDropdownTrigger,
                                      openQ24Dropdown === 'chapter' && styles.drawerDropdownTriggerActive,
                                    ]}
                                    onPress={() => setOpenQ24Dropdown(openQ24Dropdown === 'chapter' ? null : 'chapter')}
                                    activeOpacity={0.75}>
                                    <Text
                                      style={[
                                        styles.drawerDropdownTriggerText,
                                        !itemQ24Chapter && styles.drawerDropdownPlaceholder,
                                      ]}
                                      numberOfLines={1}>
                                      {itemQ24Chapter || 'Select chapter...'}
                                    </Text>
                                    <Ionicons
                                      name={openQ24Dropdown === 'chapter' ? "chevron-up" : "chevron-down"}
                                      size={14}
                                      color="#94a3b8"
                                    />
                                  </TouchableOpacity>

                                  {openQ24Dropdown === 'chapter' && (
                                    <View style={styles.drawerDropdownMenu}>
                                      {STANDARDIZED_CHAPTERS.map((ch, idx) => {
                                        const isSel = itemQ24Chapter === ch;
                                        return (
                                          <TouchableOpacity
                                            key={idx}
                                            style={[
                                              styles.drawerDropdownOption,
                                              isSel && styles.drawerDropdownOptionSelected,
                                            ]}
                                            onPress={() => {
                                              const nextVal = itemQ24Involvement ? `${ch} — ${itemQ24Involvement}` : ch;
                                              setAnswersState(prev => ({
                                                ...prev,
                                                [24]: { ...local, value: nextVal },
                                              }));
                                              handleSaveAnswer(24, nextVal);
                                              setOpenQ24Dropdown(null);
                                            }}
                                            activeOpacity={0.7}>
                                            <Text
                                              style={[
                                                styles.drawerDropdownOptionText,
                                                isSel && styles.drawerDropdownOptionTextSelected,
                                              ]}>
                                              {ch}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                  )}
                                </View>

                                <View style={styles.twoDropdownCol}>
                                  <TouchableOpacity
                                    style={[
                                      styles.drawerDropdownTrigger,
                                      openQ24Dropdown === 'involvement' && styles.drawerDropdownTriggerActive,
                                    ]}
                                    onPress={() => setOpenQ24Dropdown(openQ24Dropdown === 'involvement' ? null : 'involvement')}
                                    activeOpacity={0.75}>
                                    <Text
                                      style={[
                                        styles.drawerDropdownTriggerText,
                                        !itemQ24Involvement && styles.drawerDropdownPlaceholder,
                                      ]}
                                      numberOfLines={1}>
                                      {itemQ24Involvement || 'Select involvement...'}
                                    </Text>
                                    <Ionicons
                                      name={openQ24Dropdown === 'involvement' ? "chevron-up" : "chevron-down"}
                                      size={14}
                                      color="#94a3b8"
                                    />
                                  </TouchableOpacity>

                                  {openQ24Dropdown === 'involvement' && (
                                    <View style={styles.drawerDropdownMenu}>
                                      {STANDARDIZED_INVOLVEMENT_ROLES.map((role, idx) => {
                                        const isSel = itemQ24Involvement === role;
                                        return (
                                          <TouchableOpacity
                                            key={idx}
                                            style={[
                                              styles.drawerDropdownOption,
                                              isSel && styles.drawerDropdownOptionSelected,
                                            ]}
                                            onPress={() => {
                                              const nextVal = itemQ24Chapter ? `${itemQ24Chapter} — ${role}` : role;
                                              setAnswersState(prev => ({
                                                ...prev,
                                                [24]: { ...local, value: nextVal },
                                              }));
                                              handleSaveAnswer(24, nextVal);
                                              setOpenQ24Dropdown(null);
                                            }}
                                            activeOpacity={0.7}>
                                            <Text
                                              style={[
                                                styles.drawerDropdownOptionText,
                                                isSel && styles.drawerDropdownOptionTextSelected,
                                              ]}>
                                              {role}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                  )}
                                </View>
                              </View>
                            ) : (
                              <TextInput
                                style={styles.answerInput}
                                placeholder="Share your perspective or operating experience..."
                                placeholderTextColor={OzaraTheme.colors.textMuted}
                                multiline
                                value={local.value === 'skipped' ? '' : local.value}
                                onChangeText={val =>
                                  setAnswersState(prev => ({
                                    ...prev,
                                    [q.question_id]: { ...local, value: val },
                                  }))
                                }
                                onBlur={() => handleSaveAnswer(q.question_id)}
                              />
                            )}

                            <View style={styles.autosaveRow}>
                              <Text style={styles.autosaveHint}>
                                {isSaving ? 'Autosaving changes...' : 'Autosaved on blur'}
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
                    <Ionicons name="checkmark-circle" size={18} color="#000000" style={{ marginRight: 6 }} />
                    <Text style={styles.editorBottomDoneBtnText}>Done Editing — View Club Profile</Text>
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
                    <View style={[styles.contactMethodIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                      <Ionicons name="mail-outline" size={20} color="#38bdf8" />
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
                {(!contactMethods?.methods?.whatsapp && !contactMethods?.methods?.email && !contactMethods?.methods?.zoom?.enabled) && (
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
