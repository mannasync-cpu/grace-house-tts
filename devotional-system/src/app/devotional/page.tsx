// This page renders client-side — Firebase data is fetched dynamically
// URL format: /devotional?id=DEVOTIONAL_ID
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { getDevotional } from '@/lib/firestore';
import { linkBibleVersesInHtml } from '@/lib/bibleLinks';
import type { Devotional } from '@/lib/types';

export default function DevotionalPageWrapper() {
    return (
        <Suspense fallback={
            <div style={styles.loadingContainer}>
                <div style={styles.loadingSpinner} />
                <p style={{ color: '#94a3b8', marginTop: 16 }}>Loading devotional...</p>
            </div>
        }>
            <PublicDevotionalPage />
        </Suspense>
    );
}

function PublicDevotionalPage() {
    const searchParams = useSearchParams();
    const id = searchParams?.get('id') || '';
    const [devotional, setDevotional] = useState<Devotional | null>(null);
    const [loading, setLoading] = useState(true);
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (!id) { setLoading(false); return; }
        (async () => {
            const d = await getDevotional(id);
            setDevotional(d);
            setLoading(false);
        })();
    }, [id]);

    const toggleAudio = () => {
        if (!audioRef.current) return;
        if (playing) { audioRef.current.pause(); }
        else { audioRef.current.play(); }
        setPlaying(!playing);
    };

    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

    const handleShare = async () => {
        if (navigator.share) {
            await navigator.share({ title: devotional?.title, url: shareUrl });
        } else {
            await navigator.clipboard.writeText(shareUrl);
            alert('Link copied to clipboard!');
        }
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.loadingSpinner} />
                <p style={{ color: '#94a3b8', marginTop: 16 }}>Loading devotional...</p>
            </div>
        );
    }

    if (!devotional) {
        return (
            <div style={styles.loadingContainer}>
                <h2 style={{ color: '#fff', fontSize: 24 }}>Devotional Not Found</h2>
                <p style={{ color: '#94a3b8', marginTop: 8 }}>This devotional may not exist or has been removed.</p>
                <a href="/devotionals/archive" style={styles.archiveLink}>← Browse All Devotionals</a>
            </div>
        );
    }

    const displayDate = new Date(devotional.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const processedBody = linkBibleVersesInHtml(devotional.body || '');

    return (
        <div style={styles.page}>
            {/* ─── Top Header Bar ─────────────────────────────── */}
            <header style={styles.header}>
                <div style={styles.headerInner}>
                    <div style={styles.logo}>
                        <span style={styles.logoIcon}>✝️</span>
                        <div>
                            <div style={styles.logoText}>Grace House Church</div>
                            <div style={styles.logoSub}>Daily Devotional</div>
                        </div>
                    </div>
                    <nav style={styles.headerNav}>
                        <a href="/devotionals/archive" style={styles.headerLink}>Archive</a>
                        <button onClick={handleShare} style={styles.shareBtn}>
                            📤 Share
                        </button>
                    </nav>
                </div>
            </header>

            {/* ─── Hero / Header Image ────────────────────────── */}
            {devotional.headerImage?.url && (
                <div style={styles.heroContainer}>
                    {devotional.headerImage.link ? (
                        <a href={devotional.headerImage.link} target="_blank" rel="noopener noreferrer">
                            <img src={devotional.headerImage.url} alt="Banner" style={styles.heroImage} />
                        </a>
                    ) : (
                        <img src={devotional.headerImage.url} alt="Banner" style={styles.heroImage} />
                    )}
                </div>
            )}

            {/* ─── Article Content ────────────────────────────── */}
            <main style={styles.main}>
                <article style={styles.article}>
                    <div style={styles.dateBadge}>{displayDate}</div>
                    <h1 style={styles.title}>{devotional.title}</h1>

                    {devotional.author && (
                        <div style={styles.authorRow}>
                            <div style={styles.authorAvatar}>
                                {devotional.author.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={styles.authorName}>{devotional.author}</div>
                                <div style={styles.readTime}>
                                    {Math.max(1, Math.ceil((devotional.plainText?.split(/\s+/).length || 0) / 200))} min read
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Audio Player */}
                    {devotional.audioUrl && (
                        <div style={styles.audioCard}>
                            <audio ref={audioRef} src={devotional.audioUrl} onEnded={() => setPlaying(false)} />
                            <button onClick={toggleAudio} style={styles.playBtn}>
                                {playing ? '⏸️' : '▶️'}
                            </button>
                            <div style={{ flex: 1 }}>
                                <div style={styles.audioTitle}>🎧 Listen to this devotional</div>
                                <div style={styles.audioDuration}>
                                    {devotional.audioDuration
                                        ? `${Math.ceil(devotional.audioDuration / 60)} min`
                                        : 'Audio available'}
                                </div>
                            </div>
                        </div>
                    )}

                    {devotional.thumbnailUrl && (
                        <img src={devotional.thumbnailUrl} alt={devotional.title} style={styles.thumbnail} />
                    )}

                    <div
                        style={styles.body}
                        dangerouslySetInnerHTML={{ __html: processedBody }}
                    />

                    {/* Footer Images / Ads */}
                    {devotional.footerImages && devotional.footerImages.length > 0 && (
                        <div style={styles.footerImagesContainer}>
                            {devotional.footerImages.map((img, idx) => (
                                <div key={idx} style={{
                                    width: img.position === 'half' ? '48%' : '100%',
                                }}>
                                    {img.link ? (
                                        <a href={img.link} target="_blank" rel="noopener noreferrer">
                                            <img src={img.url} alt={img.alt || 'Announcement'} style={styles.footerImage} />
                                        </a>
                                    ) : (
                                        <img src={img.url} alt={img.alt || 'Announcement'} style={styles.footerImage} />
                                    )}
                                    {img.caption && <p style={styles.imageCaption}>{img.caption}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </article>

                {/* ─── Share / Actions ────────────────────────── */}
                <div style={styles.shareSection}>
                    <p style={styles.shareText}>Was this devotional a blessing? Share it with someone.</p>
                    <div style={styles.shareButtons}>
                        <button onClick={handleShare} style={styles.shareActionBtn}>
                            📤 Share Link
                        </button>
                        <a
                            href={`https://wa.me/?text=${encodeURIComponent(`${devotional.title}\n\n${shareUrl}`)}`}
                            target="_blank" rel="noopener noreferrer"
                            style={styles.shareActionBtn}
                        >
                            💬 WhatsApp
                        </a>
                        <a
                            href={`mailto:?subject=${encodeURIComponent(devotional.title)}&body=${encodeURIComponent(`Read today's devotional:\n${shareUrl}`)}`}
                            style={styles.shareActionBtn}
                        >
                            📧 Email
                        </a>
                    </div>
                </div>

                <div style={styles.moreSection}>
                    <a href="/devotionals/archive" style={styles.moreLink}>
                        📖 Browse All Devotionals →
                    </a>
                </div>
            </main>

            {/* ─── Footer ─────────────────────────────────────── */}
            <footer style={styles.footer}>
                <div style={styles.footerInner}>
                    <div style={styles.footerLogo}>✝️ Grace House Church</div>
                    <div style={styles.footerLinks}>
                        <a href="https://www.gracehousechurch.org" target="_blank" style={styles.footerLink}>Website</a>
                        <span style={{ color: '#475569' }}>·</span>
                        <a href="/devotionals/archive" style={styles.footerLink}>Devotionals</a>
                        <span style={{ color: '#475569' }}>·</span>
                        <a href="/unsubscribe" style={styles.footerLink}>Manage Preferences</a>
                    </div>
                    <div style={styles.footerCopy}>© {new Date().getFullYear()} Grace House Church. All rights reserved.</div>
                </div>
            </footer>

            {/* ─── Custom Styles ──────────────────────────────── */}
            <style>{`
                .bible-link {
                    color: #818cf8;
                    text-decoration: none;
                    border-bottom: 1px dashed #818cf880;
                    transition: all 0.2s ease;
                }
                .bible-link:hover { color: #a78bfa; border-bottom-color: #a78bfa; }
                .devotional-body a { color: #818cf8; text-decoration: underline; }
                .devotional-body blockquote {
                    border-left: 3px solid #818cf8;
                    margin: 24px 0; padding: 16px 24px;
                    background: rgba(129, 140, 248, 0.06);
                    border-radius: 0 8px 8px 0;
                    font-style: italic; color: #cbd5e1;
                }
                .devotional-body h1, .devotional-body h2, .devotional-body h3 {
                    color: #f1f5f9; margin: 32px 0 12px;
                }
                .devotional-body p { margin: 0 0 16px; }
                .devotional-body ul, .devotional-body ol { margin: 0 0 16px; padding-left: 24px; }
                .devotional-body li { margin-bottom: 8px; }
                .devotional-body img { max-width: 100%; border-radius: 12px; margin: 16px 0; }
                @media (max-width: 640px) { .devotional-body { font-size: 16px !important; } }
            `}</style>
        </div>
    );
}

// ─── Inline Styles ──────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        color: '#e2e8f0',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    loadingContainer: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#0f172a',
    },
    loadingSpinner: {
        width: 40, height: 40, border: '3px solid #334155', borderTopColor: '#818cf8',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    },
    header: {
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(100, 116, 139, 0.15)',
    },
    headerInner: {
        maxWidth: 720, margin: '0 auto', padding: '12px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    },
    logo: { display: 'flex', alignItems: 'center', gap: 10 },
    logoIcon: { fontSize: 24 },
    logoText: { fontWeight: 700, fontSize: 15, color: '#f1f5f9' },
    logoSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
    headerNav: { display: 'flex', alignItems: 'center', gap: 12 },
    headerLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 13, fontWeight: 500 },
    shareBtn: {
        background: 'rgba(129, 140, 248, 0.12)', border: '1px solid rgba(129, 140, 248, 0.25)',
        color: '#818cf8', padding: '6px 14px', borderRadius: 8, fontSize: 13,
        cursor: 'pointer', fontWeight: 500,
    },
    heroContainer: { maxWidth: 720, margin: '0 auto' },
    heroImage: { width: '100%', height: 'auto', display: 'block' },
    main: { maxWidth: 720, margin: '0 auto', padding: '40px 24px' },
    article: {},
    dateBadge: {
        fontSize: 12, fontWeight: 600, color: '#818cf8',
        textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12,
    },
    title: {
        fontSize: 36, fontWeight: 800, lineHeight: 1.15, color: '#f8fafc',
        marginBottom: 20, letterSpacing: '-0.03em',
    },
    authorRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 },
    authorAvatar: {
        width: 40, height: 40, borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #818cf8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, color: '#fff',
    },
    authorName: { fontWeight: 600, fontSize: 14, color: '#f1f5f9' },
    readTime: { fontSize: 12, color: '#64748b' },
    audioCard: {
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 20px', borderRadius: 12,
        background: 'rgba(129, 140, 248, 0.08)',
        border: '1px solid rgba(129, 140, 248, 0.2)',
        marginBottom: 28,
    },
    playBtn: {
        width: 44, height: 44, borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #818cf8)',
        border: 'none', cursor: 'pointer', fontSize: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    audioTitle: { fontSize: 14, fontWeight: 600, color: '#e2e8f0' },
    audioDuration: { fontSize: 12, color: '#64748b' },
    thumbnail: { width: '100%', height: 'auto', borderRadius: 16, marginBottom: 28 },
    body: { fontSize: 17, lineHeight: 1.85, color: '#cbd5e1' },
    footerImagesContainer: {
        display: 'flex', flexWrap: 'wrap' as const, gap: 12,
        marginTop: 40, paddingTop: 28,
        borderTop: '1px solid rgba(100, 116, 139, 0.2)',
    },
    footerImage: { width: '100%', borderRadius: 12 },
    imageCaption: { fontSize: 12, color: '#64748b', textAlign: 'center' as const, marginTop: 6 },
    shareSection: {
        marginTop: 48, padding: '28px 24px',
        background: 'rgba(129, 140, 248, 0.06)',
        borderRadius: 16, textAlign: 'center' as const,
        border: '1px solid rgba(129, 140, 248, 0.12)',
    },
    shareText: { fontSize: 15, color: '#94a3b8', marginBottom: 16 },
    shareButtons: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' as const },
    shareActionBtn: {
        padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
        cursor: 'pointer', textDecoration: 'none',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        color: '#e2e8f0', display: 'inline-flex', alignItems: 'center', gap: 6,
    },
    moreSection: { marginTop: 32, textAlign: 'center' as const },
    moreLink: { color: '#818cf8', textDecoration: 'none', fontSize: 14, fontWeight: 600 },
    archiveLink: { color: '#818cf8', textDecoration: 'none', marginTop: 16, display: 'inline-block' },
    footer: { borderTop: '1px solid rgba(100, 116, 139, 0.15)', marginTop: 60, padding: '32px 24px' },
    footerInner: { maxWidth: 720, margin: '0 auto', textAlign: 'center' as const },
    footerLogo: { fontSize: 16, fontWeight: 700, color: '#94a3b8', marginBottom: 12 },
    footerLinks: { display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 12 },
    footerLink: { color: '#64748b', textDecoration: 'none', fontSize: 13 },
    footerCopy: { fontSize: 12, color: '#475569' },
};
