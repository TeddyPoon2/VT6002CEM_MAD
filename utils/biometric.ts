import * as LocalAuthentication from 'expo-local-authentication';

export async function authenticateBiometric(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to view balance',
      fallbackLabel: 'Enter device passcode',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch (e) {
    return false;
  }
}
