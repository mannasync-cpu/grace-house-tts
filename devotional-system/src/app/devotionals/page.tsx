'use client';

import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getAllDevotionals, deleteDevotional } from '@/lib/firestore';
import type { Devotional } from '@/lib/types';

type FilterStatus = 'all' | 'draft' | 'scheduled' | 'published';

export default function DevotionalsPage() {
    const [devotionals, setDevotionals] = useState<Devotional[]>([]);
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [loading, setLoading] = useState(true);

    const loadDevotionals = async () => {
        setLoading(true);
        try {
            const data = await getAllDevotionals();
            setDevotionals(data);
        } catch (error) {
            console.error('Failed to load devotionals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDevotionals();
    }, []);

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
        try {
            await deleteDevotional(id);
            setDevotionals(prev => prev.filter(d => d.id !== id));
        } catch (error) {
            alert('Failed to delete devotional.');
        }
    };

    const filtered = filter === 'all'
        ? devotionals
        : devotionals.filter(d => d.status === filter);

    const counts = {
        all: devotionals.length,
        draft: devotionals.filter(d => d.status === 'draft').length,
        scheduled: devotionals.filter(d => d.status === 'scheduled').length,
        published: devotionals.filter(d => d.status === 'published').length,
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Devotionals</h1>
                        <p className="page-subtitle">Manage your daily devotional content</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <Link href="/templates" className="btn btn-secondary">
                            <span>📋</span> Templates
                        </Link>
                        <Link href="/devotionals/new" className="btn btn-primary">
                            <span>✏️</span> New Devotional
                        </Link>
                    </div>
                </div>
            </div>

            <div className="page-body">
                {/* Filter Tabs */}
                <div className="tabs">
                    {(['all', 'draft', 'scheduled', 'published'] as FilterStatus[]).map((s) => (
                        <button
                            key={s}
                            className={`tab${filter === s ? ' active' : ''}`}
                            onClick={() => setFilter(s)}
                        >
                            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>({counts[s]})</span>
                        </button>
                    ))}
                </div>

                {/* Devotionals List */}
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading devotionals…</div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📖</div>
                        <div className="empty-state-title">
                            {filter === 'all' ? 'No devotionals yet' : `No ${filter} devotionals`}
                        </div>
                        <div className="empty-state-text">
                            {filter === 'all'
                                ? 'Create your first devotional to get started. You can write it from scratch or use a template.'
                                : `No devotionals with status "${filter}" found.`}
                        </div>
                        {filter === 'all' && (
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                <Link href="/devotionals/new" className="btn btn-primary">
                                    <span>✏️</span> Write Devotional
                                </Link>
                                <Link href="/templates" className="btn btn-secondary">
                                    <span>📋</span> Browse Templates
                                </Link>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="card">
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Title</th>
                                        <th>Author</th>
                                        <th>Status</th>
                                        <th>Email</th>
                                        <th>Blog</th>
                                        <th>Audio</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(dev => (
                                        <tr key={dev.id}>
                                            <td style={{ fontSize: 13, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{dev.date}</td>
                                            <td style={{ fontWeight: 600 }}>{dev.title}</td>
                                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{dev.author || '—'}</td>
                                            <td>
                                                <span className={`status-badge status-${dev.status === 'published' ? 'published' : dev.status === 'scheduled' ? 'processing' : 'draft'}`}>
                                                    {dev.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {dev.channelStatus?.email?.status === 'sent' ? '✅' : '—'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {dev.channelStatus?.blog?.status === 'sent' ? '✅' : '—'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {dev.audioUrl ? '🎧' : '—'}
                                            </td>
                                            <td style={{ display: 'flex', gap: 4 }}>
                                                <Link
                                                    href={`/devotionals/new?edit=${dev.id}`}
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ fontSize: 12 }}
                                                >
                                                    ✏️
                                                </Link>
                                                {dev.status === 'published' && (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ fontSize: 12 }}
                                                        onClick={async () => {
                                                            const url = `https://grace-house-devotionals.web.app/devotional?id=${dev.id}`;
                                                            await navigator.clipboard.writeText(url);
                                                            alert('Devotional link copied!');
                                                        }}
                                                        title="Copy devotional link"
                                                    >
                                                        🔗
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: 'var(--status-error-text)', fontSize: 12 }}
                                                    onClick={() => handleDelete(dev.id, dev.title)}
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
