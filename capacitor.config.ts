import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'basilico',
  webDir: 'www',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
      iconColor: '#283720'
    }
  }
};

export default config;
