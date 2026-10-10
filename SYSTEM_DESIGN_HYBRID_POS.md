# Comprehensive System Design Document: Hybrid Offline-First Multi-Device Restaurant POS Architecture

This document serves as the complete, end-to-end architectural blueprint for your multi-platform, hybrid, offline-first restaurant Point of Sale (POS) system. It outlines how a single unified React Native / Expo codebase powers Android mobile APKs, desktop Electron applications (.exe), local LAN networks, and cloud-backed synchronization with Microsoft SQL Server (`UCSPONDY`) on Railway.

---

## 1. Core Philosophy & Single Codebase Strategy

The master strategy behind this architecture is **Write Once, Deploy Everywhere**. Instead of maintaining separate codebases for mobile devices and desktop computers, the entire application is written using **React Native and Expo**.

Depending on the hardware needs of a specific restaurant or shop, the code is compiled or exported into:

- **Android APK**: Installed on mobile phones and tablets used by waiters and cashiers.
- **Electron Desktop App (`.exe`)**: Installed on the Counter PC, granting native file system access, local database storage, local Express LAN server hosting, and direct thermal printer integration.
- **Cloud Backend**: A Node.js / Express server hosted on Railway connected to your central MSSQL (`UCSPONDY`) database.

```
┌─────────────────────────────────────────────────────────────┐
│              UNIFIED REACT NATIVE / EXPO APP                │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
     ┌─────────▼──────────┐         ┌─────────▼──────────┐
     │   Android APK      │         │   Electron App     │
     │ Waiter/Cashier Tbl │         │    Counter PC      │
     └─────────┬──────────┘         └─────────┬──────────┘
               │ Local Wi-Fi LAN              │
               └──────────────┬───────────────┘
                              │ 20-Min / Manual Push & Pull
                     ┌────────▼─────────┐
                     │  Railway Backend │
                     │   (Node/MSSQL)   │
                     └──────────────────┘
```

---

## 2. Store Scenarios & Operational Use Cases

Different restaurants have different physical layouts and hardware budgets. The system natively supports three distinct operational models out of the same codebase:

### Scenario A: Large Restaurant (Counter PC + Waiter Tablets)
- **The Setup**: The counter features a Windows/Mac desktop running the app wrapped in Electron (`.exe`). Waiters carry Android tablets running the Expo APK. All devices are connected to the same local Wi-Fi router.
- **The Workflow**:
  1. A waiter takes an order on their tablet APK, which saves instantly to the tablet's local SQLite database (`is_synced = 0`).
  2. The tablet fires an HTTP POST request over local Wi-Fi to the Counter PC's static local IP (e.g., `http://192.168.1.100:3000`).
  3. The Counter PC receives the order instantly, updates the cashier's live screen, and fires a print job to the kitchen/counter thermal printer.
  4. When internet is available, the Counter PC pushes all collected data up to Railway/MSSQL.

### Scenario B: Medium Cafe (Counter Tablet + Waiter Tablets)
- **The Setup**: The counter uses a larger Android tablet running the APK, acting as the local hub. Waiters also use Android APK tablets.
- **The Workflow**: Identical to Scenario A, except the "Counter PC" role is handled by a fixed Android tablet running the app and hosting local sync coordination.

### Scenario C: Small Shop / Single Counter (Standalone Tablet)
- **The Setup**: A single Android tablet running the APK at the counter. No waiter tablets are needed.
- **The Workflow**: The cashier takes the order, it saves to local SQLite, prints instantly via Bluetooth/LAN thermal printer, and syncs to the cloud whenever internet connectivity is present.

---

## 3. Deep-Dive Technical Architecture

### A. Storage Layer (Offline-First)
- **On Android APK**: Uses native SQLite database files (`pos_hybrid_local.db`). Data persists permanently, works with zero network lag, and is entirely immune to internet outages.
- **On Counter Electron App (`.exe`)**: Uses embedded SQLite or Node-level file storage via Electron’s Node runtime.
- **Sync Metadata Pattern**: Every record (orders, items, customers) carries metadata:
  - `client_id` (UUID v4): Globally unique identifier generated on the client.
  - `is_synced` (Integer `0` or `1`): Tracks whether the record has been successfully sent to the cloud.
  - `sync_action` (`'INSERT'`, `'UPDATE'`, `'DELETE'`): Determines what action the sync engine needs to perform.

### B. Local LAN Communication (Waiters to Counter)
- **Zero Internet Requirement**: Local Wi-Fi routers create an internal network bubble. Devices talk to each other locally using private IP addresses (e.g., `192.168.1.100`).
- **Fallback Queueing**: If a waiter submits an order and the Counter PC is temporarily unreachable over Wi-Fi, the order remains safely queued in the waiter tablet's local SQLite storage. A background retry loop attempts delivery until successful.

### C. Cross-Platform Thermal Printing
- **On Android APK**: Connects directly to mobile thermal printers via Bluetooth (BLE) or local LAN/Wi-Fi using raw ESC/POS command formatting libraries (`react-native-thermal-printer` / `sunmi-printer-expo`).
- **On Electron Desktop App (`.exe`)**: Bypasses browser print dialog windows entirely. Electron's main process uses Node.js printer modules (`escpos` / `node-thermal-printer`) to talk directly to USB or LAN network receipt printers connected to the PC.

### D. Cloud Synchronization Engine (Railway + MSSQL)
- **Dual Triggers**:
  1. **Automated Timer**: Runs a background sync cycle every 20 minutes.
  2. **Manual Refresh Button**: Allows staff to tap a button for instant up-sync and down-sync.
- **Push (Up-Sync)**: Collects all local records where `is_synced = 0`, packages them into a batch JSON payload, and posts them to your Node.js backend on Railway (`/api/sync/push`).
- **Transactional Idempotency**: The Railway Node.js server receives the batch and opens an MSSQL Transaction. It checks if the `client_id` already exists in `UCSPONDY` before inserting. If it exists, it safely acknowledges receipt without creating duplicate records.
- **Pull (Down-Sync)**: Fetches updated master data (menu items, price adjustments, stock availability) from central MSSQL down to local storage based on `updated_at` timestamps (`/api/sync/pull`).

---

## 4. Implementation Roadmap & Execution Plan

| Step | Module | Implementation Target |
|------|--------|-----------------------|
| **1** | **Database & Repositories** | Abstracted storage layer using SQLite (`pos_hybrid_local.db`) for mobile & Electron with `client_id`, `is_synced`, `sync_action`. |
| **2** | **Local Server Hub** | Local Express server inside Electron / Counter runtime for zero-internet LAN order reception from waiter devices. |
| **3** | **Printing Service** | Cross-platform thermal printer driver supporting Bluetooth/LAN for Android and USB/LAN native printing for Electron. |
| **4** | **Cloud Sync Routes** | Backend Railway endpoints (`/api/sync/push`, `/api/sync/pull`) with MSSQL transaction support & idempotency. |
| **5** | **UI Hooks & Sync Manager** | Background 20-minute timer, manual sync button, online/offline status indicators, and local queue retry loop. |

---

> [[SYSTEM_DESIGN_HYBRID_POS.md](file:///c:/Users/User/Desktop/POS_Club_Hybrid%20Version/SYSTEM_DESIGN_HYBRID_POS.md)]
