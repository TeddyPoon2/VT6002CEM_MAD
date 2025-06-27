# Local Setup Guide

---

## Prerequisites

- **Node.js** (v18 or newer recommended)
- **npm** (comes with Node.js)
- **Expo CLI** (for the mobile app)
- (Optional) **Android Studio** or **Xcode** for device emulation

---

## 1. Clone the Repository

```bash
git clone <repo-url>
cd <appname>
```

---

## 2. Environment Variables

- Copy `.env.example` to `.env` and fill in the required environment variables.

```bash
cp .env.example .env
```
- Fill in firebase config in server folder

---

## 3. Install Dependencies

### For the Mobile App (Root Directory)

```bash
npm install
```

### For the Backend Server

```bash
cd server
npm install
```

---

## 4. Running the App

### Start the Backend Server

```bash
cd server
node server
```

The server will start on the default port (check `server.js` for details).

### Start the Mobile App (Expo)

Open a new terminal in the root directory:

```bash
npm expo start
```

- Use the QR code to open the app on your device with Expo Go, or press `a` (Android) / `i` (iOS) to run on an emulator.

---
