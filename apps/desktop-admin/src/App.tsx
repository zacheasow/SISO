import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import * as QRCode from 'qrcode';
import jsPDF from 'jspdf';

const API_BASE = 'http://localhost:3000';

// Production default relay host — the server-side source of truth lives in
// @kumon-siso/shared (DEFAULT_PORTAL_BASE_URL); this mirrors it so the UI can
// render before the first /api/config response arrives.
const DEFAULT_PORTAL_BASE_URL = 'https://kumon-siso.vercel.app';

const slugify = (name: string) =>
  (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'center';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'roster' | 'qr' | 'history' | 'devices' | 'network' | 'portal' | 'backup' | 'logs' | 'onboarding' | 'docs'>('dashboard');
  const [toast, setToast] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [checkedin, setCheckedin] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [sysConfig, setSysConfig] = useState<any>({
    cloudflare_tunnel_enabled: false,
    cloudflare_tunnel_url: '',
    cloudflare_tunnel_token: '',
    center_slug: '',
    relay_worker_url: '',
    portal_base_url: DEFAULT_PORTAL_BASE_URL,
    relay_secret: '',
    onboarding_completed: false,
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
  });
  const [wizardQrDataUrl, setWizardQrDataUrl] = useState<string | null>(null);

  // Live connection status (Network & Devices tab)
  const [serverOnline, setServerOnline] = useState(false);
  const [relayConnected, setRelayConnected] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [rawCsvText, setRawCsvText] = useState('');
  const [importStatus, setImportStatus] = useState<any>(null);

  // Backup & Restore State
  const [backupMsg, setBackupMsg] = useState('');

  // Parent Web Portal State
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Paired Devices / Tablet Setup State
  const localPwaUrl = networkInfo?.localIpUrl || networkInfo?.pwa_urls?.[0] || '';
  const publicTunnelUrl = networkInfo?.publicTunnelUrl || sysConfig.cloudflare_tunnel_url || '';
  const tunnelKioskUrl = publicTunnelUrl ? `${publicTunnelUrl}/kiosk` : '';
  const tunnelParentUrl = publicTunnelUrl ? `${publicTunnelUrl}/parent` : '';

  // Permanent hosted portal (Vercel) URLs — fixed/branded and never change on
  // restart. They take priority over the Cloudflare Worker relay and the raw
  // tunnel URL so QR codes / copy buttons always point at the stable domain.
  const portalBaseUrl = (sysConfig.portal_base_url || DEFAULT_PORTAL_BASE_URL).replace(/\/+$/, '');
  const hasPortal = Boolean(portalBaseUrl && sysConfig.center_slug);
  const portalKioskUrl = hasPortal ? `${portalBaseUrl}/${sysConfig.center_slug}/kiosk` : '';
  const portalParentUrl = hasPortal ? `${portalBaseUrl}/${sysConfig.center_slug}/parent` : '';

  // Custom Center-Name Cloudflare Relay URLs (optional legacy fallback).
  const relayDomain = (sysConfig.relay_worker_url || '').replace(/\/+$/, '');
  const hasRelay = Boolean(relayDomain && sysConfig.center_slug);
  const relayKioskUrl = hasRelay ? `${relayDomain}/${sysConfig.center_slug}/kiosk` : '';
  const relayParentUrl = hasRelay ? `${relayDomain}/${sysConfig.center_slug}/parent` : '';
  const preferredKioskUrl = portalKioskUrl || relayKioskUrl || tunnelKioskUrl;
  const preferredParentUrl = portalParentUrl || relayParentUrl || tunnelParentUrl;
  const portalUrl = preferredParentUrl || (sysConfig.cloudflare_tunnel_url ? `${sysConfig.cloudflare_tunnel_url}/parent` : '');
  const wizardParentUrl = `${portalBaseUrl}/${slugify(onboardData.center_name)}/parent`;
  const [localQrDataUrl, setLocalQrDataUrl] = useState<string | null>(null);
  const [tunnelKioskQrDataUrl, setTunnelKioskQrDataUrl] = useState<string | null>(null);
  const [tunnelParentQrDataUrl, setTunnelParentQrDataUrl] = useState<string | null>(null);

  // QR Print Center State
  const [qrSearchQuery, setQrSearchQuery] = useState('');
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  const filteredStudentsForQr = useMemo(() => {
    const q = qrSearchQuery.trim().toLowerCase();
    const list = students.filter((s) => s.is_active !== 0);
    if (!q) return list;
    return list.filter(
      (s) => s.student_name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q)
    );
  }, [students, qrSearchQuery]);

  useEffect(() => {
    if (!portalUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(portalUrl, { width: 440, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrDataUrl)
      .catch((err) => console.error('QR generation failed', err));
  }, [portalUrl]);

  useEffect(() => {
    if (!localPwaUrl) {
      setLocalQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(localPwaUrl, { width: 400, margin: 1, errorCorrectionLevel: 'M' })
      .then(setLocalQrDataUrl)
      .catch((err) => console.error('Local tablet URL QR generation failed', err));
  }, [localPwaUrl]);

  useEffect(() => {
    if (!tunnelKioskUrl && !relayKioskUrl && !portalKioskUrl) {
      setTunnelKioskQrDataUrl(null);
      return;
    }
    const url = preferredKioskUrl;
    QRCode.toDataURL(url, { width: 400, margin: 1, errorCorrectionLevel: 'M' })
      .then(setTunnelKioskQrDataUrl)
      .catch((err) => console.error('Tunnel kiosk URL QR generation failed', err));
  }, [tunnelKioskUrl, relayKioskUrl, portalKioskUrl, preferredKioskUrl]);

  useEffect(() => {
    if (!tunnelParentUrl && !relayParentUrl && !portalParentUrl) {
      setTunnelParentQrDataUrl(null);
      return;
    }
    const url = preferredParentUrl;
    QRCode.toDataURL(url, { width: 400, margin: 1, errorCorrectionLevel: 'M' })
      .then(setTunnelParentQrDataUrl)
      .catch((err) => console.error('Tunnel parent URL QR generation failed', err));
  }, [tunnelParentUrl, relayParentUrl, portalParentUrl, preferredParentUrl]);

  // Generate a large QR for the onboarding "Ready to Go" step from the
  // center name as typed, so directors can test/print before submitting.
  useEffect(() => {
    if (activeTab !== 'onboarding' || wizardStep !== 2) {
      setWizardQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(wizardParentUrl, { width: 520, margin: 1, errorCorrectionLevel: 'M' })
      .then(setWizardQrDataUrl)
      .catch((err) => console.error('Wizard QR generation failed', err));
  }, [activeTab, wizardStep, wizardParentUrl]);

  // Generate QR data URLs for all students when QR tab is active
  useEffect(() => {
    if (activeTab !== 'qr' || students.length === 0) return;
    let cancelled = false;
    const generateAll = async () => {
      const urls: Record<string, string> = {};
      for (const s of students) {
        if (s.qr_identifier && !cancelled) {
          try {
            urls[s.id] = await QRCode.toDataURL(s.qr_identifier, { width: 300, margin: 1, errorCorrectionLevel: 'H' });
          } catch { /* skip failed QR */ }
        }
      }
      if (!cancelled) setQrDataUrls(urls);
    };
    generateAll();
    return () => { cancelled = true; };
  }, [activeTab, students]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const generateQrPdf = (items: { name: string; id: string; dataUrl: string }[], fileName: string, centerName?: string) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = 215.9;
    const pageH = 279.4;
    const marginX = 8;
    const marginY = 12;
    const gapX = 5;
    const gapY = 5;
    const cols = 3;
    const rows = 4;
    const perPage = cols * rows;
    const cardW = (pageW - marginX * 2 - gapX * (cols - 1)) / cols;
    const cardH = (pageH - marginY * 2 - gapY * (rows - 1)) / rows;
    const header = (centerName || 'KUMON SISO').toUpperCase();

    for (let i = 0; i < items.length; i++) {
      const posInPage = i % perPage;
      if (posInPage === 0 && i > 0) doc.addPage();

      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);
      const x = marginX + col * (cardW + gapX);
      const y = marginY + row * (cardH + gapY);

      doc.setDrawColor(180, 200, 220);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([3, 2], 0);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, cardW, cardH, 3, 3, 'FD');

      doc.setFillColor(30, 64, 175);
      doc.setLineDashPattern([], 0);
      doc.roundedRect(x, y, cardW, 8, 3, 3, 'F');
      doc.rect(x, y + 5, cardW, 3, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(header, x + cardW / 2, y + 6, { align: 'center', maxWidth: cardW - 6 });

      const qrSize = Math.min(cardW - 10, 38);
      const qrX = x + (cardW - qrSize) / 2;
      const qrY = y + 10;
      try {
        doc.addImage(items[i].dataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      } catch {
        doc.setFillColor(220, 220, 220);
        doc.rect(qrX, qrY, qrSize, qrSize, 'F');
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(6);
        doc.text('QR unavailable', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
      }

      const textY = qrY + qrSize + 2;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(items[i].name, x + cardW / 2, textY, { align: 'center', maxWidth: cardW - 4 });

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`ID: ${items[i].id}`, x + cardW / 2, textY + 3.5, { align: 'center' });
    }

    if (items.length === 0) {
      doc.setFontSize(14);
      doc.setTextColor(100, 116, 139);
      doc.text('No students to display', pageW / 2, pageH / 2, { align: 'center' });
    }

    doc.save(fileName);
  };

  const handleDownloadSingleQr = (student: any) => {
    try {
      const dataUrl = qrDataUrls[student.id];
      if (!dataUrl) {
        showToast('QR code still loading, please wait a moment');
        return;
      }
      generateQrPdf(
        [{ name: student.student_name, id: student.student_id, dataUrl }],
        `QR_${student.student_id}_${student.student_name.replace(/\s+/g, '_')}.pdf`,
        health?.center_name
      );
      showToast('PDF generated successfully! Saved to your Downloads folder.');
    } catch (err: any) {
      showToast(`Failed to generate QR card: ${err?.message || 'Unknown error'}`);
    }
  };

  // Generate a ready-to-print US Letter parent flyer with the portal QR code,
  // the permanent parent link, and "Add to Home Screen" instructions.
  const generateParentFlyerPdf = (parentUrl: string, qrDataUrl: string | null, centerName?: string) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = 215.9;
    const pageH = 279.4;
    const margin = 18;

    // Header band
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageW, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text((centerName || 'Kumon SISO').toUpperCase(), pageW / 2, 20, { align: 'center', maxWidth: pageW - margin * 2 });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Parent Check-In & Sign-Out Portal', pageW / 2, 29, { align: 'center' });

    // Instructions block
    const instrY = 46;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Add the portal to your phone:', margin, instrY);

    const steps = [
      '1. Point your phone camera at the QR code below.',
      '2. Tap the link that appears to open the parent portal.',
      '3. Tap Share  →  Add to Home Screen (iPhone/iPad)',
      '   or Menu ( ⋮ )  →  Add to Home Screen (Android).',
      '4. The Kumon SISO icon will appear on your home screen',
      '   for quick check-ins and sign-outs every day.',
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    let y = instrY + 10;
    for (const step of steps) {
      doc.text(step, margin, y, { maxWidth: pageW - margin * 2 });
      y += 7;
    }

    // QR code centered below instructions
    const qrSize = 86;
    const qrX = (pageW - qrSize) / 2;
    const qrY = y + 6;
    if (qrDataUrl) {
      try {
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      } catch {
        doc.setFillColor(220, 220, 220);
        doc.rect(qrX, qrY, qrSize, qrSize, 'F');
      }
    } else {
      doc.setFillColor(220, 220, 220);
      doc.rect(qrX, qrY, qrSize, qrSize, 'F');
    }

    // Parent link box
    const linkY = qrY + qrSize + 10;
    doc.setFillColor(240, 247, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(margin, linkY, pageW - margin * 2, 16, 3, 3, 'FD');
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(parentUrl, pageW / 2, linkY + 10.5, { align: 'center', maxWidth: pageW - margin * 2 - 8 });

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Powered by Kumon SISO', pageW / 2, pageH - 14, { align: 'center' });

    doc.save('Kumon_SISO_Parent_Flyer.pdf');
  };

  const handleDownloadParentFlyer = () => {
    try {
      if (!portalUrl) {
        showToast('No parent portal URL yet. A tunnel starts automatically on launch.');
        return;
      }
      generateParentFlyerPdf(portalUrl, qrDataUrl || tunnelParentQrDataUrl, health?.center_name);
      showToast('Parent flyer PDF generated! Saved to your Downloads folder.');
    } catch (err: any) {
      showToast(`Failed to generate flyer: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleTestParentLink = async () => {
    if (!portalUrl) {
      showToast('No parent portal URL yet. A tunnel starts automatically on launch.');
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      await fetch(portalUrl, { mode: 'no-cors', signal: controller.signal });
      clearTimeout(timeoutId);
      setRelayConnected(true);
      setServerOnline(true);
      showToast('Parent portal is reachable and responding!');
    } catch (err: any) {
      clearTimeout(timeoutId);
      setRelayConnected(false);
      showToast(err?.name === 'AbortError' ? 'Parent link test timed out.' : 'Parent link is not reachable right now.');
    }
  };

  const handleCopyParentLink = () => {
    if (!portalUrl) {
      showToast('No parent portal URL yet. A tunnel starts automatically on launch.');
      return;
    }
    navigator.clipboard.writeText(portalUrl);
    showToast('Parent link copied to clipboard');
  };

  // Wizard-specific flyer/copy use the typed center name before onboarding is
  // submitted (sysConfig.center_slug isn't saved yet at that point).
  const handleDownloadWizardFlyer = () => {
    try {
      generateParentFlyerPdf(wizardParentUrl, wizardQrDataUrl, onboardData.center_name || 'Kumon SISO');
      showToast('Parent flyer PDF generated! Saved to your Downloads folder.');
    } catch (err: any) {
      showToast(`Failed to generate flyer: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleCopyWizardLink = () => {
    navigator.clipboard.writeText(wizardParentUrl);
    showToast('Parent link copied to clipboard');
  };

  useEffect(() => {
    fetchHealth();
    fetchDashboardData();
    if (activeTab === 'devices') {
      fetchNetworkInfo();
    }
  }, [activeTab]);

  // Auto-poll every 3s on Dashboard / Attendance tabs so check-ins made on
  // tablets appear instantly on the desktop monitor without page refreshes.
  useEffect(() => {
    if (activeTab !== 'dashboard' && activeTab !== 'history') return;
    const id = setInterval(() => {
      fetchDashboardData();
    }, 3000);
    return () => clearInterval(id);
  }, [activeTab]);

  // On the Network & Devices tab, probe the parent portal URL every 15s so the
  // "Parent Cloud Relay" status badge stays live without manual refreshes.
  useEffect(() => {
    if (activeTab !== 'network') return;
    const probe = async () => {
      if (!portalUrl) {
        setRelayConnected(false);
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        await fetch(portalUrl, { mode: 'no-cors', signal: controller.signal });
        clearTimeout(timeoutId);
        setRelayConnected(true);
        setServerOnline(true);
      } catch {
        clearTimeout(timeoutId);
        setRelayConnected(false);
      }
    };
    probe();
    const id = setInterval(probe, 15000);
    return () => clearInterval(id);
  }, [activeTab, portalUrl]);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const data = await res.json();
      setHealth(data);
      setServerOnline(true);
      if (data.is_onboarded) {
        setOnboardingCompleted(true);
        localStorage.setItem('kumon_siso_onboarding_completed', 'true');
      }
      const cfgRes = await fetch(`${API_BASE}/api/config`).catch(() => null);
      if (cfgRes && cfgRes.ok) {
        const cfg = await cfgRes.json();
        setSysConfig(cfg);
        if (cfg.onboarding_completed) {
          setOnboardingCompleted(true);
          localStorage.setItem('kumon_siso_onboarding_completed', 'true');
        }
      }
      if (!data.is_onboarded && !localStorage.getItem('kumon_siso_onboarding_completed')) {
        setActiveTab('onboarding');
      }
    } catch (err) {
      setServerOnline(false);
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

  const refreshNetworkInfo = async () => {
    try {
      const [netRes, cfgRes] = await Promise.all([
        fetch(`${API_BASE}/api/network-info`).catch(() => null),
        fetch(`${API_BASE}/api/config`).catch(() => null),
      ]);
      if (netRes && netRes.ok) {
        setNetworkInfo(await netRes.json());
      }
      if (cfgRes && cfgRes.ok) {
        setSysConfig(await cfgRes.json());
      }
    } catch (err) {
      console.error('Network info refresh error', err);
    }
  };

  const fetchNetworkInfo = async () => {
    setNetworkError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE}/api/network-info`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo(data);
        setNetworkError(null);
      } else {
        setNetworkInfo({ localIpUrl: API_BASE, localUrl: API_BASE });
        setNetworkError(`Server returned ${res.status}. Using fallback URL.`);
      }
    } catch (err: any) {
      console.error('Network info fetch failed:', err);
      setNetworkInfo({ localIpUrl: API_BASE, localUrl: API_BASE });
      setNetworkError(
        err?.name === 'AbortError'
          ? 'Request timed out. Server may not be running.'
          : 'Could not reach the server. Make sure the local server is running on port 3000.'
      );
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
        showToast('Network & Notification settings saved!');
      }
    } catch (err) {
      showToast('Failed to save settings');
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
        showToast(`Test notification sent successfully!`);
      } else {
        showToast(`Test failed: ${data.error}`);
      }
    } catch (err) {
      showToast('Test dispatch failed');
    }
  };

  const handleOnboardingSubmit = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...onboardData,
          center_slug: slugify(onboardData.center_name),
          relay_worker_url: sysConfig.relay_worker_url || '',
          portal_base_url: sysConfig.portal_base_url || DEFAULT_PORTAL_BASE_URL,
          relay_secret: sysConfig.relay_secret || '',
        }),
      });
      if (res.ok) {
        setOnboardingCompleted(true);
        localStorage.setItem('kumon_siso_onboarding_completed', 'true');
        showToast('Onboarding complete!');
        fetchHealth();
        fetchConfig();
        setActiveTab('dashboard');
      }
    } catch (err) {
      showToast('Onboarding failed');
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
        showToast(`Successfully imported ${data.importedCount} students!`);
        setShowImportModal(false);
        fetchDashboardData();
      } else {
        setImportStatus(data);
      }
    } catch (err) {
      showToast('Import failed');
    }
  };

  const handleDownloadQrPdf = () => {
    try {
      const items = filteredStudentsForQr
        .filter((s) => qrDataUrls[s.id])
        .map((s) => ({
          name: s.student_name,
          id: s.student_id,
          dataUrl: qrDataUrls[s.id],
        }));
      if (items.length === 0) {
        showToast('No QR codes ready yet. Please wait a moment.');
        return;
      }
      generateQrPdf(items, 'Kumon_SISO_QR_Cards.pdf', health?.center_name);
      showToast('PDF generated successfully! Saved to your Downloads folder.');
    } catch (err: any) {
      showToast(`Failed to generate PDF: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleExportCsvReport = () => {
    const exportData = history.map((h) => ({
      'Student ID': h.student_number,
      'Student Name': h.student_name,
      'Class': h.class_name,
      'Date': h.student_time_in ? new Date(h.student_time_in).toLocaleDateString() : '',
      'Time In': h.student_time_in ? new Date(h.student_time_in).toLocaleTimeString() : '',
      'Time Out': h.student_time_out ? new Date(h.student_time_out).toLocaleTimeString() : '',
      'Duration': h.duration_text || '',
      'Dropoff ACK': h.dropoff_ack_status,
      'Pickup ACK': h.pickup_ack_status,
      'Override Note': h.override_reason || '',
    }));
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kumon_siso_attendance_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported successfully');
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

  const handlePrintPortal = () => {
    window.print();
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
            Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'roster' ? 'active' : ''}`} onClick={() => setActiveTab('roster')}>
            Student Roster & Import
          </button>
          <button className={`nav-item ${activeTab === 'qr' ? 'active' : ''}`} onClick={() => setActiveTab('qr')}>
            QR Code Print Center
          </button>
          <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            Attendance Reports
          </button>
          <button className={`nav-item ${activeTab === 'devices' ? 'active' : ''}`} onClick={() => setActiveTab('devices')}>
            Tablet & Kiosk Setup
          </button>
          <button className={`nav-item ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>
            Network & Devices
          </button>
          <button className={`nav-item ${activeTab === 'portal' ? 'active' : ''}`} onClick={() => setActiveTab('portal')}>
            Parent Web Portal
          </button>
          <button className={`nav-item ${activeTab === 'backup' ? 'active' : ''}`} onClick={() => setActiveTab('backup')}>
            Backup & Migration
          </button>
          <button className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            Diagnostics & Logs
          </button>
          <button className={`nav-item ${activeTab === 'onboarding' ? 'active' : ''}`} onClick={() => setActiveTab('onboarding')}>
            Onboarding Wizard
          </button>
          <button className={`nav-item ${activeTab === 'docs' ? 'active' : ''}`} onClick={() => setActiveTab('docs')}>
            Offline Documentation
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Toast Notification */}
        {toast && (
          <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', background: '#0f172a', color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            {toast}
          </div>
        )}
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
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>Import CSV Roster</button>
                <button className="btn btn-secondary" onClick={handleDownloadQrPdf}>Download QR Cards PDF</button>
                <button className="btn btn-secondary" onClick={handleExportCsvReport}>Export Attendance CSV</button>
              </div>
            </div>
          </div>
        )}

        {/* ROSTER MANAGEMENT VIEW */}
        {activeTab === 'roster' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Student Roster Management</h1>
              <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>Import Roster CSV</button>
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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={qrSearchQuery}
                  onChange={(e) => setQrSearchQuery(e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem', width: '220px' }}
                />
                <button className="btn btn-primary" onClick={handleDownloadQrPdf}>Download Full PDF Sheet</button>
              </div>
            </div>

            <div className="table-container" style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#64748b' }}>
                {filteredStudentsForQr.length} student{filteredStudentsForQr.length !== 1 ? 's' : ''} — each card contains a unique QR identifier for check-in. Download individual cards or generate a full printable PDF sheet (12 cards per page, 3x4 grid).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {filteredStudentsForQr.map((s) => (
                  <div key={s.id} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: '#1e40af', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem', width: '100%' }}>{(health?.center_name || 'KUMON SISO').toUpperCase()}</div>
                    {qrDataUrls[s.id] ? (
                      <img src={qrDataUrls[s.id]} alt={`QR for ${s.student_name}`} style={{ width: '140px', height: '140px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                    ) : (
                      <div style={{ width: '140px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>Loading...</div>
                    )}
                    <strong style={{ fontSize: '0.95rem' }}>{s.student_name}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {s.student_id}</div>
                    <button className="btn btn-secondary" onClick={() => handleDownloadSingleQr(s)} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginTop: '0.25rem' }}>
                      Download QR
                    </button>
                  </div>
                ))}
                {filteredStudentsForQr.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    {students.length === 0 ? 'No students imported yet. Add students via the Roster tab.' : 'No students match your search.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE HISTORY VIEW */}
        {activeTab === 'history' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Attendance History</h1>
              <button className="btn btn-primary" onClick={handleExportCsvReport}>Export Full CSV</button>
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
                      <td>{h.duration_text}</td>
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
              <h1 className="page-title">Tablet & Kiosk Setup Guide</h1>
              <button className="btn btn-secondary" onClick={fetchNetworkInfo}>Refresh Network Info</button>
            </div>

            <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h2>How to Connect a Tablet or Phone</h2>
              <p style={{ margin: '0.5rem 0 1rem 0', color: '#64748b' }}>
                Follow these steps to set up check-in tablets (iPad, Android tablet, Surface, phone, or laptop) on your center's Wi-Fi network:
              </p>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem', color: '#1e40af' }}>Step 1: Connect Tablet to Center Wi-Fi</h3>
                <p>Ensure the tablet/phone is connected to the same Wi-Fi network as this main computer.</p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem', color: '#1e40af' }}>Step 2: Open Web Browser on Tablet</h3>
                <p>Open Safari (iPad/iPhone) or Chrome (Android/Windows) on the tablet, then scan the QR code or enter the address below:</p>

                {!localPwaUrl && networkError && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b' }}>
                    <div style={{ marginBottom: '0.5rem' }}>{networkError}</div>
                    <button className="btn btn-secondary" onClick={fetchNetworkInfo} style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                      Retry
                    </button>
                  </div>
                )}

                {!localPwaUrl && !networkError && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', color: '#92400e', fontWeight: 'bold' }}>
                    Detecting your computer's local network address... Please wait a moment.
                  </div>
                )}

                {localPwaUrl && (
                  <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: publicTunnelUrl ? '1fr 1fr' : '1fr', gap: '1.25rem', alignItems: 'start' }}>
                    <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <p style={{ fontSize: '0.9rem', color: '#1e40af', margin: 0, fontWeight: 'bold', textAlign: 'center' }}>
                        Local Wi-Fi Kiosk
                      </p>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, textAlign: 'center' }}>
                        Must be on the same network as this computer
                      </p>
                      {localQrDataUrl && (
                        <img src={localQrDataUrl} alt="QR code for local kiosk" style={{ width: '180px', height: '180px', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ background: '#1e40af', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '1rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {localPwaUrl}
                        </div>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(localPwaUrl);
                            showToast('Local kiosk address copied');
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {publicTunnelUrl && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          <p style={{ fontSize: '0.9rem', color: '#065f46', margin: 0, fontWeight: 'bold', textAlign: 'center' }}>
                            Tablet Kiosk (HTTPS — Camera Enabled)
                          </p>
                          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, textAlign: 'center' }}>
                            {hasPortal ? `Permanent hosted URL — never changes (${portalBaseUrl})` : hasRelay ? `Fixed branded URL — never changes (relay: ${relayDomain})` : 'For tablets/phones anywhere — enables camera'}
                          </p>
                          {tunnelKioskQrDataUrl && (
                            <img src={tunnelKioskQrDataUrl} alt="QR code for tunnel kiosk" style={{ width: '150px', height: '150px', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ background: '#065f46', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                              {preferredKioskUrl}
                            </div>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                navigator.clipboard.writeText(preferredKioskUrl);
                                showToast('Kiosk URL copied');
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          <p style={{ fontSize: '0.9rem', color: '#92400e', margin: 0, fontWeight: 'bold', textAlign: 'center' }}>
                            Parent Portal (HTTPS)
                          </p>
                          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, textAlign: 'center' }}>
                            For parents to check status & sign out
                          </p>
                          {tunnelParentQrDataUrl && (
                            <img src={tunnelParentQrDataUrl} alt="QR code for parent portal" style={{ width: '150px', height: '150px', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ background: '#92400e', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                              {preferredParentUrl}
                            </div>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                navigator.clipboard.writeText(preferredParentUrl);
                                showToast('Parent portal URL copied');
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '0.5rem', color: '#1e40af' }}>Step 3: Save to Home Screen (Optional)</h3>
                <p>Tap <strong>Share &rarr; Add to Home Screen</strong> on iPad, or <strong>Menu (&#8942;) &rarr; Install App / Add to Home Screen</strong> on Android to turn the tablet into a dedicated full-screen kiosk app.</p>
              </div>
            </div>
          </div>
        )}

        {/* NETWORK & DEVICES VIEW */}
        {activeTab === 'network' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Network & Devices</h1>
            </div>

            {/* LIVE CONNECTION STATUS CARD */}
            <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h2>Live Connection Status</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                  <span style={{ fontSize: '1.25rem', color: serverOnline ? '#16a34a' : '#dc2626', lineHeight: 1 }}>●</span>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Center Server: {serverOnline ? 'Online' : 'Offline'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Port 3000 — this computer</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                  <span style={{ fontSize: '1.25rem', color: relayConnected ? '#16a34a' : '#dc2626', lineHeight: 1 }}>●</span>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Parent Cloud Relay: {relayConnected ? 'Connected' : 'Offline'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{portalBaseUrl}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ONE-CLICK ACTIONS CARD */}
            <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h2>Parent Portal Tools</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.5rem 0 1rem 0' }}>
                Verify the parent link is live, then print flyers for your front window.
              </p>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={handleTestParentLink}>Test Parent Link</button>
                <button className="btn btn-secondary" onClick={handleDownloadParentFlyer}>Print Parent Sign-Out Flyers</button>
                <button className="btn btn-secondary" onClick={handleCopyParentLink}>Copy Parent Link</button>
              </div>

              {(hasPortal || hasRelay || publicTunnelUrl) && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '1rem', marginTop: '1.25rem' }}>
                  <label style={{ fontWeight: 'bold', color: '#166534' }}>Permanent Parent Link (never changes):</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                    <code style={{ flex: 1, background: '#fff', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem', wordBreak: 'break-all' }}>{preferredParentUrl}</code>
                    <button className="btn btn-secondary" onClick={handleCopyParentLink}>Copy</button>
                  </div>
                </div>
              )}

              {!hasPortal && !hasRelay && !publicTunnelUrl && (
                <p style={{ fontSize: '0.85rem', color: '#92400e', marginTop: '0.75rem' }}>
                  No public link available yet. A secure tunnel starts automatically when the app opens — check back in a moment.
                </p>
              )}
            </div>

            {/* ADVANCED CONFIGURATION (collapsed by default) */}
            <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <h2 style={{ margin: 0 }}>Advanced Configuration</h2>
                <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{showAdvanced ? 'Hide ▲' : 'Show ▼'}</span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>
                Custom tunnel domain, relay secrets, and notification keys — normally you never need to touch these.
              </p>

              {showAdvanced && (
                <div>
                  {/* CLOUDFLARE QUICK TUNNEL CARD */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem' }}>Cloudflare Quick Tunnel</h3>
                        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Public endpoint for the tablet kiosk and parent portal.</p>
                      </div>
                      <span className={`badge ${sysConfig.cloudflare_tunnel_enabled ? 'badge-success' : 'badge-warning'}`}>
                        {sysConfig.cloudflare_tunnel_enabled ? 'TUNNEL ACTIVE' : 'DISABLED'}
                      </span>
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <label style={{ margin: 0, fontWeight: 'bold' }}>Enable Cloudflare Quick Tunnel:</label>
                      <input
                        type="checkbox"
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        checked={sysConfig.cloudflare_tunnel_enabled}
                        onChange={(e) => setSysConfig({ ...sysConfig, cloudflare_tunnel_enabled: e.target.checked })}
                      />
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
                      <label style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#475569' }}>Persistent Tunnel Token (Optional)</label>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0.75rem 0', lineHeight: 1.5 }}>
                        Paste a Cloudflare Tunnel token to get a permanent, unchanging domain (e.g. center.kumonsiso.com).
                        If left empty, a free Quick Tunnel is used instead (URL changes on each restart).
                      </p>
                      <input
                        type="password"
                        style={{ width: '100%', padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}
                        value={sysConfig.cloudflare_tunnel_token || ''}
                        onChange={(e) => setSysConfig({ ...sysConfig, cloudflare_tunnel_token: e.target.value })}
                        placeholder="ey... (paste your tunnel token here)"
                      />
                    </div>

                    {(sysConfig.cloudflare_tunnel_enabled || publicTunnelUrl) && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '1rem' }}>
                        <label style={{ fontWeight: 'bold', color: '#166534' }}>Active Public Tunnel URL:</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <input
                            type="text"
                            readOnly
                            style={{ flex: 1, padding: '0.5rem', fontFamily: 'monospace', fontWeight: 'bold', background: '#fff' }}
                            value={publicTunnelUrl || 'Starting tunnel process...'}
                          />
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              if (publicTunnelUrl) {
                                navigator.clipboard.writeText(publicTunnelUrl);
                                showToast('Public URL copied to clipboard');
                              }
                            }}
                          >
                            Copy URL
                          </button>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '0.5rem' }}>
                          Security Scoped: Public traffic is restricted to /kiosk and /parent routes. Administrative APIs return 403 over the public domain.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* CUSTOM CENTER-NAME RELAY / HOSTED PORTAL CARD */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem' }}>Permanent Center-Name Portal (Vercel)</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      A fixed, branded URL that never changes when the app restarts. The desktop auto-registers its current tunnel here on launch.
                    </p>

                    <div className="form-group">
                      <label>Center Slug (auto from Center Name):</label>
                      <input
                        type="text"
                        value={sysConfig.center_slug || ''}
                        onChange={(e) => setSysConfig({ ...sysConfig, center_slug: slugify(e.target.value) })}
                        placeholder="fremont-center"
                      />
                      <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Lowercase letters, numbers, hyphens. Set automatically during onboarding.
                      </p>
                    </div>

                    <div className="form-group">
                      <label>Relay Worker URL (Cloudflare Worker, optional):</label>
                      <input
                        type="text"
                        value={sysConfig.relay_worker_url || ''}
                        onChange={(e) => setSysConfig({ ...sysConfig, relay_worker_url: e.target.value })}
                        placeholder="https://relay.kumonsiso.com"
                      />
                    </div>

                    <div className="form-group">
                      <label>Hosted Parent Portal URL (Vercel):</label>
                      <input
                        type="text"
                        value={sysConfig.portal_base_url || ''}
                        onChange={(e) => setSysConfig({ ...sysConfig, portal_base_url: e.target.value })}
                        placeholder="https://kumon-siso.vercel.app"
                      />
                      <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Permanent PWA domain. Flyers and QR codes point to <code>{portalParentUrl || '(set a Center Slug above)'}</code>.
                      </p>
                    </div>

                    <div className="form-group">
                      <label>Relay Secret (X-Relay-Secret):</label>
                      <input
                        type="password"
                        value={sysConfig.relay_secret || ''}
                        onChange={(e) => setSysConfig({ ...sysConfig, relay_secret: e.target.value })}
                        placeholder="Shared secret for register handshake"
                      />
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                      <button className="btn btn-primary" onClick={() => handleSaveConfig(sysConfig)}>Save Relay Settings</button>
                    </div>
                  </div>

                  {/* NOTIFICATION PROVIDER SELECTOR */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem' }}>PWA Web Push Notifications</h3>
                    <p style={{ margin: '0.25rem 0 1rem 0', color: '#64748b', fontSize: '0.85rem' }}>Lock-screen push notifications for parents via the PWA interface.</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
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
                        <h4>PWA Web Push (VAPID)</h4>
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
                        <h4>Local Dev Outbox</h4>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>Writes notification JSON files locally for testing.</p>
                      </div>
                    </div>

                    {sysConfig.notification_provider === 'WEB_PUSH' && (
                      <div>
                        <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
                          <p style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.5rem' }}>What are VAPID keys?</p>
                          <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                            VAPID keys authenticate your server when sending web push notifications to parent devices. Keys are stored locally in your
                            database and never leave your machine. If you do not need push notifications, use the Dev Outbox instead.
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              const arrayToBase64 = (arr: ArrayBuffer) => {
                                return btoa(String.fromCharCode(...new Uint8Array(arr)))
                                  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                              };
                              const generateVapid = async () => {
                                try {
                                  const keyPair = await crypto.subtle.generateKey(
                                    { name: 'ECDSA', namedCurve: 'P-256' },
                                    true, ['sign']
                                  );
                                  const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
                                  const privRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
                                  const publicKey = arrayToBase64(pubRaw);
                                  const privateKey = arrayToBase64(privRaw);
                                  setSysConfig({ ...sysConfig, vapid_public_key: publicKey, vapid_private_key: privateKey });
                                  showToast('New VAPID keys generated');
                                } catch {
                                  showToast('Failed to generate VAPID keys');
                                }
                              };
                              generateVapid();
                            }}
                          >
                            Auto-Generate Keys
                          </button>
                        </div>
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
                      <button className="btn btn-secondary" onClick={handleTestNotification}>Send Test Notification</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PARENT WEB PORTAL VIEW */}
        {activeTab === 'portal' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Parent Web Portal (Front Window QR)</h1>
              <button className="btn btn-primary" onClick={handlePrintPortal}>Print QR Poster</button>
            </div>

            <div className="print-area">
              <div className="table-container portal-card" style={{ padding: '2rem' }}>
                <h2>Check My Child</h2>
                <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
                  Parents scan this QR code at the front window to check their child's check-in status and sign them out.
                </p>

                {portalUrl ? (
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                    <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="Parent Web Portal QR Code" style={{ width: 220, height: 220, display: 'block' }} />
                      ) : (
                        <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                          Generating QR...
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <label style={{ fontWeight: 'bold' }}>Public Portal URL:</label>
                      <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0 1rem 0' }}>
                        <input
                          type="text"
                          readOnly
                          style={{ flex: 1, padding: '0.5rem', fontFamily: 'monospace', fontWeight: 'bold', background: '#fff' }}
                          value={portalUrl}
                        />
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(portalUrl);
                            showToast('Portal URL copied');
                          }}
                        >
                          Copy URL
                        </button>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>
                        Print this poster and place it at the center's front window. Parents scan the QR with their phone camera to open the portal.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '1.5rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '1rem', color: '#92400e' }}>
                    No public tunnel URL yet. A Cloudflare Quick Tunnel starts automatically on server boot — if this stays empty, make sure{' '}
                    <code>cloudflared</code> is installed (or a custom-domain <code>.env</code> exists), then restart the server.
                  </div>
                )}
              </div>
            </div>

            <div className="table-container" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
              <h2>How It Works</h2>
              <p style={{ color: '#64748b', margin: '0.5rem 0 1rem 0' }}>
                The parent portal is served from the Check-In PWA at <code>/parent</code> and is accessible over both local Wi-Fi and the public Cloudflare tunnel.
              </p>
              <ul style={{ lineHeight: 2, paddingLeft: '1.25rem', color: '#334155' }}>
                <li>Parents save their child's first & last name once on their phone — profiles are remembered locally on the device.</li>
                <li>The portal shows live <strong>Checked In</strong> / <strong>Checked Out</strong> status, refreshed every 30 seconds.</li>
                <li>Parents tap <strong>Sign Out</strong> to complete checkout; staff see it in the Checked-In list immediately.</li>
                <li><strong>Security Scoped:</strong> Over the public tunnel only the kiosk (<code>/kiosk</code>), parent portal (<code>/parent</code>), their assets, and{' '}
                  <code>/api/parent/*</code> are reachable. All administrative APIs return <code>403</code>.</li>
              </ul>
            </div>
          </div>
        )}

        {/* BACKUP & RESTORE VIEW */}
        {activeTab === 'backup' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Backup & Migration</h1>
            </div>

            <div className="table-container" style={{ padding: '1.5rem' }}>
              <h3>Local Database Backup</h3>
              <p style={{ margin: '0.5rem 0 1rem 0', color: '#64748b' }}>Creates a safe SQLite snapshot copy with SHA-256 checksum.</p>
              <button className="btn btn-primary" onClick={handleCreateBackup}>Create Immediate Backup</button>

              <hr style={{ margin: '2rem 0' }} />

              <h3>Move Installation to Another Computer</h3>
              <p style={{ margin: '0.5rem 0 1rem 0', color: '#64748b' }}>Generates a transfer package containing database and verification manifest for USB transfer.</p>
              <button className="btn btn-secondary" onClick={handleExportTransferPackage}>Export Transfer Package</button>

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
            <h2>Center Setup Wizard</h2>
            <p className="subtitle">Get your center online in two easy steps — no technical setup needed.</p>

            <div className="wizard-steps">
              <div className={`wizard-step-dot ${wizardStep >= 1 ? 'active' : ''}`}></div>
              <div className={`wizard-step-dot ${wizardStep >= 2 ? 'active' : ''}`}></div>
            </div>

            {wizardStep === 1 && (
              <div>
                {/* Step 1: Center Identity */}
                <div className="form-group">
                  <label>Center Name</label>
                  <input
                    type="text"
                    value={onboardData.center_name}
                    onChange={(e) => setOnboardData({ ...onboardData, center_name: e.target.value })}
                    placeholder="e.g. Fremont Learning Center"
                    style={{ fontSize: '1.1rem', padding: '0.75rem 1rem' }}
                  />
                </div>

                {/* Live visual preview of the permanent parent link */}
                <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.75rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 600, marginBottom: '0.35rem' }}>Permanent Parent Link</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: '#1e40af', fontWeight: 'bold', wordBreak: 'break-all' }}>
                    {wizardParentUrl}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.35rem' }}>
                    This link never changes — print it on flyers and save it to your parents' phones.
                  </div>
                </div>

                <div className="form-group">
                  <label>Contact Phone Number</label>
                  <input type="text" value={onboardData.contact_phone} onChange={(e) => setOnboardData({ ...onboardData, contact_phone: e.target.value })} placeholder="+1 (555) 123-4567" />
                </div>

                <div className="form-group">
                  <label>Center Time Zone</label>
                  <select value={onboardData.time_zone} onChange={(e) => setOnboardData({ ...onboardData, time_zone: e.target.value })}>
                    <option value="America/New_York">Eastern Time (US & Canada)</option>
                    <option value="America/Chicago">Central Time (US & Canada)</option>
                    <option value="America/Denver">Mountain Time (US & Canada)</option>
                    <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  </select>
                </div>

                <button className="btn btn-primary" onClick={() => setWizardStep(2)}>Next Step →</button>
              </div>
            )}

            {wizardStep === 2 && (
              <div>
                {/* Step 2: Ready to Go */}
                <h3 style={{ marginBottom: '0.5rem' }}>Ready to Go!</h3>
                <p style={{ margin: '0 0 1.5rem 0', color: '#64748b' }}>
                  Your center is set up. Print the parent flyer, share the link, and open the dashboard.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
                  <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    {wizardQrDataUrl ? (
                      <img src={wizardQrDataUrl} alt="Parent portal QR code" style={{ width: 240, height: 240, display: 'block' }} />
                    ) : (
                      <div style={{ width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        Generating QR...
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.9rem', color: '#1e40af', fontWeight: 'bold', wordBreak: 'break-all', maxWidth: 420 }}>
                    {wizardParentUrl}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1.75rem' }}>
                  <button className="btn btn-primary" onClick={handleDownloadWizardFlyer}>Download Printable Parent Flyer (PDF)</button>
                  <button className="btn btn-secondary" onClick={handleCopyWizardLink}>Copy Parent Link</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={handleOnboardingSubmit}>Launch SISO Dashboard</button>
                </div>
                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '1rem' }}>
                  Clicking Launch finishes setup and opens your dashboard.
                </p>
              </div>
            )}
          </div>
        )}

        {/* DOCS VIEW */}
        {activeTab === 'docs' && (
          <div className="table-container" style={{ padding: '2rem' }}>
            <h1>Offline Documentation & User Manual</h1>
            <hr style={{ margin: '1rem 0' }} />
            <h3>1. System Overview</h3>
            <p>Kumon SISO is a local-first student check-in, drop-off acknowledgment, parent pickup, and checkout application designed for independent educational centers.</p>

            <h3 style={{ marginTop: '1.5rem' }}>2. Importing Roster CSV</h3>
            <p>Navigate to "Student Roster & Import", select your CSV file. Standard columns: Student ID, Student Name, Parent 1 Phone, Parent 2 Phone.</p>

            <h3 style={{ marginTop: '1.5rem' }}>3. Moving Installation to Another Computer</h3>
            <p>{'Use "Backup & Migration" -> "Export Transfer Package", copy the exported folder via USB to the target computer, and restore.'}</p>
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
