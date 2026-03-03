'use client';

import AdminLayout from '@/components/AdminLayout';
import { useState, useEffect, useRef } from 'react';
import { planningCenterService } from '@/lib/services';
import {
    getAllContacts, upsertContacts, getAllGroups,
    createGroup, updateGroup, deleteGroup,
    addContactsToGroup, removeContactFromGroup,
    updateContact,
} from '@/lib/firestore';
import { Contact, ContactGroup } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

export default function ContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [groups, setGroups] = useState<ContactGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [c, g] = await Promise.all([getAllContacts(), getAllGroups()]);
            setContacts(c);
            setGroups(g);
        } catch (error) {
            console.error('Failed to load:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // ─── Planning Center Sync ──────────────────────────────────
    const handleSync = async () => {
        setSyncing(true);
        try {
            const result = await planningCenterService.syncContacts();
            alert(`✅ Synced ${result.length} contacts from Planning Center.`);
            loadData();
        } catch (error: any) {
            alert(`❌ Sync failed: ${error.message}`);
        } finally {
            setSyncing(false);
        }
    };

    // ─── CSV Import ────────────────────────────────────────────
    const handleCsvImport = () => fileInputRef.current?.click();

    const processCsvFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) { alert('CSV file is empty.'); return; }

            const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
            const nameIdx = header.findIndex(h => ['name', 'full name', 'fullname'].includes(h));
            const firstNameIdx = header.findIndex(h => ['first name', 'firstname', 'first'].includes(h));
            const lastNameIdx = header.findIndex(h => ['last name', 'lastname', 'last'].includes(h));
            const emailIdx = header.findIndex(h => ['email', 'e-mail', 'email address'].includes(h));
            const phoneIdx = header.findIndex(h => ['phone', 'phone number', 'mobile', 'cell'].includes(h));

            if (emailIdx === -1 && phoneIdx === -1) {
                alert('❌ CSV must have an "email" or "phone" column.');
                return;
            }

            const newContacts: Contact[] = [];
            const now = Timestamp.now();

            for (let i = 1; i < lines.length; i++) {
                const fields = parseCsvLine(lines[i]);
                if (fields.length === 0) continue;

                let name = '';
                if (nameIdx >= 0) name = fields[nameIdx]?.trim() || '';
                else if (firstNameIdx >= 0 || lastNameIdx >= 0) {
                    name = `${fields[firstNameIdx]?.trim() || ''} ${fields[lastNameIdx]?.trim() || ''}`.trim();
                }

                const email = emailIdx >= 0 ? fields[emailIdx]?.trim() || '' : '';
                const phone = phoneIdx >= 0 ? fields[phoneIdx]?.trim() || null : null;
                if (!email && !phone) continue;

                const id = `csv_${email || phone || i}`.replace(/[^\w]/g, '_');
                newContacts.push({
                    id, name: name || email || phone || 'Unknown', email, phone,
                    smsOptIn: true, whatsappOptIn: false, emailOptIn: !!email,
                    dndRegistered: false, unsubscribedAt: null, groups: [],
                    planningCenterId: null, createdAt: now, updatedAt: now,
                });
            }

            if (newContacts.length === 0) { alert('No valid contacts found.'); return; }
            await upsertContacts(newContacts);
            alert(`✅ Imported ${newContacts.length} contacts from CSV.`);
            loadData();
        } catch (error: any) {
            alert(`❌ Import failed: ${error.message}`);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const parseCsvLine = (line: string): string[] => {
        const fields: string[] = [];
        let current = '', inQuotes = false;
        for (const char of line) {
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
            else current += char;
        }
        fields.push(current.trim());
        return fields;
    };

    // ─── Group Management ──────────────────────────────────────
    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        await createGroup({ name: newGroupName.trim() });
        setNewGroupName('');
        setShowGroupModal(false);
        loadData();
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!confirm('Delete this group? Contacts will NOT be deleted, only removed from the group.')) return;
        await deleteGroup(groupId);
        if (activeGroupId === groupId) setActiveGroupId(null);
        loadData();
    };

    const handleAddToGroup = async (groupId: string) => {
        if (selectedContactIds.length === 0) { alert('Select contacts first.'); return; }
        await addContactsToGroup(selectedContactIds, groupId);
        setSelectedContactIds([]);
        alert(`✅ Added ${selectedContactIds.length} contacts to group.`);
        loadData();
    };

    const handleRemoveFromGroup = async (contactId: string, groupId: string) => {
        await removeContactFromGroup(contactId, groupId);
        loadData();
    };

    // ─── Opt-in Toggle (with confirmation) ─────────────────────
    const handleOptInToggle = async (contactId: string, field: 'emailOptIn' | 'smsOptIn' | 'whatsappOptIn', currentValue: boolean) => {
        const labels: Record<string, string> = { emailOptIn: 'Email', smsOptIn: 'SMS', whatsappOptIn: 'WhatsApp' };
        const action = currentValue ? 'opt OUT' : 'opt IN';
        if (!confirm(`${action.toUpperCase()} this contact for ${labels[field]}?\n\nChanging opt-in status should reflect the contact's actual consent.`)) return;
        await updateContact(contactId, { [field]: !currentValue });
        loadData();
    };

    // ─── Filtering ─────────────────────────────────────────────
    const displayContacts = (() => {
        let list = contacts;
        if (activeGroupId) {
            list = list.filter(c => c.groups?.includes(activeGroupId));
        }
        if (contactSearch) {
            const q = contactSearch.toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                (c.phone || '').includes(q)
            );
        }
        return list;
    })();

    // Stats
    const totalContacts = contacts.length;
    const emailSubs = contacts.filter(c => c.emailOptIn && c.email).length;
    const withPhone = contacts.filter(c => c.phone).length;

    return (
        <AdminLayout>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={processCsvFile} />

            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Contacts</h1>
                        <p className="page-subtitle">Manage contacts, groups, and channel preferences</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-secondary" onClick={handleCsvImport} disabled={importing}>
                            <span>{importing ? '⏳' : '📄'}</span> {importing ? 'Importing...' : 'Import CSV'}
                        </button>
                        <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
                            <span>{syncing ? '⏳' : '🔄'}</span> {syncing ? 'Syncing...' : 'Sync PCO'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-body">
                {/* Stats Row */}
                <div className="stats-grid">
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">Total Contacts</div>
                            <div className="card-icon" style={{ background: 'var(--accent-primary-glow)' }}>👥</div>
                        </div>
                        <div className="card-value">{totalContacts}</div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">Email Opt-In</div>
                            <div className="card-icon" style={{ background: 'var(--accent-secondary-glow)' }}>📧</div>
                        </div>
                        <div className="card-value">{emailSubs}</div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">With Phone</div>
                            <div className="card-icon" style={{ background: 'var(--status-success-bg)' }}>📱</div>
                        </div>
                        <div className="card-value">{withPhone}</div>
                    </div>
                </div>

                {/* Groups Section */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="card-title">📁 Groups</div>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowGroupModal(true)}>
                            ➕ New Group
                        </button>
                    </div>

                    {/* Create Group Modal */}
                    {showGroupModal && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Group name (e.g., Life Group, Leadership)"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                                autoFocus
                                style={{ flex: 1, fontSize: 13 }}
                            />
                            <button className="btn btn-primary btn-sm" onClick={handleCreateGroup}>Create</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowGroupModal(false)}>Cancel</button>
                        </div>
                    )}

                    {/* Group Pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                            className={`btn btn-sm ${!activeGroupId ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setActiveGroupId(null)}
                            style={{ fontSize: 12 }}
                        >
                            All ({contacts.length})
                        </button>
                        {groups.map(group => (
                            <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                    className={`btn btn-sm ${activeGroupId === group.id ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setActiveGroupId(activeGroupId === group.id ? null : group.id)}
                                    style={{ fontSize: 12 }}
                                >
                                    {group.name} ({group.memberCount})
                                </button>
                                <button
                                    className="btn btn-ghost btn-xs"
                                    onClick={() => handleDeleteGroup(group.id)}
                                    style={{ fontSize: 10, color: 'var(--status-error)', padding: '2px 4px' }}
                                    title="Delete group"
                                >✕</button>
                            </div>
                        ))}
                    </div>

                    {/* Add selected to group */}
                    {selectedContactIds.length > 0 && groups.length > 0 && (
                        <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>
                                {selectedContactIds.length} selected →
                            </span>
                            {groups.map(group => (
                                <button
                                    key={group.id}
                                    className="btn btn-secondary btn-xs"
                                    style={{ fontSize: 11 }}
                                    onClick={() => handleAddToGroup(group.id)}
                                >
                                    Add to {group.name}
                                </button>
                            ))}
                            <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => setSelectedContactIds([])}
                                style={{ fontSize: 11 }}
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                {/* Contact List */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="card-title">
                            Contact List
                            {activeGroupId && (
                                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                                    (filtered: {groups.find(g => g.id === activeGroupId)?.name})
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="🔍 Search..."
                                value={contactSearch}
                                onChange={(e) => setContactSearch(e.target.value)}
                                style={{ fontSize: 12, padding: '6px 10px', width: 180 }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{displayContacts.length} contacts</span>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
                    ) : displayContacts.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <div className="empty-state-icon">👥</div>
                            <div className="empty-state-title">No contacts {activeGroupId ? 'in this group' : 'yet'}</div>
                            <div className="empty-state-text">
                                {activeGroupId ? 'Select contacts and add them to this group.' : 'Sync from Planning Center or import a CSV.'}
                            </div>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 30 }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedContactIds.length === displayContacts.length && displayContacts.length > 0}
                                                onChange={() => {
                                                    if (selectedContactIds.length === displayContacts.length) {
                                                        setSelectedContactIds([]);
                                                    } else {
                                                        setSelectedContactIds(displayContacts.map(c => c.id));
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th style={{ textAlign: 'center' }}>📧</th>
                                        <th style={{ textAlign: 'center' }}>📱</th>
                                        <th style={{ textAlign: 'center' }}>💬</th>
                                        <th>Source</th>
                                        {activeGroupId && <th></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayContacts.map(contact => (
                                        <tr key={contact.id}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedContactIds.includes(contact.id)}
                                                    onChange={() => {
                                                        setSelectedContactIds(prev =>
                                                            prev.includes(contact.id)
                                                                ? prev.filter(id => id !== contact.id)
                                                                : [...prev, contact.id]
                                                        );
                                                    }}
                                                />
                                            </td>
                                            <td style={{ fontWeight: 500 }}>
                                                {contact.name}
                                                {contact.dndRegistered && (
                                                    <span title="Do Not Disturb" style={{ marginLeft: 6, fontSize: 10, background: '#ff4444', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>
                                                        DND
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ fontSize: 13 }}>{contact.email || '—'}</td>
                                            <td style={{ fontSize: 13 }}>{contact.phone || '—'}</td>
                                            {/* Opt-in toggles */}
                                            <td style={{ textAlign: 'center' }}>
                                                <OptInDot
                                                    active={contact.emailOptIn}
                                                    disabled={!contact.email}
                                                    onClick={() => contact.email && handleOptInToggle(contact.id, 'emailOptIn', contact.emailOptIn)}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <OptInDot
                                                    active={contact.smsOptIn}
                                                    disabled={!contact.phone}
                                                    onClick={() => contact.phone && handleOptInToggle(contact.id, 'smsOptIn', contact.smsOptIn)}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <OptInDot
                                                    active={contact.whatsappOptIn}
                                                    disabled={!contact.phone}
                                                    onClick={() => contact.phone && handleOptInToggle(contact.id, 'whatsappOptIn', contact.whatsappOptIn)}
                                                />
                                            </td>
                                            <td>
                                                <span className={`status-badge status-${contact.planningCenterId ? 'published' : 'draft'}`}>
                                                    {contact.planningCenterId ? 'PCO' : 'CSV'}
                                                </span>
                                            </td>
                                            {activeGroupId && (
                                                <td>
                                                    <button
                                                        className="btn btn-ghost btn-xs"
                                                        style={{ color: 'var(--status-error)', fontSize: 11 }}
                                                        onClick={() => handleRemoveFromGroup(contact.id, activeGroupId)}
                                                    >
                                                        Remove
                                                    </button>
                                                </td>
                                            )}
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

function OptInDot({ active, disabled, onClick }: { active: boolean; disabled: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={disabled ? 'No contact info' : active ? 'Opted In (click to opt out)' : 'Opted Out (click to opt in)'}
            style={{
                width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: disabled ? 'default' : 'pointer',
                background: disabled ? 'var(--bg-elevated)' : active ? '#22c55e' : '#ef4444',
                opacity: disabled ? 0.3 : 1,
                transition: 'background 0.15s ease',
            }}
        />
    );
}
