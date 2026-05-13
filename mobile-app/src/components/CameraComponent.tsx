import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, PermissionResponse } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, RotateCcw, X, Check } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme';

const PERMISSION_BG_GRADIENT: [string, string, ...string[]] = ['#2563eb', '#1e40af'];

interface CameraComponentProps {
    onCapture: (uri: string) => void;
    onCancel: () => void;
}

export default function CameraComponent({ onCapture, onCancel }: CameraComponentProps) {
    const [facing, setFacing] = useState<'front' | 'back'>('front');
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const cameraRef = useRef<any>(null);

    const [permission, setPermission] = useState<PermissionResponse | null>(null);
    const [permissionLoading, setPermissionLoading] = useState(true);

    useEffect(() => {
        const checkPermission = async () => {
            try {
                const CameraModule = require('expo-camera');
                const permissionResult = await CameraModule.Camera.getCameraPermissionsAsync();
                setPermission(permissionResult);
            } catch (error) {
                console.warn('Camera permission check error:', error);
                setPermission(null);
            } finally {
                setPermissionLoading(false);
            }
        };
        checkPermission();
    }, []);

    const requestCameraPermission = async () => {
        try {
            const CameraModule = require('expo-camera');
            const permissionResult = await CameraModule.Camera.requestCameraPermissionsAsync();
            setPermission(permissionResult);
        } catch (error) {
            console.warn('Camera permission request error:', error);
        }
    };

    if (permissionLoading) {
        return <View style={styles.container} />;
    }

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.permissionContainer}>
                <LinearGradient colors={PERMISSION_BG_GRADIENT} style={styles.background} />
                <View style={styles.permissionContent}>
                    <View style={styles.permissionIconBox}>
                        <Camera size={48} color="#fff" />
                    </View>
                    <Text style={styles.permissionTitle}>Camera Access Required</Text>
                    <Text style={styles.permissionText}>
                        We need camera access to capture your attendance selfie.
                        This helps verify your location and identity.
                    </Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const takePicture = async () => {
        if (cameraRef.current) {
            const photo = await cameraRef.current.takePictureAsync();
            setCapturedPhoto(photo.uri);
        }
    };

    const confirmPhoto = () => {
        if (capturedPhoto) {
            onCapture(capturedPhoto);
        }
    };

    const retakePhoto = () => {
        setCapturedPhoto(null);
    };

    // After capture: full-screen review with Submit / Retake only
    if (capturedPhoto) {
        return (
            <View style={styles.container}>
                <Image source={{ uri: capturedPhoto }} style={styles.previewImage} resizeMode="cover" />
                <SafeAreaView style={styles.previewOverlay}>
                    <View style={styles.previewTextBlock}>
                        <Text style={styles.previewTitle}>Review Your Selfie</Text>
                        <Text style={styles.previewSub}>Tap Submit to confirm or Retake to redo.</Text>
                    </View>
                    <View style={styles.previewActions}>
                        <TouchableOpacity style={styles.retakeButton} onPress={retakePhoto} activeOpacity={0.85}>
                            <RotateCcw size={22} color={COLORS.neutral[700]} />
                            <Text style={styles.retakeText}>Retake</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.submitButton} onPress={confirmPhoto} activeOpacity={0.85}>
                            <Check size={22} color="#fff" />
                            <Text style={styles.submitText}>Submit</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView style={styles.camera} facing={facing} ref={cameraRef} />

            <SafeAreaView style={styles.header}>
                <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
                    <X size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Attendance Selfie</Text>
                <View style={styles.placeholder} />
            </SafeAreaView>

            <View style={styles.guideContainer} pointerEvents="none">
                <View style={styles.faceGuide}>
                    <View style={styles.guideCorner} />
                    <View style={[styles.guideCorner, styles.guideCornerTR]} />
                    <View style={[styles.guideCorner, styles.guideCornerBL]} />
                    <View style={[styles.guideCorner, styles.guideCornerBR]} />
                </View>
                <Text style={styles.guideText}>Position your face within the frame</Text>
            </View>

            <View style={styles.controlsContainer}>
                <View style={styles.controls}>
                    <TouchableOpacity
                        style={styles.sideButton}
                        onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                    >
                        <RotateCcw size={24} color="#fff" />
                        <Text style={styles.sideButtonText}>Flip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                        <View style={styles.captureOuter}>
                            <View style={styles.captureInner} />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.sideButton} onPress={onCancel}>
                        <X size={24} color="#fff" />
                        <Text style={styles.sideButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    background: {
        position: 'absolute',
        left: 0, right: 0, top: 0, bottom: 0,
    },
    camera: {
        flex: 1,
    },

    // Permission
    permissionContainer: { flex: 1 },
    permissionContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xxl,
    },
    permissionIconBox: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xxl,
    },
    permissionTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: SPACING.md,
    },
    permissionText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        marginBottom: SPACING.xxl,
        lineHeight: 24,
    },
    permissionButton: {
        backgroundColor: '#fff',
        paddingVertical: SPACING.lg,
        paddingHorizontal: SPACING.xxxl,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.md,
    },
    permissionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary[600],
    },
    cancelButton: { paddingVertical: SPACING.md },
    cancelButtonText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },

    // Header
    header: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    placeholder: { width: 44 },

    // Face Guide
    guideContainer: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    faceGuide: {
        width: 250,
        height: 320,
        borderRadius: 125,
        position: 'relative',
    },
    guideCorner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: 'rgba(255,255,255,0.8)',
        borderTopWidth: 3,
        borderLeftWidth: 3,
        borderTopLeftRadius: 20,
        top: 0,
        left: 0,
    },
    guideCornerTR: {
        borderTopWidth: 3,
        borderRightWidth: 3,
        borderLeftWidth: 0,
        borderTopRightRadius: 20,
        borderTopLeftRadius: 0,
        right: 0,
        left: undefined,
    },
    guideCornerBL: {
        borderBottomWidth: 3,
        borderLeftWidth: 3,
        borderTopWidth: 0,
        borderBottomLeftRadius: 20,
        borderTopLeftRadius: 0,
        bottom: 0,
        top: undefined,
    },
    guideCornerBR: {
        borderBottomWidth: 3,
        borderRightWidth: 3,
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderBottomRightRadius: 20,
        borderTopLeftRadius: 0,
        bottom: 0,
        right: 0,
        top: undefined,
        left: undefined,
    },
    guideText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: SPACING.lg,
    },

    // Controls
    controlsContainer: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        paddingBottom: SPACING.xxxl,
        zIndex: 20,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: SPACING.xxl,
    },
    sideButton: {
        alignItems: 'center',
        gap: SPACING.xs,
    },
    sideButtonText: {
        fontSize: 12,
        color: '#fff',
    },
    captureButton: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureOuter: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 4,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff',
    },

    // Full-screen review
    previewImage: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
    },
    previewOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: 52,
        paddingHorizontal: SPACING.xl,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    previewTextBlock: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    previewTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    previewSub: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
    },
    previewActions: {
        flexDirection: 'row',
        gap: SPACING.lg,
    },
    retakeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingVertical: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    retakeText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.neutral[700],
    },
    submitButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.success[500],
        paddingVertical: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    submitText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
