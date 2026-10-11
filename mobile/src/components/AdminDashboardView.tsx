/**
 * ÖZARA Mobile: Executive Admin Dashboard View
 * Comprehensive administrative management console for Julia Shchukina, Alexandra Hill, and Elena Ermolov.
 * Includes:
 * 1. Event Management (Create, Preview, Publish, Edit, Cancel, Attendee lists & RSVPs)
 * 2. Targeted Event Invitations & Broadcasts (3 recipient selection options, combined filters, exclusions, deduplication, message preview, delivery channels)
 * 3. Membership Invitations (Generate expirable single-use tokens/links, usage tracking, revoke, review access requests)
 * 4. Immutable Audit Logs & Governance Activity
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OzaraTheme } from '../constants/ozara-theme';
import {
  ApiService,
  ClubEvent,
  AdminEventDetail,
  RecipientPreviewResponse,
  resolveImageUrl,
} from '../services/api';
import { useClub } from '../context/ClubContext';

type AdminTabKey = 'events' | 'invitations' | 'membership' | 'audit_logs';

interface AdminDashboardViewProps {
  onClose?: () => void;
  onOpenEventDetails?: (eventId: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onClose,
  onOpenEventDetails,
}) => {
  const { currentUser, currentUserId } = useClub();
  const [activeTab, setActiveTab] = useState<AdminTabKey>('events');
  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------------
  // 1. EVENT MANAGEMENT STATE
  // -------------------------------------------------------------
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [viewingAttendeesEventId, setViewingAttendeesEventId] = useState<string | null>(null);
  const [attendeeDetail, setAttendeeDetail] = useState<AdminEventDetail | null>(null);
  const [loadingAttendeeDetail, setLoadingAttendeeDetail] = useState(false);

  // Event Form State
  const [eventTitle, setEventTitle] = useState('');
  const [eventHeadline, setEventHeadline] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventType, setEventType] = useState('Summit');
  const [eventLocation, setEventLocation] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  const [eventMeetingLink, setEventMeetingLink] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventDisplayDate, setEventDisplayDate] = useState('');
  const [eventTimezone, setEventTimezone] = useState('UTC');
  const [eventCapacity, setEventCapacity] = useState('30');
  const [eventRsvpDeadline, setEventRsvpDeadline] = useState('');
  const [eventVisibility, setEventVisibility] = useState<'all_members' | 'selected_invitees'>('all_members');
  const [eventPrice, setEventPrice] = useState('Included in Membership');
  const [eventWhatsIncluded, setEventWhatsIncluded] = useState('');
  const [eventAgenda, setEventAgenda] = useState('');
  const [eventCoverImage, setEventCoverImage] = useState('/assets/events/london_gathering.jpg');
  const [eventPublishNow, setEventPublishNow] = useState(true);
  const [savingEvent, setSavingEvent] = useState(false);

  // -------------------------------------------------------------
  // 2. TARGETED INVITATIONS & BROADCASTS STATE
  // -------------------------------------------------------------
  const [selectedInviteEventId, setSelectedInviteEventId] = useState<string>('');
  const [selectionOption, setSelectionOption] = useState<'all_admitted' | 'individual' | 'filters'>('all_admitted');
  
  // Searchable Individual Selection
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [allAdmittedMembers, setAllAdmittedMembers] = useState<any[]>([]);

  // Networking Filters
  const [filterLocation, setFilterLocation] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterInterests, setFilterInterests] = useState('');
  const [filterUniversity, setFilterUniversity] = useState('');
  const [filterExpertise, setFilterExpertise] = useState('');

  // Individual Exclusions
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>([]);

  // Preview & Dispatch
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelEmail, setChannelEmail] = useState(false);
  const [channelWhatsapp, setChannelWhatsapp] = useState(false);
  const [customInviteMessage, setCustomInviteMessage] = useState('');
  const [sendingInvitations, setSendingInvitations] = useState(false);
  const [showSendSuccessBanner, setShowSendSuccessBanner] = useState(false);

  // -------------------------------------------------------------
  // 3. MEMBERSHIP INVITATIONS STATE
  // -------------------------------------------------------------
  const [invitationsList, setInvitationsList] = useState<any[]>([]);
  const [accessRequestsList, setAccessRequestsList] = useState<any[]>([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteName, setNewInviteName] = useState('');
  const [newInviteRole, setNewInviteRole] = useState('');
  const [newInviteDays, setNewInviteDays] = useState('14');
  const [newInviteNotes, setNewInviteNotes] = useState('');
  const [isIssuingInvite, setIsIssuingInvite] = useState(false);
  const [justIssuedToken, setJustIssuedToken] = useState<string | null>(null);
  const [justIssuedLink, setJustIssuedLink] = useState<string | null>(null);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [decliningRequestId, setDecliningRequestId] = useState<string | null>(null);

  // -------------------------------------------------------------
  // 4. AUDIT LOGS STATE
  // -------------------------------------------------------------
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  const adminId = currentUserId || currentUser?.id || 'usr_alexandra';

  // Load Data based on active tab
  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getAdminEvents(adminId);
      setEvents(data);
      if (data.length > 0 && !selectedInviteEventId) {
        setSelectedInviteEventId(data[0].id);
      }
    } catch (err: any) {
      console.warn('Error loading admin events:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMembershipData = async () => {
    try {
      setLoading(true);
      const [invites, requests] = await Promise.all([
        ApiService.getInvitations(),
        ApiService.getAccessRequests(),
      ]);
      setInvitationsList(invites);
      setAccessRequestsList(requests);
    } catch (err: any) {
      console.warn('Error loading membership data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setLoadingAuditLogs(true);
      const data = await ApiService.getAdminAuditLogs(adminId);
      setAuditLogs(data);
    } catch (err: any) {
      console.warn('Error loading audit logs:', err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const loadAllMembers = async () => {
    try {
      const res = await ApiService.getMembers({ viewerId: adminId, limit: 150 });
      setAllAdmittedMembers(res.members || []);
    } catch (err) {
      console.warn('Error loading members list:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'events') {
      loadEvents();
    } else if (activeTab === 'invitations') {
      loadEvents();
      loadAllMembers();
    } else if (activeTab === 'membership') {
      loadMembershipData();
    } else if (activeTab === 'audit_logs') {
      loadAuditLogs();
    }
  }, [activeTab]);

  // Update Recipient Preview when filters change in Invitations tab
  useEffect(() => {
    if (activeTab === 'invitations' && selectedInviteEventId) {
      fetchRecipientPreview();
    }
  }, [
    activeTab,
    selectedInviteEventId,
    selectionOption,
    selectedMemberIds,
    filterLocation,
    filterIndustry,
    filterInterests,
    filterUniversity,
    filterExpertise,
    excludedMemberIds,
  ]);

  const fetchRecipientPreview = async () => {
    if (!selectedInviteEventId) return;
    try {
      setLoadingPreview(true);
      const preview = await ApiService.previewTargetedRecipients(adminId, {
        eventId: selectedInviteEventId,
        selectionOption,
        selectedUserIds: selectedMemberIds,
        filters: {
          location: filterLocation,
          industry: filterIndustry,
          interests: filterInterests,
          university: filterUniversity,
          expertise: filterExpertise,
        },
        excludedUserIds: excludedMemberIds,
      });
      setRecipientPreview(preview);
    } catch (err) {
      console.warn('Preview error:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  // -------------------------------------------------------------
  // EVENT ACTIONS
  // -------------------------------------------------------------
  const handleOpenCreateEvent = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventHeadline('');
    setEventDescription('');
    setEventType('Summit');
    setEventLocation('');
    setEventVenue('To be confirmed');
    setEventMeetingLink('');
    setEventStartDate('');
    setEventEndDate('');
    setEventDisplayDate('');
    setEventTimezone('UTC');
    setEventCapacity('30');
    setEventRsvpDeadline('');
    setEventVisibility('all_members');
    setEventPrice('Included in Membership');
    setEventWhatsIncluded('');
    setEventAgenda('');
    setEventPublishNow(true);
    setShowCreateEvent(true);
  };

  const handleOpenEditEvent = (evt: ClubEvent) => {
    setEditingEventId(evt.id);
    setEventTitle(evt.title || '');
    setEventHeadline(evt.headline || '');
    setEventDescription(evt.description || '');
    setEventType(evt.event_type || 'Summit');
    setEventLocation(evt.location || '');
    setEventVenue(evt.venue || 'To be confirmed');
    setEventMeetingLink(evt.meeting_link || '');
    setEventStartDate(evt.start_date || '');
    setEventEndDate(evt.end_date || '');
    setEventDisplayDate(evt.display_date || '');
    setEventTimezone(evt.timezone || 'UTC');
    setEventCapacity(String(evt.capacity || 30));
    setEventRsvpDeadline(evt.rsvp_deadline || '');
    setEventVisibility(evt.visibility || 'all_members');
    setEventPrice(evt.price || 'Included in Membership');
    setEventWhatsIncluded(evt.whats_included || '');
    setEventAgenda(evt.agenda || '');
    setEventCoverImage(evt.hero_image || evt.cover_image || '/assets/events/london_gathering.jpg');
    setEventPublishNow(evt.is_published === 1);
    setShowCreateEvent(true);
  };

  const handleSaveEvent = async () => {
    if (!eventTitle.trim() || !eventDescription.trim()) {
      const msg = 'Please enter both an Event Title and Description.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Missing Fields', msg);
      return;
    }

    try {
      setSavingEvent(true);
      const payload: Partial<ClubEvent> = {
        title: eventTitle.trim(),
        headline: eventHeadline.trim() || eventTitle.trim(),
        description: eventDescription.trim(),
        event_type: eventType,
        location: eventLocation.trim() || 'To be confirmed',
        venue: eventVenue.trim() || 'To be confirmed',
        meeting_link: eventMeetingLink.trim() || null,
        start_date: eventStartDate.trim() || null,
        end_date: eventEndDate.trim() || null,
        display_date: eventDisplayDate.trim() || eventStartDate.trim() || 'Upcoming',
        timezone: eventTimezone.trim() || 'UTC',
        capacity: parseInt(eventCapacity, 10) || 30,
        rsvp_deadline: eventRsvpDeadline.trim() || null,
        visibility: eventVisibility,
        price: eventPrice.trim() || 'Included in Membership',
        whats_included: eventWhatsIncluded.trim() || null,
        agenda: eventAgenda.trim() || null,
        hero_image: eventCoverImage,
        cover_image: eventCoverImage,
        is_published: eventPublishNow ? 1 : 0,
        registration_status: eventPublishNow ? 'open' : 'coming_soon',
      };

      if (editingEventId) {
        await ApiService.updateAdminEvent(editingEventId, adminId, payload);
        const msg = 'Event updated successfully.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Event Updated', msg);
      } else {
        await ApiService.createAdminEvent(adminId, payload);
        const msg = `Event "${eventTitle}" created successfully.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Event Created', msg);
      }

      setShowCreateEvent(false);
      loadEvents();
    } catch (err: any) {
      const msg = err.message || 'Failed to save event.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setSavingEvent(false);
    }
  };

  const handleTogglePublish = async (evt: ClubEvent) => {
    try {
      if (evt.is_published === 1) {
        await ApiService.updateAdminEvent(evt.id, adminId, {
          is_published: 0,
          registration_status: 'coming_soon',
        });
        const msg = `Event "${evt.title}" un-published (Draft).`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Status Updated', msg);
      } else {
        await ApiService.publishAdminEvent(evt.id, adminId);
        const msg = `Event "${evt.title}" published! Now live for members.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Event Published', msg);
      }
      loadEvents();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleCancelEvent = async (evt: ClubEvent) => {
    const doCancel = async () => {
      try {
        await ApiService.cancelAdminEvent(evt.id, adminId);
        const msg = `Event "${evt.title}" has been marked cancelled.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Event Cancelled', msg);
        loadEvents();
      } catch (err: any) {
        Alert.alert('Error', err.message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to cancel "${evt.title}"?`)) {
        doCancel();
      }
    } else {
      Alert.alert(
        'Confirm Cancellation',
        `Are you sure you want to cancel "${evt.title}"?`,
        [
          { text: 'Keep Event', style: 'cancel' },
          { text: 'Cancel Event', style: 'destructive', onPress: doCancel },
        ]
      );
    }
  };

  const handleViewAttendees = async (eventId: string) => {
    setViewingAttendeesEventId(eventId);
    setAttendeeDetail(null);
    try {
      setLoadingAttendeeDetail(true);
      const detail = await ApiService.getAdminEventDetail(eventId, adminId);
      setAttendeeDetail(detail);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load attendees');
    } finally {
      setLoadingAttendeeDetail(false);
    }
  };

  // -------------------------------------------------------------
  // TARGETED INVITATIONS DISPATCH
  // -------------------------------------------------------------
  const handleSendInvitations = async () => {
    if (!selectedInviteEventId) {
      Alert.alert('Select Event', 'Please select a target event for invitations.');
      return;
    }

    if (!recipientPreview || recipientPreview.recipients.length === 0) {
      Alert.alert('No Recipients', 'No eligible recipients found matching the active criteria.');
      return;
    }

    const recipientIds = recipientPreview.recipients.map(r => r.id);
    const activeChannels: Array<'in_app' | 'email' | 'whatsapp'> = [];
    if (channelInApp) activeChannels.push('in_app');
    if (channelEmail) activeChannels.push('email');
    if (channelWhatsapp) activeChannels.push('whatsapp');

    const confirmMessage = `Dispatch invitations to ${recipientIds.length} member(s)?\n\nChannels: ${activeChannels.join(', ').toUpperCase()}\n\nReal notifications will only be delivered after your explicit confirmation.`;

    const executeSend = async () => {
      try {
        setSendingInvitations(true);
        const res = await ApiService.sendAdminInvitations(adminId, {
          eventId: selectedInviteEventId,
          recipientIds,
          deliveryChannels: activeChannels,
          customMessage: customInviteMessage.trim() || undefined,
        });
        setShowSendSuccessBanner(true);
        setTimeout(() => setShowSendSuccessBanner(false), 5000);
        const msg = `Successfully dispatched ${res.sent_count} invitation(s) via ${res.delivery_channels.join(', ')}.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Invitations Dispatched', msg);
        fetchRecipientPreview();
        loadEvents();
      } catch (err: any) {
        Alert.alert('Dispatch Error', err.message || 'Failed to send invitations');
      } finally {
        setSendingInvitations(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) executeSend();
    } else {
      Alert.alert('Confirm Dispatch', confirmMessage, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm & Send', onPress: executeSend },
      ]);
    }
  };

  // -------------------------------------------------------------
  // MEMBERSHIP ACTIONS
  // -------------------------------------------------------------
  const handleIssueMembershipToken = async () => {
    if (!newInviteEmail.trim()) {
      const msg = 'Candidate email is required to bind a 1:1 invitation.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Missing Email', msg);
      return;
    }

    try {
      setIsIssuingInvite(true);
      const res = await ApiService.createInvitation({
        email: newInviteEmail.trim(),
        fullName: newInviteName.trim() || undefined,
        role: newInviteRole.trim() || undefined,
        expiresInDays: parseInt(newInviteDays, 10) || 14,
        notes: newInviteNotes.trim() || undefined,
      });

      setJustIssuedToken(res.token);
      setJustIssuedLink(res.inviteUrl || `https://ozara.club/invitation?code=${res.token}`);
      setNewInviteEmail('');
      setNewInviteName('');
      setNewInviteRole('');
      setNewInviteNotes('');
      loadMembershipData();

      const msg = `Invitation Token Issued: ${res.token}\nExpires: ${res.expiresAt.split('T')[0]}`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Invitation Generated', msg);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to issue invitation');
    } finally {
      setIsIssuingInvite(false);
    }
  };

  const handleRevokeToken = async (id: string, token: string) => {
    const doRevoke = async () => {
      try {
        setRevokingTokenId(id);
        await ApiService.revokeInvitation({ id, token, revokedBy: adminId });
        loadMembershipData();
        const msg = `Token ${token} has been revoked.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Token Revoked', msg);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Revocation failed');
      } finally {
        setRevokingTokenId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Revoke invitation ${token}?`)) doRevoke();
    } else {
      Alert.alert('Confirm Revocation', `Are you sure you want to revoke invitation token ${token}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: doRevoke },
      ]);
    }
  };

  const handleApproveAccessRequest = async (requestId: string, email: string) => {
    try {
      setApprovingRequestId(requestId);
      const res = await ApiService.approveAccessRequest({ requestId, email, approvedBy: adminId });
      loadMembershipData();
      const msg = `Request approved! Token ${res.token} generated and emailed to ${email}.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Approved', msg);
    } catch (err: any) {
      Alert.alert('Approval Error', err.message);
    } finally {
      setApprovingRequestId(null);
    }
  };

  const handleDeclineAccessRequest = async (requestId: string, email: string) => {
    try {
      setDecliningRequestId(requestId);
      await ApiService.declineAccessRequest({ requestId, email, declinedBy: adminId });
      loadMembershipData();
      const msg = `Access request for ${email} declined.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Declined', msg);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setDecliningRequestId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Admin Dashboard Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleBox}>
            <View style={styles.badgeRow}>
              <View style={styles.adminShieldBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.adminShieldText}>FOUNDER CONSOLE</Text>
              </View>
              <Text style={styles.adminNameText}>
                {currentUser?.full_name || 'Alexandra Hill'}
              </Text>
            </View>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              Governance, targeted invitations, events &amp; membership operations
            </Text>
          </View>
          {onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>

        {/* 4 Core Admin Navigation Sub-Tabs */}
        <View style={styles.tabsStrip}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'events' && styles.tabBtnActive]}
            onPress={() => setActiveTab('events')}
            activeOpacity={0.8}>
            <Ionicons
              name={activeTab === 'events' ? 'calendar' : 'calendar-outline'}
              size={15}
              color={activeTab === 'events' ? '#ffffff' : OzaraTheme.colors.textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'events' && styles.tabBtnTextActive]}>
              Events ({events.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'invitations' && styles.tabBtnActive]}
            onPress={() => setActiveTab('invitations')}
            activeOpacity={0.8}>
            <Ionicons
              name={activeTab === 'invitations' ? 'paper-plane' : 'paper-plane-outline'}
              size={15}
              color={activeTab === 'invitations' ? '#ffffff' : OzaraTheme.colors.textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'invitations' && styles.tabBtnTextActive]}>
              Invitations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'membership' && styles.tabBtnActive]}
            onPress={() => setActiveTab('membership')}
            activeOpacity={0.8}>
            <Ionicons
              name={activeTab === 'membership' ? 'key' : 'key-outline'}
              size={15}
              color={activeTab === 'membership' ? '#ffffff' : OzaraTheme.colors.textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'membership' && styles.tabBtnTextActive]}>
              Membership ({invitationsList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'audit_logs' && styles.tabBtnActive]}
            onPress={() => setActiveTab('audit_logs')}
            activeOpacity={0.8}>
            <Ionicons
              name={activeTab === 'audit_logs' ? 'receipt' : 'receipt-outline'}
              size={15}
              color={activeTab === 'audit_logs' ? '#ffffff' : OzaraTheme.colors.textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'audit_logs' && styles.tabBtnTextActive]}>
              Audit Logs
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Content */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* ========================================================================= */}
        {/* TAB 1: EVENT MANAGEMENT                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'events' && (
          <View style={styles.tabPane}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Club Event Management</Text>
                <Text style={styles.sectionDesc}>
                  Create, preview, publish, edit, or cancel private club events
                </Text>
              </View>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleOpenCreateEvent}
                activeOpacity={0.85}>
                <Ionicons name="add" size={16} color="#000000" style={{ marginRight: 4 }} />
                <Text style={styles.primaryActionBtnText}>Create Event</Text>
              </TouchableOpacity>
            </View>

            {loading && events.length === 0 ? (
              <ActivityIndicator size="large" color={OzaraTheme.colors.accentCyan} style={{ marginVertical: 30 }} />
            ) : (
              <View style={styles.eventsStack}>
                {events.map((evt) => {
                  const isPublished = evt.is_published === 1;
                  const isCancelled = evt.status === 'cancelled';
                  return (
                    <View key={evt.id} style={styles.eventAdminCard}>
                      <View style={styles.eventCardTop}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <View style={styles.eventBadgeRow}>
                            <View style={[
                              styles.statusBadge,
                              isCancelled ? styles.statusBadgeCancelled :
                              isPublished ? styles.statusBadgePublished : styles.statusBadgeDraft
                            ]}>
                              <Text style={styles.statusBadgeText}>
                                {isCancelled ? 'CANCELLED' : isPublished ? 'PUBLISHED' : 'DRAFT'}
                              </Text>
                            </View>
                            <View style={styles.typeBadge}>
                              <Text style={styles.typeBadgeText}>{evt.event_type || 'Event'}</Text>
                            </View>
                            <View style={styles.visibilityBadge}>
                              <Text style={styles.visibilityBadgeText}>
                                {evt.visibility === 'selected_invitees' ? 'Invite Only' : 'All Members'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.eventCardTitle}>{evt.title}</Text>
                          <Text style={styles.eventCardMeta}>
                            📅 {evt.display_date || evt.start_date || 'Upcoming'} • 📍 {evt.venue && evt.venue !== 'To be confirmed' ? `${evt.venue}, ` : ''}{evt.location}
                          </Text>
                          {evt.timezone && (
                            <Text style={styles.eventTimezoneText}>Timezone: {evt.timezone}</Text>
                          )}
                        </View>
                      </View>

                      {/* Event Key Stats Row */}
                      <View style={styles.eventStatsRow}>
                        <View style={styles.statPill}>
                          <Text style={styles.statPillLabel}>Capacity</Text>
                          <Text style={styles.statPillValue}>{evt.capacity || 'TBA'}</Text>
                        </View>
                        <View style={styles.statPill}>
                          <Text style={styles.statPillLabel}>Registered</Text>
                          <Text style={[styles.statPillValue, { color: '#10b981' }]}>
                            {evt.total_registered ?? evt.registered_count ?? 0}
                          </Text>
                        </View>
                        <View style={styles.statPill}>
                          <Text style={styles.statPillLabel}>Invited</Text>
                          <Text style={[styles.statPillValue, { color: '#38bdf8' }]}>
                            {evt.total_invited ?? 0}
                          </Text>
                        </View>
                        <View style={styles.statPill}>
                          <Text style={styles.statPillLabel}>Declined</Text>
                          <Text style={[styles.statPillValue, { color: '#ef4444' }]}>
                            {evt.total_declined ?? 0}
                          </Text>
                        </View>
                        <View style={styles.statPill}>
                          <Text style={styles.statPillLabel}>Spots Left</Text>
                          <Text style={styles.statPillValue}>{evt.available_spots ?? 'TBA'}</Text>
                        </View>
                      </View>

                      {/* Action Buttons Row */}
                      <View style={styles.eventCardActions}>
                        <TouchableOpacity
                          style={styles.cardActionBtn}
                          onPress={() => handleViewAttendees(evt.id)}
                          activeOpacity={0.75}>
                          <Ionicons name="people-outline" size={14} color="#38bdf8" style={{ marginRight: 4 }} />
                          <Text style={[styles.cardActionBtnText, { color: '#38bdf8' }]}>Attendees &amp; RSVPs</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.cardActionBtn}
                          onPress={() => {
                            setSelectedInviteEventId(evt.id);
                            setActiveTab('invitations');
                          }}
                          activeOpacity={0.75}>
                          <Ionicons name="mail-outline" size={14} color="#a855f7" style={{ marginRight: 4 }} />
                          <Text style={[styles.cardActionBtnText, { color: '#a855f7' }]}>Send Invites</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.cardActionBtn}
                          onPress={() => handleOpenEditEvent(evt)}
                          activeOpacity={0.75}>
                          <Ionicons name="create-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                          <Text style={styles.cardActionBtnText}>Edit</Text>
                        </TouchableOpacity>

                        {!isCancelled && (
                          <TouchableOpacity
                            style={[styles.cardActionBtn, isPublished ? styles.unpublishBtn : styles.publishBtn]}
                            onPress={() => handleTogglePublish(evt)}
                            activeOpacity={0.75}>
                            <Ionicons
                              name={isPublished ? 'eye-off-outline' : 'cloud-upload-outline'}
                              size={14}
                              color={isPublished ? '#f59e0b' : '#10b981'}
                              style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.cardActionBtnText, { color: isPublished ? '#f59e0b' : '#10b981' }]}>
                              {isPublished ? 'Unpublish' : 'Publish'}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {!isCancelled && (
                          <TouchableOpacity
                            style={[styles.cardActionBtn, styles.cancelEventBtn]}
                            onPress={() => handleCancelEvent(evt)}
                            activeOpacity={0.75}>
                            <Ionicons name="close-circle-outline" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                            <Text style={[styles.cardActionBtnText, { color: '#ef4444' }]}>Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TARGETED INVITATIONS & BROADCASTS                                  */}
        {/* ========================================================================= */}
        {activeTab === 'invitations' && (
          <View style={styles.tabPane}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Targeted Notifications &amp; Event Invitations</Text>
                <Text style={styles.sectionDesc}>
                  Select audience, filter by chapter/industry, preview message, and dispatch
                </Text>
              </View>
            </View>

            {/* Target Event Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Select Target Event</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventChoiceScroll}>
                {events.map((e) => {
                  const isSelected = selectedInviteEventId === e.id;
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={[styles.eventChoiceChip, isSelected && styles.eventChoiceChipActive]}
                      onPress={() => setSelectedInviteEventId(e.id)}
                      activeOpacity={0.8}>
                      <Text style={[styles.eventChoiceText, isSelected && styles.eventChoiceTextActive]}>
                        {e.title}
                      </Text>
                      <Text style={styles.eventChoiceSub}>
                        {e.display_date || e.start_date || 'Date TBA'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 3 Recipient Selection Options */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Recipient Selection Mode</Text>
              <View style={styles.selectionOptionsRow}>
                <TouchableOpacity
                  style={[styles.selectionModeBtn, selectionOption === 'all_admitted' && styles.selectionModeBtnActive]}
                  onPress={() => setSelectionOption('all_admitted')}
                  activeOpacity={0.8}>
                  <Ionicons name="globe-outline" size={15} color={selectionOption === 'all_admitted' ? '#000000' : '#ffffff'} />
                  <Text style={[styles.selectionModeText, selectionOption === 'all_admitted' && styles.selectionModeTextActive]}>
                    All Admitted Members
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.selectionModeBtn, selectionOption === 'individual' && styles.selectionModeBtnActive]}
                  onPress={() => setSelectionOption('individual')}
                  activeOpacity={0.8}>
                  <Ionicons name="person-outline" size={15} color={selectionOption === 'individual' ? '#000000' : '#ffffff'} />
                  <Text style={[styles.selectionModeText, selectionOption === 'individual' && styles.selectionModeTextActive]}>
                    Individual Selection
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.selectionModeBtn, selectionOption === 'filters' && styles.selectionModeBtnActive]}
                  onPress={() => setSelectionOption('filters')}
                  activeOpacity={0.8}>
                  <Ionicons name="options-outline" size={15} color={selectionOption === 'filters' ? '#000000' : '#ffffff'} />
                  <Text style={[styles.selectionModeText, selectionOption === 'filters' && styles.selectionModeTextActive]}>
                    Networking Filters
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Individual Selection Controls */}
            {selectionOption === 'individual' && (
              <View style={styles.subFilterCard}>
                <Text style={styles.subFilterTitle}>Search &amp; Pick Individual Members</Text>
                <TextInput
                  style={styles.adminInput}
                  placeholder="Search members by name or headline..."
                  placeholderTextColor="#64748b"
                  value={memberSearchQuery}
                  onChangeText={setMemberSearchQuery}
                />
                <ScrollView style={{ maxHeight: 180, marginTop: 8 }}>
                  {allAdmittedMembers
                    .filter((m) => {
                      if (!memberSearchQuery) return true;
                      const q = memberSearchQuery.toLowerCase();
                      return (
                        m.full_name?.toLowerCase().includes(q) ||
                        m.headline?.toLowerCase().includes(q) ||
                        m.city?.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 30)
                    .map((m) => {
                      const isPicked = selectedMemberIds.includes(m.id);
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.memberPickerRow, isPicked && styles.memberPickerRowActive]}
                          onPress={() => {
                            if (isPicked) {
                              setSelectedMemberIds(selectedMemberIds.filter((id) => id !== m.id));
                            } else {
                              setSelectedMemberIds([...selectedMemberIds, m.id]);
                            }
                          }}
                          activeOpacity={0.75}>
                          <Image source={{ uri: resolveImageUrl(m.avatar_url) }} style={styles.memberPickerAvatar} />
                          <View style={{ flex: 1, marginHorizontal: 8 }}>
                            <Text style={styles.memberPickerName}>{m.full_name}</Text>
                            <Text style={styles.memberPickerHeadline} numberOfLines={1}>
                              {m.headline || m.city}
                            </Text>
                          </View>
                          <Ionicons
                            name={isPicked ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isPicked ? '#10b981' : '#64748b'}
                          />
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
                <Text style={styles.selectedCountText}>
                  Selected: {selectedMemberIds.length} member(s)
                </Text>
              </View>
            )}

            {/* Networking Filters Controls */}
            {selectionOption === 'filters' && (
              <View style={styles.subFilterCard}>
                <Text style={styles.subFilterTitle}>Combined Networking Filters</Text>
                <Text style={styles.subFilterSubtitle}>
                  Members matching ALL filled filters will receive invitations.
                </Text>

                <View style={styles.filterInputsGrid}>
                  <View style={styles.gridInputCol}>
                    <Text style={styles.smallInputLabel}>Location (City / Country)</Text>
                    <TextInput
                      style={styles.adminInputSm}
                      placeholder="e.g. London, Dubai, Zurich"
                      placeholderTextColor="#64748b"
                      value={filterLocation}
                      onChangeText={setFilterLocation}
                    />
                  </View>
                  <View style={styles.gridInputCol}>
                    <Text style={styles.smallInputLabel}>Industry</Text>
                    <TextInput
                      style={styles.adminInputSm}
                      placeholder="e.g. Artificial Intelligence, FinTech"
                      placeholderTextColor="#64748b"
                      value={filterIndustry}
                      onChangeText={setFilterIndustry}
                    />
                  </View>
                </View>

                <View style={styles.filterInputsGrid}>
                  <View style={styles.gridInputCol}>
                    <Text style={styles.smallInputLabel}>Interests</Text>
                    <TextInput
                      style={styles.adminInputSm}
                      placeholder="e.g. Polo, Real Estate, Art"
                      placeholderTextColor="#64748b"
                      value={filterInterests}
                      onChangeText={setFilterInterests}
                    />
                  </View>
                  <View style={styles.gridInputCol}>
                    <Text style={styles.smallInputLabel}>University / Institution</Text>
                    <TextInput
                      style={styles.adminInputSm}
                      placeholder="e.g. Stanford, Oxford, Harvard"
                      placeholderTextColor="#64748b"
                      value={filterUniversity}
                      onChangeText={setFilterUniversity}
                    />
                  </View>
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={styles.smallInputLabel}>Expertise</Text>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="e.g. Venture Debt, Sovereign Wealth, Cross-border M&A"
                    placeholderTextColor="#64748b"
                    value={filterExpertise}
                    onChangeText={setFilterExpertise}
                  />
                </View>
              </View>
            )}

            {/* Live Recipient Count & Deduplication Status */}
            <View style={styles.previewBox}>
              <View style={styles.previewHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="eye-outline" size={16} color="#38bdf8" />
                  <Text style={styles.previewTitle}>Live Recipient Preview</Text>
                </View>
                {loadingPreview ? (
                  <ActivityIndicator size="small" color="#38bdf8" />
                ) : (
                  <View style={styles.recipientCountPill}>
                    <Text style={styles.recipientCountText}>
                      {recipientPreview?.recipient_count || 0} Recipients
                    </Text>
                  </View>
                )}
              </View>

              {recipientPreview && (
                <View>
                  <View style={styles.previewStatsRow}>
                    <Text style={styles.previewSubText}>
                      Matched Members: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{recipientPreview.total_found}</Text>
                    </Text>
                    {recipientPreview.already_invited_count > 0 && (
                      <View style={styles.alreadyInvitedBadge}>
                        <Text style={styles.alreadyInvitedText}>
                          ⚠️ {recipientPreview.already_invited_count} Already Invited (Duplicates Prevented)
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Recipient Avatars Flow with Individual Exclusion Toggle */}
                  <Text style={[styles.fieldLabel, { marginTop: 12, marginBottom: 6 }]}>
                    Recipients ({recipientPreview.recipients.length}) • Tap any member to exclude
                  </Text>
                  <ScrollView style={{ maxHeight: 150 }}>
                    <View style={styles.recipientsFlow}>
                      {recipientPreview.recipients.map((r) => {
                        const isExcluded = excludedMemberIds.includes(r.id);
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[styles.recipientChip, isExcluded && styles.recipientChipExcluded]}
                            onPress={() => {
                              if (isExcluded) {
                                setExcludedMemberIds(excludedMemberIds.filter((id) => id !== r.id));
                              } else {
                                setExcludedMemberIds([...excludedMemberIds, r.id]);
                              }
                            }}
                            activeOpacity={0.75}>
                            <Image source={{ uri: resolveImageUrl(r.avatar_url) }} style={styles.recipientChipImg} />
                            <Text style={[styles.recipientChipName, isExcluded && styles.recipientChipNameExcluded]}>
                              {r.full_name}
                            </Text>
                            {r.already_invited && (
                              <View style={styles.invitedDot} />
                            )}
                            <Ionicons
                              name={isExcluded ? 'add-circle' : 'close-circle'}
                              size={14}
                              color={isExcluded ? '#10b981' : '#ef4444'}
                              style={{ marginLeft: 4 }}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {/* Message Preview */}
                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Message Preview</Text>
                  <View style={styles.messagePreviewCard}>
                    <Text style={styles.messagePreviewContent}>
                      {recipientPreview.message_preview}
                    </Text>
                    {customInviteMessage ? (
                      <Text style={styles.customMessageAppended}>
                        Personal Note: "{customInviteMessage}"
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
            </View>

            {/* Custom Invitation Note */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Custom Personal Note (Optional)</Text>
              <TextInput
                style={[styles.adminInput, { height: 60 }]}
                placeholder="Add a personalized founder message to this broadcast..."
                placeholderTextColor="#64748b"
                value={customInviteMessage}
                onChangeText={setCustomInviteMessage}
                multiline
              />
            </View>

            {/* Delivery Channels */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Delivery Channels</Text>
              <View style={styles.channelsRow}>
                <TouchableOpacity
                  style={[styles.channelBtn, channelInApp && styles.channelBtnActive]}
                  onPress={() => setChannelInApp(!channelInApp)}
                  activeOpacity={0.8}>
                  <Ionicons name="notifications" size={15} color={channelInApp ? '#10b981' : '#64748b'} />
                  <Text style={[styles.channelBtnText, channelInApp && styles.channelBtnTextActive]}>
                    In-App Notification (Default)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.channelBtn, channelEmail && styles.channelBtnActive]}
                  onPress={() => setChannelEmail(!channelEmail)}
                  activeOpacity={0.8}>
                  <Ionicons name="mail" size={15} color={channelEmail ? '#10b981' : '#64748b'} />
                  <Text style={[styles.channelBtnText, channelEmail && styles.channelBtnTextActive]}>
                    Email Delivery
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.channelBtn, channelWhatsapp && styles.channelBtnActive]}
                  onPress={() => setChannelWhatsapp(!channelWhatsapp)}
                  activeOpacity={0.8}>
                  <Ionicons name="logo-whatsapp" size={15} color={channelWhatsapp ? '#10b981' : '#64748b'} />
                  <Text style={[styles.channelBtnText, channelWhatsapp && styles.channelBtnTextActive]}>
                    WhatsApp
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Explicit Send Button */}
            <TouchableOpacity
              style={[
                styles.dispatchBtn,
                (!recipientPreview || recipientPreview.recipients.length === 0 || sendingInvitations) && { opacity: 0.5 },
              ]}
              onPress={handleSendInvitations}
              disabled={!recipientPreview || recipientPreview.recipients.length === 0 || sendingInvitations}
              activeOpacity={0.85}>
              {sendingInvitations ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="paper-plane" size={16} color="#000000" />
                  <Text style={styles.dispatchBtnText}>
                    Send Event Invitations ({recipientPreview?.recipients.length || 0})
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MEMBERSHIP INVITATIONS                                             */}
        {/* ========================================================================= */}
        {activeTab === 'membership' && (
          <View style={styles.tabPane}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Membership Invitations &amp; Access Requests</Text>
                <Text style={styles.sectionDesc}>
                  Issue single-use invitation tokens, set expiration dates, and review candidate applications
                </Text>
              </View>
            </View>

            {/* Issue New Expirable Invitation Card */}
            <View style={styles.issueInviteCard}>
              <View style={styles.cardHeaderSmall}>
                <Ionicons name="key" size={15} color="#38bdf8" />
                <Text style={styles.cardHeaderTitle}>Generate Membership Invitation</Text>
              </View>

              <TextInput
                style={styles.adminInput}
                placeholder="Candidate Email Address (required)"
                placeholderTextColor="#64748b"
                value={newInviteEmail}
                onChangeText={setNewInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.filterInputsGrid}>
                <View style={styles.gridInputCol}>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="Full Name (optional)"
                    placeholderTextColor="#64748b"
                    value={newInviteName}
                    onChangeText={setNewInviteName}
                  />
                </View>
                <View style={styles.gridInputCol}>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="Role / Organization"
                    placeholderTextColor="#64748b"
                    value={newInviteRole}
                    onChangeText={setNewInviteRole}
                  />
                </View>
              </View>

              <View style={styles.expirationSelectorRow}>
                <Text style={styles.expirationLabel}>Expiration Window:</Text>
                {['7', '14', '30'].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayChoiceBtn, newInviteDays === d && styles.dayChoiceBtnActive]}
                    onPress={() => setNewInviteDays(d)}
                    activeOpacity={0.8}>
                    <Text style={[styles.dayChoiceText, newInviteDays === d && styles.dayChoiceTextActive]}>
                      {d} Days
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.adminInput, { height: 50, marginTop: 10 }]}
                placeholder="Internal notes (e.g. Met at Zurich dinner, prospective LP)..."
                placeholderTextColor="#64748b"
                value={newInviteNotes}
                onChangeText={setNewInviteNotes}
              />

              <TouchableOpacity
                style={[styles.generateTokenBtn, isIssuingInvite && { opacity: 0.6 }]}
                onPress={handleIssueMembershipToken}
                disabled={isIssuingInvite}
                activeOpacity={0.85}>
                {isIssuingInvite ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.generateTokenBtnText}>Generate Unique Invitation Token</Text>
                )}
              </TouchableOpacity>

              {/* Just Issued Token Banner */}
              {justIssuedToken && (
                <View style={styles.justIssuedCard}>
                  <Text style={styles.justIssuedLabel}>TOKEN GENERATED</Text>
                  <Text style={styles.justIssuedCode}>{justIssuedToken}</Text>
                  <Text style={styles.justIssuedLink}>{justIssuedLink}</Text>
                  <Text style={styles.justIssuedSub}>
                    Token is single-use and bound 1:1 to candidate.
                  </Text>
                </View>
              )}
            </View>

            {/* Issued Invitations List */}
            <View style={{ marginTop: 22 }}>
              <Text style={styles.subSectionTitle}>Issued Membership Invitations ({invitationsList.length})</Text>
              {invitationsList.map((inv) => {
                const isClaimed = inv.is_claimed === 1 || inv.status === 'claimed';
                const isRevoked = inv.status === 'revoked';
                const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
                return (
                  <View key={inv.id} style={styles.tokenRecordCard}>
                    <View style={styles.tokenRecordTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tokenCandidateEmail}>{inv.email}</Text>
                        {!!inv.full_name && (
                          <Text style={styles.tokenCandidateName}>{inv.full_name}</Text>
                        )}
                        <Text style={styles.tokenIssuedCode}>{inv.token}</Text>
                        <Text style={styles.tokenRecordMeta}>
                          Issued: {inv.created_at?.split('T')[0]} • Expires: {inv.expires_at?.split('T')[0] || '14d'}
                        </Text>
                        {isClaimed && (
                          <Text style={styles.claimedByMeta}>
                            ✓ Claimed by: {inv.claimed_user_name || inv.claimed_by} ({inv.claimed_at?.split('T')[0]})
                          </Text>
                        )}
                      </View>
                      <View style={[
                        styles.tokenStatusBadge,
                        isRevoked ? styles.tokenStatusRevoked :
                        isClaimed ? styles.tokenStatusClaimed :
                        isExpired ? styles.tokenStatusExpired : styles.tokenStatusActive
                      ]}>
                        <Text style={styles.tokenStatusText}>
                          {isRevoked ? 'REVOKED' : isClaimed ? 'CLAIMED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
                        </Text>
                      </View>
                    </View>

                    {!isClaimed && !isRevoked && (
                      <View style={styles.tokenActionRow}>
                        <TouchableOpacity
                          style={styles.revokeTokenBtn}
                          onPress={() => handleRevokeToken(inv.id, inv.token)}
                          disabled={revokingTokenId === inv.id}
                          activeOpacity={0.8}>
                          <Text style={styles.revokeTokenBtnText}>
                            {revokingTokenId === inv.id ? 'Revoking...' : 'Revoke Token'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Prospective Access Requests Queue */}
            {accessRequestsList.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.subSectionTitle}>Prospective Access Requests ({accessRequestsList.length})</Text>
                {accessRequestsList.map((reqItem) => (
                  <View key={reqItem.id} style={styles.accessReqCard}>
                    <View style={styles.accessReqTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.accessReqName}>{reqItem.full_name || 'Prospective Candidate'}</Text>
                        <Text style={styles.accessReqEmail}>{reqItem.email}</Text>
                        {!!reqItem.role_or_headline && (
                          <Text style={styles.accessReqRole}>{reqItem.role_or_headline}</Text>
                        )}
                        {!!reqItem.what_brings_you && (
                          <Text style={styles.accessReqNotes}>"{reqItem.what_brings_you}"</Text>
                        )}
                      </View>
                      <View style={styles.reqStatusPill}>
                        <Text style={styles.reqStatusPillText}>{reqItem.status?.toUpperCase()}</Text>
                      </View>
                    </View>

                    {reqItem.status === 'pending_admin_approval' && (
                      <View style={styles.reqActionButtonsRow}>
                        <TouchableOpacity
                          style={styles.approveReqBtn}
                          onPress={() => handleApproveAccessRequest(reqItem.id, reqItem.email)}
                          disabled={approvingRequestId === reqItem.id}
                          activeOpacity={0.85}>
                          <Text style={styles.approveReqBtnText}>
                            {approvingRequestId === reqItem.id ? 'Issuing...' : 'Approve & Issue Token'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.declineReqBtn}
                          onPress={() => handleDeclineAccessRequest(reqItem.id, reqItem.email)}
                          disabled={decliningRequestId === reqItem.id}
                          activeOpacity={0.85}>
                          <Text style={styles.declineReqBtnText}>
                            {decliningRequestId === reqItem.id ? '...' : 'Decline'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: IMMUTABLE AUDIT LOGS                                               */}
        {/* ========================================================================= */}
        {activeTab === 'audit_logs' && (
          <View style={styles.tabPane}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Immutable Governance Audit Logs</Text>
                <Text style={styles.sectionDesc}>
                  Traceability for all administrative actions, token generation, and invitations
                </Text>
              </View>
              <TouchableOpacity
                style={styles.refreshLogsBtn}
                onPress={loadAuditLogs}
                activeOpacity={0.75}>
                <Ionicons name="refresh" size={15} color="#38bdf8" />
                <Text style={styles.refreshLogsText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {loadingAuditLogs ? (
              <ActivityIndicator size="large" color={OzaraTheme.colors.accentCyan} style={{ marginVertical: 30 }} />
            ) : auditLogs.length === 0 ? (
              <Text style={styles.emptyText}>No audit records logged.</Text>
            ) : (
              <View style={styles.logsStack}>
                {auditLogs.map((log) => {
                  let meta: any = {};
                  try {
                    meta = JSON.parse(log.metadata_json || '{}');
                  } catch (e) {}

                  return (
                    <View key={log.id} style={styles.logCard}>
                      <View style={styles.logCardTop}>
                        <View style={styles.logActionBadge}>
                          <Text style={styles.logActionBadgeText}>{log.action}</Text>
                        </View>
                        <Text style={styles.logTimeText}>{new Date(log.timestamp).toLocaleString()}</Text>
                      </View>
                      <Text style={styles.logActorText}>
                        Admin: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{log.actor_name || log.actor_id}</Text>
                        {log.actor_role ? ` (${log.actor_role})` : ''}
                      </Text>
                      {log.target_member_id && (
                        <Text style={styles.logTargetText}>Target: {log.target_member_id}</Text>
                      )}
                      {meta && Object.keys(meta).length > 0 && (
                        <View style={styles.logMetaBox}>
                          <Text style={styles.logMetaCode}>
                            {JSON.stringify(meta, null, 2)}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT EVENT FORM                                         */}
      {/* ========================================================================= */}
      {showCreateEvent && (
        <View style={styles.formModalOverlay}>
          <View style={styles.formModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {editingEventId ? 'Edit Event' : 'Create New Event'}
              </Text>
              <TouchableOpacity onPress={() => setShowCreateEvent(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, padding: 18 }}>
              <Text style={styles.inputLabel}>Event Title *</Text>
              <TextInput
                style={styles.adminInput}
                placeholder="e.g. ÖZARA Annual Gathering & Venture Summit"
                placeholderTextColor="#64748b"
                value={eventTitle}
                onChangeText={setEventTitle}
              />

              <Text style={styles.inputLabel}>Short Headline</Text>
              <TextInput
                style={styles.adminInput}
                placeholder="e.g. Exclusive closed-door retreat for global tech founders"
                placeholderTextColor="#64748b"
                value={eventHeadline}
                onChangeText={setEventHeadline}
              />

              <Text style={styles.inputLabel}>Full Description *</Text>
              <TextInput
                style={[styles.adminInput, { height: 90 }]}
                placeholder="Comprehensive description of the gathering itinerary and objectives..."
                placeholderTextColor="#64748b"
                value={eventDescription}
                onChangeText={setEventDescription}
                multiline
              />

              <View style={styles.filterInputsGrid}>
                <View style={styles.gridInputCol}>
                  <Text style={styles.inputLabel}>Event Type</Text>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="e.g. Summit, Dinner, Retreat"
                    placeholderTextColor="#64748b"
                    value={eventType}
                    onChangeText={setEventType}
                  />
                </View>
                <View style={styles.gridInputCol}>
                  <Text style={styles.inputLabel}>Timezone</Text>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="e.g. Europe/London, Asia/Dubai"
                    placeholderTextColor="#64748b"
                    value={eventTimezone}
                    onChangeText={setEventTimezone}
                  />
                </View>
              </View>

              <View style={styles.filterInputsGrid}>
                <View style={styles.gridInputCol}>
                  <Text style={styles.inputLabel}>Display Date / Dates</Text>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="e.g. November 13–15, 2026"
                    placeholderTextColor="#64748b"
                    value={eventDisplayDate}
                    onChangeText={setEventDisplayDate}
                  />
                </View>
                <View style={styles.gridInputCol}>
                  <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="2026-11-13"
                    placeholderTextColor="#64748b"
                    value={eventStartDate}
                    onChangeText={setEventStartDate}
                  />
                </View>
              </View>

              <View style={styles.filterInputsGrid}>
                <View style={styles.gridInputCol}>
                  <Text style={styles.inputLabel}>Location (City, Country)</Text>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="e.g. Mayfair, London, UK"
                    placeholderTextColor="#64748b"
                    value={eventLocation}
                    onChangeText={setEventLocation}
                  />
                </View>
                <View style={styles.gridInputCol}>
                  <Text style={styles.inputLabel}>Venue (or TBA)</Text>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="e.g. The Connaught"
                    placeholderTextColor="#64748b"
                    value={eventVenue}
                    onChangeText={setEventVenue}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Online Meeting Link (if virtual/hybrid)</Text>
              <TextInput
                style={styles.adminInput}
                placeholder="https://meet.ozara.club/event-room"
                placeholderTextColor="#64748b"
                value={eventMeetingLink}
                onChangeText={setEventMeetingLink}
              />

              <View style={styles.filterInputsGrid}>
                <View style={styles.gridInputCol}>
                  <Text style={styles.inputLabel}>Capacity</Text>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="30"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={eventCapacity}
                    onChangeText={setEventCapacity}
                  />
                </View>
                <View style={styles.gridInputCol}>
                  <Text style={styles.inputLabel}>RSVP Deadline</Text>
                  <TextInput
                    style={styles.adminInputSm}
                    placeholder="e.g. 2026-11-05"
                    placeholderTextColor="#64748b"
                    value={eventRsvpDeadline}
                    onChangeText={setEventRsvpDeadline}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Visibility Scope</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.dayChoiceBtn, eventVisibility === 'all_members' && styles.dayChoiceBtnActive]}
                    onPress={() => setEventVisibility('all_members')}
                    activeOpacity={0.8}>
                    <Text style={[styles.dayChoiceText, eventVisibility === 'all_members' && styles.dayChoiceTextActive]}>
                      All Admitted Members
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dayChoiceBtn, eventVisibility === 'selected_invitees' && styles.dayChoiceBtnActive]}
                    onPress={() => setEventVisibility('selected_invitees')}
                    activeOpacity={0.8}>
                    <Text style={[styles.dayChoiceText, eventVisibility === 'selected_invitees' && styles.dayChoiceTextActive]}>
                      Selected Invitees Only
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.inputLabel}>Pricing / Inclusions</Text>
              <TextInput
                style={styles.adminInput}
                placeholder="Included in Membership / Ticket price"
                placeholderTextColor="#64748b"
                value={eventPrice}
                onChangeText={setEventPrice}
              />

              <Text style={styles.inputLabel}>Agenda Summary</Text>
              <TextInput
                style={[styles.adminInput, { height: 70 }]}
                placeholder="Day 1: Reception • Day 2: Private Salon • Day 3: Executive Dinners"
                placeholderTextColor="#64748b"
                value={eventAgenda}
                onChangeText={setEventAgenda}
                multiline
              />

              <TouchableOpacity
                style={[styles.modalSubmitBtn, savingEvent && { opacity: 0.6 }]}
                onPress={handleSaveEvent}
                disabled={savingEvent}
                activeOpacity={0.85}>
                {savingEvent ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>
                    {editingEventId ? 'Save Event Changes' : 'Create & Save Event'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ATTENDEE LIST & RSVP STATUSES                                    */}
      {/* ========================================================================= */}
      {viewingAttendeesEventId && (
        <View style={styles.formModalOverlay}>
          <View style={styles.formModalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Attendee List &amp; RSVPs</Text>
                <Text style={styles.modalHeaderSub}>
                  {attendeeDetail?.event?.title || 'Event Details'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setViewingAttendeesEventId(null)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, padding: 18 }}>
              {loadingAttendeeDetail ? (
                <ActivityIndicator size="large" color="#38bdf8" style={{ marginVertical: 30 }} />
              ) : attendeeDetail ? (
                <View>
                  {/* Summary Bar */}
                  <View style={styles.attendeeStatsGrid}>
                    <View style={styles.attendeeStatBox}>
                      <Text style={styles.attendeeStatNum}>{attendeeDetail.stats.registered}</Text>
                      <Text style={styles.attendeeStatLbl}>Registered</Text>
                    </View>
                    <View style={styles.attendeeStatBox}>
                      <Text style={styles.attendeeStatNum}>{attendeeDetail.stats.invited}</Text>
                      <Text style={styles.attendeeStatLbl}>Invited</Text>
                    </View>
                    <View style={styles.attendeeStatBox}>
                      <Text style={styles.attendeeStatNum}>{attendeeDetail.stats.declined}</Text>
                      <Text style={styles.attendeeStatLbl}>Declined</Text>
                    </View>
                    <View style={styles.attendeeStatBox}>
                      <Text style={styles.attendeeStatNum}>{attendeeDetail.stats.available_spots ?? 'TBA'}</Text>
                      <Text style={styles.attendeeStatLbl}>Available</Text>
                    </View>
                  </View>

                  {/* Registered Attendees */}
                  <Text style={[styles.fieldLabel, { marginTop: 18, marginBottom: 8 }]}>
                    Confirmed Attendees ({attendeeDetail.attendees.length})
                  </Text>
                  {attendeeDetail.attendees.length === 0 ? (
                    <Text style={styles.emptyText}>No registered attendees yet.</Text>
                  ) : (
                    attendeeDetail.attendees.map((att) => (
                      <View key={att.id} style={styles.attendeeCardRow}>
                        <Image source={{ uri: resolveImageUrl(att.avatar_url) }} style={styles.attendeeAvatar} />
                        <View style={{ flex: 1, marginHorizontal: 8 }}>
                          <Text style={styles.attendeeName}>{att.full_name}</Text>
                          <Text style={styles.attendeeHeadline} numberOfLines={1}>{att.headline || att.city}</Text>
                          <Text style={styles.attendeeEmail}>{att.email}</Text>
                        </View>
                        <View style={styles.attendeeStatusBadge}>
                          <Text style={styles.attendeeStatusBadgeText}>{att.status.toUpperCase()}</Text>
                        </View>
                      </View>
                    ))
                  )}

                  {/* Dispatched Invitees List */}
                  <Text style={[styles.fieldLabel, { marginTop: 20, marginBottom: 8 }]}>
                    Invited Members ({attendeeDetail.invitees.length})
                  </Text>
                  {attendeeDetail.invitees.map((inv) => (
                    <View key={inv.id} style={styles.inviteeCardRow}>
                      <Image source={{ uri: resolveImageUrl(inv.avatar_url) }} style={styles.attendeeAvatar} />
                      <View style={{ flex: 1, marginHorizontal: 8 }}>
                        <Text style={styles.attendeeName}>{inv.full_name}</Text>
                        <Text style={styles.attendeeEmail}>{inv.email}</Text>
                        <Text style={styles.attendeeHeadline}>
                          Sent via: {inv.delivery_channel} • {inv.sent_at?.split('T')[0]}
                        </Text>
                      </View>
                      <View style={[
                        styles.invRsvpBadge,
                        inv.status === 'accepted' ? styles.invRsvpAccepted :
                        inv.status === 'declined' ? styles.invRsvpDeclined : styles.invRsvpPending
                      ]}>
                        <Text style={styles.invRsvpBadgeText}>{inv.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.backgroundMidnight,
  },
  header: {
    backgroundColor: '#0c101d',
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitleBox: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  adminShieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  adminShieldText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  adminNameText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: '#1e293b',
  },
  tabBtnText: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 11.5,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  tabPane: {
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionDesc: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  eventsStack: {
    gap: 14,
  },
  eventAdminCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
  },
  eventCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  statusBadgePublished: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusBadgeDraft: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statusBadgeCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  typeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  typeBadgeText: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  visibilityBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  visibilityBadgeText: {
    color: '#38bdf8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  eventCardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventCardMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  eventTimezoneText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  eventStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  statPill: {
    alignItems: 'center',
  },
  statPillLabel: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statPillValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  eventCardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  cardActionBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '600',
  },
  publishBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  unpublishBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  cancelEventBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  formGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  eventChoiceScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  eventChoiceChip: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 8,
    minWidth: 140,
  },
  eventChoiceChipActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  eventChoiceText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  eventChoiceTextActive: {
    color: '#38bdf8',
  },
  eventChoiceSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 3,
  },
  selectionOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  selectionModeBtnActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  selectionModeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectionModeTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  subFilterCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  subFilterTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  subFilterSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 10,
  },
  filterInputsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  gridInputCol: {
    flex: 1,
  },
  smallInputLabel: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  adminInput: {
    backgroundColor: '#0a0e1a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 13,
  },
  adminInputSm: {
    backgroundColor: '#0a0e1a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: '#ffffff',
    fontSize: 12,
  },
  memberPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 6,
  },
  memberPickerRowActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  memberPickerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
  },
  memberPickerName: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '600',
  },
  memberPickerHeadline: {
    color: '#94a3b8',
    fontSize: 11,
  },
  selectedCountText: {
    color: '#10b981',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 8,
  },
  previewBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  recipientCountPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  recipientCountText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
  },
  previewStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewSubText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  alreadyInvitedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  alreadyInvitedText: {
    color: '#f59e0b',
    fontSize: 10.5,
    fontWeight: '700',
  },
  recipientsFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recipientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  recipientChipExcluded: {
    opacity: 0.4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  recipientChipImg: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 5,
  },
  recipientChipName: {
    color: '#ffffff',
    fontSize: 11,
  },
  recipientChipNameExcluded: {
    textDecorationLine: 'line-through',
    color: '#ef4444',
  },
  invitedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#f59e0b',
    marginLeft: 4,
  },
  messagePreviewCard: {
    backgroundColor: '#0a0e1a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  messagePreviewContent: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
  customMessageAppended: {
    color: '#38bdf8',
    fontSize: 11.5,
    marginTop: 8,
    fontStyle: 'italic',
  },
  channelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 5,
  },
  channelBtnActive: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  channelBtnText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '600',
  },
  channelBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dispatchBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  dispatchBtnText: {
    color: '#000000',
    fontSize: 13.5,
    fontWeight: '800',
  },
  issueInviteCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeaderSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  expirationSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  expirationLabel: {
    color: '#94a3b8',
    fontSize: 11.5,
  },
  dayChoiceBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  dayChoiceBtnActive: {
    backgroundColor: '#ffffff',
  },
  dayChoiceText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  dayChoiceTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  generateTokenBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  generateTokenBtnText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '800',
  },
  justIssuedCard: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    alignItems: 'center',
  },
  justIssuedLabel: {
    color: '#a78bfa',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  justIssuedCode: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginVertical: 4,
  },
  justIssuedLink: {
    color: '#38bdf8',
    fontSize: 11,
  },
  justIssuedSub: {
    color: '#64748b',
    fontSize: 10.5,
    marginTop: 4,
  },
  subSectionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  tokenRecordCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 10,
  },
  tokenRecordTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tokenCandidateEmail: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  tokenCandidateName: {
    color: '#94a3b8',
    fontSize: 11.5,
  },
  tokenIssuedCode: {
    color: '#c4b5fd',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginVertical: 3,
  },
  tokenRecordMeta: {
    color: '#64748b',
    fontSize: 11,
  },
  claimedByMeta: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tokenStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  tokenStatusActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  tokenStatusClaimed: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  tokenStatusExpired: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  tokenStatusRevoked: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  tokenStatusText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tokenActionRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'flex-end',
  },
  revokeTokenBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  revokeTokenBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  accessReqCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 10,
  },
  accessReqTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  accessReqName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  accessReqEmail: {
    color: '#38bdf8',
    fontSize: 12,
  },
  accessReqRole: {
    color: '#94a3b8',
    fontSize: 11.5,
  },
  accessReqNotes: {
    color: '#cbd5e1',
    fontSize: 11.5,
    fontStyle: 'italic',
    marginTop: 4,
  },
  reqStatusPill: {
    backgroundColor: '#1e293b',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  reqStatusPillText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
  },
  reqActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  approveReqBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  approveReqBtnText: {
    color: '#000000',
    fontSize: 11.5,
    fontWeight: '800',
  },
  declineReqBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  declineReqBtnText: {
    color: '#ef4444',
    fontSize: 11.5,
    fontWeight: '700',
  },
  refreshLogsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshLogsText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  logsStack: {
    gap: 10,
  },
  logCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  logCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logActionBadge: {
    backgroundColor: '#1e293b',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 4,
  },
  logActionBadgeText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700',
  },
  logTimeText: {
    color: '#64748b',
    fontSize: 11,
  },
  logActorText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  logTargetText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  logMetaBox: {
    backgroundColor: '#0a0e1a',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  logMetaCode: {
    color: '#a78bfa',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
  },
  formModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 14,
  },
  formModalContainer: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#0c101d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalHeaderSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  inputLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 5,
    marginTop: 8,
  },
  modalSubmitBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  modalSubmitBtnText: {
    color: '#000000',
    fontSize: 13.5,
    fontWeight: '800',
  },
  attendeeStatsGrid: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 10,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  attendeeStatBox: {
    alignItems: 'center',
  },
  attendeeStatNum: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  attendeeStatLbl: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  attendeeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  inviteeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0e1a',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  attendeeAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1e293b',
  },
  attendeeName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  attendeeHeadline: {
    color: '#94a3b8',
    fontSize: 11,
  },
  attendeeEmail: {
    color: '#64748b',
    fontSize: 10.5,
  },
  attendeeStatusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
  },
  attendeeStatusBadgeText: {
    color: '#10b981',
    fontSize: 9.5,
    fontWeight: '800',
  },
  invRsvpBadge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
  },
  invRsvpAccepted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  invRsvpDeclined: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  invRsvpPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  invRsvpBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
  },
});
