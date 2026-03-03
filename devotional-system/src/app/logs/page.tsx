'use client';

import AdminLayout from '@/components/AdminLayout';
import { useState, useEffect } from 'react';
import { orchestrator } from '@/lib/orchestrator';
import { getRecentLogs } from '@/lib/firestore';
import { PipelineLog } from '@/lib/types';

const pipelineSteps = [
    { name: 'Fetch Devotional', icon: '📥' },
    { name: 'Generate Summary', icon: '📝' },
    { name: 'Generate Audio', icon: '🎙️' },
    { name: 'Upload Audio', icon: '☁️' },
    { name: 'Send Email', icon: '📧' },
    { name: 'Send WhatsApp', icon: '💬' },
    { name: 'Publish Blog', icon: '📰' },
];

export default function LogsPage() {
    const [logs, setLogs] = useState<PipelineLog[]>([]);
    const [running, setRunning] = useState(false);

    const loadLogs = async () => {
        try {
            const data = await getRecentLogs();
            setLogs(data);
        } catch (error) {
            console.error('Failed to load logs:', error);
        }
    };

    useEffect(() => {
        loadLogs();
        // Poll for updates every 5 seconds if there are running logs
        const interval = setInterval(loadLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleRunPipeline = async () => {
        if (!confirm('Are you sure you want to run the pipeline manually? This will trigger a new daily devotional process.')) return;

        setRunning(true);
        try {
            console.log('Running pipeline...');
            const logId = await orchestrator.runPipeline();
            alert('Pipeline started successfully! ID: ' + logId);
            loadLogs();
        } catch (error: any) {
            alert('Pipeline failed to start: ' + error.message);
        } finally {
            setRunning(false);
        }
    };

    const totalRuns = logs.length;
    const successRate = totalRuns > 0
        ? Math.round((logs.filter(l => l.status === 'completed').length / totalRuns) * 100) + '%'
        : '—';
    const lastRunDate = logs[0]?.startedAt?.toDate().toLocaleString() || 'Never';

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Pipeline Logs</h1>
                        <p className="page-subtitle">Monitor daily automation runs</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleRunPipeline}
                        disabled={running}
                    >
                        <span>{running ? '⏳' : '▶️'}</span> {running ? 'Running...' : 'Run Pipeline Now'}
                    </button>
                </div>
            </div>

            <div className="page-body">
                {/* Stats */}
                <div className="stats-grid">
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">Total Runs</div>
                        </div>
                        <div className="card-value">{totalRuns}</div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">Success Rate</div>
                        </div>
                        <div className="card-value">{successRate}</div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">Last Run</div>
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{lastRunDate}</div>
                    </div>
                </div>

                {/* Logs Table */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Run History</div>
                    </div>

                    {logs.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <div className="empty-state-icon">📜</div>
                            <div className="empty-state-title">No pipeline runs yet</div>
                            <div className="empty-state-text">
                                Pipeline logs will appear here once the automation runs. You can also trigger a manual run.
                            </div>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Devotional</th>
                                        <th>Status</th>
                                        <th>Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => {
                                        const duration = log.completedAt && log.startedAt
                                            ? Math.round((log.completedAt.seconds - log.startedAt.seconds)) + 's'
                                            : '—';

                                        return (
                                            <tr key={log.id}>
                                                <td>{log.startedAt?.toDate().toLocaleString()}</td>
                                                <td style={{ fontWeight: 500 }}>{log.devotionalTitle || '—'}</td>
                                                <td>
                                                    <span className={`status-badge status-${log.status === 'completed' ? 'published' : log.status === 'failed' ? 'failed' : 'processing'}`}>
                                                        {log.status === 'completed' ? 'Success' : log.status === 'failed' ? 'Failed' : 'Running'}
                                                    </span>
                                                    {log.error && <div style={{ fontSize: 11, color: 'var(--status-error-text)', marginTop: 4 }}>{log.error}</div>}
                                                </td>
                                                <td>{duration}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
