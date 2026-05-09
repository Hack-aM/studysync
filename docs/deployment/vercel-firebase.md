# Deployment guide

## 1. Firebase setup

1. Create a new Firebase project.
2. Enable Google in Authentication.
3. Create a Firestore database.
4. Create a Realtime Database instance.
5. Apply `firebase/firestore.rules`.
6. Apply `firebase/database.rules.json`.
7. Copy `frontend/.env.example` to `frontend/.env`.
8. Fill in the Firebase config values from your project settings.

## 2. Vercel setup

1. Push this repository to GitHub.
2. Import the repo into Vercel.
3. Set the root directory to `frontend`.
4. Add the environment variables from `frontend/.env.example`.
5. Deploy.

## 3. GitHub Actions

The included workflow installs dependencies, runs the lightweight frontend check, and builds the app on every push and pull request.

## 4. Free-tier friendly defaults

- No custom server required
- Static frontend hosting on Vercel
- Auth, document storage, and presence on Firebase
- Optional Docker only for local consistency
