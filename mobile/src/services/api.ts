/**
 * ÖZARA Mobile API Service Layer
 * Connects to the Node.js / Express backend with full type safety
 */

import { Platform } from 'react-native';

// Dynamic base URL detection:
// When accessed from a physical phone on LAN (e.g. http://192.168.1.157:8081),
// Dynamic base URL detection:
// When accessed from Expo dev server on LAN (:8081), points to backend on :3000 of same host.
// When accessed on hosted staging or reverse-proxy, uses the current origin.
export const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    if (window.location.port === '8081') {
      return `${protocol}//${window.location.hostname}:3000`;
    }
    return window.location.origin;
  }
  return Platform.select({
    ios: 'http://localhost:3000',
    android: 'http://10.0.2.2:3000',
    default: 'http://localhost:3000',
  });
};

export const API_BASE_URL = getBaseUrl();

export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) {
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400';
  }
  if (url.startsWith('http')) {
    return url;
  }
  const base = getBaseUrl();
  if (url.startsWith('/')) {
    return `${base}${url}`;
  }
  return url;
}

export interface Persona {
  id: string;
  email: string;
  full_name: string;
  headline: string;
  avatar_url: string;
  role: 'FOUNDER' | 'ADMIN' | 'MEMBER';
  is_complete: number | boolean;
  contact_preference: string;
  chapter_name?: string;
  city?: string;
  country?: string;
  accepted_access_conditions_version?: string | null;
  accepted_access_conditions_at?: string | null;
}

export interface MemberDirectoryItem {
  id: string;
  member_id?: string;
  full_name: string;
  headline: string;
  avatar_url: string;
  city: string;
  country: string;
  state?: string;
  role: string;
  industry?: string;
  is_complete: boolean;
  is_test?: number;
  chapter_name?: string;
  chapter_id?: string;
  role_title?: string;
  company?: string;
  university?: string;
  relevant_tags?: string[];
  connection_status?: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined';
  connection_id?: string | null;
  contact_preference?: string;
  short_match_reason?: string;
}

export interface MembersResponse {
  members: MemberDirectoryItem[];
  total: number;
  has_more: boolean;
  limit: number;
  offset: number;
}

export interface PendingConnectionItem {
  connection_id: string;
  user_id: string;
  requester_id?: string;
  full_name: string;
  headline: string;
  role_title?: string;
  company?: string;
  avatar_url: string;
  city: string;
  country: string;
  note?: string;
  created_at: string;
}

export interface ContactMethodsResponse {
  success: boolean;
  target_id: string;
  full_name: string;
  contact_preference: string;
  methods: {
    whatsapp: string | null;
    email: string | null;
    zoom: {
      enabled: boolean;
      meeting_link: string | null;
      can_request_zoom_call: boolean;
    } | null;
  };
  allowed_list: string[];
}

export interface Recommendation {
  id: string;
  member_id?: string;
  full_name: string;
  headline: string;
  avatar_url: string;
  chapter_name?: string;
  city: string;
  country: string;
  contact_preference?: string;
  match_score?: number;
  match_rationale?: string;
  matched_tags?: Array<{ category: string; value: string }>;
  is_complete?: boolean;
  role_title?: string;
  company?: string;
  university?: string;
  industry?: string;
  relevant_tags?: string[];
  connection_status?: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined';
  connection_id?: string | null;
  short_match_reason?: string;
}

export interface QuestionDefinition {
  id: number;
  section?: string;
  prompt: string;
  type?: string;
  is_required: boolean;
  is_confidential: boolean;
  default_visibility: 'shared' | 'private';
  char_limit?: number;
  placeholder?: string;
  helper?: string;
}

export interface QuestionnaireAnswer {
  question_id: number;
  question_prompt: string;
  answer_state: 'answered' | 'unanswered' | 'deliberately_skipped';
  value: any;
  value_text: string;
  visibility: 'shared' | 'private';
  is_redacted?: boolean;
}

export interface UserProfile {
  id: string;
  full_name: string;
  headline: string;
  avatar_url: string;
  chapter_id: string;
  chapter_name?: string;
  city: string;
  country: string;
  contact_preference: string;
  role: string;
  is_complete: boolean;
  taxonomies: {
    roles: string[];
    industries: string[];
    expertise: string[];
    offers: string[];
    needs: string[];
    interests: string[];
    institutions: string[];
  };
  taxonomy_notes: Record<string, string>;
  answers: QuestionnaireAnswer[];
  travel_plans: Array<{
    id: string;
    city: string;
    country: string;
    start_date: string;
    end_date: string;
    notes?: string;
    visibility: string;
  }>;
  connection_status?: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined';
  connection_id?: string | null;
  zoom_link?: string | null;
  email?: string;
  phone?: string;
}

