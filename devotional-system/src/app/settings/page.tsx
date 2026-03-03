'use client';

import AdminLayout from '@/components/AdminLayout';
import { useState, useEffect } from 'react';
import { getSystemConfig, updateSystemConfig } from '@/lib/firestore';
import type { SystemConfig } from '@/lib/types';

const defaultConfig: SystemConfig = {
    schedule: {
        enabled: true,
        cronExpression: '0 5 * * *',
        timezone: 'America/New_York',
    },
    channels: {
        email: false,
        whatsapp: false,
        blog: false,
    },
    tts: {
        serverUrl: 'http://localhost:8123',
        voiceId: 'default',
        exponent: 1.0,
    },
    mailchimp: {
        listId: '',
        fromEmail: '',
        fromName: 'Grace House Church',
    },
    whatsapp: {
        phoneNumberId: '',
        businessAccountId: '',
        templateName: 'daily_devotional',
    },
    wix: {
        siteId: '',
        blogCategoryId: '',
    },
};

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState('general');
    const [config, setConfig] = useState<SystemConfig>(defaultConfig);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [churchName, setChurchName] = useState('Grace House Church');
    const [defaultAuthor, setDefaultAuthor] = useState('');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const data = await getSystemConfig();
            if (data) setConfig({ ...defaultConfig, ...data });
        } catch (error) {
            console.error('Failed to load config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSystemConfig(config);
            alert('Settings saved!');
        } catch (error) {
            alert('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (path: string, value: any) => {
        setConfig(prev => {
            const next = { ...prev };
            const parts = path.split('.');
            let obj: any = next;
            for (let i = 0; i < parts.length - 1; i++) {
                obj[parts[i]] = { ...obj[parts[i]] };
                obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = value;
            return next;
        });
    };

    if (loading) {
        return (
            <AdminLayout>
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading settings…</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Settings</h1>
                        <p className="page-subtitle">System configuration and API keys</p>
                    </div>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <span>{saving ? '⏳' : '💾'}</span> {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="page-body">
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
                    {/* Settings Nav */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[
                            { id: 'general', label: '⚙️ General' },
                            { id: 'schedule', label: '⏰ Schedule' },
                            { id: 'tts', label: '🎙️ TTS Server' },
                            { id: 'channels', label: '📡 Channels' },
                            { id: 'mailchimp', label: '📧 Mailchimp' },
                            { id: 'whatsapp', label: '💬 WhatsApp' },
                            { id: 'wix', label: '📰 Wix Blog' },
                            { id: 'planning-center', label: '⛪ Planning Center' },
                            { id: 'firebase', label: '🔥 Firebase' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                className={`nav-item${activeSection === item.id ? ' active' : ''}`}
                                onClick={() => setActiveSection(item.id)}
                                style={{ fontSize: 13 }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Settings Content */}
                    <div>
                        {activeSection === 'general' && (
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 20 }}>⚙️ General Settings</div>
                                <div className="form-group">
                                    <label className="form-label">Church Name</label>
                                    <input className="form-input" type="text" value={churchName} onChange={e => setChurchName(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Default Author</label>
                                    <input className="form-input" type="text" value={defaultAuthor} onChange={e => setDefaultAuthor(e.target.value)} placeholder="Pastor Name" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Timezone</label>
                                    <select className="form-select" value={config.schedule.timezone} onChange={e => updateConfig('schedule.timezone', e.target.value)}>
                                        <option value="America/New_York">America/New_York</option>
                                        <option value="America/Chicago">America/Chicago</option>
                                        <option value="America/Denver">America/Denver</option>
                                        <option value="America/Los_Angeles">America/Los_Angeles</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeSection === 'schedule' && (
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 20 }}>⏰ Schedule Configuration</div>
                                <div className="form-group">
                                    <label className="form-label">Cron Expression</label>
                                    <input className="form-input" type="text" value={config.schedule.cronExpression} onChange={e => updateConfig('schedule.cronExpression', e.target.value)} />
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                        e.g. &quot;0 5 * * *&quot; = 5:00 AM daily
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>Enable Automation</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Run pipeline automatically</div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={config.schedule.enabled} onChange={e => updateConfig('schedule.enabled', e.target.checked)} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeSection === 'tts' && (
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 20 }}>🎙️ Edge-TTS Configuration</div>
                                <div className="form-group">
                                    <label className="form-label">Server URL</label>
                                    <input className="form-input" type="text" value={config.tts.serverUrl} onChange={e => updateConfig('tts.serverUrl', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Default Voice ID</label>
                                    <input className="form-input" type="text" value={config.tts.voiceId} onChange={e => updateConfig('tts.voiceId', e.target.value)} />
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                        Options: default, guy, andrew, aria, jenny, davis, tony, brian
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Speech Rate</label>
                                    <input className="form-input" type="number" value={config.tts.exponent} onChange={e => updateConfig('tts.exponent', parseFloat(e.target.value))} step={0.1} min={0.5} max={2.0} />
                                </div>
                            </div>
                        )}

                        {activeSection === 'channels' && (
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 20 }}>📡 Channel Toggles</div>
                                {[
                                    { key: 'email', label: 'Email (Mailchimp)', icon: '📧' },
                                    { key: 'whatsapp', label: 'WhatsApp', icon: '💬' },
                                    { key: 'blog', label: 'Wix Blog', icon: '📰' },
                                ].map(ch => (
                                    <div key={ch.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span>{ch.icon}</span>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>{ch.label}</div>
                                        </div>
                                        <label className="toggle">
                                            <input type="checkbox" checked={(config.channels as any)[ch.key]} onChange={e => updateConfig(`channels.${ch.key}`, e.target.checked)} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeSection === 'mailchimp' && (
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 20 }}>📧 Mailchimp Configuration</div>
                                <div className="form-group">
                                    <label className="form-label">Audience / List ID</label>
                                    <input className="form-input" type="text" value={config.mailchimp.listId} onChange={e => updateConfig('mailchimp.listId', e.target.value)} placeholder="Mailchimp List ID" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">From Email</label>
                                    <input className="form-input" type="email" value={config.mailchimp.fromEmail} onChange={e => updateConfig('mailchimp.fromEmail', e.target.value)} placeholder="devotionals@gracehousechurch.com" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">From Name</label>
                                    <input className="form-input" type="text" value={config.mailchimp.fromName} onChange={e => updateConfig('mailchimp.fromName', e.target.value)} />
                                </div>
                            </div>
                        )}

                        {activeSection === 'whatsapp' && (
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 20 }}>💬 WhatsApp Business API</div>
                                <div className="form-group">
                                    <label className="form-label">Phone Number ID</label>
                                    <input className="form-input" type="text" value={config.whatsapp.phoneNumberId} onChange={e => updateConfig('whatsapp.phoneNumberId', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Business Account ID</label>
                                    <input className="form-input" type="text" value={config.whatsapp.businessAccountId} onChange={e => updateConfig('whatsapp.businessAccountId', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Template Name</label>
                                    <input className="form-input" type="text" value={config.whatsapp.templateName} onChange={e => updateConfig('whatsapp.templateName', e.target.value)} />
                                </div>
                            </div>
                        )}

                        {activeSection === 'wix' && (
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 20 }}>📰 Wix Blog Configuration</div>
                                <div className="form-group">
                                    <label className="form-label">Site ID</label>
                                    <input className="form-input" type="text" value={config.wix.siteId} onChange={e => updateConfig('wix.siteId', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Blog Category ID</label>
                                    <input className="form-input" type="text" value={config.wix.blogCategoryId} onChange={e => updateConfig('wix.blogCategoryId', e.target.value)} />
                                </div>
                            </div>
                        )}

                        {activeSection === 'planning-center' && (
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 20 }}>⛪ Planning Center</div>
                                <div style={{ padding: '12px', background: 'var(--status-info-bg)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--status-info)' }}>
                                        💡 Planning Center credentials are configured via environment variables. Visit the Contacts page to sync.
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: 16 }}>
                                    <label className="form-label">App ID</label>
                                    <input className="form-input" type="text" value={process.env.NEXT_PUBLIC_PLANNING_CENTER_APP_ID ? '••••' + process.env.NEXT_PUBLIC_PLANNING_CENTER_APP_ID.slice(-8) : 'Not set'} disabled />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Secret</label>
                                    <input className="form-input" type="password" value={process.env.NEXT_PUBLIC_PLANNING_CENTER_SECRET ? '••••••••' : ''} disabled />
                                </div>
                            </div>
                        )}

                        {activeSection === 'firebase' && (
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 20 }}>🔥 Firebase Configuration</div>
                                <div style={{ padding: '12px', background: 'var(--status-info-bg)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
                                    <div style={{ fontSize: 12, color: 'var(--status-info)' }}>
                                        💡 Firebase is configured via environment variables and firebase.ts. These are read-only.
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Project ID</label>
                                    <input className="form-input" type="text" value={process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''} disabled />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Auth Domain</label>
                                    <input className="form-input" type="text" value={process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || ''} disabled />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Storage Bucket</label>
                                    <input className="form-input" type="text" value={process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ''} disabled />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
