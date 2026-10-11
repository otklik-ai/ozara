/**
 * ÖZARA Mobile: Notifications Modal
 * In-app notifications panel displaying event invitations, announcements, and direct RSVP response actions.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OzaraTheme } from '../constants/ozara-theme';
import { ApiService, InAppNotification } from '../services/api';
import { useClub } from '../context/ClubContext';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenEvent?: (eventId: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  onOpenEvent,
}) => {
  const { currentUserId, currentUser } = useClub();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [processingNotifId, setProcessingNotifId] = useState<string | null>(null);

  const viewerId = currentUserId || currentUser?.id;

  const loadNotifications = async () => {
    if (!viewerId) return;
    try {
      setLoading(true);
      const res = await ApiService.getNotifications(viewerId);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch (err) {
      console.warn('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible, viewerId]);

  if (!visible) return null;

  const handleMarkRead = async (notifId: string) => {
    try {
      await ApiService.markNotificationRead(notifId);
      setNotifications(prev =>
        prev.map(n => (n.id === notifId ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Mark read error:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!viewerId) return;
    try {
      await ApiService.markAllNotificationsRead(viewerId);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Mark all read error:', err);
    }
  };

  const handleRsvpFromNotification = async (notif: InAppNotification, status: 'registered' | 'declined') => {
    if (!notif.event_id || !viewerId) return;
    try {
      setProcessingNotifId(notif.id);
      await ApiService.rsvpEvent(notif.event_id, viewerId, status === 'registered' ? 'registered' : 'cancelled');
      await handleMarkRead(notif.id);
      loadNotifications();

      const msg = status === 'registered' ? 'RSVP Confirmed! You are registered for this gathering.' : 'RSVP Declined.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('RSVP Updated', msg);
    } catch (err: any) {
      Alert.alert('RSVP Error', err.message || 'Could not update RSVP');
    } finally {
      setProcessingNotifId(null);
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="notifications" size={18} color="#38bdf8" />
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadPillText}>{unreadCount} new</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.75}>
                <Text style={styles.markAllReadText}>Mark all read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications List */}
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {loading && notifications.length === 0 ? (
            <ActivityIndicator size="large" color="#38bdf8" style={{ marginVertical: 30 }} />
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={36} color="#64748b" />
              <Text style={styles.emptyTitle}>All Caught Up</Text>
              <Text style={styles.emptySub}>You have no pending notifications or event invitations.</Text>
            </View>
          ) : (
            notifications.map((notif) => {
              const isUnread = notif.is_read === 0 || notif.is_read === false;
              const isEventInvite = notif.type === 'event_invitation' && notif.event_id;
              const isProcessing = processingNotifId === notif.id;

              return (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.notifCard, isUnread && styles.notifCardUnread]}
                  onPress={() => {
                    if (isUnread) handleMarkRead(notif.id);
                    if (isEventInvite && onOpenEvent) {
                      onClose();
                      onOpenEvent(notif.event_id!);
                    }
                  }}
                  activeOpacity={0.85}>
                  <View style={styles.notifTop}>
                    <View style={styles.notifIconWrap}>
                      <Ionicons
                        name={isEventInvite ? 'calendar' : 'information-circle'}
                        size={16}
                        color={isEventInvite ? '#a855f7' : '#38bdf8'}
                      />
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                      <Text style={styles.notifTitle}>{notif.title}</Text>
                      <Text style={styles.notifMessage}>{notif.message}</Text>
                      <Text style={styles.notifTime}>
                        {new Date(notif.created_at).toLocaleDateString()} at{' '}
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {isUnread && <View style={styles.unreadDot} />}
                  </View>

                  {/* Direct RSVP Actions for Event Invitations */}
                  {isEventInvite && (
                    <View style={styles.eventActionRow}>
                      <TouchableOpacity
                        style={styles.openEventBtn}
                        onPress={() => {
                          if (isUnread) handleMarkRead(notif.id);
                          onClose();
                          if (onOpenEvent) onOpenEvent(notif.event_id!);
                        }}
                        activeOpacity={0.8}>
                        <Ionicons name="eye-outline" size={13} color="#38bdf8" style={{ marginRight: 4 }} />
                        <Text style={styles.openEventBtnText}>View Event</Text>
                      </TouchableOpacity>

                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={[styles.rsvpAcceptBtn, isProcessing && { opacity: 0.6 }]}
                          onPress={() => handleRsvpFromNotification(notif, 'registered')}
                          disabled={isProcessing}
                          activeOpacity={0.85}>
                          <Ionicons name="checkmark-circle-outline" size={13} color="#000000" style={{ marginRight: 3 }} />
                          <Text style={styles.rsvpAcceptBtnText}>Accept</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.rsvpDeclineBtn, isProcessing && { opacity: 0.6 }]}
                          onPress={() => handleRsvpFromNotification(notif, 'declined')}
                          disabled={isProcessing}
                          activeOpacity={0.85}>
                          <Text style={styles.rsvpDeclineBtnText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 150,
    padding: 14,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#0c101d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0f172a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  unreadPill: {
    backgroundColor: '#7C3AED',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  unreadPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  markAllReadText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 10,
  },
  notifCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  notifCardUnread: {
    borderColor: 'rgba(124, 58, 237, 0.4)',
    backgroundColor: '#111827',
  },
  notifTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notifIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  notifMessage: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 17,
  },
  notifTime: {
    color: '#64748b',
    fontSize: 10.5,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
    marginTop: 4,
  },
  eventActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  openEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  openEventBtnText: {
    color: '#38bdf8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  rsvpAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  rsvpAcceptBtnText: {
    color: '#000000',
    fontSize: 11.5,
    fontWeight: '800',
  },
  rsvpDeclineBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  rsvpDeclineBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
});
