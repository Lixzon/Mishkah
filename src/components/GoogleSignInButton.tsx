import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function GoogleSignInButton({
  label,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && !loading ? styles.buttonPressed : null,
        disabled || loading ? styles.buttonDisabled : null,
      ]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.iconText}>G</Text>
      </View>
      {loading ? <ActivityIndicator color="#1f2937" /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe7e4',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 10,
    backgroundColor: '#EFF3F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#145B50',
  },
  label: {
    color: '#162D2C',
    fontSize: 14,
    fontWeight: '700',
  },
});
