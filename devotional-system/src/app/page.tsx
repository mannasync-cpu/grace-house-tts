'use client';

import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getAllDevotionals, getDevotionalByDate, getRecentLogs } from '@/lib/firestore';
import { orchestrator } from '@/lib/orchestrator';
import { planningCenterService } from '@/lib/services';
import type { Devotional, PipelineLog } from '@/lib/types';

export default function DashboardPage() {
  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [todayDev, setTodayDev] = useState<Devotional | null>(null);
  const [lastLog, setLastLog] = useState<PipelineLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allDevs, today, logs] = await Promise.all([
        getAllDevotionals(),
        getDevotionalByDate(new Date().toISOString().split('T')[0]),
        getRecentLogs(1),
      ]);
      setDevotionals(allDevs);
      setTodayDev(today);
      setLastLog(logs[0] || null);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunPipeline = async () => {
    if (!confirm('Run the pipeline for today\'s devotional?')) return;
    setRunningPipeline(true);
    try {
      await orchestrator.runPipeline();
      alert('Pipeline started!');
      loadData();
    } catch (err: any) {
      alert('Pipeline failed: ' + err.message);
    } finally {
      setRunningPipeline(false);
    }
  };

  const handleSyncContacts = async () => {
    setSyncing(true);
    try {
      const result = await planningCenterService.syncContacts();
      alert(`Synced ${result.length} contacts.`);
    } catch {
      alert('Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const checkTts = async () => {
    const url = process.env.NEXT_PUBLIC_TTS_SERVER_URL || 'http://localhost:8123';
    try {
      const res = await fetch(`${url}/health`);
      setTtsStatus(res.ok ? 'online' : 'offline');
    } catch {
      setTtsStatus('offline');
    }
  };

  // Stats
  const total = devotionals.length;
  const scheduled = devotionals.filter(d => d.status === 'scheduled').length;
  const published = devotionals.filter(d => d.status === 'published').length;
  const withAudio = devotionals.filter(d => d.audioUrl).length;
  const recent = devotionals.slice(0, 5);

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Daily devotional system overview</p>
          </div>
          <Link href="/devotionals/new" className="btn btn-primary">
            <span>✏️</span> New Devotional
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* Stats Row */}
        <div className="stats-grid">
          <StatCard icon="📖" label="Total Devotionals" value={loading ? '…' : String(total)} sub={loading ? 'Loading…' : 'All time'} />
          <StatCard icon="📅" label="Scheduled" value={loading ? '…' : String(scheduled)} sub="Upcoming devotionals" />
          <StatCard icon="✅" label="Published" value={loading ? '…' : String(published)} sub="Successfully sent" />
          <StatCard icon="🎧" label="Audio Files" value={loading ? '…' : String(withAudio)} sub="With generated audio" />
        </div>

        {/* Main Content */}
        <div className="content-grid">
          {/* Today's Devotional */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Today&apos;s Devotional</div>
                <div className="card-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
              <span className={`badge ${todayDev ? 'badge-success' : 'badge-pending'}`}>
                <span className="badge-dot"></span>
                {todayDev ? todayDev.status.charAt(0).toUpperCase() + todayDev.status.slice(1) : 'No Entry'}
              </span>
            </div>
            {todayDev ? (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{todayDev.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>by {todayDev.author || 'Unknown'}</div>
                {todayDev.summary && (
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{todayDev.summary}</div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <span className={`status-badge status-${todayDev.channelStatus?.email?.status === 'sent' ? 'published' : 'draft'}`}>
                    📧 {todayDev.channelStatus?.email?.status || 'pending'}
                  </span>
                  <span className={`status-badge status-${todayDev.channelStatus?.blog?.status === 'sent' ? 'published' : 'draft'}`}>
                    📰 {todayDev.channelStatus?.blog?.status || 'pending'}
                  </span>
                  <span className={`status-badge status-${todayDev.channelStatus?.whatsapp?.status === 'sent' ? 'published' : 'draft'}`}>
                    💬 {todayDev.channelStatus?.whatsapp?.status || 'pending'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-state-icon">📝</div>
                <div className="empty-state-title">No devotional for today</div>
                <div className="empty-state-text">Create today&apos;s devotional to start the distribution pipeline.</div>
                <Link href="/devotionals/new" className="btn btn-primary">Create Devotional</Link>
              </div>
            )}
          </div>

          {/* Pipeline Status */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Pipeline Status</div>
                <div className="card-subtitle">
                  {lastLog ? `Last run: ${lastLog.startedAt?.toDate?.()?.toLocaleString() || lastLog.date}` : 'No runs yet'}
                </div>
              </div>
              {lastLog && (
                <span className={`badge ${lastLog.status === 'completed' ? 'badge-success' : lastLog.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
                  <span className="badge-dot"></span>
                  {lastLog.status === 'completed' ? 'Success' : lastLog.status === 'failed' ? 'Failed' : 'Running'}
                </span>
              )}
            </div>
            <div className="pipeline-steps">
              {lastLog && lastLog.steps?.length > 0 ? (
                lastLog.steps.map((step, i) => (
                  <PipelineStepRow key={i} icon={stepIcons[step.name] || '▪️'} name={step.name} status={step.status} />
                ))
              ) : (
                <>
                  <PipelineStepRow icon="📥" name="Fetch Devotional" status="pending" />
                  <PipelineStepRow icon="📝" name="Generate Summary" status="pending" />
                  <PipelineStepRow icon="🎙️" name="Generate Audio (TTS)" status="pending" />
                  <PipelineStepRow icon="☁️" name="Upload Audio" status="pending" />
                  <PipelineStepRow icon="📰" name="Publish Blog (Wix)" status="pending" />
                  <PipelineStepRow icon="📧" name="Send Email (Mailchimp)" status="pending" />
                  <PipelineStepRow icon="📱" name="Send SMS (AWS SNS)" status="pending" />
                  <PipelineStepRow icon="💬" name="Send WhatsApp" status="pending" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent Devotionals */}
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">Recent Devotionals</div>
            <Link href="/devotionals" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : recent.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon">📚</div>
              <div className="empty-state-title">No devotionals yet</div>
              <div className="empty-state-text">Your devotionals will appear here once you create them.</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Audio</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(dev => (
                    <tr key={dev.id}>
                      <td style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{dev.date}</td>
                      <td style={{ fontWeight: 500 }}>{dev.title}</td>
                      <td>
                        <span className={`status-badge status-${dev.status === 'published' ? 'published' : dev.status === 'scheduled' ? 'processing' : 'draft'}`}>
                          {dev.status}
                        </span>
                      </td>
                      <td>{dev.audioUrl ? '🎧' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="stats-grid" style={{ marginTop: 24 }}>
          <QuickAction icon="🔄" label={runningPipeline ? 'Running…' : 'Run Pipeline'} description="Manually trigger today's pipeline" onClick={handleRunPipeline} disabled={runningPipeline} />
          <QuickAction icon="🎙️" label={`TTS Server (${ttsStatus})`} description="Check Edge-TTS server status" onClick={checkTts} />
          <QuickAction icon="📡" label={syncing ? 'Syncing…' : 'Sync Contacts'} description="Sync from Planning Center" onClick={handleSyncContacts} disabled={syncing} />
          <QuickAction icon="📊" label="Analytics" description="View delivery analytics" onClick={() => window.location.href = '/logs'} />
        </div>
      </div>
    </AdminLayout>
  );
}

const stepIcons: Record<string, string> = {
  'Fetch Devotional': '📥',
  'Generate Summary': '📝',
  'Generate Audio': '🎙️',
  'Upload Audio': '☁️',
  'Send Email': '📧',
  'Send Email (Mailchimp)': '📧',
  'Send WhatsApp': '💬',
  'Publish Blog': '📰',
  'Publish Blog (Wix)': '📰',
  'Send SMS': '📱',
  'Send SMS (AWS SNS)': '📱',
};

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{label}</div>
        <div className="card-icon" style={{ background: 'var(--accent-primary-glow)' }}>{icon}</div>
      </div>
      <div className="card-value">{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function PipelineStepRow({ icon, name, status }: { icon: string; name: string; status: string }) {
  const statusColor = {
    pending: 'var(--text-muted)',
    running: 'var(--status-warning)',
    completed: 'var(--status-success)',
    failed: 'var(--status-error)',
    skipped: 'var(--text-muted)',
  }[status] || 'var(--text-muted)';

  const statusLabel = {
    pending: '⏳ Waiting',
    running: '🔄 Running',
    completed: '✅ Done',
    failed: '❌ Failed',
    skipped: '⏭️ Skipped',
  }[status] || status;

  return (
    <div className="pipeline-step">
      <span className="pipeline-step-icon">{icon}</span>
      <span className="pipeline-step-name">{name}</span>
      <span className="pipeline-step-status" style={{ color: statusColor }}>{statusLabel}</span>
    </div>
  );
}

function QuickAction({ icon, label, description, onClick, disabled }: { icon: string; label: string; description: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <div className="card devotional-card" style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }} onClick={disabled ? undefined : onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="card-icon" style={{ background: 'var(--accent-primary-glow)', fontSize: 24 }}>{icon}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{description}</div>
        </div>
      </div>
    </div>
  );
}
