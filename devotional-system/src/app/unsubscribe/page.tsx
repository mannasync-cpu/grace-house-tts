'use client';

import { useState } from 'react';
import { getAllContacts, updateContact } from '@/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import type { Contact } from '@/lib/types';

export default function UnsubscribePage() {
    const [lookup, setLookup] = useState('');
    const [contact, setContact] = useState<Contact | null>(null);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [saved, setSaved] = useState(false);

    // Local toggle state
    const [emailOpt, setEmailOpt] = useState(false);
    const [smsOpt, setSmsOpt] = useState(false);
    const [waOpt, setWaOpt] = useState(false);

    const handleSearch = async () => {
        if (!lookup.trim()) return;
        setSearching(true);
        setNotFound(false);
        setSaved(false);
        try {
            const all = await getAllContacts();
            const q = lookup.trim().toLowerCase();
            const found = all.find(c =>
                c.email.toLowerCase() === q ||
                (c.phone && c.phone.replace(/\D/g, '').endsWith(q.replace(/\D/g, '')))
            );
            if (found) {
                setContact(found);
                setEmailOpt(found.emailOptIn);
                setSmsOpt(found.smsOptIn);
                setWaOpt(found.whatsappOptIn);
            } else {
                setContact(null);
                setNotFound(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSearching(false);
        }
    };

    const handleSave = async () => {
        if (!contact) return;
        setSaving(true);
        try {
            await updateContact(contact.id, {
                emailOptIn: emailOpt,
                smsOptIn: smsOpt,
                whatsappOptIn: waOpt,
            });
            setSaved(true);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleUnsubscribeAll = async () => {
        if (!contact) return;
        if (!confirm('This will unsubscribe you from ALL channels. Are you sure?')) return;
        setSaving(true);
        try {
            await updateContact(contact.id, {
                emailOptIn: false, smsOptIn: false, whatsappOptIn: false,
                unsubscribedAt: Timestamp.now(),
            });
            setEmailOpt(false);
            setSmsOpt(false);
            setWaOpt(false);
            setSaved(true);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    return (
        <div style={styles.page}>
            <div style={styles.container}>
                {/* Logo */}
                <div style={styles.logo}>
                    <span style={{ fontSize: 32 }}>✝️</span>
                    <div style={styles.logoText}>Grace House Church</div>
                </div>

                <h1 style={styles.title}>Communication Preferences</h1>
                <p style={styles.subtitle}>
                    Manage how you'd like to hear from Grace House Church.
                </p>

                {/* Lookup Form */}
                <div style={styles.card}>
                    <label style={styles.label}>Enter your email or phone number</label>
                    <div style={styles.inputRow}>
                        <input
                            type="text"
                            placeholder="email@example.com or 555-123-4567"
                            value={lookup}
                            onChange={(e) => setLookup(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            style={styles.input}
                        />
                        <button onClick={handleSearch} disabled={searching} style={styles.searchBtn}>
                            {searching ? '...' : 'Look up'}
                        </button>
                    </div>
                    {notFound && (
                        <p style={styles.notFound}>
                            We couldn't find a contact matching "{lookup}". Please check your email or phone number.
                        </p>
                    )}
                </div>

                {/* Preferences */}
                {contact && (
                    <div style={styles.card}>
                        <div style={styles.contactName}>
                            Hi, {contact.name || 'there'}! 👋
                        </div>

                        <div style={styles.toggleList}>
                            <ToggleRow
                                icon="📧" label="Email Newsletters"
                                description="Weekly devotionals and church updates via email"
                                checked={emailOpt}
                                disabled={!contact.email}
                                onChange={() => setEmailOpt(!emailOpt)}
                            />
                            <ToggleRow
                                icon="📱" label="SMS Text Messages"
                                description="Daily devotional summaries via text message"
                                checked={smsOpt}
                                disabled={!contact.phone}
                                onChange={() => setSmsOpt(!smsOpt)}
                            />
                            <ToggleRow
                                icon="💬" label="WhatsApp Messages"
                                description="Devotional updates via WhatsApp"
                                checked={waOpt}
                                disabled={!contact.phone}
                                onChange={() => setWaOpt(!waOpt)}
                            />
                        </div>

                        <div style={styles.actions}>
                            <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
                                {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Preferences'}
                            </button>
                        </div>

                        <div style={styles.divider} />

                        <button onClick={handleUnsubscribeAll} style={styles.unsubAll}>
                            Unsubscribe from all communications
                        </button>
                    </div>
                )}

                {/* Info */}
                <p style={styles.info}>
                    If you have any questions, contact us at{' '}
                    <a href="mailto:info@gracehousechurch.org" style={styles.link}>info@gracehousechurch.org</a>
                </p>
            </div>
        </div>
    );
}

function ToggleRow({ icon, label, description, checked, disabled, onChange }: {
    icon: string; label: string; description: string;
    checked: boolean; disabled: boolean; onChange: () => void;
}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 0',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            opacity: disabled ? 0.4 : 1,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{label}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{description}</div>
                </div>
            </div>
            <label style={{
                position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: disabled ? 'default' : 'pointer',
            }}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                    position: 'absolute', inset: 0, borderRadius: 24,
                    background: checked ? '#22c55e' : '#334155',
                    transition: 'background 0.2s ease',
                }} />
                <span style={{
                    position: 'absolute', top: 2, left: checked ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s ease',
                }} />
            </label>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh', background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        color: '#e2e8f0', fontFamily: "'Inter', -apple-system, sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 16px',
    },
    container: {
        maxWidth: 480, width: '100%',
    },
    logo: {
        textAlign: 'center' as const, marginBottom: 28,
    },
    logoText: {
        fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginTop: 6,
    },
    title: {
        fontSize: 24, fontWeight: 800, color: '#f8fafc', textAlign: 'center' as const, marginBottom: 8,
    },
    subtitle: {
        fontSize: 14, color: '#94a3b8', textAlign: 'center' as const, marginBottom: 28,
    },
    card: {
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '24px', marginBottom: 20,
    },
    label: {
        fontSize: 13, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 8,
    },
    inputRow: {
        display: 'flex', gap: 8,
    },
    input: {
        flex: 1, padding: '12px 16px', borderRadius: 10,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        color: '#e2e8f0', fontSize: 14, outline: 'none',
    },
    searchBtn: {
        padding: '12px 20px', borderRadius: 10, background: '#6366f1', border: 'none',
        color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    notFound: {
        marginTop: 12, fontSize: 13, color: '#f87171',
    },
    contactName: {
        fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8,
    },
    toggleList: { marginTop: 4 },
    actions: { marginTop: 20, textAlign: 'center' as const },
    saveBtn: {
        padding: '12px 32px', borderRadius: 10,
        background: 'linear-gradient(135deg, #6366f1, #818cf8)',
        border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    },
    divider: {
        height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0',
    },
    unsubAll: {
        background: 'none', border: 'none', color: '#ef4444', fontSize: 13,
        cursor: 'pointer', width: '100%', textAlign: 'center' as const,
    },
    info: {
        fontSize: 12, color: '#475569', textAlign: 'center' as const,
    },
    link: { color: '#818cf8', textDecoration: 'none' },
};
