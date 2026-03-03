'use client';

import AdminLayout from '@/components/AdminLayout';
import { useState, useEffect } from 'react';
import { getAllDevotionals } from '@/lib/firestore';
import type { Devotional } from '@/lib/types';

export default function AudioPage() {
    const [ttsStatus, setTtsStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
    const [ttsInfo, setTtsInfo] = useState<any>(null);
    const [audioDevotionals, setAudioDevotionals] = useState<Devotional[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAudioFiles();
        checkTtsServer();
    }, []);

    const loadAudioFiles = async () => {
        try {
            const all = await getAllDevotionals();
            setAudioDevotionals(all.filter(d => d.audioUrl));
        } catch (error) {
            console.error('Failed to load audio files:', error);
        } finally {
            setLoading(false);
        }
    };

    const ttsUrl = process.env.NEXT_PUBLIC_TTS_SERVER_URL || 'http://localhost:8123';

    const checkTtsServer = async () => {
        try {
            const res = await fetch(`${ttsUrl}/health`);
            if (res.ok) {
                setTtsStatus('online');
                const data = await res.json();
                setTtsInfo(data);
            } else {
                setTtsStatus('offline');
            }
        } catch {
            setTtsStatus('offline');
        }
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Audio Management</h1>
                        <p className="page-subtitle">Edge-TTS generation and audio library</p>
                    </div>
                    <button className="btn btn-secondary" onClick={checkTtsServer}>
                        <span>🔍</span> Check TTS Server
                    </button>
                </div>
            </div>

            <div className="page-body">
                {/* TTS Server Status */}
                <div className="stats-grid">
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">🎙️ Edge-TTS</div>
                            <span className={`badge ${ttsStatus === 'online' ? 'badge-success' :
                                ttsStatus === 'offline' ? 'badge-error' : 'badge-pending'
                                }`}>
                                <span className="badge-dot"></span>
                                {ttsStatus === 'online' ? 'Online' : ttsStatus === 'offline' ? 'Offline' : 'Unknown'}
                            </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            Server at <code style={{ color: 'var(--accent-primary)' }}>{ttsUrl}</code>
                            <br />
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                {ttsInfo?.engine || 'Microsoft Neural Voices (Free)'}
                            </span>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">🗣️ Available Voices</div>
                        </div>
                        <div className="card-value" style={{ fontSize: 24 }}>{ttsInfo?.voices?.length || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {ttsInfo?.voices?.join(', ') || 'Check server to see voices'}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">📁 Audio Library</div>
                        </div>
                        <div className="card-value">{loading ? '…' : audioDevotionals.length}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Devotionals with audio</div>
                    </div>
                </div>

                {/* Voice Preview */}
                <div className="card" style={{ marginTop: 24 }}>
                    <div className="card-header">
                        <div className="card-title">🗣️ Voice Profiles</div>
                    </div>
                    <div className="stats-grid" style={{ marginBottom: 0 }}>
                        {[
                            { id: 'guy', name: 'Guy (Male)', desc: 'Warm, clear — great for devotionals' },
                            { id: 'andrew', name: 'Andrew (Male)', desc: 'Professional male voice' },
                            { id: 'aria', name: 'Aria (Female)', desc: 'Clear, expressive female voice' },
                            { id: 'jenny', name: 'Jenny (Female)', desc: 'Warm, friendly female voice' },
                            { id: 'davis', name: 'Davis (Male)', desc: 'Deep, authoritative male voice' },
                            { id: 'brian', name: 'Brian (Male)', desc: 'Conversational male voice' },
                        ].map(v => (
                            <div key={v.id} className="card devotional-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 24 }}>🎤</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{v.desc}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Generated Audio Files */}
                <div className="card" style={{ marginTop: 24 }}>
                    <div className="card-header">
                        <div className="card-title">📁 Generated Audio</div>
                    </div>
                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
                    ) : audioDevotionals.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <div className="empty-state-icon">🎧</div>
                            <div className="empty-state-title">No audio generated yet</div>
                            <div className="empty-state-text">
                                Audio will appear here as devotionals are processed through the pipeline.
                            </div>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Devotional</th>
                                        <th>Duration</th>
                                        <th>Player</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {audioDevotionals.map(dev => (
                                        <tr key={dev.id}>
                                            <td style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{dev.date}</td>
                                            <td style={{ fontWeight: 500 }}>{dev.title}</td>
                                            <td style={{ fontSize: 13 }}>{dev.audioDuration ? `${Math.round(dev.audioDuration)}s` : '—'}</td>
                                            <td>
                                                <audio controls preload="none" style={{ height: 32, maxWidth: 200 }}>
                                                    <source src={dev.audioUrl} type="audio/mpeg" />
                                                </audio>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
