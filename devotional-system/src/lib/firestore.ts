import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    setDoc,
    writeBatch,
    documentId,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
    Devotional,
    DevotionalTemplate,
    SystemConfig,
    PipelineLog,
    Contact,
    ContactGroup,
    ChannelStatus,
    SendChannels,
} from './types';

// ─── Collection References ─────────────────────────────────────

const devotionalsRef = collection(db, 'devotionals');
const templatesRef = collection(db, 'templates');
const configRef = doc(db, 'system', 'config');
const logsRef = collection(db, 'pipelineLogs');
const contactsRef = collection(db, 'contacts');
const groupsRef = collection(db, 'contactGroups');

// ─── Defaults ──────────────────────────────────────────────────

const defaultChannelStatus: ChannelStatus = {
    email: { status: 'pending', sentAt: null, error: null, externalId: null },
    whatsapp: { status: 'pending', sentAt: null, error: null, externalId: null },
    sms: { status: 'pending', sentAt: null, error: null, externalId: null },
    blog: { status: 'pending', sentAt: null, error: null, externalId: null },
};

const defaultSendChannels: SendChannels = {
    email: true,
    sms: true,
    whatsapp: true,
    blog: true,
    tts: true,
};

// ─── Devotionals ───────────────────────────────────────────────

export async function createDevotional(data: Partial<Devotional>): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(devotionalsRef, {
        title: data.title || 'Untitled Devotional',
        body: data.body || '',
        plainText: data.plainText || '',
        date: data.date || new Date().toISOString().split('T')[0],
        author: data.author || '',
        summary: data.summary || '',
        audioUrl: data.audioUrl || '',
        audioDuration: data.audioDuration || 0,
        thumbnailUrl: data.thumbnailUrl || '',
        headerImage: data.headerImage || null,
        footerImages: data.footerImages || [],
        images: data.images || [],
        status: data.status || 'draft',
        templateId: data.templateId || null,
        channelStatus: data.channelStatus || defaultChannelStatus,
        // Send preferences
        sendChannels: data.sendChannels || defaultSendChannels,
        recipientMode: data.recipientMode || 'all',
        recipientGroupIds: data.recipientGroupIds || [],
        recipientContactIds: data.recipientContactIds || [],
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
    });
    return docRef.id;
}

export async function getDevotional(id: string): Promise<Devotional | null> {
    const docSnap = await getDoc(doc(devotionalsRef, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Devotional;
}

export async function getDevotionalByDate(date: string): Promise<Devotional | null> {
    const q = query(devotionalsRef, where('date', '==', date), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Devotional;
}

export async function getAllDevotionals(limitCount = 50): Promise<Devotional[]> {
    const q = query(devotionalsRef, orderBy('date', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Devotional));
}

export async function updateDevotional(id: string, data: Partial<Devotional>): Promise<void> {
    await updateDoc(doc(devotionalsRef, id), {
        ...data,
        updatedAt: Timestamp.now(),
    });
}

export async function deleteDevotional(id: string): Promise<void> {
    await deleteDoc(doc(devotionalsRef, id));
}

// ─── Templates ─────────────────────────────────────────────────

export async function createTemplate(data: Partial<DevotionalTemplate>): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(templatesRef, {
        name: data.name || 'Untitled Template',
        description: data.description || '',
        body: data.body || '',
        author: data.author || '',
        thumbnailUrl: data.thumbnailUrl || '',
        createdAt: now,
        updatedAt: now,
    });
    return docRef.id;
}

export async function getAllTemplates(): Promise<DevotionalTemplate[]> {
    const q = query(templatesRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DevotionalTemplate));
}

export async function getTemplate(id: string): Promise<DevotionalTemplate | null> {
    const docSnap = await getDoc(doc(templatesRef, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as DevotionalTemplate;
}

export async function updateTemplate(id: string, data: Partial<DevotionalTemplate>): Promise<void> {
    await updateDoc(doc(templatesRef, id), {
        ...data,
        updatedAt: Timestamp.now(),
    });
}

export async function deleteTemplate(id: string): Promise<void> {
    await deleteDoc(doc(templatesRef, id));
}

// ─── System Config ─────────────────────────────────────────────

export async function getSystemConfig(): Promise<SystemConfig | null> {
    const docSnap = await getDoc(configRef);
    if (!docSnap.exists()) return null;
    return docSnap.data() as SystemConfig;
}

export async function updateSystemConfig(data: Partial<SystemConfig>): Promise<void> {
    await setDoc(configRef, data, { merge: true });
}

// ─── Pipeline Logs ─────────────────────────────────────────────

export async function createPipelineLog(data: Partial<PipelineLog>): Promise<string> {
    const docRef = await addDoc(logsRef, {
        devotionalId: data.devotionalId || '',
        devotionalTitle: data.devotionalTitle || '',
        date: data.date || new Date().toISOString().split('T')[0],
        steps: data.steps || [],
        status: data.status || 'running',
        startedAt: Timestamp.now(),
        completedAt: null,
        error: null,
    });
    return docRef.id;
}

export async function getRecentLogs(limitCount = 20): Promise<PipelineLog[]> {
    const q = query(logsRef, orderBy('startedAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PipelineLog));
}

export async function updatePipelineLog(id: string, data: Partial<PipelineLog>): Promise<void> {
    await updateDoc(doc(logsRef, id), data);
}

// ─── Contacts ──────────────────────────────────────────────────

export async function getAllContacts(): Promise<Contact[]> {
    const q = query(contactsRef, orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            ...data,
            // Ensure new fields have defaults for older docs
            smsOptIn: data.smsOptIn ?? true,
            whatsappOptIn: data.whatsappOptIn ?? false,
            emailOptIn: data.emailOptIn ?? !!data.email,
            dndRegistered: data.dndRegistered ?? false,
            unsubscribedAt: data.unsubscribedAt ?? null,
            groups: data.groups ?? [],
        } as Contact;
    });
}

export async function getContactsByGroupIds(groupIds: string[]): Promise<Contact[]> {
    if (groupIds.length === 0) return [];
    // Firestore array-contains-any supports up to 30 values
    const q = query(contactsRef, where('groups', 'array-contains-any', groupIds.slice(0, 30)));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            ...data,
            smsOptIn: data.smsOptIn ?? true,
            emailOptIn: data.emailOptIn ?? !!data.email,
            dndRegistered: data.dndRegistered ?? false,
            groups: data.groups ?? [],
        } as Contact;
    });
}

