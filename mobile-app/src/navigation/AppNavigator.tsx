import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';

// Screens
import HomeScreen from '../screens/home/HomeScreen';
import HourlyPlanReportScreen from '../screens/work/HourlyPlanReportScreen';
import DayPlanScreen from '../screens/work/DayPlanScreen';
import EODReportScreen from '../screens/work/EODReportScreen';
import ActiveTripScreen from '../screens/work/ActiveTripScreen';
import MySOPsScreen from '../screens/work/MySOPsScreen';
import MenuScreen from '../screens/profile/MenuScreen';
import DiagnosticsScreen from '../screens/profile/DiagnosticsScreen';
import PayslipScreen from '../screens/profile/PayslipScreen';
import ProfileEditScreen from '../screens/profile/ProfileEditScreen';
import PasswordChangeScreen from '../screens/profile/PasswordChangeScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import NewChatScreen from '../screens/chat/NewChatScreen';
import CallScreen from '../screens/chat/CallScreen';
import LOPScreen from '../screens/profile/LOPScreen';
import PalmCafeScreen from '../screens/PalmCafeScreen';

// Request Screens
import LeaveRequestScreen from '../screens/requests/LeaveRequestScreen';
import LOPReversalScreen from '../screens/requests/LOPReversalScreen';
import TravelApprovalScreen from '../screens/requests/TravelApprovalScreen';
import TravelClaimScreen from '../screens/requests/TravelClaimScreen';
import TripListScreen from '../screens/requests/TripListScreen';
import RequestsHomeScreen from '../screens/requests/RequestsHomeScreen';
import PaymentRequestScreen from '../screens/requests/PaymentRequestScreen';
import TransportClaimScreen from '../screens/requests/TransportClaimScreen';

// Calendar Screen
import CompanyCalendarScreen from '../screens/calendar/CompanyCalendarScreen';

// New Screens
import AnnouncementsScreen from '../screens/announcements/AnnouncementsScreen';

// Shift Screens
import ShiftHomeScreen from '../screens/shift/ShiftHomeScreen';
import ShiftHourlyScreen from '../screens/shift/ShiftHourlyScreen';
import ShiftBreakScreen from '../screens/shift/ShiftBreakScreen';
import ShiftEODScreen from '../screens/shift/ShiftEODScreen';
import ShiftLogoutScreen from '../screens/shift/ShiftLogoutScreen';
import PaymentAuditScreen from '../screens/shift/PaymentAuditScreen';
import ShiftPaymentRequestScreen from '../screens/shift/ShiftPaymentRequestScreen';
import { useShiftUserStatus } from '../hooks/useShiftUserStatus';

import { COLORS, BORDER_RADIUS, SHADOWS } from '../theme';
import { Home, Briefcase, FileText, Menu, Clock3, MessageCircle } from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const WorkStack = createNativeStackNavigator();
const RequestsStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();
const ShiftStack = createNativeStackNavigator();
const ChatStack = createNativeStackNavigator();

// Work Stack Navigator
function WorkStackNavigator() {
    return (
        <WorkStack.Navigator
            id="WorkStack"
            screenOptions={{
                headerShown: false,
            }}
        >
            <WorkStack.Screen name="DayPlan" component={DayPlanScreen} />
            <WorkStack.Screen name="HourlyReport" component={HourlyPlanReportScreen} />
            <WorkStack.Screen name="EODReport" component={EODReportScreen} />
        </WorkStack.Navigator>
    );
}

// Requests Stack Navigator
function RequestsStackNavigator() {
    return (
        <RequestsStack.Navigator
            id="RequestsStack"
            screenOptions={{
                headerShown: false,
            }}
        >
            <RequestsStack.Screen name="RequestsHome" component={RequestsHomeScreen} />
            <RequestsStack.Screen name="TripList" component={TripListScreen} />
            <RequestsStack.Screen name="ActiveTrip" component={ActiveTripScreen} />
            <RequestsStack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
            <RequestsStack.Screen name="LOPReversal" component={LOPReversalScreen} />
            <RequestsStack.Screen name="TravelApproval" component={TravelApprovalScreen} />
            <RequestsStack.Screen name="TravelClaim" component={TravelClaimScreen} />
            <RequestsStack.Screen name="TransportClaim" component={TransportClaimScreen} />
            <RequestsStack.Screen name="PaymentRequest" component={PaymentRequestScreen} />
        </RequestsStack.Navigator>
    );
}

// More Stack Navigator
function MoreStackNavigator() {
    return (
        <MoreStack.Navigator
            id="MoreStack"
            screenOptions={{
                headerShown: false,
            }}
        >
            <MoreStack.Screen name="MenuMain" component={MenuScreen} />
            <MoreStack.Screen name="EODSummary" component={EODReportScreen} />
            <MoreStack.Screen name="CompanyCalendar" component={CompanyCalendarScreen} />
            <MoreStack.Screen name="Announcements" component={AnnouncementsScreen} />
            <MoreStack.Screen name="Diagnostics" component={DiagnosticsScreen} />
            <MoreStack.Screen name="MySOPs" component={MySOPsScreen} />
            <MoreStack.Screen name="Payslip" component={PayslipScreen} />
            <MoreStack.Screen name="ProfileEdit" component={ProfileEditScreen} />
            <MoreStack.Screen name="PasswordChange" component={PasswordChangeScreen} />
            <MoreStack.Screen name="LOPScreen" component={LOPScreen} />
            <MoreStack.Screen name="PalmCafe" component={PalmCafeScreen} />
            <MoreStack.Screen name="PaymentRequest" component={PaymentRequestScreen} />
            <MoreStack.Screen name="TransportClaim" component={TransportClaimScreen} />
        </MoreStack.Navigator>
    );
}

