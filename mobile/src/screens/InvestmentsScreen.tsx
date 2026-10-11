/**
 * ÖZARA Mobile: Investments Screen
 * Luxury branded catalog featuring Curated Real Estate and Private Tech Companies.
 * Invariants:
 * - Two top-level categories: Real Estate (active) and Private Tech Companies ("Coming soon").
 * - Provider confidentiality: Zero data provider branding in UI; stored internally.
 * - 4 property categories: Residential, Countryside, Commercial, Private Islands.
 * - Dynamic filters: Country, dependent City, Budget, Bedrooms, Type, Features, Sorting.
 * - Verified original prices & currencies, original photos, specs, and badges.
 * - Project-to-unit relationships with full unit browsing.
 * - Saved listings linked to stable IDs.
 * - "Request details" primary action routed to ÖZARA real estate admin.
 * - Disclaimers: "Updated..." timestamp and "Price and availability subject to confirmation."
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Linking,
  Dimensions,
  Platform,
} from 'react-native';
import {
  ApiService,
  RealEstateCatalogItem,
  RealEstateUnitItem,
  CatalogFilterOptions,
  CatalogCategory,
  API_BASE_URL,
  CURRENT_ACCESS_CONDITIONS_VERSION,
  resolveImageUrl,
} from '../services/api';
import { useClub } from '../context/ClubContext';
import { OzaraTheme } from '../constants/ozara-theme';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

type TopCategory = 'real_estate' | 'private_tech';
type ViewMode = 'landing' | 'results';
type PropertyCategory = string;
type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'title';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CANONICAL_PROPERTY_TYPES = [
  { name: 'Residential', icon_key: 'residential' },
  { name: 'Commercial', icon_key: 'commercial' },
  { name: 'Parking', icon_key: 'parking' },
  { name: 'Land', icon_key: 'land' },
  { name: 'Countryside', icon_key: 'countryside' },
  { name: 'Private Islands', icon_key: 'private_islands' },
  { name: 'Pools', icon_key: 'pools' },
];

interface ListingCardImageCarouselProps {
  itemId: string;
  images: string[];
  currentIndex: number;
  onPrev: (e: any) => void;
  onNext: (e: any) => void;
  propertyType: string;
  isSaved?: boolean;
  onToggleSave?: (e: any) => void;
  hasUnits?: boolean;
  unitsCount?: number;
}

const ListingCardImageCarousel: React.FC<ListingCardImageCarouselProps> = ({
  itemId,
  images,
  currentIndex,
  onPrev,
  onNext,
  propertyType,
  isSaved,
  onToggleSave,
  hasUnits,
  unitsCount,
}) => {
  const safeImages = images && images.length > 0 ? images : [`/api/media/catalog/${itemId}/cards/${itemId}_0.webp`];
  const curIdx = Math.min(Math.max(0, currentIndex), safeImages.length - 1);
  const currentUrl = safeImages[curIdx] || safeImages[0];
  const hasMultiple = safeImages.length > 1;

  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Proactively prefetch adjacent photos (next and previous) into memory and disk
  useEffect(() => {
    if (!hasMultiple) return;
    const nextIdx = (curIdx + 1) % safeImages.length;
    const prevIdx = (curIdx - 1 + safeImages.length) % safeImages.length;
    const nextUrl = resolveImageUrl(safeImages[nextIdx]);
    const prevUrl = resolveImageUrl(safeImages[prevIdx]);
    if (nextUrl) {
      try { ExpoImage.prefetch(nextUrl); } catch (e) {}
    }
    if (prevUrl) {
      try { ExpoImage.prefetch(prevUrl); } catch (e) {}
    }
  }, [curIdx, safeImages, hasMultiple]);

  // Reset error state when switching photos
  useEffect(() => {
    setHasError(false);
  }, [curIdx]);

  return (
    <View style={styles.cardPhotoWrapper}>
      <ExpoImage
        key={`${itemId}_${curIdx}_${retryKey}`}
        source={{ uri: resolveImageUrl(currentUrl) }}
        style={styles.cardImage}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        priority="high"
        onError={() => setHasError(true)}
        onLoad={() => setHasError(false)}
      />

      {/* Subtle bottom gradient vignette */}
      <View style={styles.photoOverlay} />

      {/* Error & Retry Fallback */}
      {hasError && (
        <View style={styles.imageErrorContainer}>
          <Ionicons name="image-outline" size={24} color="#8e929b" />
          <Text style={styles.imageErrorText}>Photo buffering...</Text>
          <TouchableOpacity
            style={styles.imageRetryBtn}
            onPress={(e) => {
              e.stopPropagation();
              setHasError(false);
              setRetryKey((k) => k + 1);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={12} color="#ffffff" />
            <Text style={styles.imageRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Left Arrow Button */}
      {hasMultiple && (
        <TouchableOpacity
          style={[styles.carouselBtn, styles.carouselPrevBtn]}
          onPress={onPrev}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={16} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* Right Arrow Button */}
      {hasMultiple && (
        <TouchableOpacity
          style={[styles.carouselBtn, styles.carouselNextBtn]}
          onPress={onNext}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={16} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* Photo Counter Badge (📷 1 / N) */}
      <View style={styles.photoCountPill}>
        <Ionicons name="camera-outline" size={11} color="#ffffff" />
        <Text style={styles.photoCountText}>
          {curIdx + 1} / {safeImages.length}
        </Text>
      </View>

      {/* Top Badges */}
      <View style={styles.photoTopRow}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{propertyType}</Text>
        </View>
        {onToggleSave && (
          <TouchableOpacity
            style={[styles.saveIconBtn, isSaved && styles.saveIconBtnActive]}
            onPress={onToggleSave}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={14}
              color={isSaved ? OzaraTheme.colors.accentGold : '#ffffff'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Units Available Indicator */}
      {hasUnits && (
        <View style={styles.unitsIndicatorPill}>
          <Ionicons name="layers-outline" size={11} color="#ffffff" />
          <Text style={styles.unitsIndicatorText}>
            {unitsCount} Units Available
          </Text>
        </View>
      )}
    </View>
  );
};

export const InvestmentsScreen: React.FC = () => {
  const { currentUserId, refreshUserData, openConditions } = useClub();

  // Top-Level Category State
  const [topCategory, setTopCategory] = useState<TopCategory>('real_estate');

  // View Mode: Landing Page vs Category Results
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [showTechModal, setShowTechModal] = useState<boolean>(false);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Properties');
  const [cardPhotoIndices, setCardPhotoIndices] = useState<Record<string, number>>({});
  const [categoryRemovedNotice, setCategoryRemovedNotice] = useState<boolean>(false);

  // Catalog State
  const [listings, setListings] = useState<RealEstateCatalogItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [filterOptions, setFilterOptions] = useState<CatalogFilterOptions | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);

  // Active Filters
  const [selectedType, setSelectedType] = useState<PropertyCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedBedrooms, setSelectedBedrooms] = useState<string>('any');
  const [selectedSort, setSelectedSort] = useState<SortOption>('newest');
  const [viewSavedOnly, setViewSavedOnly] = useState<boolean>(false);

  // Filter Modals
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [showSortModal, setShowSortModal] = useState<boolean>(false);

  // Listing Detail Modal State
  const [selectedListing, setSelectedListing] = useState<RealEstateCatalogItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  // Units Browser & Inquiry State
  const [selectedUnit, setSelectedUnit] = useState<RealEstateUnitItem | null>(null);
  const [showInquiryModal, setShowInquiryModal] = useState<boolean>(false);
  const [inquiryNotes, setInquiryNotes] = useState<string>('');
  const [submittingInquiry, setSubmittingInquiry] = useState<boolean>(false);

  // Sync Status State
  const [syncStatus, setSyncStatus] = useState<any>(null);

  // 1. Load Catalog from Backend
  const loadCatalog = async (resetOffset: boolean = true) => {
    try {
      if (resetOffset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = resetOffset ? 0 : offset;
      const resp = await ApiService.getCatalog({
        viewerId: currentUserId || undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        country: selectedCountry !== 'all' ? selectedCountry : undefined,
        city: selectedCity !== 'all' ? selectedCity : undefined,
        bedrooms: selectedBedrooms !== 'any' ? selectedBedrooms : undefined,
        q: searchQuery.trim() || undefined,
        sort: selectedSort,
        limit: 20,
        offset: currentOffset,
      });

      if (resp && resp.listings) {
        if (resetOffset) {
          setListings(resp.listings);
        } else {
          setListings(prev => [...prev, ...resp.listings]);
        }
        setTotalCount(resp.total);
        setHasMore(resp.has_more);
        setLastUpdated(resp.last_updated);
        if (resp.filter_options) {
          setFilterOptions(resp.filter_options);
        }
        if (!resetOffset) {
          setOffset(currentOffset + resp.listings.length);
        } else {
          setOffset(resp.listings.length);
        }
      }
    } catch (err) {
      console.warn('Error loading investments catalog:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await ApiService.getCatalogCategories();
      if (res && res.categories) {
        setCategories(res.categories);
        if (selectedCategory !== 'All Properties' && selectedCategory !== 'all') {
          const exists = CANONICAL_PROPERTY_TYPES.some(c => c.name.toLowerCase() === selectedCategory.toLowerCase()) ||
                         res.categories.some(c => c.name.toLowerCase() === selectedCategory.toLowerCase());
          if (!exists) {
            setSelectedCategory('All Properties');
            setSelectedType('all');
            setCategoryRemovedNotice(true);
          }
        }
      }
    } catch (e) {
      console.warn('Error fetching categories:', e);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadCatalog(true);
  }, [selectedType, selectedCountry, selectedCity, selectedBedrooms, selectedSort, searchQuery]);

  const openCategoryResults = (catName: string) => {
    setSelectedCategory(catName);
    if (catName === 'All Properties' || catName === 'all') {
      setSelectedType('all');
    } else {
      setSelectedType(catName);
    }
    setViewMode('results');
  };

  const backToLanding = () => {
    setViewMode('landing');
  };

  const handleCardPhotoPrev = (listingId: string, total: number, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setCardPhotoIndices(prev => {
      const cur = prev[listingId] || 0;
      const next = (cur - 1 + total) % total;
      return { ...prev, [listingId]: next };
    });
  };

  const handleCardPhotoNext = (listingId: string, total: number, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setCardPhotoIndices(prev => {
      const cur = prev[listingId] || 0;
      const next = (cur + 1) % total;
      return { ...prev, [listingId]: next };
    });
  };

  // Dependent City options based on selected Country
  const availableCities = useMemo(() => {
    if (!filterOptions || selectedCountry === 'all') return [];
    return filterOptions.cities_by_country[selectedCountry] || [];
  }, [filterOptions, selectedCountry]);

  // When Country changes, reset dependent City if not in available cities
  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    setSelectedCity('all');
  };

  const handleClearFilters = () => {
    setSelectedCategory('All Properties');
    setSelectedType('all');
    setSelectedCountry('all');
    setSelectedCity('all');
    setSelectedBedrooms('any');
    setSearchQuery('');
    setSelectedSort('newest');
    setViewSavedOnly(false);
  };

  const hasActiveFilters =
    selectedCategory !== 'All Properties' ||
    selectedType !== 'all' ||
    selectedCountry !== 'all' ||
    selectedCity !== 'all' ||
    selectedBedrooms !== 'any' ||
    Boolean(searchQuery.trim()) ||
    selectedSort !== 'newest';

  // Toggle Save Listing
  const handleToggleSave = async (listingId: string, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to save properties to your private watchlist.');
      return;
    }

    // Optimistic UI update
    setListings(prev =>
      prev.map(item => (item.id === listingId ? { ...item, is_saved: !item.is_saved } : item))
    );
    if (selectedListing && selectedListing.id === listingId) {
      setSelectedListing(prev => (prev ? { ...prev, is_saved: !prev.is_saved } : null));
    }

    try {
      await ApiService.toggleSaveListing(listingId, currentUserId);
    } catch (err) {
      // Revert if error
      setListings(prev =>
        prev.map(item => (item.id === listingId ? { ...item, is_saved: !item.is_saved } : item))
      );
    }
  };

  // Open Listing Detail
  const handleOpenDetail = async (item: RealEstateCatalogItem) => {
    setSelectedListing(item);
    setActivePhotoIndex(0);
    setSelectedUnit(null);
    setDetailLoading(true);

    try {
      const fullDetail = await ApiService.getCatalogItem(item.id, currentUserId || undefined);
      if (fullDetail) {
        setSelectedListing(fullDetail);
      }
    } catch (err) {
      console.warn('Error fetching full property detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit Inquiry / Request Details
  const handleRequestDetailsSubmit = async () => {
    if (!selectedListing) return;
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to request property details and allocation availability.');
      return;
    }

    try {
      setSubmittingInquiry(true);
      const res = await ApiService.requestPropertyDetails(
        selectedListing.id,
        currentUserId,
        selectedUnit ? selectedUnit.id : undefined,
        inquiryNotes || undefined
      );

      if (res.success) {
        setShowInquiryModal(false);
        setInquiryNotes('');
        setSelectedUnit(null);
        Alert.alert(
          'Request Received',
          `Your details request for "${selectedListing.title}" has been registered. An ÖZARA real estate advisor will follow up with verified documentation.`,
          [{ text: 'Done', style: 'default' }]
        );
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('CONDITIONS_NOT_ACCEPTED') || errMsg.includes('Access Conditions')) {
        Alert.alert(
          'Access Conditions Required',
          `Viewing detailed real estate materials requires accepting the latest Access Conditions (v${CURRENT_ACCESS_CONDITIONS_VERSION}).`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Review Conditions',
              onPress: () => {
                setShowInquiryModal(false);
                openConditions('tabs');
              },
            },
            {
              text: 'Accept Now',
              onPress: async () => {
                try {
                  await ApiService.acceptConditions(currentUserId, CURRENT_ACCESS_CONDITIONS_VERSION);
                  await refreshUserData();
                  Alert.alert('Conditions Accepted', 'You may now submit your property inquiry.');
                } catch (e: any) {
                  Alert.alert('Error', e.message);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Inquiry Error', errMsg || 'Could not submit inquiry');
      }
    } finally {
      setSubmittingInquiry(false);
    }
  };

  // Filtered list if "Saved only" is toggled
  const displayedListings = useMemo(() => {
    if (viewSavedOnly) {
      return listings.filter(item => item.is_saved);
    }
    return listings;
  }, [listings, viewSavedOnly]);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Investments</Text>
        <Text style={styles.headerSubtitle}>
          Vetted prime opportunities curated exclusively for{' '}
          <Text style={styles.headerSubtitleHighlight}>ÖZARA club members</Text>.
        </Text>
      </View>

      {/* ============================================================== */}
      {/* 1. LANDING VIEW: ONLY 2 SQUARE CARDS INLINE                     */}
      {/* ============================================================== */}
      {viewMode === 'landing' ? (
        <ScrollView style={styles.catalogScroll} contentContainerStyle={styles.landingTwoSquaresContainer}>
          <View style={styles.twoSquaresRow}>
            {/* 1. Curated Real Estate Square Card */}
            <TouchableOpacity
              style={styles.mainSquareCard}
              activeOpacity={0.88}
              onPress={() => openCategoryResults('All Properties')}
            >
              <View style={styles.squareArtWrap}>
                <Image
                  source={{ uri: `${API_BASE_URL}/investments/real_estate_card.jpg` }}
                  style={styles.squareArtImg}
                  resizeMode="cover"
                />
                <View style={styles.squareBadge}>
                  <Text style={styles.squareBadgeText}>{totalCount || 239} Properties</Text>
                </View>
              </View>
              <View style={styles.squareTextWrap}>
                <Text style={styles.squareTitle}>Curated Real Estate</Text>
                <Text style={styles.squareDesc} numberOfLines={3}>
                  Explore verified prime developments, private islands, and luxury portfolios curated for ÖZARA members.
                </Text>
                <View style={styles.squareActionRow}>
                  <Text style={styles.squareActionText}>Explore portfolio</Text>
                  <Ionicons name="arrow-forward" size={12} color="#ffffff" />
                </View>
              </View>
            </TouchableOpacity>

            {/* 2. Private Tech Companies Square Card */}
            <TouchableOpacity
              style={styles.mainSquareCard}
              activeOpacity={0.88}
              onPress={() => setShowTechModal(true)}
            >
              <View style={styles.squareArtWrap}>
                <Image
                  source={{ uri: `${API_BASE_URL}/investments/tech_companies_card.jpg` }}
                  style={styles.squareArtImg}
                  resizeMode="cover"
                />
                <View style={[styles.squareBadge, styles.squareBadgeSoon]}>
                  <Text style={styles.squareBadgeSoonText}>Coming soon</Text>
                </View>
              </View>
              <View style={styles.squareTextWrap}>
                <Text style={styles.squareTitle}>Private Tech Companies</Text>
                <Text style={styles.squareDesc} numberOfLines={3}>
                  Direct venture allocations, secondary liquidity, and syndicated co-investments in high-growth AI and deep tech.
                </Text>
                <View style={styles.squareActionRow}>
                  <Text style={[styles.squareActionText, { color: '#a78bfa' }]}>Allocations soon</Text>
                  <Ionicons name="time-outline" size={12} color="#a78bfa" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* ============================================================== */
        /* 2. REAL ESTATE BROWSING PAGE (8-TILES STRIP & LISTINGS GRID)    */
        /* ============================================================== */
        <ScrollView style={styles.catalogScroll} contentContainerStyle={styles.catalogContent}>
          {/* Top Navigation Row: Back Button & Breadcrumbs */}
          <View style={styles.resultsHeaderRow}>
            <TouchableOpacity style={styles.backBtn} onPress={backToLanding}>
              <Ionicons name="arrow-back" size={16} color="#ffffff" />
              <Text style={styles.backBtnText}>Investments</Text>
            </TouchableOpacity>
            <Text style={styles.resultsBreadcrumbText} numberOfLines={1}>
              Investments / Real Estate / <Text style={{ color: '#ffffff' }}>{selectedCategory === 'All Properties' ? 'All Listings' : selectedCategory}</Text>
            </Text>
          </View>

          {/* Horizontal Scrolling Compact Category Row Below Header */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.compactCatStrip}
            contentContainerStyle={styles.compactCatStripContent}
          >
            {/* Tile 1: All Properties */}
            <TouchableOpacity
              style={[
                styles.compactCatCard,
                (selectedCategory === 'All Properties' || selectedCategory === 'all') && styles.compactCatCardActive,
              ]}
              onPress={() => openCategoryResults('All Properties')}
            >
              <View style={styles.compactCatCardInfo}>
                <View style={styles.compactCatTitleRow}>
                  <Text style={styles.compactCatTitle}>All Properties</Text>
                  {(selectedCategory === 'All Properties' || selectedCategory === 'all') && (
                    <Ionicons name="checkmark-circle" size={13} color="#60a5fa" />
                  )}
                </View>
                <Text style={styles.compactCatCount}>{totalCount || 239} available</Text>
              </View>
              <Image
                source={{ uri: `${API_BASE_URL}/investments/icons/fallback.png` }}
                style={styles.compactCatIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* Tiles 2-8: Canonical Categories (Residential, Commercial, Parking, Land, Countryside, Private Islands, Pools) */}
            {CANONICAL_PROPERTY_TYPES.map(item => {
              const found = categories.find(c => c.name.toLowerCase() === item.name.toLowerCase());
              const count = found ? found.count : 0;
              const isActive = selectedCategory.toLowerCase() === item.name.toLowerCase();
              return (
                <TouchableOpacity
                  key={item.name}
                  style={[styles.compactCatCard, isActive && styles.compactCatCardActive]}
                  onPress={() => openCategoryResults(item.name)}
                >
                  <View style={styles.compactCatCardInfo}>
                    <View style={styles.compactCatTitleRow}>
                      <Text style={styles.compactCatTitle}>{item.name}</Text>
                      {isActive && <Ionicons name="checkmark-circle" size={13} color="#60a5fa" />}
                    </View>
                    <Text style={styles.compactCatCount}>{count} properties</Text>
                  </View>
                  <Image
                    source={{ uri: `${API_BASE_URL}/investments/icons/${item.icon_key}.png` }}
                    style={styles.compactCatIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              );
            })}

            {/* Any extra dynamic categories from database */}
            {categories
              .filter(c => !CANONICAL_PROPERTY_TYPES.some(t => t.name.toLowerCase() === c.name.toLowerCase()))
              .map(cat => {
                const isActive = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                return (
                  <TouchableOpacity
                    key={cat.id || cat.name}
                    style={[styles.compactCatCard, isActive && styles.compactCatCardActive]}
                    onPress={() => openCategoryResults(cat.name)}
                  >
                    <View style={styles.compactCatCardInfo}>
                      <View style={styles.compactCatTitleRow}>
                        <Text style={styles.compactCatTitle}>{cat.name}</Text>
                        {isActive && <Ionicons name="checkmark-circle" size={13} color="#60a5fa" />}
                      </View>
                      <Text style={styles.compactCatCount}>{cat.count} properties</Text>
                    </View>
                    <Image
                      source={{ uri: `${API_BASE_URL}/investments/icons/${cat.icon_key}.png` }}
                      style={styles.compactCatIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                );
              })}
          </ScrollView>

            {/* Category Removed Explanation Banner */}
            {categoryRemovedNotice && (
              <View style={styles.categoryNoticeBanner}>
                <Ionicons name="information-circle-outline" size={16} color="#fde047" />
                <Text style={styles.categoryNoticeText}>
                  The previously selected category is no longer available in the catalog. Showing All Properties.
                </Text>
                <TouchableOpacity onPress={() => setCategoryRemovedNotice(false)}>
                  <Ionicons name="close" size={14} color="#fde047" />
                </TouchableOpacity>
              </View>
            )}

            {/* Search Bar & Filter Buttons */}
            <View style={styles.searchFilterBlock}>
              <View style={styles.searchInputWrapper}>
                <Ionicons name="search" size={16} color={OzaraTheme.colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search country, city, project or district..."
                  placeholderTextColor={OzaraTheme.colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {Boolean(searchQuery) && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                    <Ionicons name="close-circle" size={16} color={OzaraTheme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Quick Filter Row */}
              <View style={styles.filterPillsRow}>
                <TouchableOpacity
                  style={[styles.filterPill, selectedCountry !== 'all' && styles.filterPillActive]}
                  onPress={() => setShowFilterModal(true)}
                >
                  <Ionicons
                    name="options-outline"
                    size={13}
                    color={selectedCountry !== 'all' ? OzaraTheme.colors.accentGold : OzaraTheme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterPillText,
                      selectedCountry !== 'all' && styles.filterPillTextActive,
                    ]}
                  >
                    {selectedCountry !== 'all' ? selectedCountry : 'Filters'}
                  </Text>
                  {hasActiveFilters && <View style={styles.activeDot} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterPill, selectedSort !== 'newest' && styles.filterPillActive]}
                  onPress={() => setShowSortModal(true)}
                >
                  <Ionicons
                    name="swap-vertical"
                    size={13}
                    color={selectedSort !== 'newest' ? OzaraTheme.colors.accentGold : OzaraTheme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterPillText,
                      selectedSort !== 'newest' && styles.filterPillTextActive,
                    ]}
                  >
                    {selectedSort === 'price_asc'
                      ? 'Price: Low'
                      : selectedSort === 'price_desc'
                      ? 'Price: High'
                      : selectedSort === 'title'
                      ? 'Title'
                      : 'Newest'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterPill, viewSavedOnly && styles.filterPillActive]}
                  onPress={() => setViewSavedOnly(!viewSavedOnly)}
                >
                  <Ionicons
                    name={viewSavedOnly ? 'bookmark' : 'bookmark-outline'}
                    size={13}
                    color={viewSavedOnly ? OzaraTheme.colors.accentGold : OzaraTheme.colors.textSecondary}
                  />
                  <Text style={[styles.filterPillText, viewSavedOnly && styles.filterPillTextActive]}>
                    Saved
                  </Text>
                </TouchableOpacity>

                {hasActiveFilters && (
                  <TouchableOpacity style={styles.clearFiltersBtn} onPress={handleClearFilters}>
                    <Text style={styles.clearFiltersText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Results Summary Bar */}
            <View style={styles.resultsSummaryBar}>
              <Text style={styles.resultsCountText}>
                {viewSavedOnly
                  ? `${displayedListings.length} saved properties`
                  : `${totalCount} properties available`}
              </Text>
              {Boolean(lastUpdated) && (
                <Text style={styles.lastUpdatedText}>
                  Updated {new Date(lastUpdated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              )}
            </View>

            {/* Catalog Listings List */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={OzaraTheme.colors.accentGold} />
                <Text style={styles.loadingText}>Curating portfolio...</Text>
              </View>
            ) : displayedListings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={40} color={OzaraTheme.colors.textDim} />
                <Text style={styles.emptyTitle}>No matching properties</Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your search criteria or clearing filters.
                </Text>
                <TouchableOpacity style={styles.emptyResetBtn} onPress={handleClearFilters}>
                  <Text style={styles.emptyResetText}>Reset All Filters</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cardsList}>
                {displayedListings.map(item => {
                  const imgs = item.images && item.images.length > 0
                    ? item.images
                    : ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'];
                  const curIndex = cardPhotoIndices[item.id] || 0;
                  const displayImg = imgs[curIndex] || imgs[0];
                  const hasMultiple = imgs.length > 1;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.card}
                      activeOpacity={0.9}
                      onPress={() => handleOpenDetail(item)}
                    >
                      {/* Photo Container with fixed 4:3 aspect ratio, prefetching, and smooth transitions */}
                      <ListingCardImageCarousel
                        itemId={item.id}
                        images={imgs}
                        currentIndex={curIndex}
                        onPrev={e => handleCardPhotoPrev(item.id, imgs.length, e)}
                        onNext={e => handleCardPhotoNext(item.id, imgs.length, e)}
                        propertyType={item.property_type}
                        isSaved={item.is_saved}
                        onToggleSave={e => handleToggleSave(item.id, e)}
                        hasUnits={item.has_units}
                        unitsCount={item.units_count}
                      />

                  {/* Card Body */}
                  <View style={styles.cardBody}>
                    {/* Location */}
                    <View style={styles.cardLocationRow}>
                      <Ionicons name="location-outline" size={12} color={OzaraTheme.colors.textMuted} />
                      <Text style={styles.cardLocationText} numberOfLines={1}>
                        {item.location || `${item.city}, ${item.country}`}
                      </Text>
                    </View>

                    {/* Title */}
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>

                    {/* Specifications Strip */}
                    <View style={styles.specsRow}>
                      {item.beds !== null && item.beds !== undefined && item.beds > 0 ? (
                        <View style={styles.specItem}>
                          <Ionicons name="bed-outline" size={12} color={OzaraTheme.colors.textSecondary} />
                          <Text style={styles.specText}>{item.beds} Beds</Text>
                        </View>
                      ) : null}

                      {item.baths !== null && item.baths !== undefined && item.baths > 0 ? (
                        <View style={styles.specItem}>
                          <Ionicons name="water-outline" size={12} color={OzaraTheme.colors.textSecondary} />
                          <Text style={styles.specText}>{item.baths} Baths</Text>
                        </View>
                      ) : null}

                      {item.area_range || item.sqft ? (
                        <View style={styles.specItem}>
                          <Ionicons name="expand-outline" size={12} color={OzaraTheme.colors.textSecondary} />
                          <Text style={styles.specText}>{item.area_range || `${item.sqft} m²`}</Text>
                        </View>
                      ) : null}

                      {item.handover ? (
                        <View style={styles.specItem}>
                          <Ionicons name="calendar-outline" size={12} color={OzaraTheme.colors.textSecondary} />
                          <Text style={styles.specText}>{item.handover}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Price and Action Row */}
                    <View style={styles.priceActionRow}>
                      <View style={styles.priceBlock}>
                        <Text style={styles.priceLabel}>STARTING FROM</Text>
                        <Text style={styles.priceValue}>{item.price_display}</Text>
                      </View>

                      <View style={styles.viewDetailPill}>
                        <Text style={styles.viewDetailText}>Details</Text>
                        <Ionicons name="chevron-forward" size={12} color="#ffffff" />
                      </View>
                    </View>

                    <Text style={styles.cardDisclaimer}>Price and availability subject to confirmation.</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

              {/* Load More Button */}
              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => loadCatalog(false)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.loadMoreText}>Load More Properties</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Footer Disclaimer */}
          <View style={styles.footerDisclaimer}>
            <Ionicons name="shield-checkmark-outline" size={13} color={OzaraTheme.colors.accentGold} />
            <Text style={styles.footerDisclaimerText}>
              All real estate entries are curated for verified club members. ÖZARA does not conduct
              broker-dealer transactions or collect transaction success fees.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ============================================================== */}
      {/* FILTER BOTTOM SHEET MODAL                                      */}
      {/* ============================================================== */}
      <Modal visible={showFilterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.filterSheetContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Filter Properties</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterModalScroll}>
              {/* Country Selection */}
              <Text style={styles.filterSectionTitle}>Country</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptionsScroll}>
                <TouchableOpacity
                  style={[styles.filterOptionPill, selectedCountry === 'all' && styles.filterOptionPillActive]}
                  onPress={() => handleCountrySelect('all')}
                >
                  <Text style={[styles.filterOptionText, selectedCountry === 'all' && styles.filterOptionTextActive]}>
                    All Countries
                  </Text>
                </TouchableOpacity>
                {filterOptions?.countries.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.filterOptionPill, selectedCountry === c && styles.filterOptionPillActive]}
                    onPress={() => handleCountrySelect(c)}
                  >
                    <Text style={[styles.filterOptionText, selectedCountry === c && styles.filterOptionTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Dependent City Selection */}
              {selectedCountry !== 'all' && availableCities.length > 0 && (
                <>
                  <Text style={styles.filterSectionTitle}>City in {selectedCountry}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptionsScroll}>
                    <TouchableOpacity
                      style={[styles.filterOptionPill, selectedCity === 'all' && styles.filterOptionPillActive]}
                      onPress={() => setSelectedCity('all')}
                    >
                      <Text style={[styles.filterOptionText, selectedCity === 'all' && styles.filterOptionTextActive]}>
                        All Cities
                      </Text>
                    </TouchableOpacity>
                    {availableCities.map(ct => (
                      <TouchableOpacity
                        key={ct}
                        style={[styles.filterOptionPill, selectedCity === ct && styles.filterOptionPillActive]}
                        onPress={() => setSelectedCity(ct)}
                      >
                        <Text style={[styles.filterOptionText, selectedCity === ct && styles.filterOptionTextActive]}>
                          {ct}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Bedrooms Selection */}
              <Text style={styles.filterSectionTitle}>Bedrooms</Text>
              <View style={styles.bedroomsGrid}>
                {['any', '1', '2', '3', '4', '5', '6+'].map(b => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.bedroomBtn, selectedBedrooms === b && styles.bedroomBtnActive]}
                    onPress={() => setSelectedBedrooms(b)}
                  >
                    <Text style={[styles.bedroomBtnText, selectedBedrooms === b && styles.bedroomBtnTextActive]}>
                      {b === 'any' ? 'Any' : `${b} bd`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Property Type */}
              <Text style={styles.filterSectionTitle}>Property Type</Text>
              <View style={styles.bedroomsGrid}>
                {([
                  'all',
                  'Residential',
                  'Commercial',
                  'Parking',
                  'Land',
                  'Countryside',
                  'Private Islands',
                  'Pools'
                ] as PropertyCategory[]).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.bedroomBtn, selectedType === t && styles.bedroomBtnActive]}
                    onPress={() => {
                      setSelectedType(t);
                      setSelectedCategory(t === 'all' ? 'All Properties' : t);
                    }}
                  >
                    <Text style={[styles.bedroomBtnText, selectedType === t && styles.bedroomBtnTextActive]}>
                      {t === 'all' ? 'All Types' : t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.filterModalFooter}>
              <TouchableOpacity style={styles.modalResetBtn} onPress={handleClearFilters}>
                <Text style={styles.modalResetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalApplyBtn} onPress={() => setShowFilterModal(false)}>
                <Text style={styles.modalApplyText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* SORTING MODAL                                                  */}
      {/* ============================================================== */}
      <Modal visible={showSortModal} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSortModal(false)}>
          <View style={styles.sortModalContainer}>
            <Text style={styles.sortModalTitle}>Sort Properties</Text>
            {[
              { key: 'newest', label: 'Newest Added' },
              { key: 'price_asc', label: 'Price: Low to High' },
              { key: 'price_desc', label: 'Price: High to Low' },
              { key: 'title', label: 'Property Title (A-Z)' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortOptionRow, selectedSort === opt.key && styles.sortOptionRowActive]}
                onPress={() => {
                  setSelectedSort(opt.key as SortOption);
                  setShowSortModal(false);
                }}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    selectedSort === opt.key && styles.sortOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {selectedSort === opt.key && (
                  <Ionicons name="checkmark" size={16} color={OzaraTheme.colors.accentGold} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ============================================================== */}
      {/* PROPERTY DETAIL MODAL / DRAWER                                  */}
      {/* ============================================================== */}
      <Modal visible={Boolean(selectedListing)} animationType="slide" presentationStyle="pageSheet">
        {selectedListing && (
          <View style={styles.detailContainer}>
            {/* Header Bar */}
            <View style={styles.detailHeaderBar}>
              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => {
                  setSelectedListing(null);
                  setSelectedUnit(null);
                }}
              >
                <Ionicons name="close" size={20} color="#ffffff" />
              </TouchableOpacity>

              <Text style={styles.detailHeaderCategory}>{selectedListing.property_type}</Text>

              <TouchableOpacity
                style={styles.detailSaveBtn}
                onPress={() => handleToggleSave(selectedListing.id)}
              >
                <Ionicons
                  name={selectedListing.is_saved ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={selectedListing.is_saved ? OzaraTheme.colors.accentGold : '#ffffff'}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent}>
              {/* Photo Gallery with Thumbnails */}
              <View style={styles.galleryContainer}>
                <ExpoImage
                  source={{
                    uri: resolveImageUrl(
                      selectedListing.images && selectedListing.images.length > 0
                        ? selectedListing.images[activePhotoIndex] || selectedListing.images[0]
                        : `/api/media/catalog/${selectedListing.id}/cards/${selectedListing.id}_0.webp`
                    ),
                  }}
                  style={styles.galleryPrimaryImage}
                  contentFit="cover"
                  transition={250}
                  cachePolicy="memory-disk"
                  priority="high"
                />
                <View style={styles.galleryIndexBadge}>
                  <Text style={styles.galleryIndexText}>
                    {activePhotoIndex + 1} / {selectedListing.images ? selectedListing.images.length : 1}
                  </Text>
                </View>

                {/* Thumbnails row */}
                {selectedListing.images && selectedListing.images.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailsScroll}>
                    {selectedListing.images.map((img, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.thumbnailWrapper,
                          activePhotoIndex === idx && styles.thumbnailWrapperActive,
                        ]}
                        onPress={() => setActivePhotoIndex(idx)}
                      >
                        <ExpoImage
                          source={{ uri: resolveImageUrl(img) }}
                          style={styles.thumbnailImg}
                          contentFit="cover"
                          transition={150}
                          cachePolicy="memory-disk"
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Title & Location */}
              <View style={styles.detailTitleSection}>
                <View style={styles.detailBadgeRow}>
                  <View style={styles.detailTypeBadge}>
                    <Text style={styles.detailTypeBadgeText}>{selectedListing.property_type}</Text>
                  </View>
                  {selectedListing.badge && (
                    <View style={styles.detailSpecialBadge}>
                      <Text style={styles.detailSpecialBadgeText}>{selectedListing.badge}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.detailTitle}>{selectedListing.title}</Text>

                <View style={styles.detailLocationRow}>
                  <Ionicons name="location-outline" size={14} color={OzaraTheme.colors.accentGold} />
                  <Text style={styles.detailLocationText}>{selectedListing.location}</Text>
                  {selectedListing.map_url && (
                    <TouchableOpacity
                      style={styles.mapLinkBtn}
                      onPress={() => Linking.openURL(selectedListing.map_url!)}
                    >
                      <Ionicons name="map-outline" size={12} color={OzaraTheme.colors.accentCyan} />
                      <Text style={styles.mapLinkText}>Map</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Price Strip */}
              <View style={styles.detailPriceCard}>
                <View>
                  <Text style={styles.detailPriceLabel}>PRICE GUIDANCE</Text>
                  <Text style={styles.detailPriceValue}>{selectedListing.price_display}</Text>
                </View>
                <View style={styles.detailCurrencyBadge}>
                  <Text style={styles.detailCurrencyText}>{selectedListing.currency}</Text>
                </View>
              </View>
              <Text style={styles.detailPriceDisclaimer}>
                Price and availability subject to confirmation with asset developer.
              </Text>

              {/* Specifications Strip */}
              <View style={styles.detailSpecsGrid}>
                {selectedListing.beds !== null && (
                  <View style={styles.detailSpecBox}>
                    <Ionicons name="bed-outline" size={16} color={OzaraTheme.colors.accentGold} />
                    <Text style={styles.detailSpecVal}>{selectedListing.beds} Beds</Text>
                    <Text style={styles.detailSpecLbl}>Bedrooms</Text>
                  </View>
                )}
                {selectedListing.baths !== null && (
                  <View style={styles.detailSpecBox}>
                    <Ionicons name="water-outline" size={16} color={OzaraTheme.colors.accentGold} />
                    <Text style={styles.detailSpecVal}>{selectedListing.baths} Baths</Text>
                    <Text style={styles.detailSpecLbl}>Bathrooms</Text>
                  </View>
                )}
                {Boolean(selectedListing.area_range || selectedListing.sqft) && (
                  <View style={styles.detailSpecBox}>
                    <Ionicons name="expand-outline" size={16} color={OzaraTheme.colors.accentGold} />
                    <Text style={styles.detailSpecVal}>
                      {selectedListing.area_range || `${selectedListing.sqft} m²`}
                    </Text>
                    <Text style={styles.detailSpecLbl}>Total Area</Text>
                  </View>
                )}
                {Boolean(selectedListing.handover || selectedListing.year) && (
                  <View style={styles.detailSpecBox}>
                    <Ionicons name="calendar-outline" size={16} color={OzaraTheme.colors.accentGold} />
                    <Text style={styles.detailSpecVal}>
                      {selectedListing.handover || selectedListing.year}
                    </Text>
                    <Text style={styles.detailSpecLbl}>Completion</Text>
                  </View>
                )}
              </View>

              {/* Description */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>Overview</Text>
                <Text style={styles.detailDescriptionText}>
                  {selectedListing.description_full || selectedListing.description}
                </Text>
              </View>

              {/* Features List */}
              {selectedListing.features && selectedListing.features.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionHeading}>Key Specifications & Features</Text>
                  <View style={styles.featuresTagCloud}>
                    {selectedListing.features.map((feat, idx) => (
                      <View key={idx} style={styles.featureTagPill}>
                        <Ionicons name="checkmark-sharp" size={12} color={OzaraTheme.colors.accentGold} />
                        <Text style={styles.featureTagText}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Payment Terms & Completion */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeading}>Payment Terms & Delivery</Text>
                <View style={styles.paymentTermsCard}>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentRowLabel}>Completion Horizon</Text>
                    <Text style={styles.paymentRowValue}>
                      {selectedListing.handover || selectedListing.year || 'Upon Request'}
                    </Text>
                  </View>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentRowLabel}>Mortgage Availability</Text>
                    <Text style={styles.paymentRowValue}>
                      {selectedListing.payment_terms?.mortgage_available ? 'Available' : 'Subject to inquiry'}
                    </Text>
                  </View>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentRowLabel}>Post-Handover Plan</Text>
                    <Text style={styles.paymentRowValue}>
                      {selectedListing.payment_terms?.post_handover ? 'Available' : 'Direct plan'}
                    </Text>
                  </View>
                  {selectedListing.payment_terms?.installment_plan && (
                    <View style={styles.installmentNote}>
                      <Text style={styles.installmentNoteText}>
                        {selectedListing.payment_terms.installment_plan}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* ============================================================== */}
              {/* BROWSE INDIVIDUAL UNITS WITHIN A PROJECT                         */}
              {/* ============================================================== */}
              {selectedListing.units && selectedListing.units.length > 0 && (
                <View style={styles.detailSection}>
                  <View style={styles.unitsSectionHeader}>
                    <View>
                      <Text style={styles.detailSectionHeading}>Units within Project</Text>
                      <Text style={styles.unitsSectionSub}>
                        Browse individual published residences in this development.
                      </Text>
                    </View>
                    <View style={styles.unitsCountBadge}>
                      <Text style={styles.unitsCountBadgeText}>{selectedListing.units.length} Units</Text>
                    </View>
                  </View>

                  <View style={styles.unitsList}>
                    {selectedListing.units.map(unit => {
                      const isSelected = selectedUnit?.id === unit.id;
                      return (
                        <TouchableOpacity
                          key={unit.id}
                          style={[styles.unitCard, isSelected && styles.unitCardSelected]}
                          onPress={() => setSelectedUnit(isSelected ? null : unit)}
                        >
                          <View style={styles.unitCardHeader}>
                            <View style={styles.unitTypePill}>
                              <Text style={styles.unitTypePillText}>
                                {unit.unit_types && unit.unit_types.length > 0
                                  ? unit.unit_types.join(', ')
                                  : 'Unit'}
                              </Text>
                            </View>
                            <Text style={styles.unitPriceText}>{unit.price_display}</Text>
                          </View>

                          <Text style={styles.unitTitleText}>{unit.title}</Text>

                          <View style={styles.unitSpecsRow}>
                            {Boolean(unit.area_range) && (
                              <View style={styles.unitSpecItem}>
                                <Ionicons name="expand-outline" size={11} color={OzaraTheme.colors.textMuted} />
                                <Text style={styles.unitSpecText}>{unit.area_range}</Text>
                              </View>
                            )}
                            {Boolean(unit.bedrooms_range) && (
                              <View style={styles.unitSpecItem}>
                                <Ionicons name="bed-outline" size={11} color={OzaraTheme.colors.textMuted} />
                                <Text style={styles.unitSpecText}>{unit.bedrooms_range} Beds</Text>
                              </View>
                            )}
                          </View>

                          {Boolean(unit.installment_plan) && (
                            <Text style={styles.unitInstallmentText} numberOfLines={2}>
                              Plan: {unit.installment_plan}
                            </Text>
                          )}

                          <View style={styles.unitSelectActionRow}>
                            <Text
                              style={[
                                styles.unitSelectActionText,
                                isSelected && styles.unitSelectActionTextSelected,
                              ]}
                            >
                              {isSelected ? '✓ Selected for Inquiry' : 'Select for Details'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Informational Compliance Box */}
              <View style={styles.complianceBox}>
                <Ionicons name="shield-outline" size={13} color={OzaraTheme.colors.textMuted} />
                <Text style={styles.complianceText}>
                  This catalog entry is published for informational purposes among vetted club members.
                  ÖZARA does not offer financial advice or execute payments.
                </Text>
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action Strip */}
            <View style={styles.detailBottomBar}>
              <View style={styles.detailBottomPriceBlock}>
                <Text style={styles.bottomPriceLabel}>
                  {selectedUnit ? 'SELECTED UNIT' : 'STARTING PRICE'}
                </Text>
                <Text style={styles.bottomPriceValue}>
                  {selectedUnit ? selectedUnit.price_display : selectedListing.price_display}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.requestDetailsBtn}
                onPress={() => setShowInquiryModal(true)}
              >
                <Ionicons name="mail-outline" size={15} color="#000000" />
                <Text style={styles.requestDetailsBtnText}>Request Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* ============================================================== */}
      {/* REQUEST DETAILS / INQUIRY MODAL                                */}
      {/* ============================================================== */}
      <Modal visible={showInquiryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.inquiryModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Request Property Details</Text>
              <TouchableOpacity onPress={() => setShowInquiryModal(false)}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.inquiryBody}>
              <Text style={styles.inquiryPropertyTitle}>{selectedListing?.title}</Text>
              <Text style={styles.inquiryLocationText}>{selectedListing?.location}</Text>

              {selectedUnit && (
                <View style={styles.inquirySelectedUnitCard}>
                  <Ionicons name="layers" size={14} color={OzaraTheme.colors.accentGold} />
                  <Text style={styles.inquirySelectedUnitText}>
                    Specific Unit: {selectedUnit.title} ({selectedUnit.price_display})
                  </Text>
                </View>
              )}

              <Text style={styles.inquiryFieldLabel}>Message or Questions for the Team (Optional)</Text>
              <TextInput
                style={styles.inquiryTextInput}
                placeholder="e.g. Inquiring about current allocation availability, payment plan details, and delivery timelines."
                placeholderTextColor={OzaraTheme.colors.textMuted}
                multiline
                numberOfLines={4}
                value={inquiryNotes}
                onChangeText={setInquiryNotes}
              />

              <View style={styles.regulatoryGuidanceBox}>
                <Ionicons name="information-circle-outline" size={13} color={OzaraTheme.colors.textMuted} />
                <Text style={styles.regulatoryGuidanceText}>
                  Members describe what they are interested in. Members do not post specific offerings,
                  valuations, terms, returns, or minimum investments.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.filterModalFooter}>
              <TouchableOpacity style={styles.modalResetBtn} onPress={() => setShowInquiryModal(false)}>
                <Text style={styles.modalResetText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                disabled={submittingInquiry}
                onPress={handleRequestDetailsSubmit}
              >
                {submittingInquiry ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.modalApplyText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* PRIVATE TECH COMPANIES INFO MODAL                               */}
      {/* ============================================================== */}
      <Modal visible={showTechModal} animationType="fade" transparent>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowTechModal(false)}
        >
          <View style={styles.techModalCard}>
            <View style={styles.techModalHeader}>
              <View style={styles.comingSoonPill}>
                <Text style={styles.comingSoonPillText}>COMING SOON</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTechModal(false)} style={styles.techModalCloseBtn}>
                <Ionicons name="close" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <Image
              source={{ uri: `${API_BASE_URL}/investments/tech_companies_card.jpg` }}
              style={styles.techModalImg}
              resizeMode="cover"
            />
            <Text style={styles.techModalTitle}>Private Tech Companies</Text>
            <Text style={styles.techModalBody}>
              Direct equity allocations, secondary share transactions, and founder-led syndicates in high-conviction deep tech, AI infrastructure, and frontier technology ventures.
            </Text>
            <View style={styles.techModalFeatures}>
              <View style={styles.techModalFeatureItem}>
                <Ionicons name="checkmark-circle" size={14} color={OzaraTheme.colors.accentViolet} />
                <Text style={styles.techModalFeatureText}>Secondary liquidity for tier-1 late stage startups</Text>
              </View>
              <View style={styles.techModalFeatureItem}>
                <Ionicons name="checkmark-circle" size={14} color={OzaraTheme.colors.accentViolet} />
                <Text style={styles.techModalFeatureText}>Pre-IPO allocation tranches with institutional diligence</Text>
              </View>
              <View style={styles.techModalFeatureItem}>
                <Ionicons name="checkmark-circle" size={14} color={OzaraTheme.colors.accentViolet} />
                <Text style={styles.techModalFeatureText}>Co-investment syndicates with member lead investors</Text>
              </View>
            </View>
            <Text style={styles.techModalNotice}>
              No listings or transactions are active at this time. Club members will be notified upon tranche opening.
            </Text>
            <TouchableOpacity style={styles.techModalBtn} onPress={() => setShowTechModal(false)}>
              <Text style={styles.techModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14.5,
    fontWeight: '400',
    color: '#94a3b8',
    marginTop: 6,
    lineHeight: 21,
    letterSpacing: -0.15,
    textAlign: 'center',
    maxWidth: 320,
  },
  headerSubtitleHighlight: {
    color: '#ffffff',
    fontWeight: '600',
  },
  topCategoryNav: {
    flexDirection: 'row',
    backgroundColor: '#0a0b0e',
    borderRadius: 12,
    padding: 3,
    marginTop: 10,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  topCategoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  topCategoryTabActive: {
    backgroundColor: '#ffffff',
  },
  topCategoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: OzaraTheme.colors.textSecondary,
  },
  topCategoryTabTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  countChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  countChipActive: {
    backgroundColor: '#000000',
  },
  countChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: OzaraTheme.colors.textMuted,
  },
  countChipTextActive: {
    color: '#ffffff',
  },
  comingSoonTag: {
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700',
    color: OzaraTheme.colors.accentPurple,
    textTransform: 'uppercase',
  },

  // Private Tech Coming Soon View
  comingSoonContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  comingSoonCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0f1014',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
  },
  comingSoonIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  comingSoonPill: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
    marginBottom: 10,
  },
  comingSoonPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: OzaraTheme.colors.accentPurple,
    letterSpacing: 0.8,
  },
  comingSoonHeadline: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  comingSoonBody: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  comingSoonFeatures: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  comingSoonFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#121418',
    padding: 10,
    borderRadius: 10,
  },
  comingSoonFeatureText: {
    fontSize: 12,
    color: '#ffffff',
    flex: 1,
  },
  comingSoonNote: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 10,
    width: '100%',
  },
  comingSoonNoteText: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },

  // Real Estate Catalog Scroll
  catalogScroll: {
    flex: 1,
  },
  catalogContent: {
    paddingBottom: 60,
  },

  // Landing Page Styles
  landingScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 60,
  },
  landingHeroBlock: {
    marginBottom: 16,
  },
  landingHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  landingHeroSubtitle: {
    fontSize: 12,
    color: OzaraTheme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  // Landing: Only 2 Squares Inline
  landingTwoSquaresContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  twoSquaresRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  mainSquareCard: {
    flex: 1,
    backgroundColor: '#13151a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    overflow: 'hidden',
    justifyContent: 'space-between',
    minHeight: 250,
  },
  squareArtWrap: {
    height: 120,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0a0b0e',
  },
  squareArtImg: {
    width: '100%',
    height: '100%',
  },
  squareBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(10, 11, 14, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  squareBadgeText: {
    color: '#e2e8f0',
    fontSize: 9.5,
    fontWeight: '700',
  },
  squareBadgeSoon: {
    backgroundColor: 'rgba(147, 51, 234, 0.3)',
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
  squareBadgeSoonText: {
    color: '#d8b4fe',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  squareTextWrap: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  squareTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  squareDesc: {
    fontSize: 10,
    color: OzaraTheme.colors.textMuted,
    lineHeight: 14,
    marginBottom: 8,
  },
  squareActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
  },
  squareActionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Preserved for backward-compatibility
  landingTilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  landingTileCard: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#121418',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#23262d',
    padding: 14,
    justifyContent: 'space-between',
  },
  landingTileTop: {
    gap: 2,
  },
  landingTileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  landingTileCount: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
  },
  landingTileIconWrap: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    width: '100%',
    height: 72,
  },
  landingTileIcon: {
    width: 68,
    height: 68,
  },
  landingTechPreview: {
    backgroundColor: '#0f1014',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  landingTechPreviewLeft: {
    flex: 1,
  },
  landingTechPreviewTag: {
    fontSize: 9,
    fontWeight: '800',
    color: OzaraTheme.colors.accentPurple,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  landingTechPreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  landingTechPreviewSubtitle: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
    lineHeight: 15,
  },

  // Category Results Header & Navigation
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  resultsBreadcrumbText: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
    flex: 1,
  },
  compactCatStrip: {
    marginVertical: 8,
    height: 118,
  },
  compactCatStripContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  compactCatCard: {
    width: 140,
    height: 112,
    backgroundColor: '#14161a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#23262d',
    padding: 10,
    justifyContent: 'space-between',
  },
  compactCatCardActive: {
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: '#1c202a',
  },
  compactCatCardInfo: {
    gap: 2,
  },
  compactCatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactCatTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  compactCatCount: {
    fontSize: 10,
    color: OzaraTheme.colors.textMuted,
    marginTop: 2,
  },
  compactCatIcon: {
    width: 46,
    height: 46,
    alignSelf: 'flex-end',
  },

  // Tech Modal Styles
  techModalCard: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#13151a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 18,
    alignSelf: 'center',
  },
  techModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  techModalCloseBtn: {
    padding: 4,
  },
  techModalImg: {
    width: '100%',
    height: 145,
    borderRadius: 12,
    marginBottom: 12,
  },
  techModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  techModalBody: {
    fontSize: 11.5,
    color: OzaraTheme.colors.textMuted,
    lineHeight: 16,
    marginBottom: 12,
  },
  techModalFeatures: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 10,
    gap: 7,
    marginBottom: 12,
  },
  techModalFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  techModalFeatureText: {
    fontSize: 10.5,
    color: '#e2e8f0',
  },
  techModalNotice: {
    fontSize: 10,
    color: OzaraTheme.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 14,
  },
  techModalBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  techModalBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '600',
  },
  categoryNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryNoticeText: {
    fontSize: 11,
    color: '#fef08a',
    flex: 1,
    lineHeight: 15,
  },

  // Category Chips
  categoryChipsScroll: {
    marginTop: 8,
    maxHeight: 38,
  },
  categoryChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#0a0b0e',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  categoryChipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: OzaraTheme.colors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#000000',
    fontWeight: '700',
  },

  // Search & Filters
  searchFilterBlock: {
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1014',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#ffffff',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0f1014',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  filterPillActive: {
    borderColor: OzaraTheme.colors.accentGold,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  filterPillText: {
    fontSize: 11,
    color: OzaraTheme.colors.textSecondary,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: OzaraTheme.colors.accentGold,
    fontWeight: '700',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: OzaraTheme.colors.accentGold,
  },
  clearFiltersBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  clearFiltersText: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
    textDecorationLine: 'underline',
  },

  // Results summary
  resultsSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
  },
  resultsCountText: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lastUpdatedText: {
    fontSize: 10,
    color: OzaraTheme.colors.textDim,
  },

  // Cards List
  cardsList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#0f1014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    overflow: 'hidden',
  },
  cardPhotoWrapper: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
    backgroundColor: '#121418',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  imageErrorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#121418',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 4,
  },
  imageErrorText: {
    color: '#8e929b',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 8,
    textAlign: 'center',
  },
  imageRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  imageRetryText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  carouselBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
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
  photoTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 3,
  },
  photoCountPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    zIndex: 4,
  },
  photoCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  photoRightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  saveIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveIconBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  unitsIndicatorPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124, 58, 237, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  unitsIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Card Body
  cardBody: {
    padding: 14,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  cardLocationText: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 21,
    marginBottom: 10,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specText: {
    fontSize: 11,
    color: OzaraTheme.colors.textSecondary,
    fontWeight: '500',
  },
  priceActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceBlock: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 9,
    color: OzaraTheme.colors.textDim,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: OzaraTheme.colors.accentGold,
    letterSpacing: -0.3,
  },
  viewDetailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  viewDetailText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  cardDisclaimer: {
    fontSize: 9,
    color: OzaraTheme.colors.textDim,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Load More
  loadMoreBtn: {
    backgroundColor: '#121418',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  // States
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptySubtext: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
  },
  emptyResetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },

  // Footer Disclaimer
  footerDisclaimer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#0a0b0e',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    alignItems: 'flex-start',
  },
  footerDisclaimerText: {
    fontSize: 10,
    color: OzaraTheme.colors.textMuted,
    flex: 1,
    lineHeight: 14,
  },

  // Filter Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  filterSheetContainer: {
    backgroundColor: '#0f1014',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  filterModalScroll: {
    padding: 16,
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: OzaraTheme.colors.accentGold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  filterOptionsScroll: {
    marginBottom: 12,
  },
  filterOptionPill: {
    backgroundColor: '#121418',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginRight: 8,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  filterOptionPillActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  filterOptionText: {
    fontSize: 12,
    color: OzaraTheme.colors.textSecondary,
  },
  filterOptionTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  bedroomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  bedroomBtn: {
    backgroundColor: '#121418',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  bedroomBtnActive: {
    backgroundColor: OzaraTheme.colors.accentGold,
    borderColor: OzaraTheme.colors.accentGold,
  },
  bedroomBtnText: {
    fontSize: 12,
    color: OzaraTheme.colors.textSecondary,
  },
  bedroomBtnTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  filterModalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: OzaraTheme.colors.borderSubtle,
  },
  modalResetBtn: {
    flex: 1,
    backgroundColor: '#121418',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalResetText: {
    fontSize: 13,
    fontWeight: '600',
    color: OzaraTheme.colors.textMuted,
  },
  modalApplyBtn: {
    flex: 2,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalApplyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },

  // Sort Modal
  sortModalContainer: {
    backgroundColor: '#0f1014',
    margin: 20,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  sortModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  sortOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  sortOptionRowActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  sortOptionText: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
  },
  sortOptionTextActive: {
    color: OzaraTheme.colors.accentGold,
    fontWeight: '700',
  },

  // Detail Modal
  detailContainer: {
    flex: 1,
    backgroundColor: OzaraTheme.colors.background,
  },
  detailHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: OzaraTheme.colors.borderSubtle,
  },
  detailCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#121418',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeaderCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: OzaraTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailSaveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#121418',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    paddingBottom: 40,
  },
  galleryContainer: {
    width: '100%',
    backgroundColor: '#0a0b0e',
    position: 'relative',
  },
  galleryPrimaryImage: {
    width: '100%',
    height: 260,
    resizeMode: 'cover',
  },
  galleryIndexBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  galleryIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  thumbnailsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#0f1014',
  },
  thumbnailWrapper: {
    width: 54,
    height: 54,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailWrapperActive: {
    borderColor: OzaraTheme.colors.accentGold,
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  detailTitleSection: {
    padding: 16,
  },
  detailBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  detailTypeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  detailTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  detailSpecialBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  detailSpecialBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: OzaraTheme.colors.accentGold,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 26,
    marginBottom: 6,
  },
  detailLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailLocationText: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
    flex: 1,
  },
  mapLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  mapLinkText: {
    fontSize: 11,
    color: OzaraTheme.colors.accentCyan,
    fontWeight: '600',
  },

  detailPriceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: '#0f1014',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  detailPriceLabel: {
    fontSize: 10,
    color: OzaraTheme.colors.textDim,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  detailPriceValue: {
    fontSize: 22,
    fontWeight: '800',
    color: OzaraTheme.colors.accentGold,
  },
  detailCurrencyBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detailCurrencyText: {
    fontSize: 12,
    fontWeight: '800',
    color: OzaraTheme.colors.accentGold,
  },
  detailPriceDisclaimer: {
    fontSize: 10,
    color: OzaraTheme.colors.textDim,
    marginHorizontal: 16,
    marginTop: 6,
    fontStyle: 'italic',
  },

  detailSpecsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#0f1014',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    gap: 8,
  },
  detailSpecBox: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailSpecVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 4,
  },
  detailSpecLbl: {
    fontSize: 10,
    color: OzaraTheme.colors.textMuted,
  },

  detailSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  detailSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  detailDescriptionText: {
    fontSize: 13,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 20,
  },
  featuresTagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0f1014',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  featureTagText: {
    fontSize: 11,
    color: '#ffffff',
  },

  paymentTermsCard: {
    backgroundColor: '#0f1014',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    gap: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  paymentRowLabel: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
  },
  paymentRowValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  installmentNote: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  installmentNoteText: {
    fontSize: 11,
    color: OzaraTheme.colors.textSecondary,
    lineHeight: 16,
  },

  // Units list within project
  unitsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  unitsSectionSub: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
  },
  unitsCountBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  unitsCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: OzaraTheme.colors.accentPurple,
  },
  unitsList: {
    gap: 10,
  },
  unitCard: {
    backgroundColor: '#0f1014',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  unitCardSelected: {
    borderColor: OzaraTheme.colors.accentGold,
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  unitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  unitTypePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unitTypePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  unitPriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: OzaraTheme.colors.accentGold,
  },
  unitTitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 6,
  },
  unitSpecsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  unitSpecItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  unitSpecText: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
  },
  unitInstallmentText: {
    fontSize: 11,
    color: OzaraTheme.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  unitSelectActionRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  unitSelectActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: OzaraTheme.colors.accentCyan,
  },
  unitSelectActionTextSelected: {
    color: OzaraTheme.colors.accentGold,
    fontWeight: '700',
  },

  complianceBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#0a0b0e',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  complianceText: {
    fontSize: 10,
    color: OzaraTheme.colors.textMuted,
    flex: 1,
    lineHeight: 14,
  },

  // Detail Bottom Bar
  detailBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0a0b0e',
    borderTopWidth: 1,
    borderTopColor: OzaraTheme.colors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailBottomPriceBlock: {
    flex: 1,
  },
  bottomPriceLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: OzaraTheme.colors.textDim,
  },
  bottomPriceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: OzaraTheme.colors.accentGold,
  },
  requestDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  requestDetailsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },

  // Inquiry Modal
  inquiryModalContainer: {
    backgroundColor: '#0f1014',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
  },
  inquiryBody: {
    padding: 16,
  },
  inquiryPropertyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  inquiryLocationText: {
    fontSize: 12,
    color: OzaraTheme.colors.textMuted,
    marginBottom: 12,
  },
  inquirySelectedUnitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  inquirySelectedUnitText: {
    fontSize: 12,
    fontWeight: '600',
    color: OzaraTheme.colors.accentGold,
    flex: 1,
  },
  inquiryFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: OzaraTheme.colors.textSecondary,
    marginBottom: 6,
  },
  inquiryTextInput: {
    backgroundColor: '#121418',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: OzaraTheme.colors.borderSubtle,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  regulatoryGuidanceBox: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
  },
  regulatoryGuidanceText: {
    fontSize: 10,
    color: OzaraTheme.colors.textMuted,
    flex: 1,
    lineHeight: 14,
  },
});
