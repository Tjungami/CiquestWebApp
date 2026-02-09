import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { fetchStores } from '../api/public';
import AeroBackground from '../components/AeroBackground';

const ITEM_NAME_MAX_CHARS = 22;
const ITEM_DESC_MAX_CHARS = 36;
const KEYWORD_MAX = 50;

const truncateText = (value, maxChars) => {
  if (!value) return '';
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
};

const normalizeText = (value) => {
  if (!value) return '';
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    );
};

const matchScore = (textValue, keywordValue, weight) => {
  if (!keywordValue || !textValue) return 0;
  return textValue.includes(keywordValue) ? weight : 0;
};

const sortOptions = [
  { value: 'relevance', label: '関連順' },
  { value: 'distance', label: '距離順' },
  { value: 'name', label: '名前順' },
];

const tags = ['all', 'カフェ', 'ラーメン', '居酒屋', 'スイーツ'];

export default function SearchScreen() {
  const navigation = useNavigation();
  const [stores, setStores] = useState([]);
  const [fetchError, setFetchError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tag, setTag] = useState('all');
  const [sortKey, setSortKey] = useState('relevance');

  useEffect(() => {
    let active = true;

    const loadStores = async () => {
      try {
        const data = await fetchStores();
        if (!active) return;
        const normalized = data.map((store) => {
          const storeTags = Array.isArray(store.tags) ? store.tags : [];
          const distanceMeters =
            typeof store.distance === 'number' ? Math.round(store.distance * 1000) : null;
          const parseCoord = (value) => {
            if (typeof value === 'number') return Number.isFinite(value) ? value : null;
            if (typeof value === 'string' && value.trim() !== '') {
              const parsed = Number(value);
              return Number.isFinite(parsed) ? parsed : null;
            }
            return null;
          };
          const lat = parseCoord(store.lat ?? store.latitude);
          const lon = parseCoord(store.lon ?? store.longitude);
          return {
            id: String(store.id ?? store.store_id ?? store.pk ?? store.name ?? Math.random()),
            storeId: store.store_id ?? store.id ?? store.pk ?? null,
            name: store.name || '',
            description: store.description || '',
            distance: distanceMeters,
            tag: storeTags[0] || '',
            lat,
            lon,
            address: store.address || store.location || '',
            hours: store.hours || store.opening_hours || '',
            phone: store.phone || store.tel || '',
            website: store.website || store.url || '',
          };
        });
        setStores(normalized);
        setFetchError('');
      } catch (error) {
        if (!active) return;
        setFetchError(error?.message || 'APIの取得に失敗しました。');
      }
    };

    loadStores();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalizedKeyword = normalizeText(keyword.trim());
    const results = stores
      .map((store) => {
        const normalizedName = normalizeText(store.name);
        const normalizedDesc = normalizeText(store.description);
        const normalizedTag = normalizeText(store.tag);
        const score =
          matchScore(normalizedName, normalizedKeyword, 2) +
          matchScore(normalizedDesc, normalizedKeyword, 1) +
          matchScore(normalizedTag, normalizedKeyword, 0.5);
        return { ...store, _score: score };
      })
      .filter((store) => {
        const matchKeyword = !normalizedKeyword || store._score > 0;
        const matchTag = tag === 'all' || store.tag === tag;
        return matchKeyword && matchTag;
      });

    if (sortKey === 'distance') {
      return results.sort((a, b) => {
        const aDist = typeof a.distance === 'number' ? a.distance : Number.MAX_SAFE_INTEGER;
        const bDist = typeof b.distance === 'number' ? b.distance : Number.MAX_SAFE_INTEGER;
        if (aDist === bDist) return 0;
        return aDist - bDist;
      });
    }
    if (sortKey === 'name') {
      return results.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    }
    return results.sort((a, b) => b._score - a._score);
  }, [keyword, tag, stores, sortKey]);

  return (
    <AeroBackground style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.skyDeep} />
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder={`キーワードで検索（最大${KEYWORD_MAX}文字）`}
          placeholderTextColor="#7f8fa3"
          maxLength={KEYWORD_MAX}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.tagRow}>
        {tags.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTag(t)}
            style={[styles.tagChip, tag === t && styles.tagChipActive]}
          >
            <Text style={[styles.tagText, tag === t && styles.tagTextActive]}>
              {t === 'all' ? 'すべて' : t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sortRow}>
        {sortOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            onPress={() => setSortKey(option.value)}
            style={[styles.sortChip, sortKey === option.value && styles.sortChipActive]}
          >
            <Text style={[styles.sortText, sortKey === option.value && styles.sortTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!!fetchError && <Text style={styles.errorText}>{fetchError}</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const distanceLabel =
            typeof item.distance === 'number' ? `・${item.distance}m` : '';
          const descText = [item.description, distanceLabel].filter(Boolean).join(' ');

          return (
            <View style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {truncateText(item.name, ITEM_NAME_MAX_CHARS)}
                </Text>
                <Text style={styles.itemDesc} numberOfLines={1}>
                  {truncateText(descText, ITEM_DESC_MAX_CHARS)}
                </Text>
                <View style={styles.itemTag}>
                  <Text style={styles.itemTagText}>{item.tag}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => navigation.navigate('StoreDetail', { store: item })}
              >
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>該当するお店が見つかりませんでした。</Text>
          </View>
        }
      />
    </AeroBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 10,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagChipActive: {
    backgroundColor: '#d1e9ff',
    borderColor: colors.skyDeep,
  },
  tagText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  tagTextActive: {
    color: colors.skyDeep,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: '#d1e9ff',
    borderColor: colors.skyDeep,
  },
  sortText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  sortTextActive: {
    color: colors.skyDeep,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 6,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemDesc: {
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 13,
  },
  itemTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.glassStrong,
    borderRadius: 10,
    marginTop: 8,
  },
  itemTagText: {
    color: colors.skyDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  detailBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.skyDeep,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 5,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: 10,
    color: '#c0392b',
    fontSize: 12,
    fontWeight: '600',
  },
});
