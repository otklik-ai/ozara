/**
 * ÖZARA Mobile API Service Layer
 * Connects to the Node.js / Express backend with full type safety
 */

import { Platform } from 'react-native';

// Dynamic base URL detection:
// When accessed from a physical phone on LAN (e.g. http://192.168.1.157:8081),
// dynamically point to the backend on port 3000 on that same host IP!
export const getBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:3000`;
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

export interface Recommendation {
  id: string;
  full_name: string;
  headline: string;
  avatar_url: string;
  chapter_name: string;
  city: string;
  country: string;
  contact_preference: string;
  match_score: number;
  match_rationale: string;
  matched_tags: Array<{ category: string; value: string }>;
  is_complete: boolean;
}

export interface QuestionDefinition {
  id: number;
  prompt: string;
  is_required: boolean;
  is_confidential: boolean;
  default_visibility: 'shared' | 'private';
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
}

export interface ClubEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  capacity: number;
  registered_count: number;
  user_rsvp: 'registered' | 'none';
}

export interface OpportunityEligibilityRequirements {
  requires_investor_status?: boolean;
  minimum_verification_tier?: string;
  restricted_jurisdictions?: string[];
  max_ticket_size?: number | null;
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
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const ApiService = {
  getPersonas: () => request<Persona[]>('/api/personas'),

  getRecommendations: (viewerId: string, query?: string) => {
    const q = query ? `&query=${encodeURIComponent(query)}` : '';
    return request<Recommendation[]>(`/api/recommendations?viewerId=${viewerId}${q}`);
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

  getEvents: (viewerId: string) =>
    request<ClubEvent[]>(`/api/events?viewerId=${viewerId}`),

  rsvpEvent: (eventId: string, userId: string, status: 'registered' | 'cancelled') =>
    request<{ success: boolean; registered_count: number }>(`/api/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, status }),
    }),

  getListings: () => request<RealEstateListing[]>('/api/listings'),

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
    accepted_conditions_version: string;
  }) =>
    request<{ success: boolean; user: any }>('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

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
    fullName: string;
    role?: string;
    notes?: string;
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

  getAccessRequests: () =>
    request<any[]>('/api/admin/access-requests'),

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
    }>('/api/auth/phone/config'),

  sendPhoneVerificationCode: (payload: { phone: string; country_code?: string }) =>
    request<{
      success: boolean;
      message: string;
      provider: string;
      expires_in_seconds: number;
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
};
