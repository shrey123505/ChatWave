# ChatWave v2.0 — Real-Time Messaging, Stories & HD Video Calling

ChatWave is a full-stack real-time web and mobile PWA messaging application built with **React 19**, **TypeScript**, **Tailwind CSS**, **Zustand**, **Firebase (Auth & Firestore)**, and **WebRTC**.

## What Was Fixed & Upgraded in v2.0

### 1. Video Call Orientation, Mirroring & WebRTC Fixes (`src/components/call/CallModal.tsx`)
- **Fixed Opposite / Inverted Video Call Face**:
  - Added explicit `facingMode: 'user'` camera constraints and automatic front-camera mirroring (`scaleX(-1)`) for your self-preview while un-mirroring rear camera and screen shares.
  - Added an on-screen **Video Orientation & Mirroring Toolbar** during video calls with:
    - **Flip Face (`FlipHorizontal`)**: 1-tap horizontal mirror toggle (`scaleX(-1)`) on the remote video stream if the other person's device sends an inverted/opposite camera feed.
    - **Rotate 90° (`RotateCw`)**: Cycles `0° → 90° → 180° → 270°` to immediately fix sideways or upside-down mobile video streams.
    - **Fit vs. Fill (`Maximize2` / `Minimize2`)**: Switches between `object-contain` (full uncropped portrait/landscape frame) and `object-cover` so faces are never cut off when calling between mobile and desktop.
    - **Front / Rear Camera Switch (`RefreshCw`)**: Switches between front selfie and rear environment cameras mid-call via `RTCRtpSender.replaceTrack()`.
    - **Screen Sharing (`MonitorUp`)**: Share your screen mid-call and seamlessly switch back to camera.
    - **Tap-to-Swap PIP View**: Tap the Picture-in-Picture preview to swap main and self video feeds.
- **Missed Call Auto-Notification & 35s Ring Timeout**: Unanswered outgoing calls automatically time out after 35 seconds and write a `missed_call` alert to the recipient's notification inbox.

### 2. Core Stability & Database Bug Fixes
- **Fixed Web Audio API Memory Leak (`src/utils/notification.ts`)**: Replaced per-notification `new AudioContext()` instantiation with a shared singleton `AudioContext` instance so browsers never hit the hardware audio context limit.
- **Fixed Orphaned Stories on Account Deletion (`AdminDashboardModal.tsx` & `DeleteAccountModal.tsx`)**: Fixed Firestore query field mismatch from `where('creatorId', '==', uid)` to `where('userId', '==', uid)` so deleted users' stories are properly purged.
- **Fixed `'You'` Sender Name in Replies (`ChatRoom.tsx`)**: Messages now record the sender's actual profile display name (`myName`) instead of fallback `'You'`, ensuring reply quotes show the right name on both ends.
- **Added Username Uniqueness Enforcement (`EditProfileModal.tsx` & `AuthScreen.tsx`)**: Prevents duplicate `@username` collisions in Firestore.

### 3. New Features & Theme / Mobile UI Overhaul
- **6-Theme Dynamic Theme Studio (`src/index.css`, `SettingsModal.tsx`)**: Cyber Violet, Aurora Neon, Oceanic Sapphire, Sunset Crimson, Emerald Forest, and AMOLED Gold — dynamically updating primary/secondary accents, surface elevation, background depths, and ambient radial glows.
- **Message Editing, Copy Text, In-Chat Search & Emoji Drawer (`ChatRoom.tsx`)**:
  - Edit sent text messages with an `(edited)` badge.
  - Copy message text with one tap.
  - Search messages inside any active conversation.
  - Built-in quick Emoji Picker drawer above the input bar.
  - Mobile-friendly tap-to-reveal message action bar (`React`, `Reply`, `Copy`, `Edit`, `Delete`).
- **Direct Story Replies & Quick Emoji Reactions (`StoryViewerModal.tsx`)**: Reply directly to friends' 24h stories or tap quick reaction pills (`🔥`, `❤️`, `😂`, `😍`, `👏`).
- **Conversation Filter Pills & Native Mobile Dock (`Sidebar.tsx`, `MobileBottomNav.tsx`)**: Filter chats by `All`, `Unread`, or `Online`, and navigate effortlessly on mobile with a 5-item bottom dock (`Chats`, `Explore`, floating `Scan QR`, `Alerts` with unread badge, and `Profile`) with iOS/Android safe-area inset support.

## Quick Start

```bash
npm install
npm run dev
```

To build for production:

```bash
npm run build
```
