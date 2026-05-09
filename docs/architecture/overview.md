# StudySync architecture

## Why this stack

StudySync now uses a vanilla frontend with Firebase services so the product can stay lightweight while removing the complexity of a component framework and a SQL-first backend.

## Runtime architecture

- `frontend/`: Vite-powered HTML, CSS, and JavaScript app
- `firebase/`: Firestore and Realtime Database rules
- `backend/`: reserved for optional Cloud Functions or future integrations

## Core flows

1. The user signs in with Google through Firebase Auth.
2. On first login, a profile document is created in `users/{uid}`.
3. Joined groups are tracked in both `groups/{groupId}/members/{uid}` and `users/{uid}/memberships/{groupId}`.
4. Group chat streams from `groups/{groupId}/messages`.
5. Direct messages stream from `directThreads/{threadId}/messages`.
6. Presence and typing state are published through Realtime Database under `presence/groups/{groupId}/{uid}`.

## Data model

- `users/{uid}`: profile and settings
- `users/{uid}/notifications/*`: lightweight user notifications
- `users/{uid}/directThreads/*`: DM thread summaries for fast inbox rendering
- `groups/{groupId}`: room metadata
- `groups/{groupId}/members/*`: room membership snapshot
- `groups/{groupId}/statuses/*`: study status and focus mode
- `groups/{groupId}/messages/*`: realtime group chat
- `directThreads/{threadId}`: DM thread metadata
- `directThreads/{threadId}/members/*`: participants
- `directThreads/{threadId}/messages/*`: DM timeline
