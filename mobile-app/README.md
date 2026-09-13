# DigiKhata - Digital Ledger App

A full-featured cross-platform mobile application built with React Native and Expo, inspired by DigiKhata - a Pakistani bookkeeping app for small businesses.

## 🚀 Features

### Authentication & Role-Based Access Control
- **Admin Role**: View, search, filter, and download records of ALL staff members
- **Staff Role**: View, edit, and manage their OWN data only
- Secure session management with expo-secure-store
- Hardcoded admin credentials for demo purposes

### Staff Features
- **Home Screen**: 
  - Dynamic summary cards (Total Lena, Total Dena, Net Balance)
  - Quick action buttons (Add Customer, Add Supplier, Cash Book, Reports)
  - Recent transactions list with real-time updates
  - Floating action button for quick transaction entry

### Admin Features
- **Admin Dashboard**: 
  - View all registered staff members
  - Per-staff transaction history and analytics
  - Overall statistics across all users
  - Filter by date range, transaction type, amount range

### Technical Features
- **Offline-First Architecture**: Full functionality without internet
- **Local Database**: SQLite for persistent storage
- **State Management**: Zustand for reactive state
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Navigation**: React Navigation v6 (Stack + Bottom Tabs)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Expo CLI** - Install globally: `npm install -g expo-cli`
- **Git** (optional, for version control)

For mobile development:
- **Android Studio** (for Android development)
- **Xcode** (for iOS development - macOS only)
- **Expo Go app** on your mobile device (for testing)

## 🛠️ Installation & Setup

### Step 1: Resolve PowerShell Execution Policy (Windows Only)

Since you're on Windows, you need to allow PowerShell to run scripts:

1. Open PowerShell as Administrator
2. Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
3. Type `Y` when prompted
4. Close PowerShell and reopen it normally

### Step 2: Install Dependencies

Navigate to your project directory and install all dependencies:

```bash
cd "c:\Users\DURRA\Desktop\mobile app"
npm install
```

This will install all the packages listed in `package.json`.

### Step 3: Start the Development Server

```bash
npm start
```

Or use:

```bash
expo start
```

### Step 4: Run the App

You have several options to run the app:

**Option A: Using Expo Go (Easiest for Testing)**
1. Download the Expo Go app on your mobile device (Android/iOS)
2. Scan the QR code displayed in your terminal
3. The app will load on your phone

**Option B: Android Emulator**
1. Open Android Studio and start an emulator
2. Press `a` in the terminal where Expo is running
3. The app will open in the emulator

**Option C: iOS Simulator (macOS only)**
1. Press `i` in the terminal where Expo is running
2. The app will open in the iOS Simulator

**Option D: Web Browser**
1. Press `w` in the terminal
2. The app will open in your browser (limited functionality)

## 🔐 Default Credentials

### Admin Login
- **Email**: admin@digikhata.com
- **Password**: admin123

### Staff Registration
- Register new staff members through the app
- Staff can only view and manage their own data

## 📁 Project Structure

```
mobile app/
├── App.tsx                          # Main entry point
├── package.json                     # Dependencies
├── app.json                         # Expo configuration
├── tsconfig.json                    # TypeScript config
├── tailwind.config.js               # Tailwind CSS config
├── babel.config.js                  # Babel configuration
├── global.css                       # Global styles
├── src/
│   ├── components/                  # Reusable components
│   │   ├── SummaryCard.tsx
│   │   ├── QuickActionButton.tsx
│   │   └── TransactionItem.tsx
│   ├── screens/                     # Screen components
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   ├── staff/
│   │   │   └── HomeScreen.tsx
│   │   └── admin/
│   │       └── AdminDashboard.tsx
│   ├── navigation/                  # Navigation setup
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   ├── StaffNavigator.tsx
│   │   └── AdminNavigator.tsx
│   ├── store/                       # State management (Zustand)
│   │   ├── authStore.ts
│   │   └── transactionStore.ts
│   ├── services/                    # API and database services
│   │   └── sqlite.ts
│   ├── utils/                       # Utility functions
│   │   └── calculations.ts
│   └── types/                       # TypeScript types
│       └── index.ts
```

## 🎨 Tech Stack

- **Framework**: React Native + Expo SDK 51
- **Language**: TypeScript
- **Navigation**: React Navigation v6
- **State Management**: Zustand
- **Database**: expo-sqlite
- **Styling**: NativeWind (Tailwind CSS)
- **Authentication**: expo-secure-store
- **PDF Generation**: expo-print + expo-sharing
- **Network Detection**: @react-native-community/netinfo

## 🔧 Available Scripts

```bash
# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on Web
npm run web
```

## 📱 Building for Production

### Android APK

1. Install EAS CLI: `npm install -g eas-cli`
2. Login to Expo: `eas login`
3. Configure build: `eas build:configure`
4. Build APK: `eas build --platform android`

### iOS IPA (macOS only)

1. Install EAS CLI: `npm install -g eas-cli`
2. Login to Expo: `eas login`
3. Configure build: `eas build:configure`
4. Build IPA: `eas build --platform ios`

## 🐛 Troubleshooting

### PowerShell Execution Policy Error
If you see "running scripts is disabled" error:
- Run PowerShell as Administrator
- Execute: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Metro Bundler Issues
If the app doesn't refresh:
- Stop the server (Ctrl+C)
- Clear cache: `npx expo start -c`
- Restart: `npm start`

### Dependency Issues
If you encounter module not found errors:
- Delete `node_modules` folder
- Delete `package-lock.json`
- Run: `npm install`

### TypeScript Errors
TypeScript errors are expected before installing dependencies. They will resolve after running `npm install`.

## 🚧 Pending Features

The following features are planned but not yet implemented:

- [ ] Add/Edit Transaction screens
- [ ] Cash Book management
- [ ] Customer/Supplier management
- [ ] PDF report generation
- [ ] Offline sync with cloud (Firebase/Supabase)
- [ ] Network detection and auto-sync
- [ ] Reports screen with filters
- [ ] More menu with settings

## 📝 Development Notes

### Adding New Screens
1. Create screen file in `src/screens/`
2. Add to appropriate navigator
3. Update navigation types if needed

### Database Schema
The app uses SQLite with the following tables:
- `users` - User accounts
- `transactions` - Lena/Dena entries
- `cashbook` - Cash in/out entries
- `parties` - Customers and suppliers

### Styling
The app uses NativeWind (Tailwind CSS). The primary brand color is `#00A651` (green).

## 🤝 Contributing

This is a learning project. Feel free to:
- Add new features
- Fix bugs
- Improve the UI/UX
- Add tests

## 📄 License

This project is for educational purposes.

## 🆘 Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review Expo documentation: https://docs.expo.dev/
3. Check React Native docs: https://reactnative.dev/

---

**Happy Coding! 🎉**