export type CommunityTopic = 'Question' | 'Introduction' | 'Expertise' | 'Opportunity';

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    headline: string;
    role: string;
  };
  content: string;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  author_id: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    headline: string;
    role: string;
  };
  topic: CommunityTopic | null;
  content: string;
  source_type?: 'member' | 'telegram';
  author_label?: string | null;
  is_official?: boolean;
  telegram_author_name?: string | null;
  media_attachments?: Array<{
    id: string;
    media_type: string;
    url: string;
    caption?: string | null;
    width?: number;
    height?: number;
  }>;
  created_at: string;
  updated_at: string;
  comments_count: number;
  comments: CommunityComment[];
}


export interface CityScreenData {
  city: string;
  chapter: {
    id: string;
    name: string;
    city: string;
    country: string;
    lead: {
      name: string;
      photo: string;
      bio: string;
      email: string;
    };
    gathering_place: {
      name: string;
      photo: string;
      description: string;
      action: string;
    };
  } | null;
  members_based_here: Array<{
    id: string;
    full_name: string;
    headline: string;
    avatar_url: string;
    city: string;
    country: string;
    industry: string;
    role: string;
    is_complete: boolean | number;
  }>;
  members_visiting_next_30_days: Array<{
    trip_id: string;
    city: string;
    start_date: string;
    end_date: string;
    notes: string | null;
    user_id: string;
    full_name: string;
    headline: string;
    avatar_url: string;
    home_city: string;
  }>;
  visiting_members?: any[];
  upcoming_events: Array<{
    id: string;
    title: string;
    description: string;
    location: string;
    start_time: string;
    end_time: string;
    event_type?: string;
    venue_name?: string;
    cover_image?: string;
    chapter_name?: string;
  }>;
}

export interface TravelPlan {
  id: string;
  user_id: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  visibility: 'shared' | 'chapter_only' | 'hidden';
  full_name?: string;
  avatar_url?: string;
  headline?: string;
}

export interface PulseData {
  q14_focus: string;
  last_completed_at: string | null;
  is_due: boolean;
}

export interface ClubEvent {
  id: string;
  title: string;
  headline?: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  start_date?: string | null;
  end_date?: string | null;
  date_precision?: 'exact' | 'month_only' | 'tba';
  display_date?: string;
  year?: number | null;
  month_name?: string | null;
  city?: string;
  region?: string;
  country?: string;
  venue?: string;
  capacity?: number | null;
  registered_count: number;
  available_spots?: number | null;
  registration_status?: 'open' | 'coming_soon' | 'full' | 'closed';
  user_rsvp: 'registered' | 'none';
  event_type?: string;
  venue_name?: string;
  hero_image?: string;
  cover_image?: string;
  price?: string;
  registration_link?: string;
  whats_included?: string | null;
  travel_info?: string;
  hosts?: string;
  agenda?: string | null;
  is_past?: boolean | number;
  is_next_upcoming?: boolean;
  host_members?: string;
  status?: string;
  chapter_id?: string;
  chapter_name?: string;
  is_priority_match?: boolean;
  priority_match_reason?: string;
  timezone?: string;
  meeting_link?: string | null;
  rsvp_deadline?: string | null;
  visibility?: 'all_members' | 'selected_invitees';
  total_invited?: number;
  is_published?: number | boolean;
  total_registered?: number;
  total_declined?: number;
  total_waitlisted?: number;
  attendees?: Array<{
    id: string;
    full_name: string;
    avatar_url: string;
    headline: string;
  }>;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  event_id?: string | null;
  event_title?: string | null;
  event_date?: string | null;
  event_location?: string | null;
  action_url?: string | null;
  delivery_channel: string;
  is_read: boolean | number;
  invitation_status?: string | null;
  created_at: string;
  category?: string;
  metadata?: Record<string, any>;
}

export interface InboxSummary {
  unread_messages: number;
  unread_notifications: number;
  total_unread: number;
  is_admin: boolean;
  unread_admin_activity: number;
}

export interface ConversationParticipant {
  id: string;
  full_name: string;
  avatar_url: string;
  headline?: string;
  role: string;
  city?: string;
  country?: string;
  chapter_name?: string;
}

export interface ConversationSummaryItem {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_message_snippet: string;
  unread_count: number;
  other_participant: ConversationParticipant;
}

