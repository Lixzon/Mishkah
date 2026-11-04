import { AppState } from 'react-native';

export function installBatteryGovernor(onForegroundChange: (active: boolean) => void): () => void {
  onForegroundChange(AppState.currentState == null || AppState.currentState === 'active');
  const subscription = AppState.addEventListener('change', (nextState) => {
    onForegroundChange(nextState === 'active');
  });

  return () => subscription.remove();
}
