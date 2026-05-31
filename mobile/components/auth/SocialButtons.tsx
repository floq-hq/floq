/**
 * Branded social sign-in buttons for the welcome screen.
 *  - Apple: the native HIG-compliant AppleAuthenticationButton (correct logo +
 *    styling, required for App Store review). Rendered only where Sign in with
 *    Apple is available (iOS 13+); style follows the active theme.
 *  - Google: a branded button with the official multi-color "G" mark.
 *
 * NOTE: this statically imports expo-apple-authentication (a native module), so
 * this screen must ship in a BUILD that includes it — not via an OTA update to an
 * older build. The app `version` bump (→ runtimeVersion) isolates older builds so
 * they never pull this JS.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleLogo, Text } from '../ui';
import { useTheme, useThemeSettings } from '../../theme';
import { isAppleAuthAvailable } from '../../services/firebase';

export function SocialButtons({
  onApple,
  onGoogle,
  busy = false,
}: {
  onApple: () => void;
  onGoogle: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const { scheme } = useThemeSettings();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void isAppleAuthAvailable().then((ok) => {
      if (active) setAppleAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.group}>
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={
            scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={8}
          style={styles.apple}
          onPress={busy ? () => {} : onApple}
        />
      ) : null}

      <Pressable
        onPress={busy ? undefined : onGoogle}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityState={{ disabled: busy }}
        style={[
          styles.google,
          { backgroundColor: theme.bgElevated, borderColor: theme.border, opacity: busy ? 0.6 : 1 },
        ]}
      >
        <GoogleLogo size={18} />
        <Text variant="label">Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  apple: { height: 48, width: '100%' },
  google: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
