import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ListRenderItem,
} from 'react-native';
import { Lead } from '../types/lead';
import { useLeadsQuery } from '../hooks/useLeadsQuery';
import { useLeadSocket } from '../hooks/useLeadSocket';

export const COLORS = {
  primary: '#000000',
  secondary: '#FFFFFF',
  background: '#FFFFFF',
  text: '#000000',
  muted: '#6B7280',
};

export const LeadsScreen: React.FC = () => {
  const { leads, loading, error, refetch, setLeads } = useLeadsQuery();

  const newestTimestamp = useMemo(() => {
    return leads.length > 0 ? leads[0].receivedAt : undefined;
  }, [leads]);

  const handleNewLead = useCallback(
    (lead: Lead) => {
      setLeads((prev) => {
        if (prev.some((item) => item.id === lead.id)) {
          return prev;
        }
        return [lead, ...prev];
      });
    },
    [setLeads]
  );

  const handleReconnect = useCallback(
    (lastSeen?: string) => {
      refetch(lastSeen);
    },
    [refetch]
  );

  const { connectionStatus } = useLeadSocket({
    onNewLead: handleNewLead,
    onReconnect: handleReconnect,
    lastSeenTimestamp: newestTimestamp,
  });

  const renderItem: ListRenderItem<Lead> = ({ item }) => {
    const formattedDate = item.receivedAt
      ? new Date(item.receivedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : '';

    return (
      <View testID={`lead-card-${item.id}`} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.leadName}>{item.name || 'Anonymous Lead'}</Text>
          <Text style={styles.timestamp}>{formattedDate}</Text>
        </View>

        {item.email ? (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Email:</Text>
            <Text style={styles.fieldValue}>{item.email}</Text>
          </View>
        ) : null}

        {item.phone ? (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Phone:</Text>
            <Text style={styles.fieldValue}>{item.phone}</Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>ID: {item.id}</Text>
          {item.formId ? <Text style={styles.metaText}>Form: {item.formId}</Text> : null}
        </View>
      </View>
    );
  };

  const statusLabel =
    connectionStatus === 'connected'
      ? 'LIVE'
      : connectionStatus === 'connecting'
      ? 'CONNECTING'
      : 'OFFLINE';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Meta Lead Ads</Text>
          <Text style={styles.subtitle}>Real-Time Lead Stream</Text>
        </View>

        <View
          testID="connection-status-badge"
          style={[
            styles.badge,
            connectionStatus === 'connected'
              ? styles.badgeConnected
              : connectionStatus === 'connecting'
              ? styles.badgeConnecting
              : styles.badgeDisconnected,
          ]}
        >
          <View
            style={[
              styles.dot,
              connectionStatus === 'connected'
                ? styles.dotConnected
                : connectionStatus === 'connecting'
                ? styles.dotConnecting
                : styles.dotDisconnected,
            ]}
          />
          <Text
            testID="connection-status-text"
            style={[
              styles.badgeText,
              connectionStatus === 'connected'
                ? styles.badgeTextConnected
                : styles.badgeTextMuted,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.counterBar}>
        <Text style={styles.counterText}>
          {leads.length} {leads.length === 1 ? 'Lead' : 'Leads'} Captured
        </Text>
        {error ? <Text style={styles.errorText}>Sync error</Text> : null}
      </View>

      <FlatList
        testID="leads-flat-list"
        data={leads}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={leads.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => refetch()}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View testID="empty-leads-view" style={styles.emptyView}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIconText}>✦</Text>
              </View>
              <Text style={styles.emptyTitle}>No leads received yet</Text>
              <Text style={styles.emptyDescription}>
                Leads submitted on your Facebook or Instagram Lead Ads forms will appear here
                instantly without refreshing.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: COLORS.secondary,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeConnected: {
    borderColor: '#000000',
    backgroundColor: '#000000',
  },
  badgeConnecting: {
    borderColor: '#6B7280',
    backgroundColor: '#F3F4F6',
  },
  badgeDisconnected: {
    borderColor: '#6B7280',
    backgroundColor: '#FFFFFF',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotConnected: {
    backgroundColor: '#FFFFFF',
  },
  dotConnecting: {
    backgroundColor: '#6B7280',
  },
  dotDisconnected: {
    backgroundColor: '#000000',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeTextConnected: {
    color: '#FFFFFF',
  },
  badgeTextMuted: {
    color: COLORS.text,
  },
  counterBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  leadName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.muted,
  },
  fieldRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  fieldLabel: {
    width: 60,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  fieldValue: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  metaText: {
    fontSize: 11,
    color: COLORS.muted,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyView: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 60,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIconText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
