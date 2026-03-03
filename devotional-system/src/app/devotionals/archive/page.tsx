'use client';

import { useState, useEffect } from 'react';
import { getAllDevotionals } from '@/lib/firestore';
import type { Devotional } from '@/lib/types';

export default function DevotionalArchivePage() {
    const [devotionals, setDevotionals] = useState<Devotional[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        (async () => {
            const all = await getAllDevotionals(200);
            setDevotionals(all.filter(d => d.status === 'published'));
            setLoading(false);
        })();
    }, []);

    const filtered = search
        ? devotionals.filter(d =>
            d.title.toLowerCase().includes(search.toLowerCase()) ||
            d.author?.toLowerCase().includes(search.toLowerCase()) ||
            d.plainText?.toLowerCase().includes(search.toLowerCase())
        )
        : devotionals;

    return (
        <div style={styles.page}>
            {/* Header */}
            <header style={styles.header}>
                <div style={styles.headerInner}>
                    <a href="https://www.gracehousechurch.org" style={styles.logo}>
                        <span style={{ fontSize: 24 }}>✝️</span>
                        <div>
                            <div style={styles.logoText}>Grace House Church</div>
                            <div style={styles.logoSub}>Daily Devotional Archive</div>
                        </div>
                    </a>
                </div>
            </header>

            {/* Hero */}
            <div style={styles.hero}>
                <h1 style={styles.heroTitle}>📖 Devotional Archive</h1>
                <p style={styles.heroSub}>Browse past devotionals from Grace House Church</p>
                <div style={styles.searchContainer}>
                    <input
                        type="text"
                        placeholder="Search by title, author, or content..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>
            </div>

            {/* Grid */}
            <main style={styles.main}>
                {loading ? (
                    <div style={styles.loading}>Loading devotionals...</div>
                ) : filtered.length === 0 ? (
                    <div style={styles.loading}>
                        {search ? 'No devotionals match your search.' : 'No published devotionals yet.'}
                    </div>
                ) : (
                    <div style={styles.grid}>
                        {filtered.map(d => {
                            const date = new Date(d.date + 'T12:00:00');
                            const summary = d.plainText?.substring(0, 160) || d.summary || '';
                            return (
                                <a key={d.id} href={`/devotional?id=${d.id}`} style={styles.card}>
                                    {d.thumbnailUrl && (
                                        <img src={d.thumbnailUrl} alt={d.title} style={styles.cardImage} />
                                    )}
                                    <div style={styles.cardBody}>
                                        <div style={styles.cardDate}>
                                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        <h2 style={styles.cardTitle}>{d.title}</h2>
                                        <p style={styles.cardSummary}>{summary}...</p>
                                        {d.author && (
                                            <div style={styles.cardAuthor}>By {d.author}</div>
                                        )}
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer style={styles.footer}>
                <div style={styles.footerCopy}>
                    ✝️ Grace House Church · <a href="https://www.gracehousechurch.org" style={styles.footerLink}>Website</a>
                    {' · '}
                    <a href="/unsubscribe" style={styles.footerLink}>Manage Preferences</a>
                </div>
            </footer>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh', background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        color: '#e2e8f0', fontFamily: "'Inter', -apple-system, sans-serif",
    },
    header: {
        background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(100, 116, 139, 0.15)',
    },
    headerInner: {
        maxWidth: 960, margin: '0 auto', padding: '12px 24px',
        display: 'flex', alignItems: 'center',
    },
    logo: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
    logoText: { fontWeight: 700, fontSize: 15, color: '#f1f5f9' },
    logoSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
    hero: {
        maxWidth: 960, margin: '0 auto', padding: '48px 24px 24px',
        textAlign: 'center' as const,
    },
    heroTitle: { fontSize: 32, fontWeight: 800, color: '#f8fafc', marginBottom: 8 },
    heroSub: { fontSize: 15, color: '#94a3b8', marginBottom: 24 },
    searchContainer: { maxWidth: 480, margin: '0 auto' },
    searchInput: {
        width: '100%', padding: '12px 20px', borderRadius: 12,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        color: '#e2e8f0', fontSize: 14, outline: 'none',
    },
    main: {
        maxWidth: 960, margin: '0 auto', padding: '32px 24px',
    },
    loading: {
        textAlign: 'center' as const, padding: 60, color: '#64748b', fontSize: 15,
    },
    grid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 20,
    },
    card: {
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, overflow: 'hidden', textDecoration: 'none',
        color: '#e2e8f0', transition: 'transform 0.2s ease, border-color 0.2s ease',
    },
    cardImage: {
        width: '100%', height: 180, objectFit: 'cover' as const,
    },
    cardBody: { padding: '16px 20px 20px' },
    cardDate: {
        fontSize: 11, fontWeight: 600, color: '#818cf8',
        textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6,
    },
    cardTitle: {
        fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8, lineHeight: 1.3,
    },
    cardSummary: {
        fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 8,
    },
    cardAuthor: {
        fontSize: 12, color: '#64748b', fontWeight: 500,
    },
    footer: {
        borderTop: '1px solid rgba(100,116,139,0.15)', padding: '24px',
        textAlign: 'center' as const, marginTop: 60,
    },
    footerCopy: { fontSize: 13, color: '#475569' },
    footerLink: { color: '#64748b', textDecoration: 'none' },
};
