import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Call, Mic, MicOff, Video, VideoOff, Phone, PhoneOff, User } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';

interface CallScreenProps {
  navigation: any;
  route: any;
}

export default function CallScreen({ navigation, route }: CallScreenProps) {
  const { channelId, channelName, participantId, participantName, isVideoCall } = route.params || {};
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall || true);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    initializeCall();
    return () => {
      endCall();
    };
  }, []);

  useInterval(() => {
    if (isConnected) {
      setCallDuration(prev => prev + 1);
    }
  }, 1000);

  const initializeCall = () => {
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
    }, 2000);
  };

  const endCall = () => {
    if (isConnected) {
      Alert.alert(
        'End Call',
        'Are you sure you want to end this call?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End Call', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isConnecting) {
    return (
      <View style={styles.connectingContainer}>
        <View style={styles.callingCard}>
          <View style={styles.avatarContainer}>
            <User size={64} color={COLORS.primary[600]} />
          </View>
          <Text style={styles.callingName}>{participantName || 'Participant'}</Text>
          <Text style={styles.callingStatus}>Connecting...</Text>
          <ActivityIndicator size="small" color={COLORS.primary[600]} style={styles.loader} />
        </View>
        <TouchableOpacity style={styles.endCallButton} onPress={() => navigation.goBack()}>
          <PhoneOff size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={endCall} style={styles.backButton}>
          <PhoneOff size={24} color={COLORS.neutral[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{channelName || 'Call'}</Text>
        <View style={styles.timer}>
          <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
        </View>
      </View>

      <View style={styles.videoContainer}>
        {isVideoEnabled ? (
          <View style={styles.videoPlaceholder}>
            <User size={120} color={COLORS.neutral[300]} />
            <Text style={styles.videoPlaceholderText}>Video</Text>
          </View>
        ) : (
          <View style={styles.videoOffPlaceholder}>
            <VideoOff size={64} color={COLORS.neutral[400]} />
            <Text style={styles.videoOffText}>Camera Off</Text>
          </View>
        )}
      </View>

      <View style={styles.participantInfo}>
        <View style={styles.participantAvatar}>
          <User size={32} color="#fff" />
        </View>
        <Text style={styles.participantName}>{participantName || 'Participant'}</Text>
        <Text style={styles.callStatus}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          {isMuted ? (
            <MicOff size={28} color="#fff" />
          ) : (
            <Mic size={28} color="#fff" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
          onPress={toggleVideo}
        >
          {isVideoEnabled ? (
            <Video size={28} color="#fff" />
          ) : (
            <VideoOff size={28} color="#fff" />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallButtonLarge} onPress={endCall}>
          <PhoneOff size={36} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function useInterval(callback: () => void, delay: number) {
  const [savedCallback, setSavedCallback] = React.useState(callback);

  React.useEffect(() => {
    setSavedCallback(() => callback);
  }, [callback]);

  React.useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback(), delay);
      return () => clearInterval(id);
    }
  }, [delay, savedCallback]);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  connectingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callingCard: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary[900],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  callingName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: SPACING.sm,
  },
  callingStatus: {
    fontSize: 16,
    color: COLORS.neutral[400],
  },
  loader: {
    marginTop: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  timer: {
    backgroundColor: COLORS.neutral[800],
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  videoContainer: {
    flex: 1,
    backgroundColor: COLORS.neutral[900],
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.neutral[800],
  },
  videoPlaceholderText: {
    fontSize: 18,
    color: COLORS.neutral[500],
    marginTop: SPACING.md,
  },
  videoOffPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.neutral[900],
  },
  videoOffText: {
    fontSize: 16,
    color: COLORS.neutral[500],
    marginTop: SPACING.md,
  },
  participantInfo: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  participantAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary[700],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  participantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  callStatus: {
    fontSize: 14,
    color: COLORS.neutral[400],
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.lg,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.neutral[700],
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: COLORS.primary[600],
  },
  endCallButton: {
    position: 'absolute',
    bottom: SPACING.xxl,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButtonLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
});