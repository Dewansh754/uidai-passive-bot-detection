import { useState, useEffect } from 'react';

interface LogEntry {
  id: number;
  time: string;
  sessionId: string;
  confidence: number;
  mouseSignals: number;
  keystrokes: number;
  action: string;
  isHuman: boolean;
}

interface Stats {
  total: number;
  humans: number;
  bots: number;
  challenges: number;
}

function Dashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, humans: 0, bots: 0, challenges: 0 });
  const [lastUpdated, setLastUpdated] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/dashboard');
      const data = await res.json();
      setStats(data.stats);
      setLogs(data.logs);
      setLastUpdated(new Date().toLocaleTimeString());

      // Generate alerts based on data
      const newAlerts: string[] = [];
      const total = data.stats.total;
      const bots = data.stats.bots;
      const challenges = data.stats.challenges;

      if (total > 0 && (bots / total) > 0.5) {
        newAlerts.push(`🚨 HIGH BOT TRAFFIC: ${((bots/total)*100).toFixed(0)}% of requests are bots!`);
      }
      if (bots >= 5) {
        newAlerts.push(`⚠️ ${bots} bot attempts detected this session`);
      }
      if (data.stats.permanent_blocks > 0) {
        newAlerts.push(`🔒 ${data.stats.permanent_blocks} sessions permanently blocked`);
      }
      if (challenges >= 3) {
        newAlerts.push(`🤔 ${challenges} users sent to challenge — possible bot wave`);
      }
      if (total >= 10 && bots === 0) {
        newAlerts.push(`✅ System healthy — no bots detected in last ${total} requests`);
      }
      setAlerts(newAlerts);
      if (newAlerts.some(a => a.startsWith('🚨'))) {
        setShowAlerts(true);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data');
    }
  };

  const resetDashboard = async () => {
    await fetch('http://127.0.0.1:8000/api/dashboard/reset');
    fetchData();
  };

  useEffect(() => {
    fetchData();
    if (isLive) {
      const interval = setInterval(fetchData, 2000);
      return () => clearInterval(interval);
    }
  }, [isLive]);

  const humanRate = stats.total > 0 ? ((stats.humans / stats.total) * 100).toFixed(1) : '0';
  const botRate = stats.total > 0 ? ((stats.bots / stats.total) * 100).toFixed(1) : '0';

  return (
    <div style={styles.container}>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>🔷</span>
          <div>
            <h1 style={styles.headerTitle}>UIDAI Admin Dashboard</h1>
            <p style={styles.headerSub}>Real-time Bot Detection Monitor</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.liveIndicator}>
            <span style={{ ...styles.liveDot, background: isLive ? '#22c55e' : '#6b7280' }}></span>
            {isLive ? 'LIVE' : 'PAUSED'}
          </div>
          <button style={styles.toggleBtn} onClick={() => setIsLive(!isLive)}>
            {isLive ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button style={styles.resetBtn} onClick={resetDashboard}>
            🔄 Reset
          </button>
        </div>
      </div>

      <div style={styles.body}>

        {/* Alert Banner */}
        {alerts.length > 0 && (
          <div style={alertStyles.container}>
            <div style={alertStyles.header}>
              <span style={alertStyles.title}>
                🔔 System Alerts
                <span style={alertStyles.count}>{alerts.length}</span>
              </span>
              <button
                style={alertStyles.toggleBtn}
                onClick={() => setShowAlerts(!showAlerts)}
              >
                {showAlerts ? '▲ Hide' : '▼ Show'}
              </button>
            </div>
            {showAlerts && (
              <div style={alertStyles.list}>
                {alerts.map((alert, i) => (
                  <div key={i} style={{
                    ...alertStyles.alertItem,
                    background: alert.startsWith('🚨') ? '#fee2e2' :
                                alert.startsWith('⚠️') ? '#fef9c3' :
                                alert.startsWith('✅') ? '#dcfce7' : '#eff6ff',
                    borderLeft: `4px solid ${
                                alert.startsWith('🚨') ? '#dc2626' :
                                alert.startsWith('⚠️') ? '#f59e0b' :
                                alert.startsWith('✅') ? '#16a34a' : '#3b82f6'}`,
                  }}>
                    {alert}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Stats Cards */}
        <div style={styles.statsGrid}>
          <div style={{ ...styles.statCard, borderTop: '4px solid #1e3a5f' }}>
            <div style={styles.statIcon}>📊</div>
            <div style={styles.statNumber}>{stats.total}</div>
            <div style={styles.statLabel}>Total Requests</div>
          </div>

          <div style={{ ...styles.statCard, borderTop: '4px solid #16a34a' }}>
            <div style={styles.statIcon}>✅</div>
            <div style={{ ...styles.statNumber, color: '#16a34a' }}>{stats.humans}</div>
            <div style={styles.statLabel}>Humans Verified</div>
            <div style={styles.statRate}>{humanRate}% of total</div>
          </div>

          <div style={{ ...styles.statCard, borderTop: '4px solid #dc2626' }}>
            <div style={styles.statIcon}>🤖</div>
            <div style={{ ...styles.statNumber, color: '#dc2626' }}>{stats.bots}</div>
            <div style={styles.statLabel}>Bots Blocked</div>
            <div style={styles.statRate}>{botRate}% of total</div>
          </div>

          <div style={{ ...styles.statCard, borderTop: '4px solid #f59e0b' }}>
            <div style={styles.statIcon}>🤔</div>
            <div style={{ ...styles.statNumber, color: '#f59e0b' }}>{stats.challenges}</div>
            <div style={styles.statLabel}>Challenges Issued</div>
          </div>
        </div>

        {/* Visual Bar */}
        {stats.total > 0 && (
          <div style={styles.barCard}>
            <h3 style={styles.barTitle}>Traffic Distribution</h3>
            <div style={styles.bar}>
              <div style={{
                ...styles.barSegment,
                width: `${humanRate}%`,
                background: '#16a34a'
              }} title={`Humans: ${humanRate}%`}></div>
              <div style={{
                ...styles.barSegment,
                width: `${((stats.challenges / stats.total) * 100).toFixed(1)}%`,
                background: '#f59e0b'
              }} title={`Challenges: ${stats.challenges}`}></div>
              <div style={{
                ...styles.barSegment,
                width: `${botRate}%`,
                background: '#dc2626'
              }} title={`Bots: ${botRate}%`}></div>
            </div>
            <div style={styles.barLegend}>
              <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#16a34a' }}></span>Human</span>
              <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#f59e0b' }}></span>Challenge</span>
              <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#dc2626' }}></span>Bot</span>
            </div>
          </div>
        )}

        {/* Logs Table */}
        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>📋 Recent Verification Attempts</h3>
            <span style={styles.updatedText}>Last updated: {lastUpdated}</span>
          </div>

          {logs.length === 0 ? (
            <div style={styles.emptyState}>
              No attempts yet. Go to the{' '}
              <a href="http://localhost:3000" style={styles.link}>portal</a>{' '}
              and try verifying!
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeadRow}>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>Session ID</th>
                  <th style={styles.th}>Confidence</th>
                  <th style={styles.th}>Mouse Signals</th>
                  <th style={styles.th}>Keystrokes</th>
                  <th style={styles.th}>Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={styles.tableRow}>
                    <td style={styles.td}>{log.id}</td>
                    <td style={styles.td}>{log.time}</td>
                    <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '12px' }}>{log.sessionId}</td>
                    <td style={styles.td}>
                      <div style={styles.confidenceBar}>
                        <div style={{
                          ...styles.confidenceFill,
                          width: `${log.confidence}%`,
                          background: log.confidence >= 75 ? '#16a34a' : log.confidence >= 45 ? '#f59e0b' : '#dc2626'
                        }}></div>
                        <span style={styles.confidenceText}>{log.confidence}%</span>
                      </div>
                    </td>
                    <td style={styles.td}>{log.mouseSignals}</td>
                    <td style={styles.td}>{log.keystrokes}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.resultBadge,
                        background: log.action === 'allow' ? '#dcfce7' : log.action === 'challenge' ? '#fef9c3' : '#fee2e2',
                        color: log.action === 'allow' ? '#16a34a' : log.action === 'challenge' ? '#92400e' : '#dc2626',
                      }}>
                        {log.action === 'allow' ? '✅ Verified' : log.action === 'challenge' ? '🤔 Challenge' : '🚫 Blocked'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      <div style={styles.footer}>
        🔐 UIDAI Passive Bot Detection — Admin Panel | Auto-refreshes every 2 seconds
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#f0f4f8', fontFamily: 'Segoe UI, sans-serif' },
  header: { background: '#1e3a5f', color: 'white', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  logo: { fontSize: '32px' },
  headerTitle: { margin: 0, fontSize: '20px', fontWeight: 700 },
  headerSub: { margin: 0, fontSize: '13px', opacity: 0.8 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  liveIndicator: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 },
  liveDot: { width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' },
  toggleBtn: { padding: '6px 14px', background: '#2d5a8e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  resetBtn: { padding: '6px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  body: { padding: '24px 32px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  statCard: { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' as const },
  statIcon: { fontSize: '28px', marginBottom: '8px' },
  statNumber: { fontSize: '36px', fontWeight: 700, color: '#1e3a5f' },
  statLabel: { fontSize: '13px', color: '#6b7280', marginTop: '4px' },
  statRate: { fontSize: '12px', color: '#9ca3af', marginTop: '4px' },
  barCard: { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' },
  barTitle: { margin: '0 0 16px', fontSize: '15px', color: '#1e3a5f' },
  bar: { height: '24px', borderRadius: '12px', overflow: 'hidden', background: '#e5e7eb', display: 'flex' },
  barSegment: { height: '100%', transition: 'width 0.5s ease' },
  barLegend: { display: 'flex', gap: '20px', marginTop: '12px', fontSize: '13px' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px' },
  legendDot: { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' },
  tableCard: { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  tableHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  tableTitle: { margin: 0, fontSize: '15px', color: '#1e3a5f' },
  updatedText: { fontSize: '12px', color: '#9ca3af' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  tableHeadRow: { background: '#f9fafb' },
  th: { padding: '10px 14px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' },
  tableRow: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '10px 14px', fontSize: '13px', color: '#374151' },
  confidenceBar: { display: 'flex', alignItems: 'center', gap: '8px' },
  confidenceFill: { height: '6px', borderRadius: '3px', minWidth: '4px' },
  confidenceText: { fontSize: '12px', fontWeight: 600 },
  resultBadge: { padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 },
  emptyState: { textAlign: 'center' as const, padding: '40px', color: '#9ca3af', fontSize: '14px' },
  link: { color: '#1e3a5f', fontWeight: 600 },
  footer: { textAlign: 'center' as const, padding: '20px', color: '#6b7280', fontSize: '13px' },
};
const alertStyles: Record<string, React.CSSProperties> = {
  container: { background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px', border: '1px solid #fecaca' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '15px', fontWeight: 600, color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: '8px' },
  count: { background: '#dc2626', color: 'white', borderRadius: '12px', padding: '2px 8px', fontSize: '12px' },
  toggleBtn: { padding: '4px 12px', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  list: { marginTop: '12px', display: 'flex', flexDirection: 'column' as const, gap: '8px' },
  alertItem: { padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500 },
};

export default Dashboard;