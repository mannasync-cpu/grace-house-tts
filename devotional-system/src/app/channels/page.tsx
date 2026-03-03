'use client';

import AdminLayout from '@/components/AdminLayout';
import { useState, useEffect } from 'react';
import { getSystemConfig } from '@/lib/firestore';
import type { SystemConfig } from '@/lib/types';

export default function ChannelsPage() {
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const data = await getSystemConfig();
            setConfig(data);
        } catch (error) {
            console.error('Failed to load config:', error);
        } finally {
            setLoading(false);
        }
    };

    // Detect configured state from env + config
    const hasMailchimpKey = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_MAILCHIMP_API_KEY;
    const hasWhatsappKey = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_WHATSAPP_ACCESS_TOKEN;
    const hasWixKey = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_WIX_API_KEY;

    const emailEnabled = config?.channels?.email ?? false;
    const whatsappEnabled = config?.channels?.whatsapp ?? false;
    const blogEnabled = config?.channels?.blog ?? false;

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Distribution Channels</h1>
                        <p className="page-subtitle">Configure and monitor your delivery channels</p>
                    </div>
                </div>
            </div>

            <div className="page-body">
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading channel config…</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <ChannelCard
                            icon="📧"
                            name="Email (Mailchimp)"
                            description="Send full devotional with audio link via Mailchimp campaign"
                            status={hasMailchimpKey ? 'configured' : 'not_configured'}
                            enabled={emailEnabled}
                            details={[
                                { label: 'API Key', value: hasMailchimpKey ? '••••••••' : 'Not set', configured: hasMailchimpKey },
                                { label: 'List ID', value: process.env.NEXT_PUBLIC_MAILCHIMP_LIST_ID || 'Not set', configured: !!process.env.NEXT_PUBLIC_MAILCHIMP_LIST_ID },
                                { label: 'From Name', value: process.env.NEXT_PUBLIC_MAILCHIMP_FROM_NAME || 'Not set', configured: !!process.env.NEXT_PUBLIC_MAILCHIMP_FROM_NAME },
                            ]}
                        />

                        <ChannelCard
                            icon="💬"
                            name="WhatsApp Business"
                            description="Send daily summary + audio link via WhatsApp Business Cloud API"
                            status={hasWhatsappKey ? 'configured' : 'not_configured'}
                            enabled={whatsappEnabled}
                            details={[
                                { label: 'Access Token', value: hasWhatsappKey ? '••••••••' : 'Not set', configured: hasWhatsappKey },
                                { label: 'Phone Number ID', value: process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID || 'Not set', configured: !!process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID },
                                { label: 'Template', value: 'daily_devotional', configured: true },
                            ]}
                        />

                        <ChannelCard
                            icon="📰"
                            name="Blog (Wix)"
                            description="Auto-publish devotional posts to your Wix website"
                            status={hasWixKey ? 'configured' : 'not_configured'}
                            enabled={blogEnabled}
                            details={[
                                { label: 'API Key', value: hasWixKey ? '••••••••' : 'Not set', configured: hasWixKey },
                                { label: 'Site ID', value: process.env.NEXT_PUBLIC_WIX_SITE_ID ? process.env.NEXT_PUBLIC_WIX_SITE_ID.substring(0, 8) + '…' : 'Not set', configured: !!process.env.NEXT_PUBLIC_WIX_SITE_ID },
                                { label: 'Site URL', value: 'gracehousechurch.org', configured: true },
                            ]}
                        />
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function ChannelCard({
    icon,
    name,
    description,
    status,
    enabled,
    details,
}: {
    icon: string;
    name: string;
    description: string;
    status: 'configured' | 'not_configured' | 'error';
    enabled: boolean;
    details: { label: string; value: string; configured: boolean }[];
}) {
    return (
        <div className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 16, flex: 1 }}>
                    <div style={{ fontSize: 32 }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div>
                            <span className={`badge ${status === 'configured' ? 'badge-success' : 'badge-warning'}`}>
                                <span className="badge-dot"></span>
                                {status === 'configured' ? 'Configured' : 'Not Configured'}
                            </span>
                            {enabled && (
                                <span className="badge badge-success" style={{ marginLeft: 4 }}>
                                    <span className="badge-dot"></span>
                                    Enabled
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>{description}</div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                            {details.map((d) => (
                                <div key={d.label} style={{
                                    padding: '10px 14px',
                                    background: 'var(--bg-input)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: `1px solid ${d.configured ? 'rgba(34, 197, 94, 0.2)' : 'var(--border-subtle)'}`,
                                }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
                                        {d.label}
                                    </div>
                                    <div style={{ fontSize: 13, color: d.configured ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                        {d.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
