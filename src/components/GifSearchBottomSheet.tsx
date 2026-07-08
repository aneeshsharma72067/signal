import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { colors, fonts, radius } from '../theme';
import { Chip, Label } from './ui';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
const DISMISS_THRESHOLD = 120;

interface GifSearchBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
}

interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_width: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
      width: string;
      height: string;
    };
  };
}

const QUICK_TAGS = ['CAT', 'EXCITED', 'DANCE', 'MIND BLOWN', 'LOL', 'VIBES', 'YES', 'NO'];

export default function GifSearchBottomSheet({
  visible,
  onClose,
  onSelectGif,
}: GifSearchBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const apiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY || process.env.GIPHY_API_KEY || '';

  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animations
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Track if sheet is open/closing to prevent double triggers
  const isClosing = useRef(false);

  // Search timeout ref for debouncing Giphy API calls
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const slideIn = useCallback(() => {
    isClosing.current = false;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0.6,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const slideOut = useCallback((callback?: () => void) => {
    if (isClosing.current) return;
    isClosing.current = true;
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      if (callback) callback();
    });
  }, [translateY, backdropOpacity, onClose]);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      slideIn();
      setQuery('');
      fetchGifs(true, '');
    } else {
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, slideIn]);

  // Clean up search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Pan responder for drag-to-dismiss gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only trigger pan responder on downward drags
        return gestureState.dy > 5;
      },
      onPanResponderGrant: () => {
        translateY.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        // Prevent dragging upwards beyond the screen height limit
        if (gestureState.dy < 0) {
          translateY.setValue(0);
        } else {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > 0.8) {
          slideOut();
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            friction: 5,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Fetch GIFs from Giphy API
  const fetchGifs = async (reset = false, searchQuery = query) => {
    if (!apiKey) {
      setError('GIPHY_API_KEY is not configured in .env');
      return;
    }

    const currentOffset = reset ? 0 : offset;
    if (reset) {
      setLoading(true);
      setError(null);
      setGifs([]);
    } else {
      setLoadingMore(true);
    }

    const limit = 24;
    const base = 'https://api.giphy.com/v1/gifs';
    let url = '';

    if (searchQuery.trim()) {
      url = `${base}/search?api_key=${apiKey}&q=${encodeURIComponent(searchQuery)}&limit=${limit}&offset=${currentOffset}&rating=pg-13`;
    } else {
      url = `${base}/trending?api_key=${apiKey}&limit=${limit}&offset=${currentOffset}&rating=pg-13`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Giphy HTTP error: ${response.status}`);
      }
      const json = await response.json();
      const results = (json.data || []) as GiphyGif[];
      
      setGifs((prev) => (reset ? results : [...prev, ...results]));
      setOffset(currentOffset + results.length);
      setHasMore(results.length === limit);
    } catch (err) {
      console.error('Error fetching GIFs:', err);
      setError('Could not load GIFs. Check connection.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = (text: string) => {
    setQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim() === '') {
      fetchGifs(true, '');
    } else {
      searchTimeoutRef.current = setTimeout(() => {
        fetchGifs(true, text);
      }, 400);
    }
  };

  const handleSelectTag = (tag: string) => {
    setQuery(tag);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    fetchGifs(true, tag);
  };

  const handleSelect = (gif: GiphyGif) => {
    // We select the fixed width url since it's smaller, optimized for mobile layouts
    const url = gif.images.fixed_width.url;
    slideOut(() => {
      onSelectGif(url);
    });
  };

  const renderGifItem = ({ item }: { item: GiphyGif }) => {
    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={styles.gifCell}
      >
        <Image
          source={{ uri: item.images.fixed_width.url }}
          style={styles.gifImage}
          contentFit="cover"
          placeholder={{ uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAEfgF/H3T6jQAAAABJRU5ErkJggg==' }}
          transition={200}
        />
      </Pressable>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={() => slideOut()}
      statusBarTranslucent
    >
      <View style={styles.modalContainer}>
        {/* Backdrop overlay */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => slideOut()} />
        </Animated.View>

        {/* Bottom Sheet wrapper */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                transform: [{ translateY }],
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {/* Gesture handle bar */}
            <View {...panResponder.panHandlers} style={styles.dragArea}>
              <View style={styles.dragHandle} />
              <Label style={styles.sheetTitle}>CHOOSE A GIF</Label>
            </View>

            {/* Search Input Bar */}
            <View style={styles.searchBarContainer}>
              <View style={styles.searchBox}>
                <TextInput
                  placeholder="SEARCH GIPHY…"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={query}
                  onChangeText={handleSearch}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <Pressable
                    onPress={() => handleSearch('')}
                    style={styles.clearBtn}
                  >
                    <Label style={styles.clearBtnText}>✕</Label>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Quick Tags Carousel */}
            <View style={styles.tagsContainer}>
              <FlatList
                horizontal
                data={QUICK_TAGS}
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagsList}
                renderItem={({ item }) => (
                  <Chip
                    label={item}
                    filled={query.toUpperCase() === item}
                    onPress={() => handleSelectTag(item.toLowerCase())}
                    style={styles.tagChip}
                  />
                )}
              />
            </View>

            {/* Results Grid */}
            <View style={styles.resultsContainer}>
              {loading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={colors.ink} />
                  <Label muted style={styles.loadingText}>LOADING REEL…</Label>
                </View>
              ) : error ? (
                <View style={styles.centerContainer}>
                  <Label style={styles.errorText}>{error}</Label>
                  <Pressable onPress={() => fetchGifs(true)} style={styles.retryBtn}>
                    <Label style={styles.retryText}>RETRY</Label>
                  </Pressable>
                </View>
              ) : gifs.length === 0 ? (
                <View style={styles.centerContainer}>
                  <Label muted style={styles.emptyText}>NO FRAMES FOUND</Label>
                </View>
              ) : (
                <FlatList
                  data={gifs}
                  renderItem={renderGifItem}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  onEndReached={() => {
                    if (hasMore && !loadingMore) {
                      fetchGifs(false);
                    }
                  }}
                  onEndReachedThreshold={0.5}
                  contentContainerStyle={styles.gridList}
                  showsVerticalScrollIndicator={true}
                  ListFooterComponent={
                    loadingMore ? (
                      <View style={styles.gridFooter}>
                        <ActivityIndicator color={colors.ink} />
                      </View>
                    ) : null
                  }
                />
              )}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  keyboardView: {
    width: '100%',
  },
  sheetContainer: {
    height: SHEET_HEIGHT,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.ink,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  dragArea: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ink,
    opacity: 0.3,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.ink,
    letterSpacing: 1.5,
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    height: 50,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.ink,
    height: '100%',
    padding: 0,
  },
  clearBtn: {
    padding: 8,
  },
  clearBtnText: {
    fontSize: 12,
    color: colors.ink,
  },
  tagsContainer: {
    height: 50,
    marginTop: 12,
  },
  tagsList: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  tagChip: {
    marginRight: 4,
  },
  resultsContainer: {
    flex: 1,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: colors.ink,
  },
  gridList: {
    padding: 4,
  },
  gifCell: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 4,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    overflow: 'hidden',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 11,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.signal,
    marginTop: 8,
  },
  retryText: {
    fontSize: 11,
  },
  emptyText: {
    fontSize: 12,
  },
  gridFooter: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
