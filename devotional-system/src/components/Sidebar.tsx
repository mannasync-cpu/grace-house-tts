'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
    label: string;
    href: string;
    icon: string;
    badge?: string;
}

const navSections: { label: string; items: NavItem[] }[] = [
    {
        label: 'Overview',
        items: [
            { label: 'Dashboard', href: '/', icon: '📊' },
        ],
    },
    {
        label: 'Content',
        items: [
            { label: 'Devotionals', href: '/devotionals', icon: '📖' },
            { label: 'Calendar', href: '/calendar', icon: '📅' },
            { label: 'Templates', href: '/templates', icon: '📋' },
            { label: 'Audio', href: '/audio', icon: '🎧' },
        ],
    },
    {
        label: 'Distribution',
        items: [
            { label: 'Channels', href: '/channels', icon: '📡' },
            { label: 'Contacts', href: '/contacts', icon: '👥' },
        ],
    },
    {
        label: 'System',
        items: [
            { label: 'Pipeline Logs', href: '/logs', icon: '📜' },
            { label: 'Settings', href: '/settings', icon: '⚙️' },
        ],
    },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-brand">
                    <div className="sidebar-brand-icon">✝️</div>
                    <div className="sidebar-brand-text">
                        <h1>Grace House</h1>
                        <p>Devotional System</p>
                    </div>
                </div>
            </div>
            <nav className="sidebar-nav">
                {navSections.map((section) => (
                    <div className="nav-section" key={section.label}>
                        <div className="nav-section-label">{section.label}</div>
                        {section.items.map((item) => {
                            const isActive =
                                item.href === '/'
                                    ? pathname === '/'
                                    : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`nav-item${isActive ? ' active' : ''}`}
                                >
                                    <span className="nav-item-icon">{item.icon}</span>
                                    {item.label}
                                    {item.badge && <span className="nav-item-badge">{item.badge}</span>}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>
            <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    v2.0.0 · Grace House Church
                </div>
            </div>
        </aside>
    );
}
