# Deployment Guide - DigiKhata App

## Google Play Store Deployment

### Prerequisites
- Google Play Developer account ($25 one-time fee)
- EAS build completed (production Android App Bundle)
- Google Play Console access
- App icons and screenshots prepared
- Privacy policy URL
- Content rating questionnaire completed

### Steps

#### 1. Prepare App Assets
- App icon (512x512 PNG)
- Feature graphic (1024x500 PNG)
- Screenshots for various devices
- Promo video (optional)

#### 2. Create App in Play Console
1. Go to https://play.google.com/console
2. Click "Create app"
3. Enter app name, language, and whether it's paid or free
4. Select "Yes, I have a developer account"

#### 3. Complete Store Listing
- App name: DigiKhata
- Short description (80 chars max)
- Long description (4000 chars max)
- Screenshots (at least 2)
- App icon
- Category: Business or Finance
- Contact information
- Privacy policy URL

#### 4. Content Rating
- Complete content rating questionnaire
- Select appropriate rating for your app

#### 5. Upload App Bundle
1. Go to "Release" → "Production" → "Create new release"
2. Upload the AAB file from EAS build
3. Add release notes
4. Click "Save" then "Review release"

#### 6. Review and Roll Out
- Review all information
- Click "Start rollout to Production"
- Choose rollout percentage (start with 1% for testing)
- Click "Start rollout"

#### 7. Review Time
- Initial review: 1-3 days
- Updates: 1-2 days

## Apple App Store Deployment

### Prerequisites
- Apple Developer account ($99/year)
- Mac computer with Xcode
- EAS build completed (production iOS IPA)
- App Store Connect access
- App icons and screenshots prepared
- Privacy policy URL

### Steps

#### 1. Prepare App Assets
- App icon (1024x1024 PNG)
- Screenshots for various iPhone/iPad sizes
- App preview videos (optional)

#### 2. Create App in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+"
3. Enter app information
4. Select platform (iOS)

#### 3. Complete App Information
- App name: DigiKhata
- SKU (unique identifier)
- Bundle ID (must match Xcode project)
- Category: Business or Finance
- Privacy policy URL

#### 4. Build and Upload
1. Use EAS build: `eas build --profile production --platform ios`
2. Download IPA from EAS dashboard
3. Use Transporter or Application Loader to upload
4. Or use Xcode to upload directly

#### 5. Submit for Review
1. Complete app information
2. Upload screenshots
3. Add pricing and availability
4. Select age rating
5. Submit for review

#### 6. Review Time
- Initial review: 2-5 days
- Updates: 1-3 days

## Post-Deployment Checklist

### Google Play Store
- [ ] App appears in store
- [ ] Download and test on device
- [ ] Check for crashes via Firebase Crashlytics
- [ ] Monitor user reviews
- [ ] Update store listing if needed

### Apple App Store
- [ ] App appears in store
- [ ] Download and test on device
- [ ] Check for crashes via Firebase Crashlytics
- [ ] Monitor user reviews
- [ ] Respond to user feedback

## Updates and Maintenance

### Version Management
- Update version in app.json/app.config.js
- Update build number
- Build new production version
- Submit to stores with release notes

### Hot Fixes
- For critical bugs, use expedited review
- Provide clear explanation of fix
- Test thoroughly before submission

## Monitoring

### Analytics
- Set up Firebase Analytics
- Track user engagement
- Monitor crash reports
- Review performance metrics

### User Feedback
- Respond to reviews promptly
- Address reported issues
- Collect feature requests
- Improve based on feedback

## Compliance

### Google Play Policies
- Follow Google Play Developer Policy
- Ensure app meets content guidelines
- Handle user data properly
- Provide privacy policy

### Apple App Store Guidelines
- Follow App Store Review Guidelines
- Ensure app meets design guidelines
- Handle user data properly
- Provide privacy policy

## Support

### Contact Information
- Provide support email in app
- Respond to user inquiries
- Document common issues
- Create FAQ section

### Bug Reporting
- Create bug reporting mechanism
- Track reported issues
- Prioritize fixes
- Communicate with users
