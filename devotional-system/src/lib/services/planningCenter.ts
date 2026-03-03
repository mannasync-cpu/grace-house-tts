import { Contact } from '../types';
import { Timestamp } from 'firebase/firestore';

const PCO_API_BASE = 'https://api.planningcenteronline.com/people/v2';

export class PlanningCenterService {
    private appId: string;
    private secret: string;

    constructor() {
        // Support both naming conventions
        this.appId = process.env.NEXT_PUBLIC_PLANNING_CENTER_APP_ID
            || process.env.PLANNING_CENTER_APP_ID || '';
        this.secret = process.env.NEXT_PUBLIC_PLANNING_CENTER_SECRET
            || process.env.PLANNING_CENTER_SECRET || '';
    }

    isEnabled(): boolean {
        return !!this.appId && !!this.secret;
    }

    private getAuthHeader(): string {
        // If secret is a Personal Access Token (pco_pat_...), use token auth
        if (this.secret.startsWith('pco_pat_')) {
            const str = `${this.appId}:${this.secret}`;
            if (typeof window !== 'undefined') {
                return `Basic ${window.btoa(str)}`;
            }
            return `Basic ${Buffer.from(str).toString('base64')}`;
        }
        // Standard OAuth app credentials
        const str = `${this.appId}:${this.secret}`;
        if (typeof window !== 'undefined') {
            return `Basic ${window.btoa(str)}`;
        }
        return `Basic ${Buffer.from(str).toString('base64')}`;
    }

    private async fetchJson(url: string): Promise<any> {
        console.log(`📡 PCO fetch: ${url}`);
        const res = await fetch(url, {
            headers: { 'Authorization': this.getAuthHeader() },
        });
        if (!res.ok) {
            const body = await res.text();
            console.error(`PCO API error ${res.status}: ${body}`);
            throw new Error(`PCO API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }

    async syncContacts(): Promise<Contact[]> {
        if (!this.isEnabled()) {
            console.warn('Planning Center service is not configured (missing App ID or Secret)');
            return [];
        }

        try {
            console.log('🔄 Starting Planning Center sync...');
            console.log(`   App ID: ${this.appId.substring(0, 8)}...`);
            console.log(`   Secret: ${this.secret.substring(0, 12)}...`);

            const allContacts: Contact[] = [];
            let nextUrl: string | null = `${PCO_API_BASE}/people?per_page=100&include=emails,phone_numbers`;
            let page = 0;

            // Paginate through all people
            while (nextUrl) {
                page++;
                console.log(`   📄 Fetching page ${page}...`);
                const data = await this.fetchJson(nextUrl);

                console.log(`   → Got ${data.data?.length || 0} people, ${data.included?.length || 0} included items`);

                // Build lookup maps for included emails and phone numbers
                const emailMap = new Map<string, string>();
                const phoneMap = new Map<string, string>();

                if (data.included) {
                    for (const item of data.included) {
                        if (item.type === 'Email' && item.attributes?.address) {
                            // PCO includes have relationships.person.data.id
                            const personId = item.relationships?.person?.data?.id;
                            if (personId && (item.attributes.primary || !emailMap.has(personId))) {
                                emailMap.set(personId, item.attributes.address);
                            }
                        }
                        if (item.type === 'PhoneNumber' && item.attributes?.number) {
                            const personId = item.relationships?.person?.data?.id;
                            if (personId && (item.attributes.primary || !phoneMap.has(personId))) {
                                phoneMap.set(personId, item.attributes.number);
                            }
                        }
                    }
                }

                console.log(`   → Found ${emailMap.size} emails, ${phoneMap.size} phones`);

                // Map PCO people to Contact objects
                for (const person of (data.data || [])) {
                    const now = Timestamp.now();
                    const email = emailMap.get(person.id) || '';
                    const phone = phoneMap.get(person.id) || null;

                    // Include all contacts (even without email) — they might have phone for SMS/WhatsApp
                    if (!email && !phone) continue;

                    allContacts.push({
                        id: person.id,
                        name: `${person.attributes.first_name || ''} ${person.attributes.last_name || ''}`.trim(),
                        email,
                        phone,
                        smsOptIn: !!phone,
                        whatsappOptIn: false,
                        emailOptIn: !!email,
                        dndRegistered: false,
                        unsubscribedAt: null,
                        groups: [],
                        planningCenterId: person.id,
                        createdAt: person.attributes.created_at
                            ? Timestamp.fromDate(new Date(person.attributes.created_at))
                            : now,
                        updatedAt: person.attributes.updated_at
                            ? Timestamp.fromDate(new Date(person.attributes.updated_at))
                            : now,
                    });
                }

                // Check for next page
                nextUrl = data.links?.next || null;
                if (nextUrl) {
                    console.log(`   → Next page: ${nextUrl.substring(0, 60)}...`);
                }
            }

            console.log(`✅ Synced ${allContacts.length} contacts from Planning Center (${page} pages).`);

            // Save to Firestore
            if (allContacts.length > 0) {
                const { upsertContacts } = await import('../firestore');
                await upsertContacts(allContacts);
                console.log('✅ Saved to Firestore');
            }

            return allContacts;

        } catch (error: any) {
            console.error('❌ Error syncing Planning Center contacts:', error.message || error);
            throw error; // Re-throw so the UI can display the actual error
        }
    }
}
