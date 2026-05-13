// IGO CHAIN ERP Type Definitions for Mobile

export type LocationZone = 'back_office' | 'head_office' | 'site' | 'other';

export type SlotStatus = 'live' | 'late' | 'missed' | 'upcoming' | 'completed';

export type SelfieType = 'morning_login' | 'afternoon_break' | 'evening_break';

export type LoginStatus = 'on_time' | 'late' | 'severe_late' | 'absent';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TimeSlot {
    id: string;
    slotNumber: number;
    startTime: string;
    endTime: string;
    isLunchBreak: boolean;
}

export interface DayStartData {
    id: string;
    user_id: string;
    date: string;
    location_zone: LocationZone;
    location_zone_other: string | null;
    location_verified: boolean;
    login_status: LoginStatus;
    day_plan: string;
    submitted_at: string;
}

export interface SelfieRecord {
    id: string;
    user_id: string;
    date: string;
    selfie_type: SelfieType;
    captured_at: string;
    image_url: string;
}

export interface HourlyReport {
    id: string;
    user_id: string;
    date: string;
    slot_id?: string;
    time_slot: string;
    report_text: string;
    status: string;
    is_late: boolean;
    delay_minutes: number;
    submitted_at: string;
}

export interface HourlyPlan {
    id: string;
    user_id: string;
    date: string;
    slot_id?: string;
    time_slot?: string;
    notes: string;
    tasks: string[];
}

export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string;
    assigned_by: string;
    assigned_to: string;
    project_id?: string;
    project_name?: string;
    created_at: string;
    updated_at: string;
}

export interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    role: string;
    department: string;
    avatar_url?: string;
    phone?: string;
}

export interface LocationLog {
    id: string;
    user_id: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    battery_level: number | null;
    timestamp: string;
    is_within_geofence: boolean;
    matched_geofence_id: string | null;
}

export interface Geofence {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    action_type: string;
    is_active: boolean;
}

// Time slots configuration matching web app
export const TIME_SLOTS: TimeSlot[] = [
    { id: '1', slotNumber: 1, startTime: '10:00', endTime: '11:00', isLunchBreak: false },
    { id: '2', slotNumber: 2, startTime: '11:00', endTime: '12:00', isLunchBreak: false },
    { id: '3', slotNumber: 3, startTime: '12:00', endTime: '13:00', isLunchBreak: false },
    { id: '4', slotNumber: 4, startTime: '13:00', endTime: '14:00', isLunchBreak: false },
    { id: '5', slotNumber: 5, startTime: '14:00', endTime: '14:45', isLunchBreak: true },
    { id: '6', slotNumber: 6, startTime: '14:45', endTime: '16:00', isLunchBreak: false },
    { id: '7', slotNumber: 7, startTime: '16:00', endTime: '17:00', isLunchBreak: false },
    { id: '8', slotNumber: 8, startTime: '17:00', endTime: '18:00', isLunchBreak: false },
    { id: '9', slotNumber: 9, startTime: '18:00', endTime: '19:30', isLunchBreak: false },
];

// Selfie configuration
export const SELFIE_CONFIG: Record<SelfieType, { title: string; time: string; deadline: string }> = {
    morning_login: { title: 'Morning Login', time: 'Before 10:15 AM', deadline: '10:15' },
    afternoon_break: { title: 'Lunch Break', time: '2:30 - 2:45 PM', deadline: '14:45' },
    evening_break: { title: 'Evening Break', time: '5:40 - 5:45 PM', deadline: '17:45' },
};

// Login status thresholds (in minutes from midnight IST)
export const LOGIN_THRESHOLDS = {
    ON_TIME: 615,        // 10:15 AM
    LATE: 660,           // 11:00 AM
    SEVERE_LATE: 720,    // 12:00 PM
};
