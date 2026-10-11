/**
 * ÖZARA Mobile: Network & Community Screen
 * Refactored to ÖZARA's minimalist dark aesthetic:
 * 1. "Your network" header & descriptive subtitle
 * 2. Two primary modes:
 *    - Members (Default): Search, 4 filters (Location, Industry, Interests, University),
 *      connection requests, 2-column compact profile cards, suggestions.
 *    - Community: Private wall for admitted members with compact composer
 *      ("Ask your network or share something useful…"), optional topic tags
 *      (Question, Introduction, Expertise, Opportunity), chronological feed,
 *      comments/replies, author edit/delete, admin moderation, and profile opening.
 * 3. Enforced Member Location Invariant: Elena Alexeeva (Seattle) never matches Dubai;
 *    results match members' saved locations.
 * 4. Completely removed: Chapter city tabs, venue cards, "Meet the Chapter Lead",
 *    "Post a Trip", "90s Quarterly Pulse", and unconfirmed venue claims.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import {
  ApiService,
  Recommendation,
  MemberDirectoryItem,
  PendingConnectionItem,
  ContactMethodsResponse,
  resolveImageUrl,
} from '../services/api';
import { useClub } from '../context/ClubContext';
import { OzaraTheme } from '../constants/ozara-theme';
import { Ionicons } from '@expo/vector-icons';

const LOCATIONS = [
  'All',
  'Dubai',
  'London',
  'New York',
  'Seattle',
  'Silicon Valley',
  'Miami',
  'Boston',
  'Zurich',
  'Singapore',
  'Tokyo',
  'Paris',
  'Stockholm',
];

const INDUSTRIES = [
  'All',
  'Technology',
  'Finance',
  'Healthcare',
  'Real Estate',
  'Law',
  'Venture Capital',
  'Academia',
  'Entrepreneurship',
];

const INTERESTS = [
  'All',
  'Artificial Intelligence',
  'Angel Investing',
  'Sailing',
  'Architecture',
  'Longevity',
  'Contemporary Art',
  'BioTech',
  'Renewable Energy',
];

const UNIVERSITIES = [
  'All',
  'Harvard University',
  'Stanford University',
  'MIT',
  'Oxford University',
  'Cambridge University',
  'Columbia University',
  'Yale University',
  'ETH Zurich',
  'INSEAD',
];

const PAGE_LIMIT = 10;

function formatRelativeTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return 'Just now';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 86400000);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export const NetworkingScreen: React.FC = () => {
  const { currentUserId, currentUser, openProfile } = useClub();

  // Network Directory Data
  const [members, setMembers] = useState<MemberDirectoryItem[]>([]);
  const [totalMembers, setTotalMembers] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [membersLoading, setMembersLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Suggestions Data
  const [suggestedMembers, setSuggestedMembers] = useState<Recommendation[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState<boolean>(false);

  // Pending Requests Data
  const [pendingRequests, setPendingRequests] = useState<PendingConnectionItem[]>([]);
  const [showPendingModal, setShowPendingModal] = useState<boolean>(false);
  const [connectionBusyId, setConnectionBusyId] = useState<string | null>(null);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLocation, setFilterLocation] = useState<string>('All');
  const [filterIndustry, setFilterIndustry] = useState<string>('All');
  const [filterInterests, setFilterInterests] = useState<string>('All');
  const [filterUniversity, setFilterUniversity] = useState<string>('All');
  const [activeFilterModal, setActiveFilterModal] = useState<'location' | 'industry' | 'interests' | 'university' | null>(null);

  // Permitted Contact Methods Sheet
  const [contactModalOpen, setContactModalOpen] = useState<boolean>(false);
  const [contactTarget, setContactTarget] = useState<{ id: string; name: string } | null>(null);
  const [contactMethods, setContactMethods] = useState<ContactMethodsResponse | null>(null);
  const [loadingContact, setLoadingContact] = useState<boolean>(false);

  // Peer Reporting Modal
  const [reportModalTarget, setReportModalTarget] = useState<{ id: string; name: string } | null>(null);
  const [reportReason, setReportReason] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);


  // -------------------------------------------------------------
  // DATA FETCHING: ALL MEMBERS & SUGGESTIONS
  // -------------------------------------------------------------
  const loadMembers = useCallback(async (reset: boolean = true) => {
    if (!currentUserId) return;
    try {
      if (reset) {
        setMembersLoading(true);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const res = await ApiService.getMembers({
        viewerId: currentUserId,
        q: searchQuery.trim() || undefined,
        location: filterLocation !== 'All' ? filterLocation : undefined,
        industry: filterIndustry !== 'All' ? filterIndustry : undefined,
        interests: filterInterests !== 'All' ? filterInterests : undefined,
        university: filterUniversity !== 'All' ? filterUniversity : undefined,
        limit: PAGE_LIMIT,
        offset: currentOffset,
      });

      if (reset) {
        setMembers(res.members || []);
        setOffset(PAGE_LIMIT);
      } else {
        setMembers(prev => [...prev, ...(res.members || [])]);
        setOffset(prev => prev + PAGE_LIMIT);
      }
      setTotalMembers(res.total || 0);
      setHasMore(res.has_more || false);
    } catch (err) {
      console.warn('Error loading members directory:', err);
    } finally {
      setMembersLoading(false);
      setLoadingMore(false);
    }
  }, [currentUserId, searchQuery, filterLocation, filterIndustry, filterInterests, filterUniversity, offset]);

  const loadSuggestions = useCallback(async () => {
    if (!currentUserId) return;
    try {
      setSuggestedLoading(true);
      const res = await ApiService.getRecommendations(currentUserId);
      setSuggestedMembers(res || []);
    } catch (err) {
      console.warn('Error loading suggestions:', err);
    } finally {
      setSuggestedLoading(false);
    }
  }, [currentUserId]);

  const loadPendingRequests = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await ApiService.getPendingConnections(currentUserId);
      setPendingRequests(res || []);
    } catch (err) {
      console.warn('Error loading pending connections:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadMembers(true);
    loadSuggestions();
    loadPendingRequests();
  }, [filterLocation, filterIndustry, filterInterests, filterUniversity]);

  // Debounced search for members directory
  useEffect(() => {
    const timer = setTimeout(() => {
      loadMembers(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // -------------------------------------------------------------
  // CONNECTION LIFECYCLE HANDLERS
  // -------------------------------------------------------------
  const handleRequestConnection = async (targetId: string) => {
    if (!currentUserId) return;
    try {
      setConnectionBusyId(targetId);
      await ApiService.requestConnection(currentUserId, targetId);

      // Optimistically update lists
      setMembers(prev =>
        prev.map(m => (m.id === targetId ? { ...m, connection_status: 'pending_sent' } : m))
      );
      setSuggestedMembers(prev =>
        prev.map(m => (m.member_id === targetId || m.id === targetId ? { ...m, connection_status: 'pending_sent' } : m))
      );
    } catch (err: any) {
      const msg = err.message || 'Could not send connection request';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Connection', msg);
    } finally {
      setConnectionBusyId(null);
    }
  };

  const handleCancelConnection = async (targetId: string) => {
    if (!currentUserId) return;
    try {
      setConnectionBusyId(targetId);
      await ApiService.cancelConnection(currentUserId, targetId);

      // Optimistically update lists
      setMembers(prev =>
        prev.map(m => (m.id === targetId ? { ...m, connection_status: 'none' } : m))
      );
      setSuggestedMembers(prev =>
        prev.map(m => (m.member_id === targetId || m.id === targetId ? { ...m, connection_status: 'none' } : m))
      );
    } catch (err: any) {
      const msg = err.message || 'Could not cancel request';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Connection', msg);
    } finally {
      setConnectionBusyId(null);
    }
  };

  const handleAcceptConnection = async (requesterId: string) => {
    if (!currentUserId) return;
    try {
      setConnectionBusyId(requesterId);
      await ApiService.acceptConnection(currentUserId, requesterId);

      // Refresh pending list & member records
      setPendingRequests(prev => prev.filter(r => (r.requester_id || r.user_id) !== requesterId));
      setMembers(prev =>
        prev.map(m => (m.id === requesterId ? { ...m, connection_status: 'accepted' } : m))
      );
      setSuggestedMembers(prev =>
        prev.map(m => (m.id === requesterId || ('member_id' in m && (m as any).member_id === requesterId) ? { ...m, connection_status: 'accepted' } : m))
      );
    } catch (err: any) {
      const msg = err.message || 'Could not accept connection';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Connection', msg);
    } finally {
      setConnectionBusyId(null);
    }
  };

  const handleDeclineConnection = async (requesterId: string) => {
    if (!currentUserId) return;
    try {
      setConnectionBusyId(requesterId);
      await ApiService.declineConnection(currentUserId, requesterId);

      // Remove from pending list
      setPendingRequests(prev => prev.filter(r => (r.requester_id || r.user_id) !== requesterId));
      setMembers(prev =>
        prev.map(m => (m.id === requesterId ? { ...m, connection_status: 'declined' } : m))
      );
      setSuggestedMembers(prev =>
        prev.map(m => (m.id === requesterId || ('member_id' in m && (m as any).member_id === requesterId) ? { ...m, connection_status: 'declined' } : m))
      );
    } catch (err: any) {
      const msg = err.message || 'Could not decline request';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Connection', msg);
    } finally {
      setConnectionBusyId(null);
    }
  };

  const handleOpenContactMethods = async (targetId: string, targetName: string) => {
    if (!currentUserId) return;
    try {
      setLoadingContact(true);
      setContactTarget({ id: targetId, name: targetName });
      const res = await ApiService.getContactMethods(currentUserId, targetId);
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

  const handleReportSubmit = async () => {
    if (!reportModalTarget || !reportReason.trim() || !currentUserId) return;
    try {
      setSubmittingReport(true);
      const res = await ApiService.reportMember(reportModalTarget.id, {
        reporter_id: currentUserId,
        reason: reportReason.trim(),
      });
      if (res.success) {
        Alert.alert('Report Received', 'Thank you. Your report has been submitted to the community committee for confidential review.');
        setReportModalTarget(null);
        setReportReason('');
      }
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Could not submit report.');
    } finally {
      setSubmittingReport(false);
    }
  };



  const hasActiveFilters =
    filterLocation !== 'All' ||
    filterIndustry !== 'All' ||
    filterInterests !== 'All' ||
    filterUniversity !== 'All';

  const clearAllFilters = () => {
    setFilterLocation('All');
    setFilterIndustry('All');
    setFilterInterests('All');
    setFilterUniversity('All');
    setSearchQuery('');
  };

  // -------------------------------------------------------------
  // RENDER COMPACT MEMBER CARD (SIDE-BY-SIDE MOBILE GRID)
  // -------------------------------------------------------------
  const renderCompactCard = (
    item: MemberDirectoryItem | Recommendation,
    isSuggested: boolean = false
  ) => {
    const memberId = (('member_id' in item && item.member_id) ? item.member_id : item.id) as string;
    const isBusy = connectionBusyId === memberId;
    const status = item.connection_status || 'none';

    // Format role and location
    const roleString =
      [item.role_title, item.company].filter(Boolean).join(' · ') ||
      item.headline ||
      'ÖZARA Member';

    const locationString =
      [item.city, item.country].filter(Boolean).join(', ') || 'Global';

    // Tags (up to 2)
    const tags =
      item.relevant_tags && item.relevant_tags.length > 0
        ? item.relevant_tags.slice(0, 2)
        : [(('industry' in item && item.industry) || 'Technology') as string];

    return (
      <View key={memberId} style={styles.compactCard}>
        {/* Tapping photo or name opens full profile drawer */}
        <TouchableOpacity
          onPress={() => openProfile(memberId)}
          activeOpacity={0.85}
          style={styles.cardHeaderArea}>
          <Image
            source={{ uri: resolveImageUrl(item.avatar_url) }}
            style={styles.cardAvatar}
          />
          <Text style={styles.cardName} numberOfLines={1}>
            {item.full_name}
          </Text>
          <Text style={styles.cardRole} numberOfLines={2}>
            {roleString}
          </Text>
          <View style={styles.cardLocationRow}>
            <Ionicons name="location-outline" size={11} color="#64748b" style={{ marginRight: 3 }} />
            <Text style={styles.cardLocation} numberOfLines={1}>
              {locationString}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Up to 2 relevant interests / expertise areas */}
        <View style={styles.cardTagsRow}>
          {tags.map((t, idx) => (
            <View key={idx} style={styles.cardTagPill}>
              <Text style={styles.cardTagText} numberOfLines={1}>
                {t}
              </Text>
            </View>
          ))}
        </View>

        {/* Short matching reason for suggestions */}
        {isSuggested && (item as Recommendation).short_match_reason && (
          <View style={styles.reasonBadge}>
            <Text style={styles.reasonBadgeText} numberOfLines={2}>
              💡 {(item as Recommendation).short_match_reason}
            </Text>
          </View>
        )}

        {/* Card Action Row */}
        <View style={styles.cardActionRow}>
          {status === 'accepted' ? (
            <TouchableOpacity
              style={styles.btnMessage}
              onPress={() => handleOpenContactMethods(memberId, item.full_name)}
              activeOpacity={0.85}>
              <Ionicons name="chatbubbles-outline" size={12} color="#ffffff" style={{ marginRight: 5 }} />
              <Text style={styles.btnMessageText}>Message</Text>
            </TouchableOpacity>
          ) : status === 'pending_sent' ? (
            <View style={styles.btnRequestedWrap}>
              <View style={styles.btnRequested}>
                <Ionicons name="time-outline" size={11} color="#94a3b8" style={{ marginRight: 4 }} />
                <Text style={styles.btnRequestedText}>Requested</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCancelConnection(memberId)}
                disabled={isBusy}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                style={styles.btnCancelRequest}>
                <Text style={styles.btnCancelRequestText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : status === 'pending_received' ? (
            <View style={styles.btnRespondRow}>
              <TouchableOpacity
                style={styles.btnAccept}
                onPress={() => handleAcceptConnection(memberId)}
                disabled={isBusy}
                activeOpacity={0.85}>
                <Text style={styles.btnAcceptText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnDecline}
                onPress={() => handleDeclineConnection(memberId)}
                disabled={isBusy}
                activeOpacity={0.85}>
                <Text style={styles.btnDeclineText}>Decline</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.btnConnect}
              onPress={() => handleRequestConnection(memberId)}
              disabled={isBusy}
              activeOpacity={0.85}>
              {isBusy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={12} color="#ffffff" style={{ marginRight: 5 }} />
                  <Text style={styles.btnConnectText}>Connect</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* ======================================================== */}
      {/* 1. TOP HEADER & NAVIGATION                               */}
      {/* ======================================================== */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Your network</Text>
            <Text style={styles.headerSubtitle}>
              Find your people. Connect through shared interests, expertise and ambition.
            </Text>
          </View>
        </View>

      </View>

      {/* ======================================================== */}
      {/* MEMBERS DIRECTORY                                        */}
      {/* ======================================================== */}
      <View>
          {/* Connection Requests Banner (with pending count) */}
          {pendingRequests.length > 0 && (
            <TouchableOpacity
              style={styles.pendingBanner}
              onPress={() => setShowPendingModal(true)}
              activeOpacity={0.88}>
              <View style={styles.pendingBannerLeft}>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{pendingRequests.length}</Text>
                </View>
                <View>
                  <Text style={styles.pendingBannerTitle}>Connection requests</Text>
                  <Text style={styles.pendingBannerSub}>
                    {pendingRequests.length === 1
                      ? '1 member waiting to connect with you'
                      : `${pendingRequests.length} members waiting to connect with you`}
                  </Text>
                </View>
              </View>
              <View style={styles.pendingBannerRight}>
                <Text style={styles.pendingBannerActionText}>Review</Text>
                <Ionicons name="chevron-forward" size={14} color="#38bdf8" />
              </View>
            </TouchableOpacity>
          )}

          {/* Search Bar */}
          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search members by name, role, background..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>

          {/* 4 Multi-Dimensional Filters Horizontal Bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <View style={styles.filterScrollContent}>
              {/* Location Filter */}
              <TouchableOpacity
                style={[styles.filterChip, filterLocation !== 'All' && styles.filterChipActive]}
                onPress={() => setActiveFilterModal('location')}>
                <Ionicons
                  name="location-outline"
                  size={12}
                  color={filterLocation !== 'All' ? '#38bdf8' : '#94a3b8'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.filterChipText, filterLocation !== 'All' && styles.filterChipTextActive]}>
                  {filterLocation === 'All' ? 'Location' : filterLocation}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={filterLocation !== 'All' ? '#38bdf8' : '#64748b'}
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>

              {/* Industry Filter */}
              <TouchableOpacity
                style={[styles.filterChip, filterIndustry !== 'All' && styles.filterChipActive]}
                onPress={() => setActiveFilterModal('industry')}>
                <Ionicons
                  name="briefcase-outline"
                  size={12}
                  color={filterIndustry !== 'All' ? '#38bdf8' : '#94a3b8'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.filterChipText, filterIndustry !== 'All' && styles.filterChipTextActive]}>
                  {filterIndustry === 'All' ? 'Industry' : filterIndustry}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={filterIndustry !== 'All' ? '#38bdf8' : '#64748b'}
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>

              {/* Interests Filter */}
              <TouchableOpacity
                style={[styles.filterChip, filterInterests !== 'All' && styles.filterChipActive]}
                onPress={() => setActiveFilterModal('interests')}>
                <Ionicons
                  name="sparkles-outline"
                  size={12}
                  color={filterInterests !== 'All' ? '#38bdf8' : '#94a3b8'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.filterChipText, filterInterests !== 'All' && styles.filterChipTextActive]}>
                  {filterInterests === 'All' ? 'Interests' : filterInterests}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={filterInterests !== 'All' ? '#38bdf8' : '#64748b'}
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>

              {/* University Filter */}
              <TouchableOpacity
                style={[styles.filterChip, filterUniversity !== 'All' && styles.filterChipActive]}
                onPress={() => setActiveFilterModal('university')}>
                <Ionicons
                  name="school-outline"
                  size={12}
                  color={filterUniversity !== 'All' ? '#38bdf8' : '#94a3b8'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.filterChipText, filterUniversity !== 'All' && styles.filterChipTextActive]}>
                  {filterUniversity === 'All' ? 'University' : filterUniversity}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={filterUniversity !== 'All' ? '#38bdf8' : '#64748b'}
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>

              {/* Clear filters button */}
              {hasActiveFilters && (
                <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearAllFilters}>
                  <Ionicons name="close" size={13} color="#f87171" style={{ marginRight: 2 }} />
                  <Text style={styles.clearFiltersText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* SECTION 1: ALL MEMBERS (FIRST) */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>All members</Text>
              <Text style={styles.sectionSubtext}>
                {totalMembers > 0 ? `${totalMembers} vetted members in ÖZARA` : 'Directory of admitted community members'}
              </Text>
            </View>
          </View>

          {membersLoading && members.length === 0 ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color={OzaraTheme.colors.accentCyan} />
            </View>
          ) : members.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Ionicons name="people-outline" size={32} color="#64748b" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyStateTitle}>No members found</Text>
              <Text style={styles.emptyStateDesc}>
                Try adjusting your search terms or clearing your location/industry filters.
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity style={styles.resetBtn} onPress={clearAllFilters}>
                  <Text style={styles.resetBtnText}>Clear all filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View>
              <View style={styles.compactCardsGrid}>
                {members.map(m => renderCompactCard(m, false))}
              </View>

              {/* "Load More" button */}
              {hasMore && (
                <View style={styles.loadMoreContainer}>
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => loadMembers(false)}
                    disabled={loadingMore}
                    activeOpacity={0.85}>
                    {loadingMore ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Text style={styles.loadMoreBtnText}>Load more</Text>
                        <Ionicons name="chevron-down" size={14} color="#ffffff" style={{ marginLeft: 4 }} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* SECTION 2: SUGGESTED FOR YOU (FOLLOWED BY) */}
          <View style={[styles.sectionHeader, { marginTop: 36 }]}>
            <View>
              <Text style={styles.sectionTitle}>Suggested for you</Text>
              <Text style={styles.sectionSubtext}>
                Curated introductions with shared focus, location overlap, or complementary expertise
              </Text>
            </View>
          </View>

          {suggestedLoading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="small" color={OzaraTheme.colors.accentCyan} />
            </View>
          ) : suggestedMembers.length === 0 ? (
            <View style={styles.emptyStateBoxSmall}>
              <Text style={styles.emptyStateDesc}>
                Complete your Strategic Focus in Questionnaire to receive tailored introductions.
              </Text>
            </View>
          ) : (
            <View style={styles.compactCardsGrid}>
              {suggestedMembers.map(m => renderCompactCard(m, true))}
            </View>
          )}
        </View>

      {/* ======================================================== */}
      {/* MODAL 1: CONNECTION REQUESTS REVIEW                      */}
      {/* ======================================================== */}
      <Modal
        visible={showPendingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPendingModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalDialog}>
            <View style={styles.modalDialogHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalDialogTitle}>Connection requests</Text>
                <Text style={styles.modalDialogSubtitle}>
                  Members who want to connect and unlock mutual contact methods
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPendingModal(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {pendingRequests.map(req => {
                const reqId = req.requester_id || req.user_id;
                return (
                  <View key={req.connection_id} style={styles.pendingItemRow}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowPendingModal(false);
                        openProfile(reqId);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                      <Image
                        source={{ uri: resolveImageUrl(req.avatar_url) }}
                        style={styles.pendingItemAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pendingItemName}>{req.full_name}</Text>
                        <Text style={styles.pendingItemRole} numberOfLines={1}>
                          {[req.role_title, req.company].filter(Boolean).join(' · ') || req.headline}
                        </Text>
                        {req.city ? (
                          <Text style={styles.pendingItemLoc}>
                            {req.city}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>

                    <View style={styles.pendingItemActions}>
                      <TouchableOpacity
                        style={styles.pendingAcceptBtn}
                        onPress={() => handleAcceptConnection(reqId)}
                        disabled={connectionBusyId === reqId}>
                        <Text style={styles.pendingAcceptText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pendingDeclineBtn}
                        onPress={() => handleDeclineConnection(reqId)}
                        disabled={connectionBusyId === reqId}>
                        <Text style={styles.pendingDeclineText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: PERMITTED CONTACT METHODS SHEET                 */}
      {/* ======================================================== */}
      <Modal
        visible={contactModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setContactModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalDialog}>
            <View style={styles.modalDialogHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalDialogTitle}>Contact {contactTarget?.name}</Text>
                <Text style={styles.modalDialogSubtitle}>
                  Verified channels unlocked via mutual connection
                </Text>
              </View>
              <TouchableOpacity onPress={() => setContactModalOpen(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.contactListWrap}>
              {/* WhatsApp */}
              {contactMethods?.methods?.whatsapp ? (
                <TouchableOpacity
                  style={styles.contactOptionItem}
                  onPress={() => {
                    const phoneClean = contactMethods.methods.whatsapp!.replace(/[^0-9]/g, '');
                    Linking.openURL(`https://wa.me/${phoneClean}`).catch(() =>
                      Alert.alert('Error', 'Could not open WhatsApp')
                    );
                  }}
                  activeOpacity={0.8}>
                  <View style={[styles.contactOptionIcon, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                    <Ionicons name="logo-whatsapp" size={20} color="#22c55e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactOptionTitle}>WhatsApp</Text>
                    <Text style={styles.contactOptionSub}>{contactMethods.methods.whatsapp}</Text>
                  </View>
                  <Ionicons name="open-outline" size={16} color="#64748b" />
                </TouchableOpacity>
              ) : null}

              {/* Email */}
              {contactMethods?.methods?.email ? (
                <TouchableOpacity
                  style={styles.contactOptionItem}
                  onPress={() => {
                    const subject = encodeURIComponent(`ÖZARA Club: Connecting via Network`);
                    Linking.openURL(`mailto:${contactMethods.methods.email}?subject=${subject}`).catch(() =>
                      Alert.alert('Error', 'Could not open mail client')
                    );
                  }}
                  activeOpacity={0.8}>
                  <View style={[styles.contactOptionIcon, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                    <Ionicons name="mail-outline" size={20} color="#38bdf8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactOptionTitle}>Email</Text>
                    <Text style={styles.contactOptionSub}>{contactMethods.methods.email}</Text>
                  </View>
                  <Ionicons name="open-outline" size={16} color="#64748b" />
                </TouchableOpacity>
              ) : null}

              {/* Zoom */}
              {contactMethods?.methods?.zoom?.enabled ? (
                contactMethods.methods.zoom?.meeting_link ? (
                  <TouchableOpacity
                    style={styles.contactOptionItem}
                    onPress={() => {
                      const link = contactMethods.methods.zoom?.meeting_link;
                      if (link) {
                        Linking.openURL(link).catch(() =>
                          Alert.alert('Error', 'Could not open Zoom link')
                        );
                      }
                    }}
                    activeOpacity={0.8}>
                    <View style={[styles.contactOptionIcon, { backgroundColor: 'rgba(129, 140, 248, 0.15)' }]}>
                      <Ionicons name="videocam-outline" size={20} color="#818cf8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactOptionTitle}>Zoom Meeting</Text>
                      <Text style={styles.contactOptionSub}>Open personal room link</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color="#64748b" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.contactOptionItem}
                    onPress={() => {
                      const draft = `Hi ${contactMethods.full_name}, I would love to connect for a 20-minute Zoom call. What days or times work best for you?`;
                      if (contactMethods.methods.email) {
                        Linking.openURL(
                          `mailto:${contactMethods.methods.email}?subject=${encodeURIComponent('Request for Zoom Call')}&body=${encodeURIComponent(draft)}`
                        );
                      } else if (contactMethods.methods.whatsapp) {
                        const clean = contactMethods.methods.whatsapp.replace(/[^0-9]/g, '');
                        Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(draft)}`);
                      } else {
                        Alert.alert('Request Zoom Call', `You can send a note to ${contactMethods.full_name} via ÖZARA Leadership.`);
                      }
                    }}
                    activeOpacity={0.8}>
                    <View style={[styles.contactOptionIcon, { backgroundColor: 'rgba(129, 140, 248, 0.15)' }]}>
                      <Ionicons name="videocam-outline" size={20} color="#818cf8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactOptionTitle}>Request a Zoom call</Text>
                      <Text style={styles.contactOptionSub}>Draft an invitation to schedule video call</Text>
                    </View>
                    <Ionicons name="send-outline" size={16} color="#64748b" />
                  </TouchableOpacity>
                )
              ) : null}

              {/* If no external methods */}
              {!contactMethods?.methods?.whatsapp &&
                !contactMethods?.methods?.email &&
                !contactMethods?.methods?.zoom?.enabled && (
                  <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={26} color="#64748b" style={{ marginBottom: 8 }} />
                    <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                      This member prefers introductions routed through ÖZARA Leadership (Alexandra &amp; Julia).
                    </Text>
                  </View>
                )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: FILTER SELECTION SHEET                          */}
      {/* ======================================================== */}
      <Modal
        visible={!!activeFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveFilterModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalDialog}>
            <View style={styles.modalDialogHeader}>
              <Text style={styles.modalDialogTitle}>
                Filter by {activeFilterModal ? activeFilterModal.charAt(0).toUpperCase() + activeFilterModal.slice(1) : ''}
              </Text>
              <TouchableOpacity onPress={() => setActiveFilterModal(null)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {(activeFilterModal === 'location'
                ? LOCATIONS
                : activeFilterModal === 'industry'
                ? INDUSTRIES
                : activeFilterModal === 'interests'
                ? INTERESTS
                : UNIVERSITIES
              ).map(opt => {
                const isSelected =
                  (activeFilterModal === 'location' && filterLocation === opt) ||
                  (activeFilterModal === 'industry' && filterIndustry === opt) ||
                  (activeFilterModal === 'interests' && filterInterests === opt) ||
                  (activeFilterModal === 'university' && filterUniversity === opt);

                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.filterOptionRow, isSelected && styles.filterOptionRowActive]}
                    onPress={() => {
                      if (activeFilterModal === 'location') setFilterLocation(opt);
                      if (activeFilterModal === 'industry') setFilterIndustry(opt);
                      if (activeFilterModal === 'interests') setFilterInterests(opt);
                      if (activeFilterModal === 'university') setFilterUniversity(opt);
                      setActiveFilterModal(null);
                    }}
                    activeOpacity={0.75}>
                    <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextActive]}>
                      {opt}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#38bdf8" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 5: PEER REPORTING MODAL                            */}
      {/* ======================================================== */}
      <Modal
        visible={!!reportModalTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalDialog}>
            <View style={styles.modalDialogHeader}>
              <Text style={styles.modalDialogTitle}>Report Member</Text>
              <TouchableOpacity onPress={() => setReportModalTarget(null)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDialogSubtitle}>
              Confidential report to ÖZARA community committee regarding {reportModalTarget?.name}.
            </Text>
            <TextInput
              style={[styles.composerInput, { minHeight: 90, maxHeight: 160, marginTop: 10 }]}
              placeholder="Describe the issue or commercial solicitation..."
              placeholderTextColor="#64748b"
              multiline
              value={reportReason}
              onChangeText={setReportReason}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setReportModalTarget(null)}
                activeOpacity={0.8}>
                <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, (!reportReason.trim() || submittingReport) && styles.btnDisabled]}
                disabled={!reportReason.trim() || submittingReport}
                onPress={handleReportSubmit}
                activeOpacity={0.85}>
                {submittingReport ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 90,
  },

  /* HEADER & TOP NAVIGATION */
  headerContainer: {
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 18,
  },
  modeTabsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  modeTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modeTabPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  modeTabTextActive: {
    color: '#ffffff',
  },

  /* PENDING REQUESTS BANNER */
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  pendingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pendingBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  pendingBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  pendingBannerSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  pendingBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 8,
  },
  pendingBannerActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
  },

  /* SEARCH BAR */
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0f1d',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#ffffff',
    padding: 0,
  },

  /* FILTERS ROW */
  filterScroll: {
    marginBottom: 18,
  },
  filterScrollContent: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0f1d',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  filterChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
  },
  filterChipText: {
    fontSize: 11.5,
    color: '#94a3b8',
  },
  filterChipTextActive: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  clearFiltersText: {
    fontSize: 11,
    color: '#f87171',
    fontWeight: '600',
  },

  /* SECTION HEADERS */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  sectionSubtext: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },

  /* COMPACT 2-COLUMN GRID */
  compactCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  compactCard: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  cardHeaderArea: {
    backgroundColor: '#0a0f1d',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    padding: 10,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'flex-start',
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e293b',
    marginBottom: 6,
  },
  cardName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  cardRole: {
    fontSize: 10.5,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 14,
    minHeight: 28,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardLocation: {
    fontSize: 10,
    color: '#64748b',
  },
  cardTagsRow: {
    flexDirection: 'row',
    backgroundColor: '#0a0f1d',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingBottom: 6,
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
    minHeight: 26,
  },
  cardTagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  cardTagText: {
    fontSize: 9,
    color: '#94a3b8',
  },
  reasonBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reasonBadgeText: {
    fontSize: 9.5,
    color: '#38bdf8',
    lineHeight: 13,
  },
  cardActionRow: {
    backgroundColor: '#0a0f1d',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    padding: 8,
  },
  btnConnect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 6,
    paddingVertical: 5,
  },
  btnConnectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  btnMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 6,
    paddingVertical: 5,
  },
  btnMessageText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  btnRequestedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  btnRequested: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnRequestedText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  btnCancelRequest: {
    paddingLeft: 4,
  },
  btnCancelRequestText: {
    fontSize: 9.5,
    color: '#f87171',
    fontWeight: '600',
  },
  btnRespondRow: {
    flexDirection: 'row',
    gap: 4,
  },
  btnAccept: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 5,
    paddingVertical: 4,
    alignItems: 'center',
  },
  btnAcceptText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
  },
  btnDecline: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 5,
    paddingVertical: 4,
    alignItems: 'center',
  },
  btnDeclineText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ef4444',
  },

  /* LOAD MORE */
  loadMoreContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  loadMoreBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },

  /* LOADERS & EMPTY STATES */
  loaderBox: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyStateBox: {
    padding: 28,
    backgroundColor: '#0a0f1d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    marginTop: 8,
  },
  emptyStateBoxSmall: {
    padding: 18,
    backgroundColor: '#0a0f1d',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyStateDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  resetBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 6,
  },
  resetBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#38bdf8',
  },

  /* ======================================================== */
  /* COMMUNITY WALL STYLES                                    */
  /* ======================================================== */
  composerCard: {
    backgroundColor: '#0d0f12',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  composerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  composerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e293b',
  },
  composerAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  composerAuthorRole: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  composerInput: {
    fontSize: 14.5,
    lineHeight: 22,
    color: '#ffffff',
    minHeight: 64,
    textAlignVertical: 'top',
    padding: 0,
    marginBottom: 12,
  },
  topicSelectorWrap: {
    marginBottom: 12,
  },
  topicSelectorLabel: {
    fontSize: 11.5,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: '500',
  },
  topicPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  topicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  topicPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  topicPillText: {
    fontSize: 11.5,
    color: '#94a3b8',
  },
  topicPillTextActive: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  composerFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  complianceNote: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    marginRight: 8,
  },
  btnPost: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
  },
  btnPostDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  btnPostText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* COMMUNITY EMPTY STATE */
  emptyCommunityBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: '#0d0f12',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyCommunityIconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyCommunityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  emptyCommunitySub: {
    fontSize: 12.5,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },

  /* POSTS LIST */
  postsList: {
    gap: 12,
  },
  postCard: {
    backgroundColor: '#0d0f12',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  postHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  postTimeDot: {
    fontSize: 12,
    color: '#64748b',
    marginHorizontal: 5,
  },
  postTimestamp: {
    fontSize: 11.5,
    color: '#64748b',
  },
  postAuthorHeadline: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  postActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  postIconButton: {
    padding: 4,
  },
  postTopicBadgeWrap: {
    marginBottom: 8,
  },
  postTopicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeQuestion: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  badgeIntro: {
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  badgeExpertise: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  badgeOpportunity: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  postTopicText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postBodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#e2e8f0',
    marginBottom: 10,
  },
  postMediaWrapper: {
    position: 'relative',
    width: '100%',
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#05070a',
    marginBottom: 12,
  },
  postMediaImage: {
    width: '100%',
    height: '100%',
  },
  postCarouselBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 14, 22, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  postCarouselPrevBtn: {
    left: 8,
  },
  postCarouselNextBtn: {
    right: 8,
  },
  postPhotoCountPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 14, 22, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  postPhotoCountText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#ffffff',
  },
  postFooterRow: {

    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  commentsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentsToggleText: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '500',
  },
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    gap: 10,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    marginRight: 8,
    marginTop: 2,
  },
  commentContentWrap: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthorName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ffffff',
  },
  commentDot: {
    fontSize: 11,
    color: '#64748b',
    marginHorizontal: 4,
  },
  commentTime: {
    fontSize: 11,
    color: '#64748b',
  },
  commentAuthorRole: {
    fontSize: 10.5,
    color: '#94a3b8',
  },
  commentText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#e2e8f0',
  },
  addCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  commentComposerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12.5,
    color: '#ffffff',
    maxHeight: 70,
  },
  btnSendComment: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSendCommentDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  /* MODALS COMMON */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0d0f12',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 18,
  },
  modalDialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalDialogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalDialogSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 3,
    lineHeight: 16,
  },
  modalPrimaryBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalPrimaryBtnText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalSecondaryBtnText: {
    color: '#94a3b8',
    fontSize: 12.5,
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.5,
  },

  /* PENDING REQUESTS MODAL ITEMS */
  pendingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  pendingItemAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  pendingItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  pendingItemRole: {
    fontSize: 11,
    color: '#94a3b8',
  },
  pendingItemLoc: {
    fontSize: 10,
    color: '#64748b',
  },
  pendingItemActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  pendingAcceptBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pendingAcceptText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  pendingDeclineBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pendingDeclineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },

  /* CONTACT OPTIONS MODAL */
  contactListWrap: {
    gap: 10,
  },
  contactOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  contactOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  contactOptionSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },

  /* FILTER OPTIONS MODAL */
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  filterOptionRowActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  filterOptionText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  filterOptionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
