# EasyJob 💼

A job search mobile app built with React Native and Expo.

## Features

- 🔍 **Search & Filter** — Search jobs by title, company, skill, or location; filter by work type and category
- 📋 **Job Listings** — Browse a curated feed of job postings with salary, location, and tags
- 📄 **Job Details** — View full job description, responsibilities, requirements, and benefits
- ❤️ **Save Jobs** — Bookmark jobs to review later
- ✅ **Apply** — Submit applications and track which jobs you've applied to
- 👤 **Profile** — View your profile, saved jobs stats, skills, and resume

## Tech Stack

- [Expo](https://expo.dev/) (React Native)
- [React Navigation](https://reactnavigation.org/) – Bottom tabs + stack navigation
- React Context + useReducer – State management

## Getting Started

### Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/client) app on your phone, or an Android/iOS simulator

### Install & Run

```bash
npm install
npm start          # Opens Expo DevTools
npm run android    # Run on Android emulator
npm run ios        # Run on iOS simulator (macOS only)
npm run web        # Run in web browser
```

## Project Structure

```
EasyJob/
├── App.js                    # Root component
├── app.json                  # Expo configuration
├── src/
│   ├── context/
│   │   └── JobsContext.js    # Global state (jobs, saved, applied)
│   ├── data/
│   │   └── jobs.js           # Mock job data & categories
│   ├── navigation/
│   │   └── index.js          # Navigation setup
│   ├── screens/
│   │   ├── HomeScreen.js     # Search & job feed
│   │   ├── JobDetailScreen.js # Job detail & apply
│   │   ├── SavedJobsScreen.js # Saved/bookmarked jobs
│   │   └── ProfileScreen.js  # User profile
│   ├── components/
│   │   ├── JobCard.js        # Reusable job card
│   │   └── SearchBar.js      # Search input
│   └── theme/
│       └── index.js          # Colors, spacing, typography
└── assets/                   # App icons and images
```
