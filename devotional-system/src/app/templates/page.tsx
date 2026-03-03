'use client';

import AdminLayout from '@/components/AdminLayout';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllTemplates, createTemplate, deleteTemplate } from '@/lib/firestore';
import type { DevotionalTemplate } from '@/lib/types';

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<DevotionalTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const data = await getAllTemplates();
            setTemplates(data);
        } catch (error) {
            console.error('Failed to load templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!templateName.trim()) return;
        setSaving(true);
        try {
            await createTemplate({
                name: templateName,
                description: templateDescription,
                body: '',
                author: '',
            });
            setTemplateName('');
            setTemplateDescription('');
            setShowCreate(false);
            loadTemplates();
        } catch (error) {
            alert('Failed to create template.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete template "${name}"?`)) return;
        try {
            await deleteTemplate(id);
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            alert('Failed to delete template.');
        }
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Templates</h1>
                        <p className="page-subtitle">Reusable devotional formats and layouts</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <span>➕</span> New Template
                    </button>
                </div>
            </div>

            <div className="page-body">
                {/* Built-in Templates */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-header">
                        <div className="card-title">📋 Built-in Templates</div>
                    </div>
                    <div className="stats-grid" style={{ marginBottom: 0 }}>
                        <TemplateCard name="Classic Devotional" description="Scripture → Reflection → Prayer → Application" icon="📖" />
                        <TemplateCard name="Verse of the Day" description="Featured verse with brief commentary" icon="✨" />
                        <TemplateCard name="Topical Study" description="Deep dive into a theological topic" icon="🔍" />
                        <TemplateCard name="Psalm Meditation" description="Focused meditation on a psalm passage" icon="🙏" />
                    </div>
                </div>

                {/* Custom Templates */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">💾 Custom Templates ({templates.length})</div>
                    </div>
                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
                    ) : templates.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <div className="empty-state-icon">📋</div>
                            <div className="empty-state-title">No custom templates yet</div>
                            <div className="empty-state-text">
                                Create a template from scratch or save a devotional as a template for quick reuse.
                            </div>
                        </div>
                    ) : (
                        <div className="stats-grid" style={{ marginBottom: 0 }}>
                            {templates.map(t => (
                                <div key={t.id} className="card devotional-card">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.description || 'No description'}</div>
                                        </div>
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-error-text)' }} onClick={() => handleDelete(t.id, t.name)}>🗑️</button>
                                    </div>
                                    <Link href="/devotionals/new" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                                        Use Template
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Template Modal */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">New Template</div>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Template Name</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="e.g., Morning Reflection"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-textarea"
                                placeholder="Brief description of this template format..."
                                value={templateDescription}
                                onChange={(e) => setTemplateDescription(e.target.value)}
                                style={{ minHeight: 80 }}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !templateName.trim()}>
                                {saving ? '⏳ Creating…' : 'Create Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}

function TemplateCard({ name, description, icon }: { name: string; description: string; icon: string }) {
    return (
        <div className="card devotional-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 28 }}>{icon}</div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{description}</div>
                </div>
            </div>
            <Link href="/devotionals/new" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                Use Template
            </Link>
        </div>
    );
}
