import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/notificationsApi";

const parseUserId = (user) => {
  if (!user) return null;
  return user._id || user.id || user.userId || null;
};

export default function useNotifications(options = {}) {
  const { userId: propUserId = null, pollIntervalMs = 5000, enabled = true } = options;
  const [userId, setUserId] = useState(propUserId);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const fetchUserId = useCallback(async () => {
    if (propUserId) return propUserId;
    const raw = await AsyncStorage.getItem("userData");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parseUserId(parsed);
    } catch {
      return null;
    }
  }, [propUserId]);

  const load = useCallback(async () => {
    const uid = userId || (await fetchUserId());
    if (!uid) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getUserNotifications(uid);
      const items = Array.isArray(data) ? data : data?.notifications || [];
      setNotifications(items);
    } catch (e) {
      const message = e?.response?.data?.message || e?.message || "Failed to load notifications";
      setError(String(message));
    } finally {
      setLoading(false);
    }
  }, [userId, fetchUserId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const markOneAsRead = useCallback(
    async (id) => {
      if (!id) return;
      try {
        await markNotificationRead(id);
        setNotifications((prev) => prev.map((n) => (n.id === id || n._id === id ? { ...n, read: true } : n)));
      } catch {}
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    const uid = userId || (await fetchUserId());
    if (!uid) return;
    try {
      await markAllNotificationsRead(uid);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  }, [userId, fetchUserId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const uid = await fetchUserId();
      if (mounted) setUserId(uid);
      if (enabled) await load();
    })();
    return () => {
      mounted = false;
    };
  }, [enabled, fetchUserId, load]);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      load();
    }, pollIntervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, pollIntervalMs, load]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  return {
    userId,
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    refresh,
    markOneAsRead,
    markAllAsRead,
  };
}