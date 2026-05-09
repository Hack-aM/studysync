# StudySync

A realtime collaborative study platform built with **pure HTML, CSS, and Vanilla JavaScript** — no bundler, no npm required at runtime. Firebase provides auth, data, and live presence.

## Features

- 🔒 Google Sign-In via Firebase Auth
- 👥 Public and private study groups (Firestore)
- 💬 Realtime group chat with typing indicators
- ⚡ Live room presence (Firebase Realtime Database)
- 📬 Direct messaging between study partners
- 📊 Dashboard with focus streaks and stats
- 👤 Editable user profiles
- ⚙️ Configurable daily study goals

## Tech Stack

| Layer | Technology |
|---|---|
| UI | HTML + Vanilla CSS + Vanilla JS (ES Modules) |
| Auth | Firebase Authentication (Google) |
| Database | Cloud Firestore |
| Presence | Firebase Realtime Database |
| Hosting | Any static file server |

## File Structure

```
.
├── index.html          ← Single HTML entry point
├── css/
│   └── style.css       ← Complete design system
├── js/
│   ├── config.js       ← Firebase config (fill in your values)
│   ├── firebase.js     ← Firebase CDN init
│   ├── auth.js         ← Auth helpers
│   ├── data.js         ← All Firestore + RTDB functions
│   ├── state.js        ← App state factory
│   ├── render.js       ← HTML template rendering
│   └── app.js          ← Main controller (routing, events)
└── firebase/
    ├── firestore.rules
    ├── firestore.indexes.json
    └── database.rules.json
```

## Setup

### 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Google** under Authentication → Sign-in Methods
4. Create a **Firestore** database (start in test mode, then apply rules)
5. Create a **Realtime Database** instance

### 2. Configure Firebase

Open `js/config.js` and fill in your Firebase project values:

```js
export const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_AUTH_DOMAIN",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID",
  databaseURL:       "YOUR_DATABASE_URL",
};
```

### 3. Apply Security Rules

In the Firebase Console:
- **Firestore** → Rules → paste contents of `firebase/firestore.rules`
- **Realtime Database** → Rules → paste contents of `firebase/database.rules.json`

### 4. Run Locally

> ⚠️ ES Modules require HTTP — **do not open index.html directly** as a `file://` URL.

**Option A — npx serve (recommended)**
```bash
npx serve d:\Project
```

**Option B — VS Code Live Server**  
Right-click `index.html` → *Open with Live Server*

**Option C — Python**
```bash
python -m http.server 8080
```

Then open `http://localhost:3000` (or whatever port your server uses).

## Deployment

Deploy the root folder to any static host:

- **Vercel**: `vercel --prod` (point root to `./`)
- **Firebase Hosting**: `firebase deploy`
- **Netlify**: drag and drop the folder

## Development Notes

- No build step required — edit files and refresh the browser
- Firebase is loaded via CDN (`gstatic.com/firebasejs/10.12.2/`)
- Hash-based routing: `#/dashboard`, `#/room`, `#/messages`, etc.
- All state lives in `js/state.js` — a plain JS object
- All HTML is generated as template literals in `js/render.js`
