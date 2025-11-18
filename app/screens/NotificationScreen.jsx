import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import useNotifications from "../../hooks/useNotifications";

export default function NotificationScreen() {
  const router = useRouter();
  const { notifications, unreadCount, loading, refreshing, error, refresh, markOneAsRead, markAllAsRead } = useNotifications();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/Home');
    }
  };

  const formatDate = (value) => {
    if (!value) return "";
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
    } catch {
      return String(value);
    }
  };

  const getTemplate = (n) => {
    return n.template || n.text || n.message || "";
  };

  const getId = (n) => {
    return n.id || n._id;
  };

  const unread = useMemo(() => notifications.filter((n) => !n.read), [notifications]);
  const read = useMemo(() => notifications.filter((n) => !!n.read), [notifications]);

  const NotificationCard = ({ item }) => {
    const isUnread = !item.read;
    const orderText = item.orderId ? `Order: ${String(item.orderId)}` : "";
    return (
      <TouchableOpacity
        style={[styles.card, isUnread ? styles.cardUnread : styles.cardRead]}
        onPress={() => {
          const id = getId(item);
          if (id) markOneAsRead(id);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, isUnread ? styles.cardTitleUnread : null]}>Notification</Text>
          <Text style={styles.cardDate}>{formatDate(item.createdAt || item.date)}</Text>
        </View>
        <Text style={styles.cardBody}>{getTemplate(item)}</Text>
        {orderText ? <Text style={styles.cardOrder}>{orderText}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack}>
          <Image source={require("../../assets/icons/back_icon.png")} style={styles.iconBox} />
        </TouchableOpacity>
        <Text style={styles.heading}>Notification</Text>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.markAllBtn, unreadCount > 0 ? styles.markAllBtnEnabled : styles.markAllBtnDisabled]}
          onPress={markAllAsRead}
          disabled={unreadCount === 0}
        >
          <Text style={[styles.markAllText, unreadCount > 0 ? styles.markAllTextEnabled : styles.markAllTextDisabled]}>
            {unreadCount > 0 ? `Mark all as read (${unreadCount})` : "All read"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {error ? (
          <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Unread</Text>
          </View>
          <View style={styles.sectionContent}>
            {unread.length === 0 ? (
              <Text style={styles.emptyText}>{loading ? "Loading..." : "No unread notifications"}</Text>
            ) : (
              unread.map((n) => <NotificationCard key={String(getId(n))} item={n} />)
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Read</Text>
          </View>
          <View style={styles.sectionContent}>
            {read.length === 0 ? (
              <Text style={styles.emptyText}>{loading ? "" : "No read notifications"}</Text>
            ) : (
              read.map((n) => <NotificationCard key={String(getId(n))} item={n} />)
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1, backgroundColor: "#FFFFFF",
    }, topBar: {
        padding: 20, marginTop: 20, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center',
    }, heading: {
        fontSize: 24, fontWeight: '500', color: '#1B1B1B', alignItems: 'center', marginLeft: 20
    }, iconBox: {
        width: 32, height: 32, borderRadius: 8,
    }, scrollView: {
        flex: 1, backgroundColor: "#FFFFFF",
    }, actionsRow: {
        paddingHorizontal: 20, marginBottom: 8, alignItems: 'flex-end',
    }, markAllBtn: {
        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    }, markAllBtnEnabled: {
        backgroundColor: '#4CAD73',
    }, markAllBtnDisabled: {
        backgroundColor: '#E6E6E6',
    }, markAllText: {
        fontSize: 12, fontFamily: 'Poppins', fontWeight: '500',
    }, markAllTextEnabled: {
        color: '#FFFFFF',
    }, markAllTextDisabled: {
        color: '#838383',
    }, section: {
        marginBottom: 24, backgroundColor: "#FFFFFF",
    }, sectionHeader: {
        paddingHorizontal: 24, paddingVertical: 8, backgroundColor: "#FFFFFF",
    }, sectionTitle: {
        fontSize: 16, fontFamily: "Poppins", fontWeight: "500", color: "#1B1B1B", lineHeight: 24,
    }, sectionContent: {
        paddingHorizontal: 16,
    }, card: {
        borderWidth: 1, borderColor: '#E6E6E6', borderRadius: 12, padding: 12, marginBottom: 12,
    }, cardUnread: {
        backgroundColor: '#FFF8E1',
        borderColor: '#FCD400',
    }, cardRead: {
        backgroundColor: '#FFFFFF',
    }, cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
    }, cardTitle: {
        fontSize: 14, fontFamily: 'Poppins', fontWeight: '600', color: '#1B1B1B',
    }, cardTitleUnread: {
        color: '#4CAD73',
    }, cardDate: {
        fontSize: 12, fontFamily: 'Poppins', color: '#838383',
    }, cardBody: {
        fontSize: 13, fontFamily: 'Poppins', color: '#1B1B1B', marginBottom: 4,
    }, cardOrder: {
        fontSize: 12, fontFamily: 'Poppins', color: '#218D96',
    }, emptyText: {
        fontSize: 12, fontFamily: 'Poppins', color: '#838383', paddingHorizontal: 16, paddingVertical: 8,
    }, errorBox: {
        paddingHorizontal: 20,
    }, errorText: {
        fontSize: 12, fontFamily: 'Poppins', color: '#DC1010',
    },
});