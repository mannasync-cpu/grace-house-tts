import { Timestamp } from 'firebase/firestore';

// ─── Devotional ────────────────────────────────────────────────

export type DevotionalStatus = 'draft' | 'scheduled' | 'processing' | 'published' | 'failed';

export interface Devotional {
    id: string;
    title: string;
    body: string;                     // Rich HTML from the editor
    plainText: string;                // Plain text version for TTS
    date: string;                     // ISO date string (YYYY-MM-DD)
    author: string;
    summary: string;                  // 2-3 sentence auto-generated summary
    audioUrl: string;                 // Firebase Storage public URL
    audioDuration: number;            // Duration in seconds
    thumbnailUrl: string;             // Cover image URL
    headerImage?: DevotionalImage;    // Top banner advertisement/branding
    footerImages: DevotionalImage[];  // Bottom advertisement images
    images: string[];                 // Embedded image URLs
    status: DevotionalStatus;
    templateId: string | null;        // Template used, if any
    channelStatus: ChannelStatus;     // Per-channel delivery status

    // ─── Send Preferences ──────────────────────────────────────
    sendChannels: SendChannels;       // Which channels to send on
    recipientMode: 'all' | 'groups' | 'individual';
    recipientGroupIds: string[];      // When mode = 'groups'
    recipientContactIds: string[];    // When mode = 'individual'

    createdAt: Timestamp;
    updatedAt: Timestamp;
    publishedAt: Timestamp | null;
}

export interface SendChannels {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    blog: boolean;
    tts: boolean;
}

export interface DevotionalImage {
    url: string;
    alt?: string;
    link?: string;                    // Click-through URL
    position?: 'full' | 'half';       // Layout preference (default: full)
    caption?: string;
}

export interface ChannelStatus {
    email: DeliveryStatus;
    whatsapp: DeliveryStatus;
    sms: DeliveryStatus;
    blog: DeliveryStatus;
}

export type DeliveryStatusType = 'pending' | 'sent' | 'failed' | 'skipped';

export interface DeliveryStatus {
    status: DeliveryStatusType;
    sentAt: Timestamp | null;
    error: string | null;
    externalId: string | null;        // Campaign ID, message ID, post ID, etc.
}

// ─── Devotional Template ───────────────────────────────────────

export interface DevotionalTemplate {
    id: string;
    name: string;
    description: string;
    body: string;                     // Rich HTML template content
    author: string;
    thumbnailUrl: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ─── System Config ─────────────────────────────────────────────

export interface SystemConfig {
    schedule: {
        enabled: boolean;
        cronExpression: string;         // e.g., "0 5 * * *"
        timezone: string;               // e.g., "America/New_York"
    };
    channels: {
        email: boolean;
        whatsapp: boolean;
        blog: boolean;
    };
    tts: {
        serverUrl: string;              // e.g., "http://localhost:8123"
        voiceId: string;
        exponent: number;               // Speech rate
    };
    mailchimp: {
        listId: string;
        fromEmail: string;
        fromName: string;
    };
    whatsapp: {
        phoneNumberId: string;
        businessAccountId: string;
        templateName: string;
    };
    wix: {
        siteId: string;
        blogCategoryId: string;
    };
}

// ─── Pipeline Log ──────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface PipelineLog {
    id: string;
    devotionalId: string;
    devotionalTitle: string;
    date: string;                     // ISO date
    steps: PipelineStep[];
    status: 'running' | 'completed' | 'failed';
    startedAt: Timestamp;
    completedAt: Timestamp | null;
    error: string | null;
}

export interface PipelineStep {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    message: string;
    startedAt: Timestamp | null;
    completedAt: Timestamp | null;
    error: string | null;
}

// ─── Contact ───────────────────────────────────────────────────

export interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    smsOptIn: boolean;                // Opted in for SMS
    whatsappOptIn: boolean;           // Opted in for WhatsApp
    emailOptIn: boolean;              // Opted in for Email
    dndRegistered: boolean;           // On Do Not Call registry
    unsubscribedAt: Timestamp | null; // Global unsubscribe timestamp
    groups: string[];                 // Array of group IDs
    planningCenterId: string | null;  // Synced from Planning Center
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ─── Contact Group ─────────────────────────────────────────────

export interface ContactGroup {
    id: string;
    name: string;                     // e.g., "Life Group", "Leadership Team"
    description: string;
    memberCount: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
