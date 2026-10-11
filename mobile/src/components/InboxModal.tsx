/**
 * ÖZARA Mobile: Inbox & Direct Messaging Modal
 * Features 1:1 Member Messaging, Rich In-App Notifications, Inline Connection Accept/Decline,
 * Shared Admin Activity Feed, and Notification Preferences.
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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OzaraTheme } from '../constants/ozara-theme';
import {
  ApiService,
  ConversationSummaryItem,
  DirectMessageItem,
  NotificationItem,
  AdminActivityItem,
  resolveImageUrl,
} from '../services/api';
import { useClub } from '../context/ClubContext';

interface InboxModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenEvent?: (eventId: string) => void;
  onOpenProfile?: (userId: string) => void;
  initialTab?: 'messages' | 'notifications' | 'admin_activity';
}

export const InboxModal: React.FC<InboxModalProps> = ({
  visible,
  onClose,
  onOpenEvent,
  onOpenProfile,
  initialTab = 'messages',
}) => {
  const { currentUserId, currentUser } = useClub();
  const viewerId = currentUserId || currentUser?.id || 'usr_elena';
  const isAdmin = currentUser?.role === 'FOUNDER' || currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'messages' | 'notifications' | 'admin_activity'>(initialTab);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);

  // Messages State
  const [conversations, setConversations] = useState<ConversationSummaryItem[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [activePartner, setActivePartner] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<DirectMessageItem[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [searchConvos, setSearchConvos] = useState('');

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifCategory, setNotifCategory] = useState<string>('all');
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // Admin Activity State
  const [activities, setActivities] = useState<AdminActivityItem[]>([]);
  const [activityCategory, setActivityCategory] = useState<string>('all');
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Preferences Screen State
  const [showPreferences, setShowPreferences] = useState(false);
  const [prefConn, setPrefConn] = useState('immediate');
  const [prefEvents, setPrefEvents] = useState('immediate');
  const [prefCommunity, setPrefCommunity] = useState('daily_digest');
  const [prefAdmin, setPrefAdmin] = useState('daily_digest');

  // Load summary and initial tab on open
  useEffect(() => {
    if (visible && viewerId) {
      loadInboxSummary();
      if (activeTab === 'messages') loadConversationsList();
      else if (activeTab === 'notifications') loadNotificationsList();
      else if (activeTab === 'admin_activity') loadAdminActivityList();
    }
  }, [visible, viewerId, activeTab]);

  const loadInboxSummary = async () => {
    try {
      const summary = await ApiService.getInboxSummary(viewerId);
      setUnreadMsgCount(summary.unread_messages || 0);
      setUnreadNotifCount(summary.unread_notifications || 0);
      setUnreadActivityCount(summary.unread_admin_activity || 0);
    } catch (e) {
      console.warn('Inbox summary error:', e);
    }
  };

  // --- CONVERSATIONS & CHAT ---
  const loadConversationsList = async () => {
    try {
      const res = await ApiService.getConversations(viewerId);
      setConversations(res.conversations || []);
    } catch (e) {
      console.warn('Load convos error:', e);
    }
  };

  const openConversationThread = async (convoId: string, partner: any) => {
    setActiveConvoId(convoId);
    setActivePartner(partner);
    setLoadingChat(true);
    try {
      const res = await ApiService.getConversationDetails(convoId, viewerId);
      setChatMessages(res.messages || []);
      loadInboxSummary();
    } catch (e: any) {
      Alert.alert('Conversation Restricted', e.message || 'Cannot load conversation');
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeConvoId || sendingMsg) return;
    const content = messageInput.trim();
    setSendingMsg(true);
    try {
      const res = await ApiService.sendDirectMessage(viewerId, activeConvoId, content);
      setChatMessages(prev => [...prev, res.message]);
      setMessageInput('');
      loadConversationsList();
    } catch (e: any) {
      Alert.alert('Send Error', e.message || 'Could not send direct message');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleReportOrBlock = (partnerId: string, partnerName: string) => {
    Alert.alert(
      `Report or Block ${partnerName}`,
      'Peer reports are reviewed strictly by club leadership. Commercial fundraising and solicitation are prohibited under the ÖZARA constitution.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block Member',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.blockUser(viewerId, partnerId, 'User requested block');
              Alert.alert('Member Blocked', `${partnerName} can no longer message you.`);
              setActiveConvoId(null);
              loadConversationsList();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not block member');
            }
          },
        },
        {
          text: 'Submit Peer Report',
          onPress: async () => {
            try {
              await ApiService.reportUser(viewerId, partnerId, 'commercial_solicitation', 'Reported via mobile client', true);
              Alert.alert('Report Submitted', 'Confidential report submitted to leadership.');
              setActiveConvoId(null);
              loadConversationsList();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not submit report');
            }
          },
        },
      ]
    );
  };

  // --- NOTIFICATIONS ---
  const loadNotificationsList = async () => {
    setLoadingNotifs(true);
    try {
      const res = await ApiService.getInboxNotifications(viewerId, notifCategory === 'all' ? undefined : notifCategory);
      setNotifications(res.notifications || []);
      setUnreadNotifCount(res.unread_count || 0);
    } catch (e) {
      console.warn('Load notifs error:', e);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const handleMarkNotifRead = async (id: string) => {
    try {
      await ApiService.markInboxNotificationRead(id, viewerId);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      loadInboxSummary();
    } catch (e) {}
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await ApiService.markAllInboxNotificationsRead(viewerId);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      loadInboxSummary();
    } catch (e) {}
  };

  const handleAcceptConnection = async (notif: NotificationItem) => {
    const connId = notif.metadata?.connection_id;
    try {
      await ApiService.acceptConnection(connId, viewerId);
      await handleMarkNotifRead(notif.id);
      Alert.alert('Connection Accepted', 'You can now exchange confidential direct messages.');
      loadNotificationsList();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not accept connection');
    }
  };

  const handleDeclineConnection = async (notif: NotificationItem) => {
    const connId = notif.metadata?.connection_id;
    try {
      await ApiService.declineConnection(connId, viewerId);
      await handleMarkNotifRead(notif.id);
      loadNotificationsList();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not decline connection');
    }
  };

  // --- ADMIN ACTIVITY ---
  const loadAdminActivityList = async () => {
    if (!isAdmin) return;
    setLoadingActivities(true);
    try {
      const res = await ApiService.getAdminActivity(viewerId, activityCategory === 'all' ? undefined : activityCategory);
      setActivities(res.activity || []);
      loadInboxSummary();
    } catch (e) {
      console.warn('Load activities error:', e);
    } finally {
      setLoadingActivities(false);
    }
  };

  // --- PREFERENCES ---
  const loadPreferences = async () => {
    try {
      const res = await ApiService.getNotificationPreferences(viewerId);
      const p = res.preferences || {};
      setPrefConn(p.email_connection_requests || 'immediate');
      setPrefEvents(p.email_event_invitations || 'immediate');
      setPrefCommunity(p.email_community_posts || 'daily_digest');
      setPrefAdmin(p.email_admin_activity || 'daily_digest');
    } catch (e) {}
  };

  const savePreferences = async () => {
    try {
      await ApiService.updateNotificationPreferences(viewerId, {
        email_connection_requests: prefConn,
        email_event_invitations: prefEvents,
        email_community_posts: prefCommunity,
        email_admin_activity: prefAdmin,
      });
      setShowPreferences(false);
      Alert.alert('Saved', 'Notification preferences updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save preferences');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>ÖZARA INBOX</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => {
                  loadPreferences();
                  setShowPreferences(true);
                }}>
                <Ionicons name="settings-outline" size={19} color={OzaraTheme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconBtn} onPress={onClose}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Navigation Tabs: Messages | Notifications | Admin Activity */}
          {!activeConvoId && !showPreferences && (
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'messages' && styles.tabBtnActive]}
                onPress={() => setActiveTab('messages')}>
                <Text style={[styles.tabText, activeTab === 'messages' && styles.tabTextActive]}>Messages</Text>
                {unreadMsgCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{unreadMsgCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'notifications' && styles.tabBtnActive]}
                onPress={() => setActiveTab('notifications')}>
                <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>Notifications</Text>
                {unreadNotifCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{unreadNotifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {isAdmin && (
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'admin_activity' && styles.tabBtnActive]}
                  onPress={() => setActiveTab('admin_activity')}>
                  <Text style={[styles.tabText, activeTab === 'admin_activity' && styles.tabTextActive]}>Admin</Text>
                  {unreadActivityCount > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{unreadActivityCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Content Body */}
        {showPreferences ? (
          /* PREFERENCES SCREEN */
          <ScrollView style={styles.body} contentContainerStyle={{ padding: 18 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Notification &amp; Email Delivery</Text>
              <TouchableOpacity onPress={() => setShowPreferences(false)}>
                <Text style={styles.linkText}>Back</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              Control email notifications dispatched to your verified email. In-app inbox notifications are always delivered.
            </Text>

            <View style={styles.prefCard}>
              <Text style={styles.prefLabel}>Direct Messages</Text>
              <Text style={styles.prefHelp}>Instant email alert (debounced to 1 email every 15 mins)</Text>
              <Text style={styles.prefFixedBadge}>Immediate Email (Permanent)</Text>
            </View>

            <View style={styles.prefCard}>
              <Text style={styles.prefLabel}>Connection Requests</Text>
              <Text style={styles.prefHelp}>Alerts when members request or accept connections</Text>
              <View style={styles.prefOptionsRow}>
                {['immediate', 'in_app_only'].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.prefOptionPill, prefConn === opt && styles.prefOptionPillActive]}
                    onPress={() => setPrefConn(opt)}>
                    <Text style={[styles.prefOptionText, prefConn === opt && styles.prefOptionTextActive]}>
                      {opt === 'immediate' ? 'Immediate Email' : 'In-App Only'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.prefCard}>
              <Text style={styles.prefLabel}>Event Invitations &amp; Gatherings</Text>
              <Text style={styles.prefHelp}>Invitations to club treks, dinners, and summits</Text>
              <View style={styles.prefOptionsRow}>
                {['immediate', 'daily_digest', 'in_app_only'].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.prefOptionPill, prefEvents === opt && styles.prefOptionPillActive]}
                    onPress={() => setPrefEvents(opt)}>
                    <Text style={[styles.prefOptionText, prefEvents === opt && styles.prefOptionTextActive]}>
                      {opt === 'immediate' ? 'Immediate' : opt === 'daily_digest' ? 'Daily Digest' : 'In-App Only'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.prefCard}>
              <Text style={styles.prefLabel}>Community Posts</Text>
              <Text style={styles.prefHelp}>Updates posted to ÖZARA Community feed</Text>
              <View style={styles.prefOptionsRow}>
                {['immediate', 'daily_digest', 'in_app_only'].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.prefOptionPill, prefCommunity === opt && styles.prefOptionPillActive]}
                    onPress={() => setPrefCommunity(opt)}>
                    <Text style={[styles.prefOptionText, prefCommunity === opt && styles.prefOptionTextActive]}>
                      {opt === 'immediate' ? 'Immediate' : opt === 'daily_digest' ? 'Daily Digest' : 'In-App Only'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {isAdmin && (
              <View style={styles.prefCard}>
                <Text style={styles.prefLabel}>Admin Activity Alerts</Text>
                <Text style={styles.prefHelp}>Access requests, onboarding, inquiries, reports</Text>
                <View style={styles.prefOptionsRow}>
                  {['immediate', 'daily_digest', 'in_app_only'].map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.prefOptionPill, prefAdmin === opt && styles.prefOptionPillActive]}
                      onPress={() => setPrefAdmin(opt)}>
                      <Text style={[styles.prefOptionText, prefAdmin === opt && styles.prefOptionTextActive]}>
                        {opt === 'immediate' ? 'Immediate' : opt === 'daily_digest' ? 'Daily Digest' : 'In-App Only'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={savePreferences}>
              <Text style={styles.saveBtnText}>Save Preferences</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : activeConvoId && activePartner ? (
          /* ACTIVE 1:1 CHAT VIEW */
          <View style={styles.chatContainer}>
            <View style={styles.chatTopBar}>
              <TouchableOpacity style={styles.chatBackBtn} onPress={() => setActiveConvoId(null)}>
                <Ionicons name="arrow-back" size={22} color="#ffffff" />
              </TouchableOpacity>
              <Image
                source={{ uri: resolveImageUrl(activePartner.avatar_url) }}
                style={styles.chatAvatar}
              />
              <View style={styles.chatPartnerInfo}>
                <Text style={styles.chatPartnerName}>{activePartner.full_name}</Text>
                <Text style={styles.chatPartnerHeadline} numberOfLines={1}>
                  {activePartner.role === 'FOUNDER' || activePartner.role === 'ADMIN' ? 'Club Leadership' : 'Mutual Connection'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.chatActionBtn}
                onPress={() => handleReportOrBlock(activePartner.id, activePartner.full_name)}>
                <Ionicons name="ellipsis-vertical" size={20} color={OzaraTheme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingChat ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={OzaraTheme.colors.accentCyan} />
              </View>
            ) : (
              <ScrollView style={styles.messagesScroll} contentContainerStyle={{ padding: 14 }}>
                <View style={styles.privacyBanner}>
                  <Text style={styles.privacyText}>
                    🔒 Confidential 1:1 communication between verified members. Messages are never shared or published.
                  </Text>
                </View>

                {chatMessages.length === 0 ? (
                  <View style={styles.emptyChatBox}>
                    <Text style={styles.emptyChatTitle}>No messages yet</Text>
                    <Text style={styles.emptyChatSub}>Send a confidential message to start the conversation.</Text>
                  </View>
                ) : (
                  chatMessages.map(m => {
                    const isSent = m.sender_id === viewerId;
                    return (
                      <View
                        key={m.id}
                        style={[styles.messageBubbleRow, isSent ? styles.bubbleRowSent : styles.bubbleRowReceived]}>
                        <View style={[styles.messageBubble, isSent ? styles.bubbleSent : styles.bubbleReceived]}>
                          <Text style={[styles.bubbleText, isSent && styles.bubbleTextSent]}>{m.content}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}

            {/* Input Bar */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatTextInput}
                placeholder="Write a message…"
                placeholderTextColor={OzaraTheme.colors.textMuted}
                value={messageInput}
                onChangeText={setMessageInput}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, !messageInput.trim() && styles.sendBtnDisabled]}
                onPress={handleSendMessage}
                disabled={!messageInput.trim() || sendingMsg}>
                <Ionicons name="send" size={17} color="#000000" />
              </TouchableOpacity>
            </View>
          </View>
        ) : activeTab === 'messages' ? (
          /* CONVERSATIONS LIST */
          <View style={styles.body}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={OzaraTheme.colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search conversations…"
                placeholderTextColor={OzaraTheme.colors.textMuted}
                value={searchConvos}
                onChangeText={setSearchConvos}
              />
            </View>

            <ScrollView style={styles.scrollArea}>
              {conversations.length === 0 ? (
                <View style={styles.centerBox}>
                  <Ionicons name="chatbubbles-outline" size={38} color={OzaraTheme.colors.textDim} />
                  <Text style={styles.emptyTitle}>No conversations yet</Text>
                  <Text style={styles.emptySub}>
                    Direct messaging is restricted to mutually accepted connections. Connect with peers in the Network tab to chat.
                  </Text>
                </View>
              ) : (
                conversations
                  .filter(c => {
                    if (!searchConvos.trim()) return true;
                    const q = searchConvos.toLowerCase();
                    return (
                      c.other_participant?.full_name?.toLowerCase().includes(q) ||
                      c.last_message_snippet?.toLowerCase().includes(q)
                    );
                  })
                  .map(c => {
                    const p = c.other_participant || {};
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.convoItem}
                        onPress={() => openConversationThread(c.id, p)}>
                        <Image
                          source={{ uri: resolveImageUrl(p.avatar_url) }}
                          style={styles.convoAvatar}
                        />
                        <View style={styles.convoDetails}>
                          <View style={styles.convoTopLine}>
                            <Text style={styles.convoName}>{p.full_name || 'Member'}</Text>
                            <Text style={styles.convoTime}>
                              {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                            </Text>
                          </View>
                          <View style={styles.convoBottomLine}>
                            <Text style={styles.convoSnippet} numberOfLines={1}>
                              {c.last_message_snippet || 'No messages'}
                            </Text>
                            {c.unread_count > 0 && (
                              <View style={styles.unreadPill}>
                                <Text style={styles.unreadPillText}>{c.unread_count}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
              )}
            </ScrollView>
          </View>
        ) : activeTab === 'notifications' ? (
          /* NOTIFICATIONS LIST */
          <View style={styles.body}>
            <View style={styles.notifFilterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['all', 'connection', 'event', 'community', 'system'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.filterPill, notifCategory === cat && styles.filterPillActive]}
                    onPress={() => {
                      setNotifCategory(cat);
                    }}>
                    <Text style={[styles.filterPillText, notifCategory === cat && styles.filterPillTextActive]}>
                      {cat === 'all' ? 'All' : cat === 'connection' ? 'Connections' : cat === 'event' ? 'Events' : cat === 'community' ? 'Community' : 'System'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity onPress={handleMarkAllNotifsRead} style={styles.markAllBtn}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollArea}>
              {loadingNotifs ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator color={OzaraTheme.colors.accentCyan} />
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.centerBox}>
                  <Ionicons name="notifications-off-outline" size={38} color={OzaraTheme.colors.textDim} />
                  <Text style={styles.emptyTitle}>No notifications</Text>
                  <Text style={styles.emptySub}>You are completely up to date.</Text>
                </View>
              ) : (
                notifications.map(n => {
                  const isUnread = !n.is_read;
                  const isConn = n.type === 'connection_request';
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.notifCard, isUnread && styles.notifCardUnread]}
                      onPress={() => {
                        handleMarkNotifRead(n.id);
                        if (n.type === 'direct_message' && n.metadata?.conversation_id) {
                          setActiveTab('messages');
                        } else if (n.action_url?.startsWith('#event-') && onOpenEvent) {
                          onClose();
                          onOpenEvent(n.action_url.replace('#event-', ''));
                        } else if (n.action_url?.startsWith('#profile-') && onOpenProfile) {
                          onClose();
                          onOpenProfile(n.action_url.replace('#profile-', ''));
                        }
                      }}>
                      <View style={styles.notifIconCircle}>
                        <Ionicons
                          name={
                            n.category === 'connection'
                              ? 'people'
                              : n.category === 'event'
                              ? 'calendar'
                              : n.category === 'community'
                              ? 'chatbubble'
                              : 'mail'
                          }
                          size={16}
                          color={OzaraTheme.colors.accentCyan}
                        />
                      </View>
                      <View style={styles.notifContent}>
                        <View style={styles.notifHeaderRow}>
                          <Text style={styles.notifTitle}>{n.title}</Text>
                          <Text style={styles.notifDate}>
                            {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                        <Text style={styles.notifMessage}>{n.message}</Text>

                        {isConn && !n.is_read && (
                          <View style={styles.connActionsRow}>
                            <TouchableOpacity
                              style={styles.connAcceptBtn}
                              onPress={() => handleAcceptConnection(n)}>
                              <Text style={styles.connAcceptText}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.connDeclineBtn}
                              onPress={() => handleDeclineConnection(n)}>
                              <Text style={styles.connDeclineText}>Decline</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        ) : (
          /* ADMIN ACTIVITY FEED */
          <View style={styles.body}>
            <View style={styles.notifFilterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['all', 'access_request', 'onboarding', 'connection', 'community', 'rsvp', 'inquiry', 'report'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.filterPill, activityCategory === cat && styles.filterPillActive]}
                    onPress={() => setActivityCategory(cat)}>
                    <Text style={[styles.filterPillText, activityCategory === cat && styles.filterPillTextActive]}>
                      {cat.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={styles.scrollArea}>
              {loadingActivities ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator color={OzaraTheme.colors.accentCyan} />
                </View>
              ) : activities.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={styles.emptyTitle}>No operational activity recorded</Text>
                </View>
              ) : (
                activities.map(act => (
                  <View key={act.id} style={styles.activityCard}>
                    <View style={styles.activityBadge}>
                      <Text style={styles.activityBadgeText}>{act.category}</Text>
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityText}>
                        <Text style={styles.activityBold}>{act.actor_name || 'System'}</Text>: {act.action_type}
                        {act.target_name ? ` → ${act.target_name}` : ''}
                      </Text>
                      <Text style={styles.activityTime}>
                        {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(act.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    backgroundColor: '#0a0b0e',
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    padding: 6,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#121318',
    borderRadius: OzaraTheme.radius.full,
    padding: 3,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: OzaraTheme.radius.full,
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: '#22242d',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: OzaraTheme.colors.textMuted,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  tabBadge: {
    backgroundColor: '#ff3366',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  body: {
    flex: 1,
    backgroundColor: '#000000',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1015',
    margin: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: OzaraTheme.radius.full,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 14,
  },
  convoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  convoAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  convoDetails: {
    flex: 1,
  },
  convoTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  convoName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  convoTime: {
    fontSize: 11,
    color: OzaraTheme.colors.textDim,
  },
  convoBottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convoSnippet: {
    fontSize: 12.5,
    color: OzaraTheme.colors.textSecondary,
    flex: 1,
  },
  unreadPill: {
    backgroundColor: OzaraTheme.colors.accentCyan,
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  unreadPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#0a0b0e',
  },
  chatTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
    backgroundColor: '#0f1015',
    gap: 10,
  },
  chatBackBtn: {
    padding: 4,
  },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  chatPartnerInfo: {
    flex: 1,
  },
  chatPartnerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  chatPartnerHeadline: {
    fontSize: 11,
    color: OzaraTheme.colors.accentCyan,
  },
  chatActionBtn: {
    padding: 6,
  },
  messagesScroll: {
    flex: 1,
  },
  privacyBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  privacyText: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
  emptyChatBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyChatTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyChatSub: {
    color: OzaraTheme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  messageBubbleRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bubbleRowSent: {
    justifyContent: 'flex-end',
  },
  bubbleRowReceived: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 15,
  },
  bubbleSent: {
    backgroundColor: '#0284c7',
    borderBottomRightRadius: 3,
  },
  bubbleReceived: {
    backgroundColor: '#191b22',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    borderBottomLeftRadius: 3,
  },
  bubbleText: {
    fontSize: 13.5,
    color: '#ffffff',
    lineHeight: 18,
  },
  bubbleTextSent: {
    color: '#ffffff',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: OzaraTheme.colors.borderSubtle,
    backgroundColor: '#0f1015',
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#161820',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 90,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  notifFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: OzaraTheme.radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: '#20222a',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterPillText: {
    fontSize: 11.5,
    color: OzaraTheme.colors.textMuted,
    textTransform: 'capitalize',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  markAllBtn: {
    paddingLeft: 8,
  },
  markAllText: {
    fontSize: 11,
    color: OzaraTheme.colors.accentCyan,
  },
  notifCard: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  notifCardUnread: {
    backgroundColor: 'rgba(56, 189, 248, 0.03)',
  },
  notifIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161820',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  notifContent: {
    flex: 1,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  notifDate: {
    fontSize: 10.5,
    color: OzaraTheme.colors.textDim,
  },
  notifMessage: {
    fontSize: 12,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 16,
  },
  connActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  connAcceptBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: OzaraTheme.radius.full,
  },
  connAcceptText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  connDeclineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: OzaraTheme.radius.full,
  },
  connDeclineText: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
  },
  activityCard: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'flex-start',
    gap: 10,
  },
  activityBadge: {
    backgroundColor: '#20222a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activityBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: OzaraTheme.colors.accentCyan,
    textTransform: 'uppercase',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 12,
    color: '#ffffff',
    lineHeight: 16,
  },
  activityBold: {
    fontWeight: '700',
  },
  activityTime: {
    fontSize: 10,
    color: OzaraTheme.colors.textDim,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
    marginBottom: 16,
    lineHeight: 16,
  },
  linkText: {
    fontSize: 13,
    color: OzaraTheme.colors.accentCyan,
    fontWeight: '600',
  },
  prefCard: {
    backgroundColor: '#0f1015',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  prefLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  prefHelp: {
    fontSize: 11.5,
    color: OzaraTheme.colors.textMuted,
    marginBottom: 10,
  },
  prefFixedBadge: {
    fontSize: 11,
    color: OzaraTheme.colors.accentCyan,
    fontWeight: '600',
  },
  prefOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  prefOptionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: OzaraTheme.radius.full,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    backgroundColor: '#161820',
  },
  prefOptionPillActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  prefOptionText: {
    fontSize: 11,
    color: OzaraTheme.colors.textSecondary,
    fontWeight: '500',
  },
  prefOptionTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#ffffff',
    borderRadius: OzaraTheme.radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
});
