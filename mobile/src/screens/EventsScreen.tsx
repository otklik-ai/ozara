/**
 * ÖZARA Mobile: Events Screen (Modern Chronological Event Calendar)
 * 
 * Features:
 * - Chronological event ordering, nearest upcoming event first
 * - Grouped by Year (2026, 2027) and Month
 * - Dedicated, prominent Left Date Block (Day range, Month, Year, Duration)
 * - Responsive desktop & mobile layouts
 * - Prominent "Next Upcoming Event" spotlight highlight
 * - Strict Data Integrity: Displays "To be confirmed" / "To be announced" for unconfirmed fields
 * - "Dates to Be Announced" section for unconfirmed date events
 * - "Past Events Archive" tab/toggle
 * - Filter by Year, Destination, Event Type, Registration Status, and Travel plans
 * - Dedicated Event Detail Modal with Agenda, Hosts, Venue, Pricing, and Inclusions
 * - Personal Calendar Export (.ics download & Google Calendar link)
 * - Administrator Event Editor Modal
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  TextInput,
  Platform,
  Linking,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { ApiService, ClubEvent, TravelPlan, resolveImageUrl } from '../services/api';
import { useClub } from '../context/ClubContext';
import { OzaraTheme } from '../constants/ozara-theme';
import { Ionicons } from '@expo/vector-icons';

const EVENT_TYPES = [
  'All Types',
  'Summit',
  'Retreat',
  'Trek',
  'Family & Education',
  'Networking',
  'Jubilee',
];

const DESTINATIONS = [
  'All Destinations',
  'Miami',
  'Phuket',
  'Silicon Valley',
  'Georgia',
  'Barcelona',
  'Central Asia',
  'New York + Boston',
  'European Grand Tour',
];

const REGISTRATION_STATUSES = [
  'All Statuses',
  'Open',
  'Coming Soon',
  'Full',
  'Closed',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const COVER_IMAGE_PRESETS = [
  { label: 'Miami (Night Networking)', url: '/events/miami_networking.jpg' },
  { label: 'Phuket (Tropical Retreat)', url: '/events/phuket_retreat.jpg' },
  { label: 'Silicon Valley (Hillside Villa)', url: '/events/silicon_valley.jpg' },
  { label: 'Georgia (Caucasus Mountains)', url: '/events/georgia.jpg' },
  { label: 'Barcelona (Modernist Rooftop)', url: '/events/barcelona.jpg' },
  { label: 'Central Asia (Silk Road Archways)', url: '/events/central_asia.jpg' },
  { label: 'New York & Boston (Family Robotics Workshop)', url: '/events/ny_boston.jpg' },
  { label: 'European Grand Tour (Monaco Harbour)', url: '/events/europe_grand_tour.jpg' },
  { label: 'London (Mayfair Salon)', url: '/events/london_salon.jpg' },
  { label: 'Dubai (Skyline Terrace)', url: '/events/dubai_dinner.jpg' },
];

interface EventCardItemProps {
  event: ClubEvent;
  isDesktop: boolean;
  onSelectDetail: (event: ClubEvent) => void;
  onRsvp: (event: ClubEvent) => void;
  onDownloadIcs: (event: ClubEvent) => void;
  onOpenEdit?: (event: ClubEvent) => void;
  isAdmin: boolean;
  renderStatusBadge: (status?: string) => React.ReactNode;
}

const EventCardItem: React.FC<EventCardItemProps> = ({
  event,
  isDesktop,
  onSelectDetail,
  onRsvp,
  onDownloadIcs,
  onOpenEdit,
  isAdmin,
  renderStatusBadge,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const rawImage = event.hero_image || (event as any).cover_image;
  const imageUri = rawImage ? resolveImageUrl(rawImage) : null;

  const renderFloatingDate = () => {
    if (event.date_precision === 'tba') {
      return (
        <View style={[styles.floatingDateBadge, styles.floatingDateBadgeTba]}>
          <Text style={styles.floatingDateTbaText}>DATES TBA</Text>
          <Text style={styles.floatingDateBadgeYear}>{event.year || 2027}</Text>
        </View>
      );
    }

    if (event.date_precision === 'month_only') {
      const month = (event.month_name || 'MONTH').toUpperCase();
      return (
        <View style={styles.floatingDateBadge}>
          <Text style={styles.floatingDateBadgeMonthOnly}>{month}</Text>
          <Text style={styles.floatingDateBadgeYear}>{event.year || 2027}</Text>
          <View style={styles.floatingDateSubTag}>
            <Text style={styles.floatingDateSubTagText}>CONFIRMED</Text>
          </View>
        </View>
      );
    }

    let dayRange = '';
    let monthName = '';
    if (event.start_date && event.end_date) {
      const startDay = new Date(event.start_date).getUTCDate();
      const endDay = new Date(event.end_date).getUTCDate();
      dayRange = startDay === endDay ? `${startDay}` : `${startDay}–${endDay}`;
      monthName = (event.month_name || MONTH_NAMES[new Date(event.start_date).getUTCMonth()]).toUpperCase();
    } else if (event.display_date) {
      const parts = event.display_date.split(' ');
      dayRange = parts[0] || '';
      monthName = (event.month_name || parts[1] || 'DATE').toUpperCase();
    }

    return (
      <View style={styles.floatingDateBadge}>
        <Text style={styles.floatingDateBadgeDays}>{dayRange}</Text>
        <Text style={styles.floatingDateBadgeMonth}>{monthName}</Text>
        <Text style={styles.floatingDateBadgeYear}>{event.year || 2026}</Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.eventCard,
        isDesktop ? styles.eventCardDesktop : styles.eventCardMobile,
        event.date_precision === 'tba' && styles.eventCardTba,
      ]}>
      {/* 1. Cover Picture Section (Left on Desktop, Top on Mobile) */}
      <View
        style={[
          styles.cardImageContainer,
          isDesktop ? styles.cardImageContainerDesktop : styles.cardImageContainerMobile,
        ]}>
        {!imageUri || imgError ? (
          <View style={styles.imageFallback}>
            <Ionicons name="compass-outline" size={32} color="#38bdf8" />
            <Text style={styles.imageFallbackCity}>{event.city || event.location}</Text>
            <Text style={styles.imageFallbackBrand}>ÖZARA PRIVATE EXPEDITIONS</Text>
          </View>
        ) : (
          <View style={styles.imageWrapper}>
            {!imgLoaded && (
              <View style={styles.imageLoadingSkeleton}>
                <ActivityIndicator size="small" color="#38bdf8" />
              </View>
            )}
            <Image
              source={{ uri: imageUri }}
              style={styles.cardImage}
              resizeMode="cover"
              onLoadStart={() => setImgLoaded(false)}
              onLoadEnd={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
            <View style={styles.imageVignetteOverlay} />
          </View>
        )}

        {/* Floating Prominent Date Badge */}
        {renderFloatingDate()}
      </View>

      {/* 2. Event Details Section (Right on Desktop, Below on Mobile) */}
      <View style={styles.cardContent}>
        {/* Top Meta Strip */}
        <View style={styles.cardTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <View style={styles.typeTag}>
              <Text style={styles.typeTagText}>{(event.event_type || 'SUMMIT').toUpperCase()}</Text>
            </View>
            {renderStatusBadge(event.registration_status)}
            {event.user_rsvp === 'registered' && (
              <View style={styles.rsvpBadge}>
                <Ionicons name="checkmark-circle" size={11} color="#10b981" />
                <Text style={styles.rsvpBadgeText}>REGISTERED</Text>
              </View>
            )}
          </View>
          {event.display_date && (
            <Text style={styles.cardDateTopText}>{event.display_date}</Text>
          )}
        </View>

        {/* Headline / Title */}
        <Text style={styles.cardTitle}>{event.headline || event.title}</Text>

        {/* Location & Venue */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color="#38bdf8" style={{ marginRight: 5 }} />
          <Text style={styles.locationText}>{event.location}</Text>
        </View>
        <View style={styles.venueRow}>
          <Ionicons name="business-outline" size={13} color="#94a3b8" style={{ marginRight: 5 }} />
          <Text style={styles.venueText}>
            Venue: {event.venue && event.venue !== 'To be confirmed' ? event.venue : 'To be confirmed'}
          </Text>
        </View>

        {/* Description */}
        <Text style={styles.cardDescription} numberOfLines={3}>
          {event.description}
        </Text>

        {/* Metrics Row */}
        <View style={styles.cardMetricsRow}>
          <View style={styles.metricItem}>
            <Ionicons name="people-outline" size={13} color="#94a3b8" style={{ marginRight: 4 }} />
            <Text style={styles.metricText}>
              Capacity: {event.capacity && event.capacity > 0 ? `${event.capacity} seats` : 'To be confirmed'}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Ionicons name="ticket-outline" size={13} color="#94a3b8" style={{ marginRight: 4 }} />
            <Text style={styles.metricText}>
              Available: {event.available_spots !== null && event.available_spots !== undefined ? `${event.available_spots} spots` : 'To be confirmed'}
            </Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => onSelectDetail(event)}
            activeOpacity={0.8}>
            <Text style={styles.detailsBtnText}>View Details &amp; Agenda</Text>
            <Ionicons name="arrow-forward" size={13} color="#ffffff" style={{ marginLeft: 5 }} />
          </TouchableOpacity>

          {event.registration_status === 'open' && (
            <TouchableOpacity
              style={[
                styles.cardRsvpBtn,
                event.user_rsvp === 'registered' && styles.cardRsvpBtnActive,
              ]}
              onPress={() => onRsvp(event)}
              activeOpacity={0.8}>
              <Ionicons
                name={event.user_rsvp === 'registered' ? "checkmark-circle" : "ticket-outline"}
                size={14}
                color={event.user_rsvp === 'registered' ? "#10b981" : "#ffffff"}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.cardRsvpBtnText,
                  event.user_rsvp === 'registered' && { color: '#10b981' },
                ]}>
                {event.user_rsvp === 'registered' ? 'Confirmed ✓' : 'Register'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.calIconBtn}
            onPress={() => onDownloadIcs(event)}
            activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
          </TouchableOpacity>

          {isAdmin && onOpenEdit && (
            <TouchableOpacity
              style={styles.adminEditBtn}
              onPress={() => onOpenEdit(event)}
              activeOpacity={0.7}>
              <Ionicons name="create-outline" size={14} color="#f59e0b" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export const EventsScreen: React.FC = () => {
  const { currentUserId, currentUser } = useClub();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'upcoming' | 'archive'>('upcoming');

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('All Years');
  const [selectedType, setSelectedType] = useState<string>('All Types');
  const [selectedDest, setSelectedDest] = useState<string>('All Destinations');
  const [selectedStatus, setSelectedStatus] = useState<string>('All Statuses');
  const [onlyTravelCities, setOnlyTravelCities] = useState<boolean>(false);
  const [userTrips, setUserTrips] = useState<TravelPlan[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'year' | 'type' | 'dest' | 'status' | null>(null);

  const hasActiveFilters =
    selectedYear !== 'All Years' ||
    selectedType !== 'All Types' ||
    selectedDest !== 'All Destinations' ||
    selectedStatus !== 'All Statuses' ||
    onlyTravelCities;

  // Modals
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<ClubEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ClubEvent>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  const isAdmin = currentUser?.role === 'FOUNDER' || currentUser?.role === 'ADMIN' ||
    ['usr_elena', 'usr_alexandra', 'usr_julia'].includes(currentUserId);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsData, tripsData] = await Promise.all([
        ApiService.getEvents(currentUserId, true),
        ApiService.getTravelPlans(currentUserId).catch(() => []),
      ]);
      setEvents(eventsData);
      setUserTrips(tripsData);
    } catch (err) {
      console.warn('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUserId]);

  const handleRsvp = async (event: ClubEvent) => {
    try {
      const actionStatus = event.user_rsvp === 'registered' ? 'cancelled' : 'registered';
      const res = await ApiService.rsvpEvent(event.id, currentUserId, actionStatus);
      if (res.success) {
        setEvents(prev =>
          prev.map(e =>
            e.id === event.id
              ? {
                  ...e,
                  user_rsvp: (actionStatus === 'registered' ? 'registered' : 'none') as 'registered' | 'none',
                  registered_count: res.registered_count,
                  available_spots: e.capacity && e.capacity > 0 ? Math.max(0, e.capacity - res.registered_count) : e.available_spots
                }
              : e
          )
        );
        if (selectedEventForDetail && selectedEventForDetail.id === event.id) {
          setSelectedEventForDetail(prev => prev ? {
            ...prev,
            user_rsvp: (actionStatus === 'registered' ? 'registered' : 'none') as 'registered' | 'none',
            registered_count: res.registered_count,
            available_spots: prev.capacity && prev.capacity > 0 ? Math.max(0, prev.capacity - res.registered_count) : prev.available_spots
          } : null);
        }
        Alert.alert(
          actionStatus === 'registered' ? 'Seat Reserved' : 'Reservation Cancelled',
          actionStatus === 'registered'
            ? `Your seat for "${event.headline || event.title}" is confirmed. It has been recorded to your member activity.`
            : `Your reservation for "${event.headline || event.title}" has been removed.`
        );
      }
    } catch (err: any) {
      Alert.alert('RSVP Error', err.message || 'Could not update RSVP');
    }
  };

  const handleDownloadIcs = (event: ClubEvent) => {
    const icsUrl = ApiService.getEventIcsUrl(event.id);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(icsUrl, '_blank');
      }
    } else {
      Linking.openURL(icsUrl).catch(() => {
        Alert.alert('Calendar Download', 'Could not open calendar download link.');
      });
    }
  };

  const handleOpenGoogleCalendar = (event: ClubEvent) => {
    const title = encodeURIComponent(`ÖZARA: ${event.headline || event.title}`);
    const details = encodeURIComponent(event.description || '');
    const location = encodeURIComponent((event.venue && event.venue !== 'To be confirmed' ? `${event.venue}, ` : '') + (event.location || ''));
    let datesParam = '';
    if (event.start_date && event.end_date) {
      const s = event.start_date.replace(/-/g, '');
      const e = event.end_date.replace(/-/g, '');
      datesParam = `&dates=${s}/${e}`;
    }
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}${datesParam}`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  // Open Admin Edit Modal
  const openEditModal = (event: ClubEvent) => {
    setEditingEvent(event);
    setEditFormData({
      title: event.title,
      headline: event.headline || '',
      description: event.description || '',
      event_type: event.event_type || 'Summit',
      venue: event.venue || 'To be confirmed',
      capacity: event.capacity ?? 0,
      available_spots: event.available_spots ?? 0,
      registration_status: event.registration_status || 'coming_soon',
      price: event.price || 'To be confirmed',
      whats_included: event.whats_included || '',
      travel_info: event.travel_info || '',
      hosts: event.hosts || '',
      agenda: event.agenda || '',
      hero_image: event.hero_image || '',
      display_date: event.display_date || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEvent) return;
    try {
      setIsSubmittingEdit(true);
      const res = await ApiService.updateEvent(editingEvent.id, currentUserId, editFormData);
      if (res.success) {
        setEvents(prev => prev.map(e => (e.id === editingEvent.id ? { ...e, ...res.event } : e)));
        if (selectedEventForDetail && selectedEventForDetail.id === editingEvent.id) {
          setSelectedEventForDetail({ ...selectedEventForDetail, ...res.event });
        }
        setEditingEvent(null);
        Alert.alert('Saved', 'Event updated successfully.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update event.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Filter events based on viewMode and active filters
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      // Archive vs Upcoming
      const isPast = evt.is_past === 1 || evt.is_past === true;
      if (viewMode === 'archive' && !isPast) return false;
      if (viewMode === 'upcoming' && isPast) return false;

      // Year Filter
      if (selectedYear !== 'All Years') {
        const y = parseInt(selectedYear, 10);
        if (evt.year !== y) return false;
      }

      // Type Filter
      if (selectedType !== 'All Types') {
        const tLower = selectedType.toLowerCase();
        const evtType = (evt.event_type || '').toLowerCase();
        if (!evtType.includes(tLower)) return false;
      }

      // Destination Filter
      if (selectedDest !== 'All Destinations') {
        const dLower = selectedDest.toLowerCase();
        const content = `${evt.city || ''} ${evt.location || ''} ${evt.title || ''} ${evt.country || ''}`.toLowerCase();
        if (dLower === 'central asia' && (content.includes('кыргызстан') || content.includes('узбекистан') || content.includes('азербайджан') || content.includes('central asia'))) {
          // matches
        } else if (dLower.includes('europe') && (content.includes('европа') || content.includes('лондон') || content.includes('париж') || content.includes('монако') || content.includes('цюрих') || content.includes('europe'))) {
          // matches
        } else if (dLower.includes('new york') && (content.includes('нью-йорк') || content.includes('бостон') || content.includes('new york') || content.includes('boston'))) {
          // matches
        } else if (dLower.includes('silicon valley') && (content.includes('кремниевая') || content.includes('silicon valley'))) {
          // matches
        } else if (dLower.includes('georgia') && (content.includes('грузия') || content.includes('georgia') || content.includes('тбилиси'))) {
          // matches
        } else if (dLower.includes('barcelona') && (content.includes('барселона') || content.includes('barcelona'))) {
          // matches
        } else if (dLower.includes('miami') && (content.includes('майами') || content.includes('miami'))) {
          // matches
        } else if (dLower.includes('phuket') && (content.includes('пхукет') || content.includes('phuket'))) {
          // matches
        } else if (!content.includes(dLower)) {
          return false;
        }
      }

      // Status Filter
      if (selectedStatus !== 'All Statuses') {
        const sLower = selectedStatus.toLowerCase().replace(' ', '_');
        if ((evt.registration_status || '').toLowerCase() !== sLower) return false;
      }

      // Smart Travel Filter
      if (onlyTravelCities) {
        const tripCities = userTrips.map(t => t.city.toLowerCase());
        if (tripCities.length === 0) return false;
        const evtLoc = `${evt.location || ''} ${evt.city || ''}`.toLowerCase();
        const matches = tripCities.some(tc => evtLoc.includes(tc));
        if (!matches) return false;
      }

      return true;
    });
  }, [events, viewMode, selectedYear, selectedType, selectedDest, selectedStatus, onlyTravelCities, userTrips]);

  // Separate dated events from TBA events
  const datedEvents = useMemo(() => {
    return filteredEvents.filter(e => e.date_precision !== 'tba');
  }, [filteredEvents]);

  const tbaEvents = useMemo(() => {
    return filteredEvents.filter(e => e.date_precision === 'tba');
  }, [filteredEvents]);

  // Group dated events by Year -> Month
  const groupedEvents = useMemo(() => {
    const groups: Array<{
      year: number;
      months: Array<{
        monthName: string;
        events: ClubEvent[];
      }>;
    }> = [];

    const yearMap = new Map<number, Map<string, ClubEvent[]>>();

    datedEvents.forEach(evt => {
      const year = evt.year || (evt.start_date ? new Date(evt.start_date).getFullYear() : 2027);
      const month = evt.month_name || (evt.start_date ? MONTH_NAMES[new Date(evt.start_date).getMonth()] : 'To be confirmed');

      if (!yearMap.has(year)) {
        yearMap.set(year, new Map());
      }
      const monthMap = yearMap.get(year)!;
      if (!monthMap.has(month)) {
        monthMap.set(month, []);
      }
      monthMap.get(month)!.push(evt);
    });

    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
    sortedYears.forEach(year => {
      const monthMap = yearMap.get(year)!;
      const monthsList: Array<{ monthName: string; events: ClubEvent[] }> = [];

      monthMap.forEach((evts, monthName) => {
        monthsList.push({ monthName, events: evts });
      });

      groups.push({ year, months: monthsList });
    });

    return groups;
  }, [datedEvents]);

  // Next Upcoming Event for prominent spotlight
  const nextUpcomingEvent = useMemo(() => {
    if (viewMode === 'archive') return null;
    return events.find(e => e.is_next_upcoming === true) || datedEvents[0] || null;
  }, [events, datedEvents, viewMode]);


  // Helper formatting for Registration Status
  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'open':
        return (
          <View style={[styles.statusBadge, styles.statusBadgeOpen]}>
            <View style={[styles.statusDot, styles.dotEmerald]} />
            <Text style={[styles.statusBadgeText, styles.textEmerald]}>REGISTRATION OPEN</Text>
          </View>
        );
      case 'full':
        return (
          <View style={[styles.statusBadge, styles.statusBadgeFull]}>
            <View style={[styles.statusDot, styles.dotPurple]} />
            <Text style={[styles.statusBadgeText, styles.textPurple]}>CAPACITY FULL</Text>
          </View>
        );
      case 'closed':
        return (
          <View style={[styles.statusBadge, styles.statusBadgeClosed]}>
            <View style={[styles.statusDot, styles.dotSlate]} />
            <Text style={[styles.statusBadgeText, styles.textSlate]}>REGISTRATION CLOSED</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.statusBadge, styles.statusBadgeComingSoon]}>
            <View style={[styles.statusDot, styles.dotAmber]} />
            <Text style={[styles.statusBadgeText, styles.textAmber]}>COMING SOON</Text>
          </View>
        );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 1. Header Banner */}
      <View style={styles.headerBlock}>
        <View style={styles.tagRow}>
          <View style={styles.tagDot} />
          <Text style={styles.tagText}>CALENDAR OF EVENTS 2026 / 2027</Text>
        </View>
        <Text style={styles.headline}>Gatherings, Treks &amp; Private Summits</Text>
        <Text style={styles.subtext}>
          High-conviction executive retreats, university tours, and international chapter gatherings for verified members.
        </Text>

        {/* View Mode Switcher: Upcoming Calendar vs Past Archive */}
        <View style={styles.viewModeSwitcher}>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'upcoming' && styles.modeBtnActive]}
            onPress={() => setViewMode('upcoming')}
            activeOpacity={0.8}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={viewMode === 'upcoming' ? '#38bdf8' : '#94a3b8'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.modeBtnText, viewMode === 'upcoming' && styles.modeBtnTextActive]}>
              Upcoming Calendar (2026–2027)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'archive' && styles.modeBtnActive]}
            onPress={() => setViewMode('archive')}
            activeOpacity={0.8}>
            <Ionicons
              name="archive-outline"
              size={14}
              color={viewMode === 'archive' ? '#38bdf8' : '#94a3b8'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.modeBtnText, viewMode === 'archive' && styles.modeBtnTextActive]}>
              Past Events Archive
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Filter Controls Section (Clean Dropdowns) */}
      <View style={[styles.filterSection, openDropdown ? { zIndex: 100 } : null]}>
        <View style={styles.filterHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="options-outline" size={13} color="#38bdf8" />
            <Text style={styles.filterSectionTitle}>FILTER CALENDAR</Text>
          </View>

          <View style={styles.filterHeaderActions}>
            {userTrips.length > 0 && (
              <TouchableOpacity
                style={[styles.travelFilterBtn, onlyTravelCities && styles.travelFilterBtnActive]}
                onPress={() => setOnlyTravelCities(prev => !prev)}
                activeOpacity={0.8}>
                <Ionicons
                  name="airplane-outline"
                  size={12}
                  color={onlyTravelCities ? "#ffffff" : "#38bdf8"}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.travelFilterBtnText, onlyTravelCities && { color: '#ffffff' }]}>
                  Cities I Am Travelling To
                </Text>
              </TouchableOpacity>
            )}

            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.resetAllBtn}
                onPress={() => {
                  setSelectedYear('All Years');
                  setSelectedType('All Types');
                  setSelectedDest('All Destinations');
                  setSelectedStatus('All Statuses');
                  setOnlyTravelCities(false);
                  setOpenDropdown(null);
                }}
                activeOpacity={0.75}>
                <Ionicons name="close-circle-outline" size={13} color="#ef4444" />
                <Text style={styles.resetAllBtnText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 4 Clean Dropdown Selectors */}
        <View style={styles.dropdownsGrid}>
          {/* 1. Year Dropdown */}
          <View style={[styles.dropdownCol, openDropdown === 'year' && { zIndex: 120 }]}>
            <Text style={styles.dropdownLabel}>Year</Text>
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                selectedYear !== 'All Years' && styles.dropdownTriggerActive,
                openDropdown === 'year' && styles.dropdownTriggerOpen,
              ]}
              onPress={() => setOpenDropdown(openDropdown === 'year' ? null : 'year')}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.dropdownValueText,
                  selectedYear !== 'All Years' && styles.dropdownValueTextActive,
                ]}
                numberOfLines={1}>
                {selectedYear}
              </Text>
              <Ionicons
                name={openDropdown === 'year' ? "chevron-up" : "chevron-down"}
                size={13}
                color={selectedYear !== 'All Years' ? "#38bdf8" : "#94a3b8"}
              />
            </TouchableOpacity>

            {openDropdown === 'year' && (
              <View style={styles.dropdownMenu}>
                {['All Years', '2026', '2027'].map(yr => {
                  const isSel = selectedYear === yr;
                  return (
                    <TouchableOpacity
                      key={yr}
                      style={[styles.dropdownItem, isSel && styles.dropdownItemSelected]}
                      onPress={() => {
                        setSelectedYear(yr);
                        setOpenDropdown(null);
                      }}
                      activeOpacity={0.7}>
                      <Text style={[styles.dropdownItemText, isSel && styles.dropdownItemTextSelected]}>
                        {yr}
                      </Text>
                      {isSel && <Ionicons name="checkmark" size={13} color="#38bdf8" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* 2. Type Dropdown */}
          <View style={[styles.dropdownCol, openDropdown === 'type' && { zIndex: 120 }]}>
            <Text style={styles.dropdownLabel}>Event Type</Text>
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                selectedType !== 'All Types' && styles.dropdownTriggerActive,
                openDropdown === 'type' && styles.dropdownTriggerOpen,
              ]}
              onPress={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.dropdownValueText,
                  selectedType !== 'All Types' && styles.dropdownValueTextActive,
                ]}
                numberOfLines={1}>
                {selectedType}
              </Text>
              <Ionicons
                name={openDropdown === 'type' ? "chevron-up" : "chevron-down"}
                size={13}
                color={selectedType !== 'All Types' ? "#38bdf8" : "#94a3b8"}
              />
            </TouchableOpacity>

            {openDropdown === 'type' && (
              <View style={styles.dropdownMenu}>
                {EVENT_TYPES.map(tp => {
                  const isSel = selectedType === tp;
                  return (
                    <TouchableOpacity
                      key={tp}
                      style={[styles.dropdownItem, isSel && styles.dropdownItemSelected]}
                      onPress={() => {
                        setSelectedType(tp);
                        setOpenDropdown(null);
                      }}
                      activeOpacity={0.7}>
                      <Text style={[styles.dropdownItemText, isSel && styles.dropdownItemTextSelected]}>
                        {tp}
                      </Text>
                      {isSel && <Ionicons name="checkmark" size={13} color="#38bdf8" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* 3. Destination Dropdown */}
          <View style={[styles.dropdownCol, openDropdown === 'dest' && { zIndex: 120 }]}>
            <Text style={styles.dropdownLabel}>Destination</Text>
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                selectedDest !== 'All Destinations' && styles.dropdownTriggerActive,
                openDropdown === 'dest' && styles.dropdownTriggerOpen,
              ]}
              onPress={() => setOpenDropdown(openDropdown === 'dest' ? null : 'dest')}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.dropdownValueText,
                  selectedDest !== 'All Destinations' && styles.dropdownValueTextActive,
                ]}
                numberOfLines={1}>
                {selectedDest}
              </Text>
              <Ionicons
                name={openDropdown === 'dest' ? "chevron-up" : "chevron-down"}
                size={13}
                color={selectedDest !== 'All Destinations' ? "#38bdf8" : "#94a3b8"}
              />
            </TouchableOpacity>

            {openDropdown === 'dest' && (
              <View style={[styles.dropdownMenu, { maxHeight: 220 }]}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                  {DESTINATIONS.map(dst => {
                    const isSel = selectedDest === dst;
                    return (
                      <TouchableOpacity
                        key={dst}
                        style={[styles.dropdownItem, isSel && styles.dropdownItemSelected]}
                        onPress={() => {
                          setSelectedDest(dst);
                          setOpenDropdown(null);
                        }}
                        activeOpacity={0.7}>
                        <Text style={[styles.dropdownItemText, isSel && styles.dropdownItemTextSelected]}>
                          {dst}
                        </Text>
                        {isSel && <Ionicons name="checkmark" size={13} color="#38bdf8" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* 4. Status Dropdown */}
          <View style={[styles.dropdownCol, openDropdown === 'status' && { zIndex: 120 }]}>
            <Text style={styles.dropdownLabel}>Registration</Text>
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                selectedStatus !== 'All Statuses' && styles.dropdownTriggerActive,
                openDropdown === 'status' && styles.dropdownTriggerOpen,
              ]}
              onPress={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.dropdownValueText,
                  selectedStatus !== 'All Statuses' && styles.dropdownValueTextActive,
                ]}
                numberOfLines={1}>
                {selectedStatus}
              </Text>
              <Ionicons
                name={openDropdown === 'status' ? "chevron-up" : "chevron-down"}
                size={13}
                color={selectedStatus !== 'All Statuses' ? "#38bdf8" : "#94a3b8"}
              />
            </TouchableOpacity>

            {openDropdown === 'status' && (
              <View style={styles.dropdownMenu}>
                {REGISTRATION_STATUSES.map(st => {
                  const isSel = selectedStatus === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.dropdownItem, isSel && styles.dropdownItemSelected]}
                      onPress={() => {
                        setSelectedStatus(st);
                        setOpenDropdown(null);
                      }}
                      activeOpacity={0.7}>
                      <Text style={[styles.dropdownItemText, isSel && styles.dropdownItemTextSelected]}>
                        {st}
                      </Text>
                      {isSel && <Ionicons name="checkmark" size={13} color="#38bdf8" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 4. Events Feed */}
      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loaderText}>Loading chronological calendar...</Text>
        </View>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={36} color="#64748b" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No events match your current filter</Text>
          <Text style={styles.emptySub}>
            Adjust your filters or reset to view all gatherings for 2026 and 2027.
          </Text>
          <TouchableOpacity
            style={styles.resetFilterBtn}
            onPress={() => {
              setSelectedYear('All Years');
              setSelectedType('All Types');
              setSelectedDest('All Destinations');
              setSelectedStatus('All Statuses');
              setOnlyTravelCities(false);
            }}>
            <Text style={styles.resetFilterBtnText}>Reset All Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.eventsCalendar}>
          {/* Grouped by Year and Month */}
          {groupedEvents.map(yearGroup => (
            <View key={yearGroup.year} style={styles.yearSection}>
              <View style={styles.yearBanner}>
                <Text style={styles.yearBannerText}>{yearGroup.year}</Text>
                <View style={styles.yearBannerLine} />
              </View>

              {yearGroup.months.map(monthGroup => (
                <View key={monthGroup.monthName} style={styles.monthSection}>
                  <Text style={styles.monthHeading}>
                    {monthGroup.monthName.toUpperCase()} {yearGroup.year}
                  </Text>

                  {monthGroup.events.map(event => (
                    <EventCardItem
                      key={event.id}
                      event={event}
                      isDesktop={isDesktop}
                      onSelectDetail={setSelectedEventForDetail}
                      onRsvp={handleRsvp}
                      onDownloadIcs={handleDownloadIcs}
                      onOpenEdit={openEditModal}
                      isAdmin={isAdmin}
                      renderStatusBadge={renderStatusBadge}
                    />
                  ))}
                </View>
              ))}
            </View>
          ))}

          {/* 5. Dates to Be Announced Section */}
          {tbaEvents.length > 0 && (
            <View style={styles.tbaSection}>
              <View style={styles.tbaSectionHeader}>
                <Ionicons name="time-outline" size={16} color="#fbbf24" style={{ marginRight: 6 }} />
                <Text style={styles.tbaSectionTitle}>DATES TO BE ANNOUNCED</Text>
              </View>
              <Text style={styles.tbaSectionSub}>
                High-level club expeditions in planning. Exact dates will be confirmed and announced as venues finalize.
              </Text>

              {tbaEvents.map(event => (
                <EventCardItem
                  key={event.id}
                  event={event}
                  isDesktop={isDesktop}
                  onSelectDetail={setSelectedEventForDetail}
                  onRsvp={handleRsvp}
                  onDownloadIcs={handleDownloadIcs}
                  onOpenEdit={openEditModal}
                  isAdmin={isAdmin}
                  renderStatusBadge={renderStatusBadge}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* 6. Event Detail Modal */}
      <Modal
        visible={!!selectedEventForDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedEventForDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedEventForDetail && (
              <ScrollView contentContainerStyle={styles.modalScroll}>
                {/* Hero Image */}
                <View style={styles.modalHeroWrap}>
                  <Image
                    source={{ uri: selectedEventForDetail.hero_image || 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=1200' }}
                    style={styles.modalHeroImage}
                    resizeMode="cover"
                  />
                  <View style={styles.modalHeroGradient} />

                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedEventForDetail(null)}
                    activeOpacity={0.8}>
                    <Ionicons name="close" size={20} color="#ffffff" />
                  </TouchableOpacity>

                  <View style={styles.modalHeroBadgeRow}>
                    <View style={styles.typeTag}>
                      <Text style={styles.typeTagText}>
                        {(selectedEventForDetail.event_type || 'SUMMIT').toUpperCase()}
                      </Text>
                    </View>
                    {renderStatusBadge(selectedEventForDetail.registration_status)}
                  </View>
                </View>

                {/* Content Header */}
                <View style={styles.modalBody}>
                  <Text style={styles.modalTitle}>
                    {selectedEventForDetail.headline || selectedEventForDetail.title}
                  </Text>

                  {/* Dates & Location */}
                  <View style={styles.modalInfoCard}>
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="calendar-outline" size={16} color="#38bdf8" style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalInfoLabel}>DATES &amp; TIME</Text>
                        <Text style={styles.modalInfoValue}>
                          {selectedEventForDetail.display_date || selectedEventForDetail.start_date || 'Dates to be announced'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.modalInfoDivider} />

                    <View style={styles.modalInfoRow}>
                      <Ionicons name="location-outline" size={16} color="#38bdf8" style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalInfoLabel}>DESTINATION &amp; VENUE</Text>
                        <Text style={styles.modalInfoValue}>{selectedEventForDetail.location}</Text>
                        <Text style={styles.modalInfoSub}>
                          Venue: {selectedEventForDetail.venue && selectedEventForDetail.venue !== 'To be confirmed' ? selectedEventForDetail.venue : 'To be confirmed'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.modalInfoDivider} />

                    <View style={styles.modalInfoRow}>
                      <Ionicons name="people-outline" size={16} color="#38bdf8" style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalInfoLabel}>CAPACITY &amp; AVAILABILITY</Text>
                        <Text style={styles.modalInfoValue}>
                          {selectedEventForDetail.capacity && selectedEventForDetail.capacity > 0
                            ? `${selectedEventForDetail.capacity} Maximum Capacity · ${selectedEventForDetail.available_spots ?? 'TBD'} spots available`
                            : 'Capacity to be confirmed'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Overview Description */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionHeading}>OVERVIEW</Text>
                    <Text style={styles.modalParagraph}>{selectedEventForDetail.description}</Text>
                  </View>

                  {/* Agenda Breakdown */}
                  {selectedEventForDetail.agenda && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionHeading}>AGENDA &amp; SCHEDULE</Text>
                      <View style={styles.agendaCard}>
                        <Text style={styles.agendaText}>{selectedEventForDetail.agenda}</Text>
                      </View>
                    </View>
                  )}

                  {/* Route Extension / Travel Info */}
                  {selectedEventForDetail.travel_info && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionHeading}>TRAVEL &amp; ACCOMMODATIONS</Text>
                      <View style={styles.travelCard}>
                        <Ionicons name="airplane-outline" size={16} color="#38bdf8" style={{ marginRight: 8, marginTop: 2 }} />
                        <Text style={styles.travelText}>{selectedEventForDetail.travel_info}</Text>
                      </View>
                    </View>
                  )}

                  {/* Hosts & Organizers */}
                  {selectedEventForDetail.hosts && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionHeading}>HOSTS &amp; LEADERSHIP</Text>
                      <View style={styles.hostsCard}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#fbbf24" style={{ marginRight: 8 }} />
                        <Text style={styles.hostsText}>{selectedEventForDetail.hosts}</Text>
                      </View>
                    </View>
                  )}

                  {/* Pricing & What's Included */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionHeading}>PRICING &amp; INCLUSIONS</Text>
                    <View style={styles.inclusionsCard}>
                      <Text style={styles.priceHeading}>
                        Pricing: {selectedEventForDetail.price || 'To be confirmed'}
                      </Text>
                      <Text style={styles.inclusionsText}>
                        {selectedEventForDetail.whats_included || 'Private executive sessions, networking receptions, curated dinners, and masterclasses.'}
                      </Text>
                    </View>
                  </View>

                  {/* Personal Calendar Action Row */}
                  <View style={styles.calActionRow}>
                    <TouchableOpacity
                      style={styles.calExportBtn}
                      onPress={() => handleDownloadIcs(selectedEventForDetail)}
                      activeOpacity={0.8}>
                      <Ionicons name="download-outline" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
                      <Text style={styles.calExportBtnText}>Download .ICS File</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.calExportBtn}
                      onPress={() => handleOpenGoogleCalendar(selectedEventForDetail)}
                      activeOpacity={0.8}>
                      <Ionicons name="logo-google" size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                      <Text style={styles.calExportBtnText}>Add to Google Calendar</Text>
                    </TouchableOpacity>
                  </View>

                  {/* RSVP Primary Button */}
                  {selectedEventForDetail.registration_status === 'open' && (
                    <TouchableOpacity
                      style={[
                        styles.modalPrimaryRsvpBtn,
                        selectedEventForDetail.user_rsvp === 'registered' && styles.modalPrimaryRsvpBtnActive
                      ]}
                      onPress={() => handleRsvp(selectedEventForDetail)}
                      activeOpacity={0.8}>
                      <Text style={styles.modalPrimaryRsvpBtnText}>
                        {selectedEventForDetail.user_rsvp === 'registered' ? 'Cancel Seat Reservation' : 'Confirm Registration & Reserve Seat'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 7. Administrator Edit Modal */}
      <Modal
        visible={!!editingEvent}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingEvent(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
            <ScrollView contentContainerStyle={styles.adminModalScroll}>
              <View style={styles.adminModalHeader}>
                <Text style={styles.adminModalTitle}>Edit Event (Administrator)</Text>
                <TouchableOpacity onPress={() => setEditingEvent(null)}>
                  <Ionicons name="close" size={22} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.adminInputLabel}>EVENT HEADLINE</Text>
              <TextInput
                style={styles.adminInput}
                value={editFormData.headline}
                onChangeText={txt => setEditFormData(p => ({ ...p, headline: txt }))}
                placeholder="Enter event headline..."
                placeholderTextColor="#64748b"
              />

              <Text style={styles.adminInputLabel}>EVENT TYPE</Text>
              <TextInput
                style={styles.adminInput}
                value={editFormData.event_type}
                onChangeText={txt => setEditFormData(p => ({ ...p, event_type: txt }))}
                placeholder="Summit, Retreat, Trek, etc."
                placeholderTextColor="#64748b"
              />

              <Text style={styles.adminInputLabel}>DISPLAY DATE STRING</Text>
              <TextInput
                style={styles.adminInput}
                value={editFormData.display_date}
                onChangeText={txt => setEditFormData(p => ({ ...p, display_date: txt }))}
                placeholder="e.g. November 13–15, 2026"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.adminInputLabel}>VENUE / MEETING LOCATION</Text>
              <TextInput
                style={styles.adminInput}
                value={editFormData.venue}
                onChangeText={txt => setEditFormData(p => ({ ...p, venue: txt }))}
                placeholder="Specific venue or 'To be confirmed'"
                placeholderTextColor="#64748b"
              />

              <View style={styles.adminInputRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.adminInputLabel}>CAPACITY</Text>
                  <TextInput
                    style={styles.adminInput}
                    value={String(editFormData.capacity ?? 0)}
                    onChangeText={txt => setEditFormData(p => ({ ...p, capacity: parseInt(txt, 10) || 0 }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminInputLabel}>REGISTRATION STATUS</Text>
                  <TextInput
                    style={styles.adminInput}
                    value={editFormData.registration_status}
                    onChangeText={txt => setEditFormData(p => ({ ...p, registration_status: txt as any }))}
                    placeholder="open, coming_soon, full, closed"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Text style={styles.adminInputLabel}>PRICE</Text>
              <TextInput
                style={styles.adminInput}
                value={editFormData.price}
                onChangeText={txt => setEditFormData(p => ({ ...p, price: txt }))}
                placeholder="Included or 'To be confirmed'"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.adminInputLabel}>DESCRIPTION</Text>
              <TextInput
                style={[styles.adminInput, { minHeight: 80 }]}
                value={editFormData.description}
                onChangeText={txt => setEditFormData(p => ({ ...p, description: txt }))}
                multiline
                placeholder="2-3 sentence overview..."
                placeholderTextColor="#64748b"
              />

              <Text style={styles.adminInputLabel}>AGENDA</Text>
              <TextInput
                style={[styles.adminInput, { minHeight: 80 }]}
                value={editFormData.agenda || ''}
                onChangeText={txt => setEditFormData(p => ({ ...p, agenda: txt }))}
                multiline
                placeholder="Day-by-day agenda..."
                placeholderTextColor="#64748b"
              />

              <Text style={styles.adminInputLabel}>COVER PHOTO PREVIEW</Text>
              <View style={styles.adminPreviewBox}>
                {editFormData.hero_image ? (
                  <Image
                    source={{ uri: resolveImageUrl(editFormData.hero_image) }}
                    style={styles.adminPreviewImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.adminPreviewEmpty}>
                    <Ionicons name="image-outline" size={28} color="#64748b" />
                    <Text style={styles.adminPreviewEmptyText}>No cover photo selected</Text>
                  </View>
                )}
              </View>

              <Text style={styles.adminInputLabel}>COVER PHOTO URL</Text>
              <TextInput
                style={styles.adminInput}
                value={editFormData.hero_image}
                onChangeText={txt => setEditFormData(p => ({ ...p, hero_image: txt }))}
                placeholder="/events/miami_networking.jpg or https://..."
                placeholderTextColor="#64748b"
              />

              <Text style={styles.adminInputLabel}>DESTINATION PRESETS (TAP TO APPLY)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {COVER_IMAGE_PRESETS.map(preset => {
                  const isSel = editFormData.hero_image === preset.url;
                  return (
                    <TouchableOpacity
                      key={preset.url}
                      style={[styles.presetPill, isSel && styles.presetPillActive]}
                      onPress={() => setEditFormData(p => ({ ...p, hero_image: preset.url }))}
                      activeOpacity={0.8}>
                      <Text style={[styles.presetPillText, isSel && styles.presetPillTextActive]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={styles.adminUploadBtn}
                  onPress={() => {
                    if (typeof document !== 'undefined') {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e: any) => {
                        const file = e.target?.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const base64 = reader.result as string;
                            try {
                              const res = await ApiService.uploadEventImage(currentUserId, base64);
                              if (res.success && res.url) {
                                setEditFormData(p => ({ ...p, hero_image: res.url }));
                              } else {
                                setEditFormData(p => ({ ...p, hero_image: base64 }));
                              }
                            } catch (_) {
                              setEditFormData(p => ({ ...p, hero_image: base64 }));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }
                  }}
                  activeOpacity={0.8}>
                  <Ionicons name="cloud-upload-outline" size={15} color="#38bdf8" style={{ marginRight: 6 }} />
                  <Text style={styles.adminUploadBtnText}>Upload Cover Image from Computer</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.adminSaveBtn}
                onPress={handleSaveEdit}
                disabled={isSubmittingEdit}
                activeOpacity={0.8}>
                {isSubmittingEdit ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.adminSaveBtnText}>Save Event Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080c18',
  },
  contentContainer: {
    paddingBottom: 60,
  },
  headerBlock: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38bdf8',
  },
  tagText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headline: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtext: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#0c1222',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  modeBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },

  // Spotlight Next Event Card
  spotlightCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 16,
    padding: 18,
    boxShadow: '0 4px 20px rgba(56, 189, 248, 0.08)',
  },
  spotlightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  spotlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  spotlightPillText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  spotlightBodyRow: {
    flexDirection: 'row',
    gap: 16,
  },
  spotlightDateBlock: {
    width: 90,
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  spotlightDateDays: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  spotlightDateMonth: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  spotlightDateYear: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  spotlightContent: {
    flex: 1,
  },
  spotlightTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaLocation: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  metaDot: {
    color: '#64748b',
    marginHorizontal: 6,
  },
  metaType: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  spotlightDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  spotlightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OzaraTheme.colors.accentViolet,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  rsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  rsvpBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  rsvpBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  iconCalBtn: {
    padding: 8,
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },

  // Filters Section
  filterSection: {
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 12,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filterSectionTitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  filterHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  travelFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 7,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  travelFilterBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  travelFilterBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  resetAllBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  dropdownsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dropdownCol: {
    flex: 1,
    minWidth: 140,
    position: 'relative',
  },
  dropdownLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  dropdownTriggerActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  dropdownTriggerOpen: {
    borderColor: '#38bdf8',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownValueText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  dropdownValueTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#0b1329',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 999,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  dropdownItemText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  dropdownItemTextSelected: {
    color: '#38bdf8',
    fontWeight: '700',
  },

  // Events Feed
  loaderBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loaderText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 10,
  },
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 30,
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetFilterBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  resetFilterBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },

  eventsCalendar: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  yearSection: {
    marginBottom: 26,
  },
  yearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  yearBannerText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  yearBannerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  monthSection: {
    marginBottom: 18,
  },
  monthHeading: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },

  // Event Card
  eventCard: {
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
    ...Platform.select({
      web: {
        transition: 'border-color 0.2s ease, transform 0.2s ease',
      },
    }),
  },
  eventCardDesktop: {
    flexDirection: 'row',
    minHeight: 250,
  },
  eventCardMobile: {
    flexDirection: 'column',
  },
  eventCardTba: {
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },

  // Cover Image Section (Left on Desktop, Top on Mobile)
  cardImageContainer: {
    position: 'relative',
    backgroundColor: '#070b14',
    overflow: 'hidden',
  },
  cardImageContainerDesktop: {
    width: 340,
    minHeight: 250,
  },
  cardImageContainerMobile: {
    width: '100%',
    height: 210,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageLoadingSkeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#070b14',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  imageVignetteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#090e1c',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
  },
  imageFallbackCity: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 8,
    textAlign: 'center',
  },
  imageFallbackBrand: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 4,
    textAlign: 'center',
  },

  // Floating Prominent Date Badge
  floatingDateBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(9, 14, 28, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  floatingDateBadgeTba: {
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  floatingDateBadgeDays: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  floatingDateBadgeMonth: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  floatingDateBadgeMonthOnly: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  floatingDateBadgeYear: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  floatingDateSubTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
    marginTop: 4,
  },
  floatingDateSubTagText: {
    color: '#38bdf8',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  floatingDateTbaText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardDateTopText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 'auto',
  },

  // Main Card Content on Right
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  typeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
  },
  typeTagText: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
  },
  statusBadgeOpen: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusBadgeComingSoon: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  statusBadgeFull: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  statusBadgeClosed: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  dotEmerald: { backgroundColor: '#10b981' },
  dotAmber: { backgroundColor: '#fbbf24' },
  dotPurple: { backgroundColor: '#c084fc' },
  dotSlate: { backgroundColor: '#94a3b8' },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  textEmerald: { color: '#10b981' },
  textAmber: { color: '#fbbf24' },
  textPurple: { color: '#c084fc' },
  textSlate: { color: '#94a3b8' },
  rsvpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    gap: 3,
  },
  rsvpBadgeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  locationText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  venueText: {
    color: '#94a3b8',
    fontSize: 11,
    fontStyle: 'italic',
  },
  cardDescription: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  cardMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OzaraTheme.colors.accentViolet,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  detailsBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardRsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  cardRsvpBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  cardRsvpBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  calIconBtn: {
    padding: 7,
    backgroundColor: '#090e1c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 7,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  adminEditBtn: {
    padding: 7,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 7,
    marginLeft: 'auto',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },

  // Dates To Be Announced Section
  tbaSection: {
    marginTop: 10,
    marginBottom: 30,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  tbaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tbaSectionTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tbaSectionSub: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },

  // Modal Detail Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  modalScroll: {
    paddingBottom: 40,
  },
  modalHeroWrap: {
    position: 'relative',
    width: '100%',
    height: 220,
    backgroundColor: '#090e1c',
  },
  modalHeroImage: {
    width: '100%',
    height: '100%',
  },
  modalHeroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(12, 18, 34, 0.55)',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 20,
    padding: 6,
    zIndex: 10,
  },
  modalHeroBadgeRow: {
    position: 'absolute',
    bottom: 14,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalBody: {
    padding: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 14,
  },
  modalInfoCard: {
    backgroundColor: '#090e1c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalInfoLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  modalInfoValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalInfoSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  modalInfoDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionHeading: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  modalParagraph: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 20,
  },
  agendaCard: {
    backgroundColor: '#090e1c',
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
    borderRadius: 8,
    padding: 12,
  },
  agendaText: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 19,
  },
  travelCard: {
    flexDirection: 'row',
    backgroundColor: '#090e1c',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  travelText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
  hostsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090e1c',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  hostsText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  inclusionsCard: {
    backgroundColor: '#090e1c',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  priceHeading: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  inclusionsText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  calActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 16,
  },
  calExportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090e1c',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 8,
    paddingVertical: 10,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  calExportBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  modalPrimaryRsvpBtn: {
    backgroundColor: OzaraTheme.colors.accentViolet,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  modalPrimaryRsvpBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  modalPrimaryRsvpBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Admin Modal Styles
  adminModalScroll: {
    padding: 20,
  },
  adminModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  adminModalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  adminInputLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 5,
    marginTop: 10,
  },
  adminInput: {
    backgroundColor: '#090e1c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 13,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  adminInputRow: {
    flexDirection: 'row',
  },
  adminSaveBtn: {
    backgroundColor: OzaraTheme.colors.accentViolet,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  adminSaveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  adminPreviewBox: {
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#070b14',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  adminPreviewImg: {
    width: '100%',
    height: '100%',
  },
  adminPreviewEmpty: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminPreviewEmptyText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 6,
  },
  presetPill: {
    backgroundColor: '#0c1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  presetPillActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  presetPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  presetPillTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  adminUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 12,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  adminUploadBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
});
