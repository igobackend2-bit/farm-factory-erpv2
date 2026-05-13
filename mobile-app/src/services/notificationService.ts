import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface PushTokenData {
  employee_id: string;
  token: string;
  device_type: 'android' | 'ios' | 'web';
  device_name: string;
  app_version: string;
}

const getEmployeeId = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
};

export const pushNotificationService = {
  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('[Push] Must use physical device for push notifications');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Failed to get push notification permissions');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
      });

      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Alerts',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        enableVibrate: true,
      });
    }

    return true;
  },

  async registerDevice(): Promise<string | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return null;

    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: 'igo-mobile',
    });

    const employeeId = await getEmployeeId();
    if (!employeeId || !pushToken) return null;

    const deviceType: 'android' | 'ios' | 'web' = Platform.OS === 'android' ? 'android' : 
                                                       Platform.OS === 'ios' ? 'ios' : 'web';

    const tokenData: Partial<PushTokenData> = {
      employee_id: employeeId,
      token: pushToken,
      device_type: deviceType,
      device_name: Device.modelName || 'Unknown',
      app_version: '1.0.0',
    };

    await supabase.from('push_tokens').upsert(tokenData, { onConflict: 'employee_id,token' });

    console.log('[Push] Device registered:', pushToken.substring(0, 20) + '...');
    return pushToken;
  },

  async unregisterDevice(): Promise<void> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return;

    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('employee_id', employeeId);
  },

  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  },

  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },

  async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    const data = response.notification.request.content.data;
    
    if (data?.screen) {
      console.log('[Push] Navigate to:', data.screen);
    }

    if (data?.reference_id) {
      console.log('[Push] Reference ID:', data.reference_id);
    }
  },

  scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    delaySeconds?: number
  ): void {
    const trigger: Notifications.NotificationTriggerInput = delaySeconds
      ? { type: Notifications.SchedulesTriggerInput.SECOND, value: delaySeconds }
      : null;

    Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger,
    });
  },

  cancelAllScheduledNotifications(): void {
    Notifications.cancelAllScheduledNotificationsAsync();
  },

  getBadgeCount(): Promise<number> {
    return Notifications.getBadgeAsync();
  },

  setBadgeCount(count: number): void {
    Notifications.setBadgeAsync(count);
  },
};

export default pushNotificationService;