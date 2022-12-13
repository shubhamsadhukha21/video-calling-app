Video Call App

A peer-to-peer video calling in React Native using open source WebRTC

Dependencies

- NodeJS v14.17.5
- react-native-cli 2.0.1 (Global)
- Project React Native version 0.66.4



Installation

- Setup App
`cd <project-directory>`
`yarn`

- Setup Server
`cd <project-directory>/server/`
`yarn`

- Run Server
`cd <project-directory>/server/`
`yarn start`

- Run App

1. Run on Android Emulator/Device:
`yarn android`
2. Run on iOS Emulator/Device:
`yarn ios`


Prepare APK (Android)

- Delete old assets
`rm -rf ./android/app/src/main/res/drawable-*`

- Delete old bundle file already exists
`rm ./android/app/src/main/assets/app.bundle`

- Prepare the bundle
`react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res --verbose`

- Prepare APK
`rm -rf ./android/app/src/main/res/drawable-*` # If you do not remove the assets, it will throw duplicate assets error while build

`cd andoid/`

For Debug APK:
`gradlew assembleDebug`
Output Path `android\app\build\outputs\apk\debug\app-debug.apk`

For Release APK:
`gradlew assembleRelease`
Output Path `android\app\build\outputs\apk\release\app-release.apk`




