'use client';

import dynamic from 'next/dynamic';
import AdminLayout from '@/components/AdminLayout';
import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createDevotional, updateDevotional, getDevotional, getAllGroups, getAllContacts } from '@/lib/firestore';
import type { Devotional, DevotionalImage, SendChannels, ContactGroup, Contact } from '@/lib/types';

// Dynamically import Quill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-64 bg-gray-50 animate-pulse rounded-lg" />,
});

// Load Quill CSS on client only
if (typeof window !== 'undefined') {
    import('react-quill-new/dist/quill.snow.css');
}

const quillModules = {
    toolbar: {
        container: [
            [{ header: [1, 2, 3, false] }],
            [{ font: [] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ align: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['blockquote'],
            ['link', 'image'],
            ['clean'],
        ],
    },
    clipboard: { matchVisual: false },
};

const quillFormats = [
    'header', 'font', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'align', 'list', 'blockquote',
    'link', 'image',
];

export default function NewDevotionalPage() {
    return (
        <Suspense fallback={<AdminLayout><div style={{ padding: 60, textAlign: 'center' }}>Loading...</div></AdminLayout>}>
            <DevotionalEditor />
        </Suspense>
    );
}

function DevotionalEditor() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams?.get('edit') || '';
    const prefillDate = searchParams?.get('date') || '';
    const isEditing = !!editId;

    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [date, setDate] = useState(prefillDate || new Date().toISOString().split('T')[0]);
    const [body, setBody] = useState('');
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);
    const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Channel & Recipient State ─────────────────────────────
    const [sendChannels, setSendChannels] = useState<SendChannels>({
        email: true, sms: true, whatsapp: true, blog: true, tts: true,
    });
    const [recipientMode, setRecipientMode] = useState<'all' | 'groups' | 'individual'>('all');
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [groups, setGroups] = useState<ContactGroup[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const [loadingRecipients, setLoadingRecipients] = useState(false);

    // Load groups and contacts
    useEffect(() => {
        (async () => {
            setLoadingRecipients(true);
            try {
                const [g, c] = await Promise.all([getAllGroups(), getAllContacts()]);
                setGroups(g);
                setContacts(c);
            } catch (e) { console.error(e); }
            finally { setLoadingRecipients(false); }
        })();
    }, []);

    // ─── Load existing devotional for editing ──────────────────
    useEffect(() => {
        if (!editId) return;
        (async () => {
            setLoadingEdit(true);
            try {
                const dev = await getDevotional(editId);
                if (dev) {
                    setTitle(dev.title || '');
                    setAuthor(dev.author || '');
                    setDate(dev.date || '');
                    setBody(dev.body || '');
                    setThumbnailPreview(dev.thumbnailUrl || null);
                    if (dev.sendChannels) setSendChannels(dev.sendChannels);
                    if (dev.recipientMode) setRecipientMode(dev.recipientMode);
                    if (dev.recipientGroupIds) setSelectedGroupIds(dev.recipientGroupIds);
                    if (dev.recipientContactIds) setSelectedContactIds(dev.recipientContactIds);
                    if (dev.headerImage) setHeaderImage(dev.headerImage);
                    if (dev.footerImages) setFooterImages(dev.footerImages);
                }
            } catch (e) { console.error('Failed to load devotional:', e); }
            finally { setLoadingEdit(false); }
        })();
    }, [editId]);

    // ─── Recipient Count Preview ───────────────────────────────
    const recipientCount = (() => {
        switch (recipientMode) {
            case 'groups':
                return contacts.filter(c => c.groups?.some(g => selectedGroupIds.includes(g))).length;
            case 'individual':
                return selectedContactIds.length;
            case 'all':
            default:
                return contacts.length;
        }
    })();

    const handleThumbnailClick = () => {
        fileInputRef.current?.click();
    };

    const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setThumbnailPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const stripHtml = (html: string) => {
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    };

    const [headerImage, setHeaderImage] = useState<DevotionalImage | null>(null);
    const [footerImages, setFooterImages] = useState<DevotionalImage[]>([]);

    const handleImageUpload = (file: File, type: 'header' | 'footer') => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const newImage: DevotionalImage = {
                url: reader.result as string,
                position: 'full',
            };
            if (type === 'header') {
                setHeaderImage(newImage);
            } else {
                setFooterImages([...footerImages, newImage]);
            }
        };
        reader.readAsDataURL(file);
    };

    const toggleChannel = (channel: keyof SendChannels) => {
        setSendChannels(prev => ({ ...prev, [channel]: !prev[channel] }));
    };

    const toggleGroup = (groupId: string) => {
        setSelectedGroupIds(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    const toggleContact = (contactId: string) => {
        setSelectedContactIds(prev =>
            prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
        );
    };

    const handleSave = async (status: 'draft' | 'scheduled') => {
        setSaving(true);
        try {
            const devotional: Partial<Devotional> = {
                title,
                body,
                plainText: stripHtml(body),
                date,
                author,
                headerImage: headerImage ?? undefined,
                footerImages: footerImages ?? [],
                status,
                sendChannels,
                recipientMode,
                recipientGroupIds: recipientMode === 'groups' ? selectedGroupIds : [],
                recipientContactIds: recipientMode === 'individual' ? selectedContactIds : [],
            };

            // Firestore rejects undefined values — strip them
            const cleanData = Object.fromEntries(
                Object.entries(devotional).filter(([_, v]) => v !== undefined)
            );

            if (isEditing) {
                await updateDevotional(editId, cleanData);
                alert(`Devotional updated!`);
            } else {
                await createDevotional(cleanData);
                alert(`Devotional ${status === 'draft' ? 'saved as draft' : 'scheduled'}!`);
            }
            router.push('/devotionals');
        } catch (error) {
            console.error('Error saving devotional:', error);
            alert('Error saving devotional: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setSaving(false);
        }
    };

    const wordCount = stripHtml(body).split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    const audioEstimate = Math.max(1, Math.ceil(wordCount / 150));

    // Filtered contacts for search
    const filteredContacts = contactSearch
        ? contacts.filter(c =>
            c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
            c.email.toLowerCase().includes(contactSearch.toLowerCase())
        ).slice(0, 50)
        : contacts.slice(0, 50);

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">{isEditing ? 'Edit Devotional' : 'New Devotional'}</h1>
                        <p className="page-subtitle">{isEditing ? 'Update your devotional content' : 'Create and format your daily devotional'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <Link href="/devotionals" className="btn btn-ghost">← Back</Link>
                        <button
                            className="btn btn-secondary"
                            onClick={() => handleSave('draft')}
                            disabled={saving}
                        >
                            {saving ? <span className="spinner" /> : '💾'} Save Draft
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => handleSave('scheduled')}
                            disabled={saving || !title || !body}
                        >
                            {saving ? <span className="spinner" /> : '📅'} Schedule
                        </button>
                    </div>
                </div>
            </div>


            {/* Left: Editor */}
            <div>
                {/* Header Image Section */}
                <div className="card" style={{ marginBottom: 24, padding: 20, border: '1px dashed var(--border-color)', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>🖼️ Header Banner (Top)</span>
                        {headerImage && (
                            <button onClick={() => setHeaderImage(null)} className="btn btn-ghost btn-xs" style={{ color: 'var(--status-error)' }}>Remove</button>
                        )}
                    </div>

                    {!headerImage ? (
                        <div
                            className="image-upload"
                            style={{ height: 100, minHeight: 100 }}
                            onClick={() => document.getElementById('header-upload')?.click()}
                        >
                            <div className="image-upload-text">Click to upload header banner</div>
                            <input
                                id="header-upload"
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'header')}
                            />
                        </div>
                    ) : (
                        <div style={{ position: 'relative' }}>
                            <img src={headerImage.url} alt="Header" style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
                            <div style={{ marginTop: 8 }}>
                                <input
                                    type="text"
                                    placeholder="Optional link URL (e.g., https://gracehouse.com/events)"
                                    className="form-input"
                                    style={{ fontSize: 13, padding: '6px 10px' }}
                                    value={headerImage.link || ''}
                                    onChange={(e) => setHeaderImage({ ...headerImage, link: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Title */}
                <div className="form-group">
                    <input
                        className="form-input"
                        type="text"
                        placeholder="Devotional Title..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{ fontSize: 20, fontWeight: 700, padding: '14px 16px', letterSpacing: '-0.02em' }}
                    />
                </div>

                {/* Editor Tabs & Quill */}
                <div className="tabs" style={{ marginBottom: 0 }}>
                    <button
                        className={`tab${activeTab === 'write' ? ' active' : ''}`}
                        onClick={() => setActiveTab('write')}
                    >
                        ✏️ Write
                    </button>
                    <button
                        className={`tab${activeTab === 'preview' ? ' active' : ''}`}
                        onClick={() => setActiveTab('preview')}
                    >
                        👁️ Preview
                    </button>
                </div>

                {activeTab === 'write' ? (
                    <div className="editor-container" style={{ marginTop: 2 }}>
                        <ReactQuill
                            theme="snow"
                            value={body}
                            onChange={setBody}
                            modules={quillModules}
                            formats={quillFormats}
                            placeholder="Begin writing your devotional..."
                        />
                    </div>
                ) : (
                    <div className="card" style={{ marginTop: 2, minHeight: 400 }}>
                        {headerImage && <img src={headerImage.url} alt="Header" style={{ width: '100%', borderRadius: '8px 8px 0 0', marginBottom: 20 }} />}

                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                            {date && new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{title || 'Untitled'}</h2>
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
                            {author && `By ${author}`}
                        </div>
                        <div
                            style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-secondary)' }}
                            dangerouslySetInnerHTML={{ __html: body || '<p style="color: var(--text-muted)">No content yet...</p>' }}
                        />

                        {footerImages.length > 0 && (
                            <div style={{ marginTop: 30, borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    {footerImages.map((img, idx) => (
                                        <img
                                            key={idx}
                                            src={img.url}
                                            style={{
                                                width: img.position === 'half' ? '48%' : '100%',
                                                margin: '1%',
                                                borderRadius: 8
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Images Section */}
                <div className="card" style={{ marginTop: 24, padding: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>📣 Footer / Event Ads (Bottom)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
                        {footerImages.map((img, index) => (
                            <div key={index} style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', padding: 8 }}>
                                <div style={{ position: 'relative', height: 100, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                                    <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <button
                                        onClick={() => setFooterImages(footerImages.filter((_, i) => i !== index))}
                                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >×</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <select
                                        className="form-input"
                                        style={{ fontSize: 12, padding: '4px' }}
                                        value={img.position || 'full'}
                                        onChange={(e) => {
                                            const newImages = [...footerImages];
                                            newImages[index].position = e.target.value as 'full' | 'half';
                                            setFooterImages(newImages);
                                        }}
                                    >
                                        <option value="full">Full Width</option>
                                        <option value="half">Half Width (Side-by-Side)</option>
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Link URL..."
                                        className="form-input"
                                        style={{ fontSize: 12, padding: '4px' }}
                                        value={img.link || ''}
                                        onChange={(e) => {
                                            const newImages = [...footerImages];
                                            newImages[index].link = e.target.value;
                                            setFooterImages(newImages);
                                        }}
                                    />
                                </div>
                            </div>
                        ))}

                        <div
                            className="image-upload"
                            style={{ height: 'auto', minHeight: 160, margin: 0 }}
                            onClick={() => document.getElementById('footer-upload')?.click()}
                        >
                            <div className="image-upload-icon" style={{ fontSize: 24 }}>➕</div>
                            <div className="image-upload-text" style={{ fontSize: 12 }}>Add Image</div>
                            <input
                                id="footer-upload"
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'footer')}
                            />
                        </div>
                    </div>
                </div>

                {/* Right: Metadata Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Publish Details */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>📅 Publish Details</div>
                        <div className="form-group">
                            <label className="form-label">Date</label>
                            <input
                                className="form-input"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Author</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Author name"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Thumbnail */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>🖼️ Cover Image</div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleThumbnailChange}
                            style={{ display: 'none' }}
                        />
                        {
                            thumbnailPreview ? (
                                <div>
                                    <img src={thumbnailPreview} alt="Thumbnail" className="image-preview" />
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ marginTop: 8, width: '100%' }}
                                        onClick={handleThumbnailClick}
                                    >
                                        🔄 Change Image
                                    </button>
                                </div>
                            ) : (
                                <div className="image-upload" onClick={handleThumbnailClick}>
                                    <div className="image-upload-icon">📷</div>
                                    <div className="image-upload-text">Click to upload cover image</div>
                                </div>
                            )
                        }
                    </div>

                    {/* Content Stats */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>📊 Content Stats</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <StatRow label="Words" value={wordCount.toString()} />
                            <StatRow label="Reading Time" value={`~${readingTime} min`} />
                            <StatRow label="Audio Estimate" value={`~${audioEstimate} min`} />
                            <StatRow label="Characters" value={stripHtml(body).length.toString()} />
                        </div>
                    </div>

                    {/* ════════════════════════════════════════════════════════
                        DISTRIBUTION CHANNELS — functional toggles
                    ════════════════════════════════════════════════════════ */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>📡 Distribution Channels</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <ChannelToggleRow icon="📧" label="Email (Mailchimp)" checked={sendChannels.email} onChange={() => toggleChannel('email')} />
                            <ChannelToggleRow icon="📱" label="SMS (AWS SNS)" checked={sendChannels.sms} onChange={() => toggleChannel('sms')} />
                            <ChannelToggleRow icon="💬" label="WhatsApp" checked={sendChannels.whatsapp} onChange={() => toggleChannel('whatsapp')} />
                            <ChannelToggleRow icon="📰" label="Blog (Wix)" checked={sendChannels.blog} onChange={() => toggleChannel('blog')} />
                            <ChannelToggleRow icon="🎧" label="Audio (TTS)" checked={sendChannels.tts} onChange={() => toggleChannel('tts')} />
                        </div>
                    </div>

                    {/* ════════════════════════════════════════════════════════
                        RECIPIENT TARGETING
                    ════════════════════════════════════════════════════════ */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div className="card-title">🎯 Recipients</div>
                            <div style={{
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '4px 10px',
                                borderRadius: 12,
                                background: 'var(--accent-primary-glow)',
                                color: 'var(--accent-primary)',
                            }}>
                                ~{recipientCount} people
                            </div>
                        </div>

                        {/* Mode Selector */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                            {(['all', 'groups', 'individual'] as const).map(mode => (
                                <button
                                    key={mode}
                                    className={`btn btn-sm ${recipientMode === mode ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
                                    onClick={() => setRecipientMode(mode)}
                                >
                                    {mode === 'all' ? '👥 All' : mode === 'groups' ? '📁 Groups' : '👤 Pick'}
                                </button>
                            ))}
                        </div>

                        {/* Groups Multi-Select */}
                        {recipientMode === 'groups' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {loadingRecipients ? (
                                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: 12, textAlign: 'center' }}>Loading groups...</div>
                                ) : groups.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: 12, textAlign: 'center' }}>
                                        No groups created yet. Go to Contacts → Create Group.
                                    </div>
                                ) : (
                                    groups.map(group => (
                                        <label
                                            key={group.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                                                background: selectedGroupIds.includes(group.id) ? 'var(--accent-primary-glow)' : 'var(--bg-elevated)',
                                                border: `1px solid ${selectedGroupIds.includes(group.id) ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedGroupIds.includes(group.id)}
                                                onChange={() => toggleGroup(group.id)}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 500 }}>{group.name}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                    {group.memberCount} members{group.description ? ` · ${group.description}` : ''}
                                                </div>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Individual Contact Picker */}
                        {recipientMode === 'individual' && (
                            <div>
                                <input
                                    className="form-input"
                                    type="text"
                                    placeholder="🔍 Search contacts..."
                                    value={contactSearch}
                                    onChange={(e) => setContactSearch(e.target.value)}
                                    style={{ fontSize: 13, marginBottom: 8 }}
                                />
                                {selectedContactIds.length > 0 && (
                                    <div style={{ fontSize: 12, color: 'var(--accent-primary)', marginBottom: 8, fontWeight: 500 }}>
                                        ✓ {selectedContactIds.length} selected
                                    </div>
                                )}
                                <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {filteredContacts.map(contact => (
                                        <label
                                            key={contact.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                                                background: selectedContactIds.includes(contact.id) ? 'var(--accent-primary-glow)' : 'transparent',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedContactIds.includes(contact.id)}
                                                onChange={() => toggleContact(contact.id)}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontWeight: 500 }}>{contact.name}</span>
                                                <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>{contact.email || contact.phone}</span>
                                            </div>
                                        </label>
                                    ))}
                                    {filteredContacts.length === 0 && (
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 12, textAlign: 'center' }}>
                                            No contacts found
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* All mode info */}
                        {recipientMode === 'all' && (
                            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0' }}>
                                Devotional will be sent to all {contacts.length} contacts (filtered by each channel's opt-in status and DND).
                            </div>
                        )}
                    </div>

                    {/* Template Actions */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>📋 Templates</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                                📥 Load Template
                            </button>
                            <button
                                className="btn btn-secondary btn-sm"
                                style={{ width: '100%' }}
                                onClick={() => {
                                    if (title && body) {
                                        alert('Template saved! (Firebase not connected yet)');
                                    }
                                }}
                            >
                                💾 Save as Template
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function StatRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </div>
    );
}

function ChannelToggleRow({ icon, label, checked, onChange }: { icon: string; label: string; checked: boolean; onChange: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span>{icon}</span>
                <span style={{ color: checked ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{label}</span>
            </div>
            <label className="toggle">
                <input type="checkbox" checked={checked} onChange={onChange} />
                <span className="toggle-slider" />
            </label>
        </div>
    );
}
