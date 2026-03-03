'use client';

import AdminLayout from '@/components/AdminLayout';
import { useState, useEffect } from 'react';
import { getAllDevotionals } from '@/lib/firestore';
import Link from 'next/link';
import type { Devotional } from '@/lib/types';

export default function CalendarPage() {
    const [devotionals, setDevotionals] = useState<Devotional[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        (async () => {
            const all = await getAllDevotionals(200);
            setDevotionals(all);
            setLoading(false);
        })();
    }, []);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Calendar grid helpers
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const today = new Date().toISOString().split('T')[0];

    // Map devotionals by date for fast lookup
    const devotionalMap: Record<string, Devotional> = {};
    devotionals.forEach(d => {
        if (d.date) devotionalMap[d.date] = d;
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const statusColors: Record<string, { bg: string; text: string; border: string }> = {
        published: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
        scheduled: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
        draft: { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)' },
        processing: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
        failed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Content Calendar</h1>
                        <p className="page-subtitle">Plan and track your devotional schedule</p>
                    </div>
                    <Link href="/devotionals/new" className="btn btn-primary">
                        ➕ New Devotional
                    </Link>
                </div>
            </div>

            {/* Calendar Card */}
            <div className="card" style={{ padding: 24 }}>
                {/* Month Navigation */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 20,
                }}>
                    <button className="btn btn-ghost" onClick={prevMonth}>← Prev</button>
                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{monthName}</h2>
                    <button className="btn btn-ghost" onClick={nextMonth}>Next →</button>
                </div>

                {/* Day Headers */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
                    marginBottom: 4,
                }}>
                    {dayNames.map(d => (
                        <div key={d} style={{
                            textAlign: 'center', fontSize: 11, fontWeight: 600,
                            color: 'var(--text-tertiary)', padding: '8px 0',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                            {d}
                        </div>
                    ))}
                </div>

                {/* Day Grid */}
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        Loading calendar...
                    </div>
                ) : (
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
                    }}>
                        {/* Empty cells before first day */}
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`empty-${i}`} style={{
                                minHeight: 90, background: 'var(--bg-secondary)',
                                borderRadius: 6, opacity: 0.3,
                            }} />
                        ))}

                        {/* Days of the month */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const devotional = devotionalMap[dateStr];
                            const isToday = dateStr === today;
                            const colors = devotional ? statusColors[devotional.status] || statusColors.draft : null;

                            return (
                                <div
                                    key={day}
                                    style={{
                                        minHeight: 90, padding: 8,
                                        background: isToday ? 'rgba(129, 140, 248, 0.08)' : 'var(--bg-secondary)',
                                        border: isToday ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid transparent',
                                        borderRadius: 8,
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'border-color 0.15s ease',
                                    }}
                                >
                                    {/* Day Number */}
                                    <div style={{
                                        fontSize: 12, fontWeight: isToday ? 700 : 500,
                                        color: isToday ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        marginBottom: 4,
                                    }}>
                                        {day}
                                    </div>

                                    {/* Devotional Pill */}
                                    {devotional ? (
                                        <Link
                                            href={`/devotionals/new?edit=${devotional.id}`}
                                            style={{
                                                display: 'block', padding: '4px 6px',
                                                borderRadius: 6,
                                                background: colors?.bg,
                                                border: `1px solid ${colors?.border}`,
                                                fontSize: 10, fontWeight: 600,
                                                color: colors?.text,
                                                textDecoration: 'none',
                                                lineHeight: 1.3,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                            title={`${devotional.title} (${devotional.status})`}
                                        >
                                            {devotional.status === 'published' ? '✓ ' :
                                                devotional.status === 'scheduled' ? '📅 ' :
                                                    devotional.status === 'draft' ? '📝 ' : ''}
                                            {devotional.title}
                                        </Link>
                                    ) : (
                                        <Link
                                            href={`/devotionals/new?date=${dateStr}`}
                                            style={{
                                                display: 'block', padding: '4px 6px',
                                                borderRadius: 6, fontSize: 10,
                                                color: 'var(--text-muted)',
                                                textDecoration: 'none',
                                                opacity: 0.5,
                                            }}
                                        >
                                            + Add
                                        </Link>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Legend */}
                <div style={{
                    display: 'flex', gap: 20, marginTop: 16,
                    justifyContent: 'center', flexWrap: 'wrap',
                }}>
                    {Object.entries(statusColors).map(([status, colors]) => (
                        <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                                width: 10, height: 10, borderRadius: '50%',
                                background: colors.text,
                            }} />
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                                {status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}