export async function getContactsByIds(contactIds: string[]): Promise<Contact[]> {
    if (contactIds.length === 0) return [];
    // Firestore __name__ in supports up to 30 values per query
    const contacts: Contact[] = [];
    for (let i = 0; i < contactIds.length; i += 30) {
        const chunk = contactIds.slice(i, i + 30);
        const q = query(contactsRef, where(documentId(), 'in', chunk));
        const snap = await getDocs(q);
        snap.docs.forEach((d) => {
            const data = d.data();
            contacts.push({
                id: d.id,
                ...data,
                smsOptIn: data.smsOptIn ?? true,
                emailOptIn: data.emailOptIn ?? !!data.email,
                dndRegistered: data.dndRegistered ?? false,
                groups: data.groups ?? [],
            } as Contact);
        });
    }
    return contacts;
}

export async function updateContact(id: string, data: Partial<Contact>): Promise<void> {
    await updateDoc(doc(contactsRef, id), {
        ...data,
        updatedAt: Timestamp.now(),
    });
}

export async function upsertContacts(contacts: Contact[]): Promise<void> {
    // Batch in groups of 500 (Firestore limit)
    for (let i = 0; i < contacts.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = contacts.slice(i, i + 500);
        chunk.forEach((contact) => {
            const docRef = doc(contactsRef, contact.id);
            batch.set(docRef, contact, { merge: true });
        });
        await batch.commit();
    }
}

// ─── Contact Groups ────────────────────────────────────────────

export async function getAllGroups(): Promise<ContactGroup[]> {
    const q = query(groupsRef, orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactGroup));
}

export async function createGroup(data: Partial<ContactGroup>): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(groupsRef, {
        name: data.name || 'New Group',
        description: data.description || '',
        memberCount: 0,
        createdAt: now,
        updatedAt: now,
    });
    return docRef.id;
}

export async function updateGroup(id: string, data: Partial<ContactGroup>): Promise<void> {
    await updateDoc(doc(groupsRef, id), {
        ...data,
        updatedAt: Timestamp.now(),
    });
}

export async function deleteGroup(id: string): Promise<void> {
    await deleteDoc(doc(groupsRef, id));
    // Remove group reference from all contacts
    const q = query(contactsRef, where('groups', 'array-contains', id));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
        const groups = (d.data().groups || []).filter((g: string) => g !== id);
        batch.update(d.ref, { groups });
    });
    if (snap.docs.length > 0) await batch.commit();
}

export async function addContactsToGroup(contactIds: string[], groupId: string): Promise<void> {
    const batch = writeBatch(db);
    for (const contactId of contactIds) {
        const contactRef = doc(contactsRef, contactId);
        const snap = await getDoc(contactRef);
        if (snap.exists()) {
            const groups: string[] = snap.data().groups || [];
            if (!groups.includes(groupId)) {
                groups.push(groupId);
                batch.update(contactRef, { groups });
            }
        }
    }
    await batch.commit();

    // Update member count
    const memberSnap = await getDocs(query(contactsRef, where('groups', 'array-contains', groupId)));
    await updateDoc(doc(groupsRef, groupId), { memberCount: memberSnap.size });
}

export async function removeContactFromGroup(contactId: string, groupId: string): Promise<void> {
    const contactRef = doc(contactsRef, contactId);
    const snap = await getDoc(contactRef);
    if (snap.exists()) {
        const groups: string[] = (snap.data().groups || []).filter((g: string) => g !== groupId);
        await updateDoc(contactRef, { groups });
    }

    // Update member count
    const memberSnap = await getDocs(query(contactsRef, where('groups', 'array-contains', groupId)));
    await updateDoc(doc(groupsRef, groupId), { memberCount: memberSnap.size });
}
