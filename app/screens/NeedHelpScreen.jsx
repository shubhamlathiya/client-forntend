import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEnquiry, getMyTickets, createTicket } from '../../api/supportApi';
import { API_BASE_URL } from '../../config/apiConfig';

const showToast = (msg) => {
  if (Platform.OS === 'android') {
    try { const { ToastAndroid } = require('react-native'); ToastAndroid.show(String(msg), ToastAndroid.SHORT); } catch { alert(msg); }
  } else { alert(msg); }
};

const validateEmail = (email) => /\S+@\S+\.\S+/.test(String(email || '').trim());

export default function NeedHelpScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  // Contact Enquiry form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [enquiryLoading, setEnquiryLoading] = useState(false);

  // Tickets
  const [tickets, setTickets] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketPriority, setTicketPriority] = useState('low');
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        setIsLoggedIn(!!token);
        const raw = await AsyncStorage.getItem('userData');
        setUser(raw ? JSON.parse(raw) : null);
        if (token) loadTickets(1);
      } catch {}
    })();
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) router.back(); else router.replace('/Home');
  };

  const submitEnquiry = async () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) { showToast('Please fill all fields'); return; }
    if (!validateEmail(email)) { showToast('Invalid email'); return; }
    if (enquiryLoading) return;
    setEnquiryLoading(true);
    try {
      await createEnquiry({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() });
      showToast('Enquiry submitted');
      setName(''); setEmail(''); setSubject(''); setMessage('');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to submit enquiry';
      showToast(msg);
    } finally {
      setEnquiryLoading(false);
    }
  };

  const loadTickets = async (nextPage) => {
    if (!isLoggedIn) return;
    setTicketsLoading(true);
    try {
      const res = await getMyTickets({ page: nextPage, limit });
      const payload = res?.data ?? res;
      const items = Array.isArray(payload) ? payload : (payload?.items || payload?.data?.items || []);
      const mapped = items.map((t) => ({
        id: String(t?._id || t?.id),
        subject: t?.subject || 'No subject',
        status: (t?.status || 'open'),
        priority: (t?.priority || 'low'),
        createdAt: t?.createdAt || t?.created_date || null,
      }));
      setTickets(nextPage === 1 ? mapped : [...tickets, ...mapped]);
      setPage(nextPage);
    } catch (e) {
      const msg = e?.response?.status === 401 ? 'Please log in to view tickets' : (e?.response?.data?.message || 'Failed to load tickets');
      showToast(msg);
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!isLoggedIn) { showToast('Please log in to create a ticket'); return; }
    if (!ticketSubject.trim() || !ticketDescription.trim()) { showToast('Subject and description are required'); return; }
    if (creatingTicket) return;
    setCreatingTicket(true);
    try {
      const res = await createTicket({ subject: ticketSubject.trim(), description: ticketDescription.trim(), priority: ticketPriority, attachments });
      showToast('Ticket created');
      setTicketSubject(''); setTicketDescription(''); setTicketPriority('low'); setAttachments([]);
      await loadTickets(1);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to create ticket';
      showToast(msg);
    } finally {
      setCreatingTicket(false);
    }
  };

  const selectAttachment = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') { showToast('Permission required'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: true });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const item = { uri: asset.uri, base64: asset.base64 };
        setAttachments((prev) => [...prev, item]);
      }
    } catch {
      showToast('Attachment picker not available');
    }
  };

  const renderTicketCard = (t) => (
    <Pressable key={t.id} style={styles.ticketCard} onPress={() => router.push({ pathname: '/screens/TicketDetailScreen', params: { id: String(t.id) } })}>
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketSubject}>{t.subject}</Text>
        <Text style={[styles.statusBadge, styles[`status_${t.status?.toLowerCase()}`] || styles.status_open]}>{String(t.status).toUpperCase()}</Text>
      </View>
      <View style={styles.ticketMeta}>
        <Text style={[styles.priorityBadge, styles[`priority_${t.priority}`] || styles.priority_low]}>{t.priority}</Text>
        <Text style={styles.ticketDate}>{t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.topBar}>
        <Pressable onPress={handleBack}>
          <Image source={require('../../assets/icons/back_icon.png')} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.heading}>Need Help</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/*<View style={styles.section}>*/}
        {/*  <Text style={styles.sectionTitle}>Contact Enquiry</Text>*/}
        {/*  <View style={styles.formRow}><Text style={styles.label}>Name</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#838383" /></View>*/}
        {/*  <View style={styles.formRow}><Text style={styles.label}>Email</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Your email" placeholderTextColor="#838383" keyboardType="email-address" autoCapitalize="none" /></View>*/}
        {/*  <View style={styles.formRow}><Text style={styles.label}>Subject</Text><TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor="#838383" /></View>*/}
        {/*  <View style={styles.formRow}><Text style={styles.label}>Message</Text><TextInput style={[styles.input, { height: 100 }]} value={message} onChangeText={setMessage} placeholder="Type your message" placeholderTextColor="#838383" multiline /></View>*/}
        {/*  <Pressable style={[styles.submitBtn, enquiryLoading && styles.btnDisabled]} onPress={submitEnquiry} disabled={enquiryLoading}>*/}
        {/*    <Text style={styles.submitText}>{enquiryLoading ? 'Submitting...' : 'Submit'}</Text>*/}
        {/*  </Pressable>*/}
        {/*</View>*/}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support Tickets</Text>
          {!isLoggedIn ? (
            <Text style={styles.infoText}>Log in to view and create tickets.</Text>
          ) : (
            <>
              <View style={styles.subSection}>
                <Text style={styles.subTitle}>My Tickets</Text>
                {ticketsLoading ? (
                  <ActivityIndicator size="small" color="#4CAD73" />
                ) : tickets.length === 0 ? (
                  <Text style={styles.infoText}>No tickets found.</Text>
                ) : (
                  <View style={{ gap: 8 }}>{tickets.map(renderTicketCard)}</View>
                )}
                <Pressable style={styles.loadMoreBtn} onPress={() => loadTickets(page + 1)} disabled={ticketsLoading}>
                  <Text style={styles.loadMoreText}>{ticketsLoading ? 'Loading...' : 'Load More'}</Text>
                </Pressable>
              </View>

              <View style={styles.subSection}>
                <Text style={styles.subTitle}>Create New Ticket</Text>
                <View style={styles.formRow}><Text style={styles.label}>Subject</Text><TextInput style={styles.input} value={ticketSubject} onChangeText={setTicketSubject} placeholder="Subject" placeholderTextColor="#838383" /></View>
                <View style={styles.formRow}><Text style={styles.label}>Description</Text><TextInput style={[styles.input, { height: 100 }]} value={ticketDescription} onChangeText={setTicketDescription} placeholder="Describe your issue" placeholderTextColor="#838383" multiline /></View>
                <View style={styles.formRow}><Text style={styles.label}>Priority</Text>
                  <View style={styles.priorityRow}>
                    {['low', 'medium', 'high'].map((p) => (
                      <Pressable key={p} style={[styles.priorityChip, ticketPriority === p && styles.priorityChipActive]} onPress={() => setTicketPriority(p)}>
                        <Text style={[styles.priorityText, ticketPriority === p && styles.priorityTextActive]}>{p}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.label}>Attachments (optional)</Text>
                  <Pressable style={styles.attachBtn} onPress={selectAttachment}><Text style={styles.attachText}>Attach Image</Text></Pressable>
                  {attachments.length > 0 && (
                    <View style={styles.attachList}>
                      {attachments.map((a, i) => (<Image key={`att-${i}`} source={{ uri: a.uri }} style={styles.attachPreview} />))}
                    </View>
                  )}
                </View>
                <Pressable style={[styles.submitBtn, creatingTicket && styles.btnDisabled]} onPress={handleCreateTicket} disabled={creatingTicket}>
                  <Text style={styles.submitText}>{creatingTicket ? 'Submitting...' : 'Submit Ticket'}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { padding: 20, marginTop: 20, flexDirection: 'row', alignItems: 'center' },
  backIcon: { width: 32, height: 32 },
  heading: { fontSize: 24, fontWeight: '500', color: '#1B1B1B', marginLeft: 20 },
  scrollView: { flex: 1 },
  section: { marginHorizontal: 16, marginBottom: 24, backgroundColor: '#FFFFFF' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1B1B1B', marginBottom: 12 },
  formRow: { marginBottom: 12 },
  label: { fontSize: 14, color: '#1B1B1B', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E6E6E6', borderRadius: 12, padding: 12, fontSize: 14, color: '#1B1B1B', backgroundColor: '#FFFFFF' },
  submitBtn: { backgroundColor: '#4CAD73', borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.7 },
  infoText: { fontSize: 12, color: '#666' },
  subSection: { marginTop: 16 },
  subTitle: { fontSize: 16, fontWeight: '600', color: '#1B1B1B', marginBottom: 8 },
  loadMoreBtn: { backgroundColor: '#F5F5F5', borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginTop: 8 },
  loadMoreText: { color: '#1B1B1B', fontSize: 12 },
  ticketCard: { borderWidth: 1, borderColor: '#E6E6E6', borderRadius: 12, padding: 12 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketSubject: { fontSize: 14, fontWeight: '600', color: '#1B1B1B' },
  statusBadge: { fontSize: 10, color: '#FFFFFF', backgroundColor: '#999', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  status_open: { backgroundColor: '#3A9AEF' },
  status_closed: { backgroundColor: '#666' },
  ticketMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  priorityBadge: { fontSize: 10, color: '#FFFFFF', backgroundColor: '#999', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  priority_low: { backgroundColor: '#4CAD73' },
  priority_medium: { backgroundColor: '#E89A23' },
  priority_high: { backgroundColor: '#DC1010' },
  ticketDate: { fontSize: 12, color: '#666' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: { borderWidth: 1, borderColor: '#E6E6E6', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  priorityChipActive: { borderColor: '#4CAD73', backgroundColor: 'rgba(76,173,115,0.1)' },
  priorityText: { fontSize: 12, color: '#333' },
  priorityTextActive: { color: '#2E7D5B', fontWeight: '600' },
  attachBtn: { backgroundColor: '#F5F5F5', borderRadius: 8, alignItems: 'center', paddingVertical: 10 },
  attachText: { color: '#1B1B1B', fontSize: 12 },
  attachList: { flexDirection: 'row', gap: 8, marginTop: 8 },
  attachPreview: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#F0F0F0' },
});

