# Kumon SISO - Troubleshooting Guide

### 1. Tablet Shows "Offline Mode"
- Verify tablet and main computer are connected to the center's local Wi-Fi network.
- Confirm local server is running on the main computer.
- Attendance events continue recording safely in local IndexedDB storage and will auto-sync when reconnected!

### 2. Parent Link Does Not Open
- Check if public parent relay endpoint or port forwarding / Cloudflare tunnel is active on the main computer.
- Local-only mode works fully via Staff PIN Overrides even without external parent internet access.

### 3. Database Integrity Issue
- Open **Diagnostics & Logs** in Desktop Admin app to view integrity check status.
- Use **Backup & Computer Move** to restore from the latest automated snapshot.