// Shift Stack Navigator
function ShiftStackNavigator() {
    return (
        <ShiftStack.Navigator
            id="ShiftStack"
            screenOptions={{
                headerShown: false,
            }}
        >
            <ShiftStack.Screen name="ShiftHome" component={ShiftHomeScreen} />
            <ShiftStack.Screen name="ShiftHourly" component={ShiftHourlyScreen} />
            <ShiftStack.Screen name="ShiftBreak" component={ShiftBreakScreen} />
            <ShiftStack.Screen name="ShiftEOD" component={ShiftEODScreen} />
            <ShiftStack.Screen name="ShiftLogout" component={ShiftLogoutScreen} />
            <ShiftStack.Screen name="ShiftPaymentRequest" component={ShiftPaymentRequestScreen} />
            <ShiftStack.Screen name="PaymentAudit" component={PaymentAuditScreen} />
        </ShiftStack.Navigator>
    );
}

// Chat Stack Navigator
function ChatStackNavigator() {
    return (
        <ChatStack.Navigator
            id="ChatStack"
            screenOptions={{
                headerShown: false,
            }}
        >
            <ChatStack.Screen name="ChatList" component={ChatListScreen} />
            <ChatStack.Screen name="ChatRoom" component={ChatRoomScreen} />
            <ChatStack.Screen name="NewChat" component={NewChatScreen} />
            <ChatStack.Screen name="CallScreen" component={CallScreen} />
        </ChatStack.Navigator>
    );
}

function renderTabIcon(routeName: string, focused: boolean, color: string) {
    const iconSize = focused === true ? 22 : 20;

    if (routeName === 'Home') {
        return <Home size={iconSize} color={color} />;
    }
    if (routeName === 'Work') {
        return <Briefcase size={iconSize} color={color} />;
    }
    if (routeName === 'Requests') {
        return <FileText size={iconSize} color={color} />;
    }
    if (routeName === 'Chat') {
        return <MessageCircle size={iconSize} color={color} />;
    }
    if (routeName === 'More') {
        return <Menu size={iconSize} color={color} />;
    }

    return <Clock3 size={iconSize} color={color} />;
}

function tabScreenOptions(route: { name: string }) {
    return {
        headerShown: false,
        tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
            <View style={[styles.iconContainer, focused === true ? styles.iconContainerActive : null]}>
                {renderTabIcon(route.name, focused, color)}
            </View>
        ),
        tabBarActiveTintColor: COLORS.primary[700],
        tabBarInactiveTintColor: COLORS.neutral[500],
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
            height: Platform.OS === 'ios' ? 80 : 66,
            paddingBottom: Platform.OS === 'ios' ? 16 : 10,
            paddingTop: 6,
            borderTopWidth: 1,
            borderTopColor: COLORS.neutral[200],
            backgroundColor: '#ffffff',
            ...SHADOWS.md,
        },
        tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700' as const,
            marginTop: 2,
        },
    };
}

function GeneralUserTabs() {
    return (
        <Tab.Navigator id="GeneralUserTabs" screenOptions={({ route }) => tabScreenOptions(route)}>
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: 'Day Start' }}
            />
            <Tab.Screen
                name="Work"
                component={WorkStackNavigator}
                options={{ title: 'Work' }}
            />
            <Tab.Screen
                name="Requests"
                component={RequestsStackNavigator}
                options={{ title: 'Requests' }}
            />
            <Tab.Screen
                name="Chat"
                component={ChatStackNavigator}
                options={{ title: 'Chat' }}
            />
            <Tab.Screen
                name="More"
                component={MoreStackNavigator}
                options={{ title: 'More' }}
            />
        </Tab.Navigator>
    );
}

function ShiftUserTabs() {
    return (
        <Tab.Navigator id="ShiftUserTabs" screenOptions={({ route }) => tabScreenOptions(route)}>
            <Tab.Screen
                name="Home"
                component={ShiftStackNavigator}
                options={{ title: 'Shift' }}
            />
            <Tab.Screen
                name="Requests"
                component={RequestsStackNavigator}
                options={{ title: 'Requests' }}
            />
            <Tab.Screen
                name="More"
                component={MoreStackNavigator}
                options={{ title: 'More' }}
            />
        </Tab.Navigator>
    );
}

export default function AppNavigator({ session }: { session: any }) {
    const { isShiftUser, isLoading } = useShiftUserStatus();

    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.background.primary, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.primary[600]} />
            </View>
        );
    }

    return isShiftUser === true ? <ShiftUserTabs /> : <GeneralUserTabs />;
}

const styles = StyleSheet.create({
    iconContainer: {
        width: 40,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.sm,
    },
    iconContainerActive: {
        backgroundColor: COLORS.primary[50],
    },
});
