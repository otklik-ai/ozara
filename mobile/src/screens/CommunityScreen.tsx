/**
 * ÖZARA Mobile: Dedicated Community Wall Screen
 * First top-level tab for member-to-member communication, questions, introductions,
 * and synchronized ÖZARA Telegram broadcasts.
 * 
 * Features:
 * - Direct global peer exchange (members see all posts even if not connected)
 * - Compact Composer with topic pills & content guardrails
 * - Segmented filters: All · From ÖZARA · From Members
 * - Swipeable photo carousel with Left/Right arrows for multi-photo albums
 * - Inline comments thread with reply input
 * - Profile drawer linking on author taps
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClub } from '../context/ClubContext';
import {
  ApiService,
  CommunityPost,
  CommunityComment,
  CommunityTopic,
} from '../services/api';
import { OzaraTheme } from '../constants/ozara-theme';

const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

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
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export const CommunityScreen: React.FC = () => {
  const { currentUserId, currentUser, openProfile } = useClub();

  // Posts Feed State (Mutual Wall)
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Composer State
  const [composerText, setComposerText] = useState<string>('');
  const [attachments, setAttachments] = useState<Array<{ media_type: string; url: string; caption?: string }>>([]);
  const [submittingPost, setSubmittingPost] = useState<boolean>(false);

  // Carousel Photo Index per Post
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({});

  // Comments Thread State
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);

  // Edit Post State
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false);

  const resolveImageUrl = (url?: string | null) => {
    if (!url) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // -------------------------------------------------------------
  // DATA FETCHING (MUTUAL WALL)
  // -------------------------------------------------------------
  const loadPosts = useCallback(async (isPullRefresh: boolean = false) => {
    if (!currentUserId) return;
    try {
      if (!isPullRefresh) setLoading(true);
      const res = await ApiService.getCommunityPosts(currentUserId);
      setPosts(res || []);
    } catch (err) {
      console.warn('Error loading community posts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts(true);
  };

  // -------------------------------------------------------------
  // CAROUSEL HANDLERS
  // -------------------------------------------------------------
  const handlePhotoPrev = (postId: string, count: number) => {
    setCarouselIndices(prev => {
      const cur = prev[postId] || 0;
      return { ...prev, [postId]: (cur - 1 + count) % count };
    });
  };

  const handlePhotoNext = (postId: string, count: number) => {
    setCarouselIndices(prev => {
      const cur = prev[postId] || 0;
      return { ...prev, [postId]: (cur + 1) % count };
    });
  };

  // -------------------------------------------------------------
  // POST ACTIONS: CREATE / EDIT / DELETE
  // -------------------------------------------------------------
  const handleAddSampleMedia = (type: 'photo' | 'video' | 'file') => {
    if (type === 'photo') {
      const samplePhotos = [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      ];
      const photoUrl = samplePhotos[attachments.length % samplePhotos.length];
      setAttachments(prev => [...prev, { media_type: 'photo', url: photoUrl, caption: 'Photo attachment' }]);
    } else if (type === 'video') {
      setAttachments(prev => [...prev, { media_type: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4', caption: 'Video attachment' }]);
    } else if (type === 'file') {
      setAttachments(prev => [...prev, { media_type: 'file', url: '/sample-document.pdf', caption: 'Executive_Brief.pdf' }]);
    }
  };

  const handleAddLinkPrompt = () => {
    if (Platform.OS === 'web') {
      const url = window.prompt('Enter link URL (https://...):');
      if (url && url.trim()) {
        const fullUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
        setAttachments(prev => [...prev, { media_type: 'link', url: fullUrl, caption: fullUrl }]);
      }
    } else {
      Alert.prompt
        ? Alert.prompt('Add Link', 'Enter URL (https://...):', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add',
              onPress: (url?: string) => {
                if (url && url.trim()) {
                  const fullUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
                  setAttachments(prev => [...prev, { media_type: 'link', url: fullUrl, caption: fullUrl }]);
                }
              },
            },
          ])
        : setAttachments(prev => [...prev, { media_type: 'link', url: 'https://ozara.club', caption: 'https://ozara.club' }]);
    }
  };

  const handleCreatePost = async () => {
    if (!currentUserId) return;
    if (!composerText.trim() && attachments.length === 0) return;

    // Broker-dealer content guardrail check
    const prohibitedRegex = /\b(\$\d+|\€\d+|\£\d+|raising|pre-money|ticket|IRR|valuation|minimum investment)\b/i;
    if (prohibitedRegex.test(composerText)) {
      Alert.alert(
        'Compliance Notice',
        'Posts describe what members do and what is useful. Please omit specific fundraising terms, check sizes, valuations, or projected returns.'
      );
      return;
    }

    try {
      setSubmittingPost(true);
      const res = await ApiService.createCommunityPost({
        author_id: currentUserId,
        content: composerText.trim() || 'Shared an attachment',
        attachments: attachments,
      });
      setPosts(prev => [res, ...prev]);
      setComposerText('');
      setAttachments([]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not publish post.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to remove this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await ApiService.deleteCommunityPost(postId, currentUserId);
            setPosts(prev => prev.filter(p => p.id !== postId));
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Could not delete post.');
          }
        },
      },
    ]);
  };

  const handleStartEdit = (post: CommunityPost) => {
    setEditingPost(post);
    setEditText(post.content);
  };

  const handleSaveEdit = async () => {
    if (!editingPost || !editText.trim()) return;
    try {
      setSubmittingEdit(true);
      const res = await ApiService.updateCommunityPost(editingPost.id, {
        editor_id: currentUserId,
        content: editText.trim(),
      });
      if (res.success) {
        setPosts(prev =>
          prev.map(p =>
            p.id === editingPost.id
              ? { ...p, content: res.content, updated_at: res.updated_at }
              : p
          )
        );
        setEditingPost(null);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update post.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // -------------------------------------------------------------
  // COMMENTS HANDLERS
  // -------------------------------------------------------------
  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleSubmitComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!currentUserId || !text) return;
    try {
      setSubmittingCommentId(postId);
      const newComment = await ApiService.createCommunityComment(postId, {
        author_id: currentUserId,
        content: text,
      });
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? {
                ...p,
                comments_count: (p.comments_count || 0) + 1,
                comments: [...(p.comments || []), newComment],
              }
            : p
        )
      );
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not add comment.');
    } finally {
      setSubmittingCommentId(null);
    }
  };

  const handleDeleteComment = (postId: string, commentId: string) => {
    Alert.alert('Delete Comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await ApiService.deleteCommunityComment(commentId, currentUserId);
            setPosts(prev =>
              prev.map(p =>
                p.id === postId
                  ? {
                      ...p,
                      comments_count: Math.max(0, (p.comments_count || 1) - 1),
                      comments: (p.comments || []).filter(c => c.id !== commentId),
                    }
                  : p
              )
            );
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Could not delete comment.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={OzaraTheme.colors.accentCyan}
          colors={[OzaraTheme.colors.accentCyan]}
        />
      }>
      {/* SCREEN BANNER */}
      <View style={styles.topBanner}>
        <View style={styles.bannerRow}>
          <Text style={styles.bannerTitle}>ÖZARA Community</Text>
        </View>
        <Text style={styles.bannerSubtext}>
          Global member exchange, requests for introductions, questions, and curated club intelligence.
        </Text>
      </View>

      {/* COMPACT COMPOSER CARD */}
      <View style={styles.composerCard}>
        <View style={styles.composerHeaderRow}>
          <Image
            source={{ uri: resolveImageUrl(currentUser?.avatar_url) }}
            style={styles.composerAvatar}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.composerAuthorName}>
              {currentUser?.full_name || 'ÖZARA Member'}
            </Text>
            <Text style={styles.composerAuthorRole} numberOfLines={1}>
              {currentUser?.headline || 'Share an insight or question with the community'}
            </Text>
          </View>
        </View>

        <TextInput
          style={styles.composerInput}
          placeholder="Share an insight, question, or request introductions with the community…"
          placeholderTextColor="#64748b"
          multiline
          value={composerText}
          onChangeText={setComposerText}
        />

        {/* Attached Media Previews */}
        {attachments.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsPreviewScroll}>
            {attachments.map((att, idx) => (
              <View key={idx} style={styles.attachmentChip}>
                {att.media_type === 'photo' ? (
                  <Image source={{ uri: resolveImageUrl(att.url) }} style={styles.attachmentThumb} />
                ) : (
                  <Ionicons
                    name={att.media_type === 'video' ? 'videocam' : att.media_type === 'link' ? 'link' : 'document-text'}
                    size={15}
                    color="#38bdf8"
                  />
                )}
                <Text style={styles.attachmentChipText} numberOfLines={1}>
                  {att.caption || att.url}
                </Text>
                <TouchableOpacity
                  onPress={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Attachment Options Toolbar & Submit Row */}
        <View style={styles.composerAttachRow}>
          <View style={styles.attachBtnGroup}>
            <TouchableOpacity
              style={styles.attachOptionBtn}
              onPress={() => handleAddSampleMedia('photo')}
              activeOpacity={0.75}>
              <Ionicons name="image-outline" size={15} color="#94a3b8" />
              <Text style={styles.attachOptionText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachOptionBtn}
              onPress={() => handleAddSampleMedia('video')}
              activeOpacity={0.75}>
              <Ionicons name="videocam-outline" size={15} color="#94a3b8" />
              <Text style={styles.attachOptionText}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachOptionBtn}
              onPress={() => handleAddSampleMedia('file')}
              activeOpacity={0.75}>
              <Ionicons name="document-text-outline" size={15} color="#94a3b8" />
              <Text style={styles.attachOptionText}>File</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachOptionBtn}
              onPress={handleAddLinkPrompt}
              activeOpacity={0.75}>
              <Ionicons name="link-outline" size={15} color="#94a3b8" />
              <Text style={styles.attachOptionText}>Link</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.composerSubmitBtn,
              (!composerText.trim() && attachments.length === 0 || submittingPost) && styles.composerSubmitBtnDisabled,
            ]}
            onPress={handleCreatePost}
            disabled={(!composerText.trim() && attachments.length === 0) || submittingPost}
            activeOpacity={0.8}>
            {submittingPost ? (
              <ActivityIndicator size="small" color="#030712" />
            ) : (
              <Text style={styles.composerSubmitBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.complianceNote, { marginTop: 8 }]} numberOfLines={1}>
          ⚖️ No fundraising figures, valuations, or check sizes
        </Text>
      </View>

      {/* POSTS LIST FEED */}
      {loading && posts.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={OzaraTheme.colors.accentCyan} />
          <Text style={styles.loadingText}>Loading community feed…</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="chatbubbles-outline" size={36} color="#64748b" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No updates yet in this section</Text>
          <Text style={styles.emptySubtext}>
            Be the first to share an insight, ask a strategic question, or request a warm introduction.
          </Text>
        </View>
      ) : (
        <View style={styles.postsList}>
          {posts.map(post => {
            const isOfficial = post.source_type === 'telegram' || post.is_official;
            const isAuthor = post.author_id === currentUserId;
            const isAdmin = currentUser?.role === 'FOUNDER' || currentUser?.role === 'ADMIN';
            const isExpanded = !!expandedComments[post.id];
            const commentInput = commentInputs[post.id] || '';
            const isSubmittingComment = submittingCommentId === post.id;
            const attachments = post.media_attachments || [];
            const photoAttachments = attachments.filter((a: any) => a.media_type === 'photo' || !a.media_type);
            const otherAttachments = attachments.filter((a: any) => a.media_type && a.media_type !== 'photo');
            const curPhotoIdx = carouselIndices[post.id] || 0;
            const currentPhoto = photoAttachments[curPhotoIdx] || photoAttachments[0];

            return (
              <View key={post.id} style={[styles.postCard, isOfficial && styles.officialPostCard]}>
                {/* Post Header */}
                <View style={styles.postHeaderRow}>
                  <TouchableOpacity
                    onPress={() => {
                      if (!isOfficial && post.author_id) {
                        openProfile(post.author_id);
                      }
                    }}
                    activeOpacity={0.85}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Image
                      source={{ uri: resolveImageUrl(post.author.avatar_url) }}
                      style={[styles.postAvatar, isOfficial && styles.officialAvatar]}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Text style={styles.postAuthorName}>{post.author.full_name}</Text>
                        {isOfficial && (
                          <View style={styles.officialPill}>
                            <Text style={styles.officialPillText}>From ÖZARA</Text>
                          </View>
                        )}
                        <Text style={styles.postTimeDot}>·</Text>
                        <Text style={styles.postTimestamp}>{formatRelativeTime(post.created_at)}</Text>
                      </View>
                      <Text style={styles.postAuthorHeadline} numberOfLines={1}>
                        {post.author.headline}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Actions for Author or Admin */}
                  {(isAuthor || isAdmin) && !isOfficial && (
                    <View style={styles.postActionButtons}>
                      {isAuthor && (
                        <TouchableOpacity
                          style={styles.postIconButton}
                          onPress={() => handleStartEdit(post)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="pencil-outline" size={15} color="#94a3b8" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.postIconButton}
                        onPress={() => handleDeletePost(post.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={15} color="#f87171" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Post Content */}
                <Text style={styles.postBodyText}>{post.content}</Text>

                {/* PHOTO CAROUSEL FOR MULTI-PHOTO POSTS */}
                {photoAttachments.length > 0 && currentPhoto && (
                  <View style={styles.mediaCarouselWrap}>
                    <Image
                      source={{ uri: resolveImageUrl(currentPhoto.url) }}
                      style={styles.carouselImage}
                      resizeMode="contain"
                    />

                    {/* Overlay Arrows */}
                    {photoAttachments.length > 1 && (
                      <>
                        <TouchableOpacity
                          style={[styles.carouselBtn, styles.carouselPrevBtn]}
                          onPress={() => handlePhotoPrev(post.id, photoAttachments.length)}
                          activeOpacity={0.75}>
                          <Ionicons name="chevron-back" size={16} color="#ffffff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.carouselBtn, styles.carouselNextBtn]}
                          onPress={() => handlePhotoNext(post.id, photoAttachments.length)}
                          activeOpacity={0.75}>
                          <Ionicons name="chevron-forward" size={16} color="#ffffff" />
                        </TouchableOpacity>

                        {/* Photo Counter Pill */}
                        <View style={styles.carouselCounterPill}>
                          <Ionicons name="camera-outline" size={11} color="#ffffff" />
                          <Text style={styles.carouselCounterText}>
                            {curPhotoIdx + 1} / {photoAttachments.length}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {/* FILE, VIDEO & LINK ATTACHMENTS */}
                {otherAttachments.length > 0 && (
                  <View style={styles.otherAttachmentsWrap}>
                    {otherAttachments.map((att: any, aIdx: number) => (
                      <View key={aIdx} style={styles.postAttachmentPill}>
                        <Ionicons
                          name={att.media_type === 'video' ? 'videocam' : att.media_type === 'link' ? 'link' : 'document-text'}
                          size={14}
                          color="#38bdf8"
                        />
                        <Text style={styles.postAttachmentPillText} numberOfLines={1}>
                          {att.caption || att.url}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Post Footer & Comments Toggle */}
                <View style={styles.postFooterRow}>
                  <TouchableOpacity
                    style={styles.commentsToggleBtn}
                    onPress={() => toggleComments(post.id)}
                    activeOpacity={0.75}>
                    <Ionicons name="chatbubble-outline" size={13} color="#94a3b8" style={{ marginRight: 6 }} />
                    <Text style={styles.commentsToggleText}>
                      {post.comments_count === 1 ? '1 comment' : `${post.comments_count} comments`}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color="#64748b"
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>

                  {/* Connect / Intro shortcut for non-authors */}
                  {!isAuthor && !isOfficial && (
                    <TouchableOpacity
                      style={styles.introShortcutBtn}
                      onPress={() => openProfile(post.author_id)}
                      activeOpacity={0.7}>
                      <Ionicons name="person-outline" size={12} color="#c5a059" style={{ marginRight: 4 }} />
                      <Text style={styles.introShortcutText}>View Profile</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Comments Thread */}
                {isExpanded && (
                  <View style={styles.commentsSection}>
                    {post.comments && post.comments.length > 0 ? (
                      post.comments.map(comment => {
                        const isCommentAuthor = comment.author_id === currentUserId;
                        return (
                          <View key={comment.id} style={styles.commentItem}>
                            <TouchableOpacity
                              onPress={() => openProfile(comment.author_id)}
                              activeOpacity={0.8}>
                              <Image
                                source={{ uri: resolveImageUrl(comment.author.avatar_url) }}
                                style={styles.commentAvatar}
                              />
                            </TouchableOpacity>
                            <View style={styles.commentBubble}>
                              <View style={styles.commentHeaderRow}>
                                <TouchableOpacity
                                  onPress={() => openProfile(comment.author_id)}
                                  activeOpacity={0.8}>
                                  <Text style={styles.commentAuthorName}>{comment.author.full_name}</Text>
                                </TouchableOpacity>
                                <Text style={styles.commentTimestamp}>
                                  {formatRelativeTime(comment.created_at)}
                                </Text>
                                {(isCommentAuthor || isAdmin) && (
                                  <TouchableOpacity
                                    style={{ marginLeft: 'auto', padding: 2 }}
                                    onPress={() => handleDeleteComment(post.id, comment.id)}>
                                    <Ionicons name="trash-outline" size={12} color="#f87171" />
                                  </TouchableOpacity>
                                )}
                              </View>
                              <Text style={styles.commentBody}>{comment.content}</Text>
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.noCommentsNotice}>
                        No comments yet. Start the conversation!
                      </Text>
                    )}

                    {/* Inline Comment Input Box */}
                    <View style={styles.commentInputRow}>
                      <TextInput
                        style={styles.commentTextInput}
                        placeholder="Write a comment or warm reply…"
                        placeholderTextColor="#64748b"
                        value={commentInput}
                        onChangeText={txt =>
                          setCommentInputs(prev => ({ ...prev, [post.id]: txt }))
                        }
                      />
                      <TouchableOpacity
                        style={[
                          styles.commentSendBtn,
                          (!commentInput.trim() || isSubmittingComment) &&
                            styles.commentSendBtnDisabled,
                        ]}
                        onPress={() => handleSubmitComment(post.id)}
                        disabled={!commentInput.trim() || isSubmittingComment}
                        activeOpacity={0.8}>
                        {isSubmittingComment ? (
                          <ActivityIndicator size="small" color="#030712" />
                        ) : (
                          <Ionicons name="arrow-up" size={14} color="#030712" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* EDIT MODAL / OVERLAY */}
      {editingPost && (
        <View style={styles.editOverlay}>
          <View style={styles.editCard}>
            <View style={styles.editHeaderRow}>
              <Text style={styles.editTitle}>Edit Post</Text>
              <TouchableOpacity onPress={() => setEditingPost(null)}>
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.editInput}
              multiline
              value={editText}
              onChangeText={setEditText}
            />

            <View style={styles.editFooterRow}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => setEditingPost(null)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, submittingEdit && { opacity: 0.5 }]}
                onPress={handleSaveEdit}
                disabled={submittingEdit}>
                {submittingEdit ? (
                  <ActivityIndicator size="small" color="#030712" />
                ) : (
                  <Text style={styles.editSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090e',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
  },
  topBanner: {
    marginBottom: 16,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(197, 160, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(197, 160, 89, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#c5a059',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dfc082',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bannerSubtext: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },

  /* Composer */
  composerCard: {
    backgroundColor: '#0d121c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  composerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  composerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e293b',
  },
  composerAuthorName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#ffffff',
  },
  composerAuthorRole: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  composerInput: {
    minHeight: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    color: '#f8fafc',
    fontSize: 13.5,
    lineHeight: 19,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },

  /* Composer Attachments */
  attachmentsPreviewScroll: {
    marginVertical: 10,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#141a26',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 8,
  },
  attachmentThumb: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  attachmentChipText: {
    fontSize: 11,
    color: '#e2e8f0',
    maxWidth: 120,
  },
  composerAttachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  attachBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  attachOptionText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  complianceNote: {
    fontSize: 10.5,
    color: '#64748b',
  },
  composerSubmitBtn: {
    backgroundColor: '#c5a059',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  composerSubmitBtnDisabled: {
    opacity: 0.35,
  },
  composerSubmitBtnText: {
    color: '#07090e',
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* Posts */
  postsList: {
    gap: 14,
  },
  postCard: {
    backgroundColor: '#0d121c',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  officialPostCard: {
    borderColor: 'rgba(197, 160, 89, 0.25)',
    backgroundColor: '#0f1522',
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
  officialAvatar: {
    borderWidth: 1.5,
    borderColor: '#c5a059',
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  officialPill: {
    backgroundColor: 'rgba(197, 160, 89, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  officialPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#dfc082',
    textTransform: 'uppercase',
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
  postBodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#e2e8f0',
    marginBottom: 10,
  },

  /* Carousel */
  mediaCarouselWrap: {
    position: 'relative',
    width: '100%',
    height: 380,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#06070a',
    marginBottom: 12,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },

  /* Other Attachments */
  otherAttachmentsWrap: {
    gap: 6,
    marginBottom: 10,
  },
  postAttachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  postAttachmentPillText: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '500',
    flex: 1,
  },
  carouselBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 14, 22, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  carouselPrevBtn: {
    left: 8,
  },
  carouselNextBtn: {
    right: 8,
  },
  carouselCounterPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 14, 22, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  carouselCounterText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#ffffff',
  },

  /* Footer */
  postFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  introShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(197, 160, 89, 0.08)',
  },
  introShortcutText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c5a059',
  },

  /* Comments */
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
    marginTop: 2,
  },
  commentBubble: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  commentAuthorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f8fafc',
  },
  commentTimestamp: {
    fontSize: 10.5,
    color: '#64748b',
    marginLeft: 6,
  },
  commentBody: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#cbd5e1',
  },
  noCommentsNotice: {
    fontSize: 11.5,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 4,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    color: '#ffffff',
    fontSize: 12.5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  commentSendBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#c5a059',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendBtnDisabled: {
    opacity: 0.35,
  },

  /* Empty & Loading */
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 8,
  },
  emptyBox: {
    paddingVertical: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Edit Modal */
  editOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 100,
  },
  editCard: {
    backgroundColor: '#0f1522',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  editHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  editInput: {
    minHeight: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    fontSize: 13.5,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  editFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  editCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  editCancelText: {
    fontSize: 12.5,
    color: '#94a3b8',
    fontWeight: '600',
  },
  editSaveBtn: {
    backgroundColor: '#c5a059',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editSaveText: {
    fontSize: 12.5,
    color: '#07090e',
    fontWeight: '700',
  },
});