export interface DirectMessageItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: number | boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export interface ConversationDetailResponse {
  conversation: {
    id: string;
    created_at: string;
    updated_at: string;
  };
  other_participant: ConversationParticipant;
  messages: DirectMessageItem[];
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  action_url?: string;
  delivery_channel: string;
  is_read: number | boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface NotificationPreferences {
  user_id: string;
  email_connection_requests: string;
  email_event_invitations: string;
  email_community_posts: string;
  email_announcements: string;
  email_admin_activity: string;
  updated_at: string;
}

export interface AdminActivityItem {
  id: string;
  category: string;
  actor_id: string;
  actor_name: string;
  action_type: string;
  target_id?: string;
  target_name?: string;
  metadata?: Record<string, any>;
  status?: string;
  created_at: string;
}

export interface AdminEventDetail {
  event: ClubEvent;
  attendees: Array<{
    id: number;
    user_id: string;
    status: string;
    created_at: string;
    full_name: string;
    email: string;
    headline: string;
    avatar_url: string;
    city: string;
    country: string;
  }>;
  invitees: Array<{
    id: number;
    user_id: string;
    status: string;
    sent_at: string;
    responded_at?: string | null;
    delivery_channel: string;
    full_name: string;
    email: string;
    headline: string;
    avatar_url: string;
    city: string;
    country: string;
  }>;
  stats: {
    capacity: number | null;
    registered: number;
    waitlisted: number;
    invited: number;
    declined: number;
    available_spots: number | null;
  };
}

export interface RecipientPreviewResponse {
  selection_option: string;
  total_found: number;
  recipient_count: number;
  uninvited_count: number;
  already_invited_count: number;
  message_preview: string;
  recipients: Array<{
    id: string;
    full_name: string;
    headline?: string;
    email: string;
    avatar_url?: string;
    city?: string;
    country?: string;
    chapter_name?: string;
    already_invited: boolean;
    rsvp_status: string;
  }>;
  event?: {
    id: string;
    title: string;
    location: string;
    display_date?: string;
  } | null;
}

export interface OpportunityEligibilityRequirements {
  requires_investor_status?: boolean;
  minimum_verification_tier?: string;
  restricted_jurisdictions?: string[];
  max_ticket_size?: number | null;
}

export interface RealEstateUnitItem {
  id: string;
  parent_project_id: number;
  parent_catalog_id: string;
  title: string;
  description: string;
  unit_types: string[];
  price_display: string;
  currency: string;
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  area_range: string | null;
  bedrooms_range: string | null;
  bedrooms_min: number | null;
  bedrooms_max: number | null;
  handover_quarter: string | null;
  handover_year: number | null;
  installment_plan: string | null;
  images: string[];
  status: string;
}

export interface RealEstateCatalogItem {
  id: string;
  source_id: string;
  developer_project_id: number | null;
  title: string;
  description: string;
  description_full: string;
  property_type: 'Residential' | 'Countryside' | 'Commercial' | 'Private Islands' | string;
  country: string;
  city: string;
  location: string;
  price_display: string;
  currency: string;
  price_min_num: number | null;
  price_max_num: number | null;
  beds: number | null;
  baths: number | null;
  beds_min: number | null;
  beds_max: number | null;
  sqft: number | null;
  area_range: string | null;
  year: number | null;
  handover: string | null;
  completion_status: string | null;
  badge: string | null;
  features: string[];
  images: string[];
  floor_plans: string[];
  map_url: string | null;
  payment_terms: {
    installment_plan?: string | null;
    mortgage_available?: boolean;
    post_handover?: boolean;
  };
  has_units: boolean;
  units_count: number;
  units?: RealEstateUnitItem[];
  status: string;
  is_saved: boolean;
  updated_at: string;
  created_at: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  count: number;
  icon_key: string;
  icon_url: string;
}

export interface CatalogCategoriesResponse {
  total_properties: number;
  categories: CatalogCategory[];
}

export interface CatalogFilterOptions {
  countries: string[];
  cities_by_country: Record<string, string[]>;
  types: string[];
  categories?: CatalogCategory[];
  currencies: string[];
  features: string[];
}

export interface CatalogResponse {
  listings: RealEstateCatalogItem[];
  total: number;
  has_more: boolean;
  limit: number;
  offset: number;
  last_updated: string;
  filter_options: CatalogFilterOptions;
}

export interface CatalogQueryParams {
  viewerId?: string;
  type?: string;
  country?: string;
  city?: string;
  budgetMin?: number;
  budgetMax?: number;
  bedrooms?: string;
  features?: string;
  q?: string;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'title';
  limit?: number;
  offset?: number;
}

export interface RealEstateListing {
  id: string;
  title: string;
  short_summary: string;
  location: string;
  property_type: string;
  status: string;
  images: string[];
  brochure_document_url: string;
  disclaimer: string;
  created_by: string;
  eligibility_requirements?: OpportunityEligibilityRequirements | null;
}

export const CURRENT_ACCESS_CONDITIONS_VERSION = '2026-10-v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    let errorType = 'general';
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
      else if (errJson.message) errorMsg = errJson.message;
      if (errJson.errorType) errorType = errJson.errorType;
    } catch (_) {}
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.errorType = errorType;
    throw err;
  }

  return response.json();
}

