import React, {useEffect, useState} from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    TextInput,
    Image,
    StatusBar,
    ActivityIndicator
} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getTicketById, updateTicket} from '../../api/supportApi';

export default function TicketDetailScreen() {
    const router = useRouter();
    const {id} = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ticket, setTicket] = useState(null);
    const [user, setUser] = useState(null);

    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('low');
    const [status, setStatus] = useState('open');

    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('userData');
                setUser(raw ? JSON.parse(raw) : null);
            } catch {
            }
            await load();
        })();
    }, [id]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await getTicketById(String(id));
            const data = res?.data ?? res;
            setTicket(data);
            setSubject(data?.subject || '');
            setDescription(data?.description || '');
            setPriority(data?.priority || 'low');
            setStatus(data?.status || 'open');
        } catch (e) {
        } finally {
            setLoading(false);
        }
    };

    const canEdit = () => {
        const uid = user?._id || user?.id || user?.userId;
        const ownerId = ticket?.userId?._id || ticket?.userId || ticket?.ownerId;
        const role = (user?.role || '').toLowerCase();
        return uid && (String(uid) === String(ownerId)) || role === 'admin' || role === 'superadmin';
    };

    const handleSave = async () => {
        if (!canEdit()) return;
        if (saving) return;
        setSaving(true);
        try {
            await updateTicket(String(id), {subject, description, priority, status});
            await load();
            alert('Ticket updated');
        } catch (e) {
            alert('Failed to update ticket');
        } finally {
            setSaving(false);
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) router.back(); else router.replace('/Home');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF"/>
            <View style={styles.topBar}>
                <Pressable onPress={handleBack}><Image source={require('../../assets/icons/back_icon.png')}
                                                              style={styles.backIcon}/></Pressable>
                <Text style={styles.heading}>Ticket Details</Text>
            </View>
            {loading ? (
                <View style={styles.loader}><ActivityIndicator size="large" color="#4CAD73"/><Text
                    style={styles.loaderText}>Loading...</Text></View>
            ) : !ticket ? (
                <View style={styles.loader}><Text style={styles.loaderText}>Ticket not found</Text></View>
            ) : (
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    <View style={styles.section}>
                        <Text style={styles.label}>Subject</Text>
                        <TextInput style={styles.input} value={subject} onChangeText={setSubject} editable={canEdit()}/>

                        <Text style={styles.label}>Description</Text>
                        <TextInput style={[styles.input, {height: 120}]} value={description}
                                   onChangeText={setDescription} editable={canEdit()} multiline/>

                        <Text style={styles.label}>Priority</Text>
                        {canEdit() ? (
                            <View style={styles.priorityRow}>
                                {['low', 'medium', 'high'].map((p) => (
                                    <Pressable key={p}
                                                      style={[styles.priorityChip, priority === p && styles.priorityChipActive]}
                                                      onPress={() => setPriority(p)}>
                                        <Text
                                            style={[styles.priorityText, priority === p && styles.priorityTextActive]}>{p}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.valueText}>{priority}</Text>
                        )}

                        <Text style={styles.label}>Status</Text>
                        {canEdit() ? (
                            <View style={styles.priorityRow}>
                                {['open', 'in_progress', 'resolved', 'closed'].map((s) => (
                                    <Pressable key={s}
                                                      style={[styles.priorityChip, status === s && styles.priorityChipActive]}
                                                      onPress={() => setStatus(s)}>
                                        <Text
                                            style={[styles.priorityText, status === s && styles.priorityTextActive]}>{s}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.valueText}>{status}</Text>
                        )}

                        <Text style={styles.label}>Created At</Text>
                        <Text
                            style={styles.valueText}>{ticket?.createdAt ? new Date(ticket.createdAt).toLocaleString() : ''}</Text>
                        <Text style={styles.label}>Updated At</Text>
                        <Text
                            style={styles.valueText}>{ticket?.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : ''}</Text>

                        {canEdit() && (
                            <Pressable style={[styles.submitBtn, saving && {opacity: 0.7}]} onPress={handleSave}
                                              disabled={saving}>
                                <Text style={styles.submitText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                            </Pressable>
                        )}
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1, backgroundColor: '#FFFFFF'},
    topBar: {padding: 20, marginTop: 20, flexDirection: 'row', alignItems: 'center'},
    backIcon: {width: 32, height: 32},
    heading: {fontSize: 24, fontWeight: '500', color: '#1B1B1B', marginLeft: 20},
    loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    loaderText: {marginTop: 12, fontSize: 14, color: '#666'},
    scrollView: {flex: 1},
    section: {marginHorizontal: 16, marginBottom: 24},
    label: {fontSize: 14, color: '#1B1B1B', marginBottom: 6},
    input: {
        borderWidth: 1,
        borderColor: '#E6E6E6',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#1B1B1B',
        marginBottom: 12
    },
    valueText: {fontSize: 14, color: '#333', marginBottom: 12},
    priorityRow: {flexDirection: 'row', gap: 8, marginBottom: 12},
    priorityChip: {borderWidth: 1, borderColor: '#E6E6E6', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6},
    priorityChipActive: {borderColor: '#4CAD73', backgroundColor: 'rgba(76,173,115,0.1)'},
    priorityText: {fontSize: 12, color: '#333'},
    priorityTextActive: {color: '#2E7D5B', fontWeight: '600'},
    submitBtn: {backgroundColor: '#4CAD73', borderRadius: 12, alignItems: 'center', paddingVertical: 12, marginTop: 8},
    submitText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
});

