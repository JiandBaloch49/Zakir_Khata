# EAS Build Setup Guide

## Prerequisites
- Expo account (create at https://expo.dev)
- EAS CLI installed: `npm install -g eas-cli`
- Project configured with EAS

## Initial Setup

### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

### 2. Configure EAS
```bash
eas build:configure
```

### 3. Update app.json/app.config.js
Ensure your app configuration includes:
- `expo.name`
- `expo.slug`
- `expo.version`
- `expo.android.package`
- `expo.ios.bundleIdentifier`

## Building for Development

### Android APK
```bash
eas build --profile development --platform android
```

### iOS Simulator (Mac only)
```bash
eas build --profile development --platform ios
```

## Building for Preview

### Android APK
```bash
eas build --profile preview --platform android
```

### iOS (Mac only)
```bash
eas build --profile preview --platform ios
```

## Building for Production

### Android App Bundle (Play Store)
```bash
eas build --profile production --platform android
```

### iOS (App Store - Mac only)
```bash
eas build --profile production --platform ios
```

## Build Profiles

### Development Build
- Includes Expo DevTools
- Fast build times
- For internal testing

### Preview Build
- Production-like build
- For beta testing
- Faster than production

### Production Build
- Optimized for app stores
- Includes all optimizations
- For final release

## Troubleshooting

### Build Fails
1. Check EAS dashboard for build logs
2. Ensure all dependencies are in package.json
3. Verify environment variables are set
4. Check for TypeScript errors

### iOS Build Issues
- Requires Mac with Xcode
- Apple Developer account required
- Provisioning profiles must be configured

### Android Build Issues
- Ensure Android SDK is installed
- Check keystore configuration
- Verify package name uniqueness

## Environment Variables

Set sensitive data in EAS:
```bash
eas secret:create --scope project --name FIREBASE_API_KEY
eas secret:create --scope project --name FIREBASE_PROJECT_ID
```

## Local Build (Alternative)

If EAS build fails, build locally:

### Android
```bash
eas build --local --platform android
```

### iOS (Mac only)
```bash
eas build --local --platform ios
```

## Build Artifacts

After successful build:
- Download APK/IPA from EAS dashboard
- Test on physical devices
- Verify all features work
- Proceed to store submission
