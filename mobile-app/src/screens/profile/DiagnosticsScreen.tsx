import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { syncOfflineLocations } from '../../services/offlineSyncService';

export default function DiagnosticsScreen() {
    const [queueCount, setQueueCount] = useState(0);
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);

    const checkStatus = async () => {
        // Check Queue
        const queueStr = await AsyncStorage.getItem('offline_locations_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        setQueueCount(queue.length);

        // Check Network
        const netState = await NetInfo.fetch();
        setIsConnected(netState.isConnected);
    };

    useEffect(() => {
        checkStatus();
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
        });
        return () => unsubscribe();
    }, []);

    const handleSync = async () => {
        setLoading(true);
        await syncOfflineLocations();
        await checkStatus();
        setLoading(false);
        Alert.alert('Sync Complete', 'Manual sync attempt finished.');
    };

    const clearQueue = async () => {
        await AsyncStorage.removeItem('offline_locations_queue');
        await checkStatus();
        Alert.alert('Success', 'Offline queue cleared.');
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>System Diagnostics</Text>

            <View style={styles.card}>
                <Text style={styles.label}>Network Status</Text>
                <Text style={[styles.value, { color: isConnected ? '#4CAF50' : '#F44336' }]}>
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                </Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Offline Queue</Text>
                <Text style={styles.value}>{queueCount} items pending</Text>
            </View>

            <View style={styles.buttonGroup}>
                <Button
                    title={loading === true ? "Syncing..." : "Run Manual Sync"}
                    onPress={handleSync}
                    disabled={loading === true || isConnected !== true}
                    color="#2196F3"
                />
                <View style={{ height: 10 }} />
                <Button
                    title="Refresh Status"
                    onPress={checkStatus}
                    color="#9E9E9E"
                />
                <View style={{ height: 10 }} />
                <Button
                    title="Clear Pending Queue"
                    onPress={clearQueue}
                    color="#F44336"
                />
            </View>

            <Text style={styles.footerText}>
                Use this screen to verify that background tracking is queuing data while offline and syncing when back online.
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#F9F9F9',
        flexGrow: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
        marginTop: 20,
        textAlign: 'center',
    },
    card: {
        backgroundColor: '#FFF',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    value: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    buttonGroup: {
        marginTop: 20,
    },
    footerText: {
        marginTop: 40,
        color: '#888',
        textAlign: 'center',
        fontSize: 12,
        fontStyle: 'italic',
    }
});
