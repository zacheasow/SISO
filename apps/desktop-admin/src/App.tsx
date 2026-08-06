import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const API_BASE = 'http://localhost:3000';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'roster' | 'qr' | 'history' | 'devices' | 'network' | 'backup' | 'logs' | 'onboarding' | 'docs'>('dashboard');
  const [health, setHealth] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [checkedin, setCheckedin] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [sysConfig, setSysConfig] = useState<any>({
    cloudflare_tunnel_enabled: false,
    cloudflare_tunnel_url: '',
    notification_provider: 'DEV_OUTBOX',
    vapid_public_key: '',
    vapid_private_key: '',
    vapid_subject: 'mailto:admin@kumon-siso.local',
  });

  // Onboarding Wizard Form State
  const [wizardStep, setWizardStep] = useState(1);
  const [onboardData, setOnboardData] = useState({
    center_name: 'Community Learning Center',
    contact_phone: '+15551234567',
    time_zone: 'America/New_York',
    staff_pin: '1234',
  });

  // CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [rawCsvText, setRawCsvText] = useState('');
  const [importStatus, setImportStatus] = useState<any>(null);

  // Backup & Restore State
  const [backupMsg, setBackupMsg] = useState('');

  useEffect(() => {
    fetchHealth();
    fetchDashboardData();
  }, [activeTab]);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const data = await res.json();
      setHealth(data);
      if (!data.is_onboarded) {
        setActiveTab('onboarding');
      }
    } catch (err) {
      console.error('Health check failed', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [stRes, histRes, chkRes, logsRes, netRes] = await Promise.all([
        fetch(`${API_BASE}/api/students`),
        fetch(`${API_BASE}/api/attendance/history`),
        fetch(`${API_BASE}/api/attendance/checked-in`),
        fetch(`${API_BASE}/api/diagnostics/logs`),
        fetch(`${API_BASE}/api/network-info`).catch(() => null),
      ]);
      setStudents(await stRes.json());
      setHistory(await histRes.json());
      setCheckedin(await chkRes.json());
      setLogs(await logsRes.json());
      if (netRes && netRes.ok) {
        setNetworkInfo(await netRes.json());
      }
      fetchConfig();
    } catch (err) {
      console.error('Dashboard fetch error', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (res.ok) {
        setSysConfig(await res.json());
      }
    } catch (err) {
      console.error('Config fetch error', err);
    }
  };

  const handleSaveConfig = async (newConfig: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        const data = await res.json();
        setSysConfig(data);
        alert('Network & Notification settings saved!');
      }
    } catch (err) {
      alert('Failed to save settings');
    }
  };

  const handleTestNotification = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config/test-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: '+15551234567', message: 'Test Web Push Notification from Kumon SISO' }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Test notification sent successfully! Message ID: ${data.messageId}`);
      } else {
        alert(`Test failed: ${data.error}`);
      }
    } catch (err) {
      alert('Test dispatch failed');
    }
  };

  const handleOnboardingSubmit = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardData),
      });
      if (res.ok) {
        alert('Onboarding complete!');
        fetchHealth();
        setActiveTab('dashboard');
      }
    } catch (err) {
      alert('Onboarding failed');
    }
  };

  const handleCsvImport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/students/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: rawCsvText }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully imported ${data.importedCount} students!`);
        setShowImportModal(false);
        fetchDashboardData();
      } else {
        setImportStatus(data);
      }
    } catch (err) {
      alert('Import failed');
    }
  };

  const handleDownloadQrPdf = () => {
    window.open(`${API_BASE}/api/students/qr-pdf`, '_blank');
  };

  const handleExportCsvReport = () => {
    window.open(`${API_BASE}/api/attendance/export-csv`, '_blank');
  };

  const handleCreateBackup = async () => {
    const res = await fetch(`${API_BASE}/api/backup/create`, { method: 'POST' });
    const data = await res.json();
    setBackupMsg(`Backup created at: ${data.backupFilePath}`);
  };

  const handleExportTransferPackage = async () => {
    const res = await fetch(`${API_BASE}/api/backup/export-package`, { method: 'POST' });
    const data = await res.json();
    setBackupMsg(`Transfer package ready at: ${data.packagePath}`);
  };

  const handlePairDevice = async () => {
    const res = await fetch(`${API_BASE}/api/devices/pair-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceName: 'Tablet Device' }),
    });
    const data = await res.json();
    alert(`Pairing Code: ${data.pairingCode}\nRaw Auth Token: ${data.rawAuthToken}`);
    fetchDashboardData();
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Kumon SISO</h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Desktop Admin v1.0</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            📊 Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'roster' ? 'active' : ''}`} onClick={() => setActiveTab('roster')}>
            👥 Student Roster & Import
          </button>
          <button className={`nav-item ${activeTab === 'qr' ? 'active' : ''}`} onClick={() => setActiveTab('qr')}>
            📇 QR Code Print Center
          </button>
          <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            📅 Attendance Reports (2-Yr)
          </button>
          <button className={`nav-item ${activeTab === 'devices' ? 'active' : ''}`} onClick={() => setActiveTab('devices')}>
            📱 Paired Devices
          </button>
          <button className={`nav-item ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>
            🌐 Network & Notifications
          </button>
          <button className={`nav-item ${activeTab === 'backup' ? 'active' : ''}`} onClick={() => setActiveTab('backup')}>
            💾 Backup & Computer Move
          </button>
          <button className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            🔍 Diagnostics & Logs
          </button>
          <button className={`nav-item ${activeTab === 'onboarding' ? 'active' : ''}`} onClick={() => setActiveTab('onboarding')}>
            ⚙️ Onboarding Wizard
          </button>
          <button className={`nav-item ${activeTab === 'docs' ? 'active' : ''}`} onClick={() => setActiveTab('docs')}>
            📖 Offline Documentation
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Center Overview</h1>
              <span className="badge badge-success">{health?.center_name || 'Active Center'}</span>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{checkedin.length}</span>
                <span className="stat-label">Checked-In Students Now</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{students.length}</span>
                <span className="stat-label">Total Registered Roster</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{history.length}</span>
                <span className="stat-label">Total Recorded Sessions</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{health?.db_integrity === 'Database integrity check passed' ? 'OK' : 'WARN'}</span>
                <span className="stat-label">SQLite Integrity</span>
              </div>
            </div>

            <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h2>Quick Actions</h2>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>📥 Import CSV Roster</button>
                <button className="btn btn-secondary" onClick={handleDownloadQrPdf}>📇 Download QR Cards PDF</button>
                <button className="btn btn-secondary" onClick={handleExportCsvReport}>📊 Export Attendance CSV</button>
              </div>
            </div>
          </div>
        )}

        {/* ROSTER MANAGEMENT VIEW */}
        {activeTab === 'roster' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Student Roster Management</h1>
              <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>📥 Import Roster CSV</button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Parent 1 Phone</th>
                    <th>Parent 2 Phone</th>
                    <th>QR Token</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.student_id}</strong></td>
                      <td>{s.student_name}</td>
                      <td>{s.parent1_phone}</td>
                      <td>{s.parent2_phone || 'N/A'}</td>
                      <td><code>{s.qr_identifier.substring(0, 10)}...</code></td>
                      <td><span className="badge badge-success">Active</span></td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center' }}>No student records found. Please import a roster CSV.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* QR PRINT CENTER VIEW */}
        {activeTab === 'qr' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">QR Code Print Center</h1>
              <button className="btn btn-primary" onClick={handleDownloadQrPdf}>📄 Generate & Download PDF Sheet</button>
            </div>

            <div className="table-container" style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#64748b' }}>
                Generate printable PDF pass sheets with center logo, student name, ID number, and secure QR identifier. Supports standard 8-card grid per page.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {students.slice(0, 8).map((s) => (
                  <div key={s.id} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ background: '#1e40af', color: '#fff', padding: '0.25rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>KUMON SISO</div>
                    <div style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}>📷 QR CODE</div>
                    <strong>{s.student_name}</strong>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>ID: {s.student_id}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE HISTORY VIEW */}
        {activeTab === 'history' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Attendance History & 2-Year Audit</h1>
              <button className="btn btn-primary" onClick={handleExportCsvReport}>📊 Export Full CSV</button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Duration</th>
                    <th>Dropoff ACK</th>
                    <th>Pickup ACK</th>
                    <th>Override</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td><strong>{h.student_name}</strong></td>
                      <td>{h.class_name}</td>
                      <td>{new Date(h.student_time_in).toLocaleTimeString()}</td>
                      <td>{h.student_time_out ? new Date(h.student_time_out).toLocaleTimeString() : 'Checked In'}</td>
                      <td>{h.duration_minutes ? `${h.duration_minutes} mins` : 'N/A'}</td>
                      <td><span className={`badge ${h.dropoff_ack_status === 'ACKNOWLEDGED' ? 'badge-success' : 'badge-warning'}`}>{h.dropoff_ack_status}</span></td>
                      <td><span className={`badge ${h.pickup_ack_status === 'PICKUP_REQUESTED' || h.pickup_ack_status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>{h.pickup_ack_status}</span></td>
                      <td>{h.is_override ? <span className="badge badge-danger">OVERRIDE</span> : <span className="badge badge-success">NO</span>}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center' }}>No attendance sessions recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DEVICE PAIRING VIEW */}
        {activeTab === 'devices' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Check-in Tablets & Devices</h1>
              <button className="btn btn-primary" onClick={handlePairDevice}>➕ Generate Device Pairing Code</button>
            </div>

            <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h2>📱 How to Connect a Tablet or Phone (No Terminal Required)</h2>
              <p style={{ margin: '0.5rem 0 1rem 0', color: '#64748b' }}>
                Follow these simple steps to set up check-in tablets (iPad, Android tablet, surface, phone, or laptop) on your center's Wi-Fi network:
              </p>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem', color: '#1e40af' }}>Step 1: Connect Tablet to Center Wi-Fi</h3>
                <p>Ensure the tablet/phone is connected to the same Wi-Fi network as this main computer.</p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem', color: '#1e40af' }}>Step 2: Open Web Browser on Tablet</h3>
                <p>Open Safari (iPad/iPhone) or Chrome (Android/Windows) on the tablet, and enter this exact address:</p>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {networkInfo?.pwa_urls?.length > 0 ? (
                    networkInfo.pwa_urls.map((url: string) => (
                      <div key={url} style={{ background: '#1e40af', color: '#fff', padding: '0.6rem 1rem', borderRadius: '6px', fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {url}
                      </div>
                    ))
                  ) : (
                    <div style={{ background: '#1e40af', color: '#fff', padding: '0.6rem 1rem', borderRadius: '6px', fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      http://localhost:5173
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '0.5rem', color: '#1e40af' }}>Step 3: Save to Home Screen (Optional)</h3>
                <p>Tap <strong>Share → Add to Home Screen</strong> on iPad, or <strong>Menu (⋮) → Install App / Add to Home Screen</strong> on Android to turn the tablet into a dedicated full-screen kiosk app!</p>
              </div>
            </div>
          </div>
        )}

        {/* NETWORK & NOTIFICATIONS VIEW */}
        {activeTab === 'network' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Network & Notification Settings</h1>
              <button className="btn btn-primary" onClick={() => handleSaveConfig(sysConfig)}>💾 Save All Settings</button>
            </div>

            {/* CLOUDFLARE QUICK TUNNEL CARD */}
            <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2>☁️ Automated Cloudflare Quick Tunnel (cloudflared)</h2>
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Zero-cost, zero-configuration public endpoint for parent drop-off & pickup links.</p>
                </div>
                <span className={`badge ${sysConfig.cloudflare_tunnel_enabled ? 'badge-success' : 'badge-warning'}`}>
                  {sysConfig.cloudflare_tunnel_enabled ? 'TUNNEL ACTIVE' : 'DISABLED'}
                </span>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <label style={{ margin: 0, fontWeight: 'bold' }}>Enable Automated Quick Tunnel:</label>
                <input
                  type="checkbox"
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  checked={sysConfig.cloudflare_tunnel_enabled}
                  onChange={(e) => setSysConfig({ ...sysConfig, cloudflare_tunnel_enabled: e.target.checked })}
                />
              </div>

              {sysConfig.cloudflare_tunnel_enabled && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '1rem' }}>
                  <label style={{ fontWeight: 'bold', color: '#166534' }}>Live Public Parent Link Endpoint:</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input
                      type="text"
                      readOnly
                      style={{ flex: 1, padding: '0.5rem', fontFamily: 'monospace', fontWeight: 'bold', background: '#fff' }}
                      value={sysConfig.cloudflare_tunnel_url || 'Starting tunnel process...'}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        if (sysConfig.cloudflare_tunnel_url) {
                          navigator.clipboard.writeText(sysConfig.cloudflare_tunnel_url);
                          alert('Public URL copied to clipboard!');
                        }
                      }}
                    >
                      Copy URL
                    </button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '0.5rem' }}>
                    🔒 <strong>Security Scoped:</strong> Public traffic is restricted strictly to parent routes (`/parent/...`). Administrative APIs return `403 Forbidden` over the public domain.
                  </p>
                </div>
              )}
            </div>

            {/* NOTIFICATION PROVIDER SELECTOR */}
            <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h2>📱 PWA Web Push Notifications</h2>
              <p style={{ margin: '0.5rem 0 1rem 0', color: '#64748b' }}>Zero-cost lock-screen push notifications for parents via the PWA interface.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div
                  style={{
                    border: sysConfig.notification_provider === 'WEB_PUSH' ? '2px solid #1e40af' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '1rem',
                    cursor: 'pointer',
                    background: sysConfig.notification_provider === 'WEB_PUSH' ? '#eff6ff' : '#fff',
                  }}
                  onClick={() => setSysConfig({ ...sysConfig, notification_provider: 'WEB_PUSH' })}
                >
                  <h3>🔔 PWA Web Push (VAPID)</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>Zero-cost lock-screen notifications for iOS & Android PWA.</p>
                </div>

                <div
                  style={{
                    border: sysConfig.notification_provider === 'DEV_OUTBOX' ? '2px solid #1e40af' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '1rem',
                    cursor: 'pointer',
                    background: sysConfig.notification_provider === 'DEV_OUTBOX' ? '#eff6ff' : '#fff',
                  }}
                  onClick={() => setSysConfig({ ...sysConfig, notification_provider: 'DEV_OUTBOX' })}
                >
                  <h3>📁 Local Dev Outbox</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>Writes notification JSON files locally for testing.</p>
                </div>
              </div>

              {/* VAPID KEY FIELDS */}
              {sysConfig.notification_provider === 'WEB_PUSH' && (
                <div>
                  <div className="form-group">
                    <label>VAPID Public Key:</label>
                    <input
                      type="text"
                      value={sysConfig.vapid_public_key || ''}
                      onChange={(e) => setSysConfig({ ...sysConfig, vapid_public_key: e.target.value })}
                      placeholder="BEl62i..."
                    />
                  </div>
                  <div className="form-group">
                    <label>VAPID Private Key:</label>
                    <input
                      type="password"
                      value={sysConfig.vapid_private_key || ''}
                      onChange={(e) => setSysConfig({ ...sysConfig, vapid_private_key: e.target.value })}
                      placeholder="Private key token"
                    />
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary" onClick={() => handleSaveConfig(sysConfig)}>Save Provider Config</button>
                <button className="btn btn-secondary" onClick={handleTestNotification}>🧪 Send Test Web Push</button>
              </div>
            </div>
          </div>
        )}

        {/* BACKUP & RESTORE VIEW */}
        {activeTab === 'backup' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Backup & Computer Migration</h1>
            </div>

            <div className="table-container" style={{ padding: '1.5rem' }}>
              <h3>Local Database Backup</h3>
              <p style={{ margin: '0.5rem 0 1rem 0', color: '#64748b' }}>Creates a safe SQLite snapshot copy with SHA-256 checksum.</p>
              <button className="btn btn-primary" onClick={handleCreateBackup}>💾 Create Immediate Backup</button>

              <hr style={{ margin: '2rem 0' }} />

              <h3>Move Installation to Another Computer</h3>
              <p style={{ margin: '0.5rem 0 1rem 0', color: '#64748b' }}>Generates an encrypted transfer package containing database and verification manifest for USB transfer.</p>
              <button className="btn btn-secondary" onClick={handleExportTransferPackage}>📦 Export Transfer Package</button>

              {backupMsg && <div style={{ marginTop: '1.5rem', background: '#e0e7ff', color: '#3730a3', padding: '1rem', borderRadius: '6px' }}>{backupMsg}</div>}
            </div>
          </div>
        )}

        {/* LOGS VIEW */}
        {activeTab === 'logs' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">System Diagnostics & Redacted Audit Logs</h1>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor Device</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td>{new Date(l.timestamp).toLocaleString()}</td>
                      <td><strong>{l.action}</strong></td>
                      <td>{l.actor_device_id || 'SERVER'}</td>
                      <td><code>{typeof l.details === 'string' ? l.details : JSON.stringify(l.details)}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ONBOARDING WIZARD VIEW */}
        {activeTab === 'onboarding' && (
          <div className="wizard-card">
            <h2>First-Run Onboarding Wizard</h2>
            <p className="subtitle">Configure your educational center in 4 easy steps.</p>

            <div className="wizard-steps">
              <div className={`wizard-step-dot ${wizardStep >= 1 ? 'active' : ''}`}></div>
              <div className={`wizard-step-dot ${wizardStep >= 2 ? 'active' : ''}`}></div>
              <div className={`wizard-step-dot ${wizardStep >= 3 ? 'active' : ''}`}></div>
            </div>

            {wizardStep === 1 && (
              <div>
                <div className="form-group">
                  <label>Educational Center Name:</label>
                  <input type="text" value={onboardData.center_name} onChange={(e) => setOnboardData({ ...onboardData, center_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Contact Phone Number:</label>
                  <input type="text" value={onboardData.contact_phone} onChange={(e) => setOnboardData({ ...onboardData, contact_phone: e.target.value })} />
                </div>
                <button className="btn btn-primary" onClick={() => setWizardStep(2)}>Next Step →</button>
              </div>
            )}

            {wizardStep === 2 && (
              <div>
                <div className="form-group">
                  <label>Center Time Zone:</label>
                  <select value={onboardData.time_zone} onChange={(e) => setOnboardData({ ...onboardData, time_zone: e.target.value })}>
                    <option value="America/New_York">Eastern Time (US & Canada)</option>
                    <option value="America/Chicago">Central Time (US & Canada)</option>
                    <option value="America/Denver">Mountain Time (US & Canada)</option>
                    <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Shared Staff PIN (for Overrides & Settings):</label>
                  <input type="password" value={onboardData.staff_pin} onChange={(e) => setOnboardData({ ...onboardData, staff_pin: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => setWizardStep(1)}>← Back</button>
                  <button className="btn btn-primary" onClick={() => setWizardStep(3)}>Next Step →</button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div>
                <h3>Confirm Configuration</h3>
                <p style={{ margin: '1rem 0' }}>Review center details before initializing local SQLite database.</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => setWizardStep(2)}>← Back</button>
                  <button className="btn btn-primary" onClick={handleOnboardingSubmit}>Complete Setup & Initialize Center</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DOCS VIEW */}
        {activeTab === 'docs' && (
          <div className="table-container" style={{ padding: '2rem' }}>
            <h1>Kumon SISO Offline Documentation & User Manual</h1>
            <hr style={{ margin: '1rem 0' }} />
            <h3>1. System Overview</h3>
            <p>Kumon SISO is a local-first student check-in, drop-off acknowledgment, parent pickup, and checkout application designed for independent educational centers.</p>

            <h3 style={{ marginTop: '1.5rem' }}>2. Importing Roster CSV</h3>
            <p>Navigate to "Student Roster & Import", select your CSV file. Standard columns: Student ID, Student Name, Parent 1 Phone, Parent 2 Phone.</p>

            <h3 style={{ marginTop: '1.5rem' }}>3. Moving Installation to Another Computer</h3>
            <p>{'Use "Backup & Computer Move" -> "Export Transfer Package", copy the exported folder via USB to the target computer, and restore without distributor intervention.'}</p>
          </div>
        )}

        {/* CSV IMPORT MODAL */}
        {showImportModal && (
          <div className="modal-overlay">
            <div className="modal-box">
              <h2>Import Student Roster CSV</h2>
              <p style={{ margin: '0.5rem 0 1rem 0', color: '#64748b' }}>Paste raw CSV text or sample contents to preview & import.</p>
              <textarea
                style={{ width: '100%', height: '180px', padding: '0.75rem', fontFamily: 'monospace' }}
                value={rawCsvText}
                onChange={(e) => setRawCsvText(e.target.value)}
                placeholder="Student ID,Student Name,Parent 1 Phone,Parent 2 Phone&#10;10001,Jordan Lee,+15551234567,+15557654321&#10;10002,Alex Rivera,+15559876543,"
              />

              {importStatus?.error && (
                <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '4px', marginTop: '1rem' }}>
                  {importStatus.error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCsvImport}>Import Records</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