export const ApiService = {
  getPersonas: () => request<Persona[]>('/api/personas'),

  getRecommendations: (viewerId: string, query?: string) => {
    const q = query ? `&query=${encodeURIComponent(query)}` : '';
    return request<Recommendation[]>(`/api/recommendations?viewerId=${viewerId}${q}`);
  },

  getMembers: (
    arg1: string | {
      viewerId?: string;
      q?: string;
      location?: string;
      industry?: string;
      interests?: string;
      university?: string;
      limit?: number;
      offset?: number;
    },
    params?: {
      q?: string;
      location?: string;
      industry?: string;
      interests?: string;
      university?: string;
      limit?: number;
      offset?: number;
    }
  ) => {
    const isObj = typeof arg1 === 'object';
    const viewerId = isObj ? arg1.viewerId : arg1;
    const actualParams = isObj ? arg1 : (params || {});
    const searchParams = new URLSearchParams();
    if (viewerId) searchParams.append('viewerId', viewerId);
    searchParams.append('paginated', 'true');
    if (actualParams.q) searchParams.append('q', actualParams.q);
    if (actualParams.location && actualParams.location !== 'all' && actualParams.location !== 'All') searchParams.append('location', actualParams.location);
    if (actualParams.industry && actualParams.industry !== 'all' && actualParams.industry !== 'All') searchParams.append('industry', actualParams.industry);
    if (actualParams.interests && actualParams.interests !== 'all' && actualParams.interests !== 'All') searchParams.append('interests', actualParams.interests);
    if (actualParams.university && actualParams.university !== 'all' && actualParams.university !== 'All') searchParams.append('university', actualParams.university);
    if (actualParams.limit) searchParams.append('limit', String(actualParams.limit));
    if (actualParams.offset !== undefined) searchParams.append('offset', String(actualParams.offset));
    return request<MembersResponse>(`/api/members?${searchParams.toString()}`);
  },

  requestConnection: (requesterId: string, recipientId: string, note?: string) =>
    request<{ success: boolean; status: string; connection_id: string; message: string }>('/api/connections/request', {
      method: 'POST',
      body: JSON.stringify({ requester_id: requesterId, recipient_id: recipientId, note }),
    }),

  cancelConnection: (requesterId: string, recipientId: string, connectionId?: string) =>
    request<{ success: boolean; status: string; message: string }>('/api/connections/cancel', {
      method: 'POST',
      body: JSON.stringify({ requester_id: requesterId, recipient_id: recipientId, connection_id: connectionId }),
    }),

  acceptConnection: (
    arg1: string | { connection_id?: string; requester_id?: string; recipient_id?: string },
    arg2?: string
  ) => {
    const payload =
      typeof arg1 === 'string'
        ? { recipient_id: arg1, requester_id: arg2 }
        : arg1;
    return request<{ success: boolean; status: string; connection_id: string; message: string }>(
      '/api/connections/accept',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  declineConnection: (
    arg1: string | { connection_id?: string; requester_id?: string; recipient_id?: string },
    arg2?: string
  ) => {
    const payload =
      typeof arg1 === 'string'
        ? { recipient_id: arg1, requester_id: arg2 }
        : arg1;
    return request<{ success: boolean; status: string; connection_id: string; message: string }>(
      '/api/connections/decline',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  getPendingConnections: (viewerId: string) =>
    request<PendingConnectionItem[]>(`/api/connections/pending?viewerId=${viewerId}`),

  getContactMethods: (arg1: string, arg2?: string) => {
    const targetId = arg2 ? arg2 : arg1;
    const viewerId = arg2 ? arg1 : undefined;
    return request<ContactMethodsResponse>(
      `/api/connections/contact-methods/${targetId}${viewerId ? `?viewerId=${viewerId}` : ''}`
    );
  },

  getProfile: (userId: string, viewerId: string) =>
    request<UserProfile>(`/api/profile/${userId}?viewerId=${viewerId}`),

  saveAnswer: (userId: string, questionId: number, value: any, visibility: 'shared' | 'private') =>
    request<{ success: boolean; is_complete: boolean }>(`/api/profile/${userId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, value, visibility }),
    }),

  updateProfile: (userId: string, payload: any) =>
    request<{ success: boolean; user: any }>(`/api/profile/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getEvents: (viewerId: string, includePast = false) =>
    request<ClubEvent[]>(`/api/events?viewerId=${viewerId}${includePast ? '&include_past=true' : ''}`),

  getEventDetails: (eventId: string, viewerId: string) =>
    request<ClubEvent>(`/api/events/${eventId}?viewerId=${viewerId}`),

  updateEvent: (eventId: string, viewerId: string, payload: Partial<ClubEvent>) =>
    request<{ success: boolean; event: ClubEvent }>(`/api/events/${eventId}?viewerId=${viewerId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getEventIcsUrl: (eventId: string) => `${API_BASE_URL}/api/events/${eventId}/ics`,

  uploadEventImage: (viewerId: string, imageBase64: string) =>
    request<{ success: boolean; url: string }>(`/api/events/upload-image?viewerId=${viewerId}`, {
      method: 'POST',
      body: JSON.stringify({ imageBase64 }),
    }),

  rsvpEvent: (eventId: string, userId: string, status: 'registered' | 'cancelled') =>
    request<{ success: boolean; registered_count: number }>(`/api/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, status }),
    }),

  getListings: () => request<RealEstateListing[]>('/api/listings'),

  getCatalogCategories: () =>
    request<CatalogCategoriesResponse>('/api/investments/categories'),

  getCatalog: (params?: CatalogQueryParams) => {
    const query = new URLSearchParams();
    if (params) {
      if (params.viewerId) query.append('viewerId', params.viewerId);
      if (params.type && params.type !== 'all') query.append('type', params.type);
      if (params.country && params.country !== 'all') query.append('country', params.country);
      if (params.city && params.city !== 'all') query.append('city', params.city);
      if (params.budgetMin) query.append('budgetMin', String(params.budgetMin));
      if (params.budgetMax) query.append('budgetMax', String(params.budgetMax));
      if (params.bedrooms && params.bedrooms !== 'any') query.append('bedrooms', params.bedrooms);
      if (params.features) query.append('features', params.features);
      if (params.q) query.append('q', params.q);
      if (params.sort) query.append('sort', params.sort);
      if (params.limit) query.append('limit', String(params.limit));
      if (params.offset) query.append('offset', String(params.offset));
    }
    const qs = query.toString();
    return request<CatalogResponse>(`/api/investments/catalog${qs ? `?${qs}` : ''}`);
  },

  getCatalogItem: (id: string, viewerId?: string) =>
    request<RealEstateCatalogItem>(`/api/investments/catalog/${id}${viewerId ? `?viewerId=${viewerId}` : ''}`),

  getCatalogUnits: (id: string) =>
    request<RealEstateUnitItem[]>(`/api/investments/catalog/${id}/units`),

  toggleSaveListing: (id: string, viewerId: string) =>
    request<{ success: boolean; is_saved: boolean; listing_id: string }>(`/api/investments/saved/${id}`, {
      method: 'POST',
      body: JSON.stringify({ viewerId }),
    }),

  getSavedListings: (viewerId: string) =>
    request<RealEstateCatalogItem[]>(`/api/investments/saved?viewerId=${viewerId}`),

  requestPropertyDetails: (listingId: string, memberId: string, unitId?: string, notes?: string) =>
    request<{ success: boolean; inquiry_id: string; message: string }>('/api/investments/request-details', {
      method: 'POST',
      body: JSON.stringify({ listingId, memberId, unitId, notes }),
    }),

  getInvestmentSyncStatus: () =>
    request<{ sync_enabled: boolean; last_sync: any }>('/api/investments/sync-status'),

  triggerInvestmentSync: () =>
    request<{ success: boolean; message: string; sync_log: any }>('/api/investments/sync', {
      method: 'POST',
    }),

  getListingDocument: (listingId: string, viewerId: string) =>
    request<{ success: boolean; document_url: string; title: string; listing_id: string }>(
      `/api/listings/${listingId}/document?viewerId=${viewerId}`
    ),

  submitInquiry: (listingId: string, memberId: string, inquiryType: string, notes: string) =>
    request<{ success: boolean; inquiry: any }>(`/api/listings/${listingId}/inquire`, {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId, inquiry_type: inquiryType, notes }),
    }),

  requestIntro: (requesterId: string, targetMemberId: string, targetContextNeed: string) =>
    request<{ success: boolean; request: any }>('/api/intros', {
      method: 'POST',
      body: JSON.stringify({
        requester_id: requesterId,
        target_member_id: targetMemberId,
        target_context_need: targetContextNeed,
      }),
    }),

  bookCall: (requesterId: string, recipientId: string, message: string, proposedTimes: string[]) =>
    request<{ success: boolean; booking: any }>('/api/call-bookings', {
      method: 'POST',
      body: JSON.stringify({
        requester_id: requesterId,
        recipient_id: recipientId,
        message,
        proposed_times: proposedTimes,
      }),
    }),

  getIntroPics: () => request<string[]>('/api/intro-pics'),
  
  acceptConditions: (userId: string, version: string = CURRENT_ACCESS_CONDITIONS_VERSION) =>
    request<{ success: boolean; version: string; accepted_at: string }>(
      `/api/profile/${userId}/accept-conditions`,
      {
        method: 'POST',
        body: JSON.stringify({ version }),
      }
    ),

  updateAvatar: (userId: string, avatar_url: string) =>
    request<{ success: boolean; user?: any; avatar_url: string }>(
      `/api/profile/${userId}/avatar`,
      {
        method: 'POST',
        body: JSON.stringify({ avatar_url }),
      }
    ),

  registerUser: (payload: {
    email: string;
    full_name: string;
    headline?: string;
    avatar_url?: string;
    country?: string;
    state?: string;
    city?: string;
    industry?: string;
    invite_code?: string;
    token?: string;
    chapter_id?: string;
    accepted_conditions_version?: string;
    accepted_terms_version?: string;
    accepted_terms_at?: string;
    biometrics_enabled?: boolean;
    phone?: string;
  }) =>
    request<{ success: boolean; user: any; userId?: string }>('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getLegalTerms: () =>
    request<{
      title: string;
      version: string;
      last_updated: string;
      sections: Array<{ heading: string; content: string }>;
    }>('/api/legal/terms'),

  getLegalPrivacy: () =>
    request<{
      title: string;
      version: string;
      last_updated: string;
      sections: Array<{ heading: string; content: string }>;
    }>('/api/legal/privacy'),

  verifyInviteToken: (token: string) =>
    request<{
      success: boolean;
      valid: boolean;
      token: string;
      email: string;
      fullName: string;
      role: string;
      status: string;
    }>('/api/invitations/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  requestAccess: (payload: {
    email: string;
    fullName?: string;
    full_name?: string;
    role?: string;
    notes?: string;
    phone?: string;
    linkedin_or_background?: string;
    what_brings_you?: string;
  }) =>
    request<{
      success: boolean;
      status: string;
      id?: string;
      email?: string;
      token?: string;
      message: string;
    }>('/api/invitations/request-access', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  checkEmailStatus: (email: string) =>
    request<{
      status: 'new' | 'pending_request' | 'existing_account' | 'declined_request';
      email: string;
      fullName?: string;
      phone?: string | null;
      message?: string;
    }>('/api/invitations/check-email-status', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  checkAccessStatus: (email: string) =>
    request<{
      status: 'none' | 'pending' | 'approved' | 'claimed';
      has_token: boolean;
      token?: string;
      email?: string;
      fullName?: string;
    }>(`/api/invitations/status?email=${encodeURIComponent(email)}`),

  approveAccessRequest: (payload: {
    requestId?: string;
    email?: string;
    approvedBy?: string;
  }) =>
    request<{
      success: boolean;
      email: string;
      token: string;
      status: string;
      approvedBy: string;
      emailDispatched: boolean;
    }>('/api/admin/invitations/approve', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  declineAccessRequest: (payload: {
    requestId?: string;
    email?: string;
    declinedBy?: string;
    reason?: string;
  }) =>
    request<{
      success: boolean;
      status: string;
      message: string;
    }>('/api/admin/access-requests/decline', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  revokeInvitation: (payload: {
    id?: string;
    token?: string;
    revokedBy?: string;
    reason?: string;
  }) =>
    request<{
      success: boolean;
      status: string;
      message: string;
    }>('/api/admin/invitations/revoke', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createInvitation: (payload: {
    email: string;
    createdBy?: string;
    fullName?: string;
    role?: string;
    expiresInDays?: number;
    expiresAt?: string;
    notes?: string;
  }) =>
    request<{
      success: boolean;
      token: string;
      id: string;
      email: string;
      expiresAt: string;
      inviteUrl?: string;
    }>('/api/admin/invitations/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAccessRequests: () =>
    request<any[]>('/api/admin/access-requests'),

  getInvitations: () =>
    request<any[]>('/api/admin/invitations'),

  getQuestions: () =>
    request<QuestionDefinition[]>('/api/questions'),

  saveAnswersBulk: (
    userId: string,
    answers: Array<{ question_id: number; value: string; visibility: 'shared' | 'private' }>
  ) =>
    request<{ success: boolean; count: number; is_complete: boolean }>(
      `/api/profile/${userId}/answers-bulk`,
      {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }
    ),

  getContactConfig: () =>
    request<{
      whatsapp_configured: boolean;
      whatsapp_number: string | null;
    }>('/api/contact/config'),

  submitContactMessage: (payload: {
    name: string;
    email: string;
    message: string;
    website?: string;
  }) =>
    request<{
      success: boolean;
      message: string;
    }>('/api/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPhoneAuthConfig: () =>
    request<{
      whatsapp_verification_enabled: boolean;
      provider: string;
      is_test_mode?: boolean;
    }>('/api/auth/phone/config'),

  sendPhoneVerificationCode: (payload: { phone: string; country_code?: string }) =>
    request<{
      success: boolean;
      message: string;
      provider: string;
      expires_in_seconds: number;
      is_test_mode?: boolean;
      mock_code?: string;
      demoCode?: string;
    }>('/api/auth/phone/send-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyPhoneCode: (payload: { phone: string; code: string }) =>
    request<{
      success: boolean;
      verified: boolean;
      is_existing_member: boolean;
      user?: Persona;
      phone: string;
    }>('/api/auth/phone/verify-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCityDetails: (cityName: string, viewerId?: string) =>
    request<CityScreenData>(`/api/cities/${encodeURIComponent(cityName)}?viewerId=${encodeURIComponent(viewerId || '')}`),

  postTravelPlan: (payload: {
    user_id: string;
    city: string;
    country?: string;
    start_date: string;
    end_date: string;
    notes?: string;
    visibility?: string;
  }) =>
    request<{ success: boolean; trip: TravelPlan; message?: string }>('/api/travel-plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getTravelPlans: (userId?: string) =>
    request<TravelPlan[]>(userId ? `/api/travel-plans?userId=${encodeURIComponent(userId)}` : '/api/travel-plans'),

  contactChapterLead: (chapterId: string, payload: { sender_id: string; message: string }) =>
    request<{ success: boolean; message: string }>(`/api/chapters/${encodeURIComponent(chapterId)}/contact-lead`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPulse: (userId: string) =>
    request<PulseData>(`/api/pulse?userId=${encodeURIComponent(userId)}`),

  submitPulse: (payload: {
    user_id: string;
    q14_focus?: string;
    situation_changes?: string[];
    useful_people?: string;
    travel_city?: string;
    travel_start_date?: string;
    travel_end_date?: string;
  }) =>
    request<{ success: boolean; message: string }>('/api/pulse', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reportMember: (memberId: string, payload: { reporter_id: string; reason: string }) =>
    request<{ success: boolean; message: string }>(`/api/members/${encodeURIComponent(memberId)}/report`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCommunityPosts: (viewerId: string, filter?: 'all' | 'ozara' | 'members') =>
    request<CommunityPost[]>(
      `/api/community/posts?viewerId=${encodeURIComponent(viewerId)}${filter ? `&filter=${encodeURIComponent(filter)}` : ''}`
    ),


  createCommunityPost: (payload: { author_id: string; content: string; topic?: CommunityTopic | null; attachments?: any[] }) =>
    request<CommunityPost>('/api/community/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCommunityPost: (postId: string, payload: { editor_id: string; content: string; topic?: CommunityTopic | null }) =>
    request<{ success: boolean; id: string; content: string; topic: CommunityTopic | null; updated_at: string }>(`/api/community/posts/${encodeURIComponent(postId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteCommunityPost: (postId: string, requesterId: string) =>
    request<{ success: boolean; message: string }>(`/api/community/posts/${encodeURIComponent(postId)}?requester_id=${encodeURIComponent(requesterId)}`, {
      method: 'DELETE',
    }),

  createCommunityComment: (postId: string, payload: { author_id: string; content: string }) =>
    request<CommunityComment>(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteCommunityComment: (commentId: string, requesterId: string) =>
    request<{ success: boolean; message: string }>(`/api/community/comments/${encodeURIComponent(commentId)}?requester_id=${encodeURIComponent(requesterId)}`, {
      method: 'DELETE',
    }),

  // Admin Dashboard & Event Management API
  getAdminEvents: (adminId: string) =>
    request<ClubEvent[]>(`/api/admin/events?viewerId=${encodeURIComponent(adminId)}`),

  getAdminEventDetail: (eventId: string, adminId: string) =>
    request<AdminEventDetail>(`/api/admin/events/${encodeURIComponent(eventId)}?viewerId=${encodeURIComponent(adminId)}`),

  createAdminEvent: (adminId: string, payload: Partial<ClubEvent>) =>
    request<{ success: boolean; event: ClubEvent }>(`/api/admin/events?viewerId=${encodeURIComponent(adminId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminEvent: (eventId: string, adminId: string, payload: Partial<ClubEvent>) =>
    request<{ success: boolean; event: ClubEvent }>(`/api/admin/events/${encodeURIComponent(eventId)}?viewerId=${encodeURIComponent(adminId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  publishAdminEvent: (eventId: string, adminId: string) =>
    request<{ success: boolean; is_published: number; message: string }>(`/api/admin/events/${encodeURIComponent(eventId)}/publish?viewerId=${encodeURIComponent(adminId)}`, {
      method: 'POST',
    }),

  cancelAdminEvent: (eventId: string, adminId: string) =>
    request<{ success: boolean; status: string; message: string }>(`/api/admin/events/${encodeURIComponent(eventId)}/cancel?viewerId=${encodeURIComponent(adminId)}`, {
      method: 'POST',
    }),

  previewTargetedRecipients: (adminId: string, payload: {
    eventId?: string;
    selectionOption: 'all_admitted' | 'individual' | 'filters';
    selectedUserIds?: string[];
    filters?: {
      location?: string;
      chapter_id?: string;
      industry?: string;
      interests?: string;
      university?: string;
      expertise?: string;
    };
    excludedUserIds?: string[];
  }) =>
    request<RecipientPreviewResponse>(`/api/admin/events/invitations/recipients?viewerId=${encodeURIComponent(adminId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendAdminInvitations: (adminId: string, payload: {
    eventId: string;
    recipientIds: string[];
    deliveryChannels?: Array<'in_app' | 'email' | 'whatsapp'>;
    customMessage?: string;
  }) =>
    request<{ success: boolean; sent_count: number; delivery_channels: string[] }>(`/api/admin/events/invitations/send?viewerId=${encodeURIComponent(adminId)}`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, adminId }),
    }),

  getNotifications: (viewerId: string) =>
    request<{ notifications: InAppNotification[]; unread_count: number }>(`/api/notifications?viewerId=${encodeURIComponent(viewerId)}`),

  markNotificationRead: (notifId: string) =>
    request<{ success: boolean }>(`/api/notifications/${encodeURIComponent(notifId)}/read`, {
      method: 'POST',
    }),

  markAllNotificationsRead: (userId: string) =>
    request<{ success: boolean }>(`/api/notifications/read-all`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  getAdminAuditLogs: (adminId: string) =>
    request<any[]>(`/api/admin/audit-logs?viewerId=${encodeURIComponent(adminId)}`),

  getInboxSummary: (userId: string) =>
    request<InboxSummary>(`/api/inbox/summary?userId=${encodeURIComponent(userId)}`),

  getInboxNotifications: (userId: string, category?: string) =>
    request<{ notifications: NotificationItem[]; unread_count: number }>(
      `/api/inbox/notifications?userId=${encodeURIComponent(userId)}${category ? `&category=${encodeURIComponent(category)}` : ''}`
    ),

  markInboxNotificationRead: (notifId: string, userId: string) =>
    request<{ success: boolean }>(`/api/inbox/notifications/${encodeURIComponent(notifId)}/read`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  markAllInboxNotificationsRead: (userId: string) =>
    request<{ success: boolean }>(`/api/inbox/notifications/read-all`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  getConversations: (userId: string) =>
    request<{ conversations: ConversationSummaryItem[] }>(`/api/inbox/conversations?userId=${encodeURIComponent(userId)}`),

  getConversationDetails: (convoId: string, userId: string) =>
    request<ConversationDetailResponse>(`/api/inbox/conversations/${encodeURIComponent(convoId)}?userId=${encodeURIComponent(userId)}`),

  startConversation: (userId: string, recipientId: string, initialMessage?: string) =>
    request<{ conversation: any }>(`/api/inbox/conversations/start`, {
      method: 'POST',
      headers: { 'x-user-id': userId },
      body: JSON.stringify({ userId, recipientId, initialMessage }),
    }),

  sendDirectMessage: (userId: string, conversationId: string, content: string) =>
    request<{ message: DirectMessageItem }>(`/api/inbox/messages/send`, {
      method: 'POST',
      headers: { 'x-user-id': userId },
      body: JSON.stringify({ userId, conversationId, content }),
    }),

  blockUser: (userId: string, targetUserId: string, reason?: string) =>
    request<{ success: boolean }>(`/api/inbox/block`, {
      method: 'POST',
      headers: { 'x-user-id': userId },
      body: JSON.stringify({ userId, targetUserId, reason }),
    }),

  reportUser: (userId: string, targetUserId: string, reason: string, details?: string, blockUser?: boolean) =>
    request<{ success: boolean; report_id: string }>(`/api/inbox/report`, {
      method: 'POST',
      headers: { 'x-user-id': userId },
      body: JSON.stringify({ userId, targetUserId, reason, details, blockUser }),
    }),

  getNotificationPreferences: (userId: string) =>
    request<{ preferences: NotificationPreferences }>(`/api/inbox/preferences?userId=${encodeURIComponent(userId)}`),

  updateNotificationPreferences: (userId: string, preferences: Partial<NotificationPreferences>) =>
    request<{ success: boolean; preferences: NotificationPreferences }>(`/api/inbox/preferences`, {
      method: 'PUT',
      headers: { 'x-user-id': userId },
      body: JSON.stringify({ userId, preferences }),
    }),

  getAdminActivity: (adminId: string, category?: string) =>
    request<{ activity: AdminActivityItem[]; total: number }>(
      `/api/admin/activity?userId=${encodeURIComponent(adminId)}${category ? `&category=${encodeURIComponent(category)}` : ''}`
    ),
};

