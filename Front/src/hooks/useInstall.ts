import { useSyncExternalStore } from 'react'
import { getInstallMode, isInstallDismissed, subscribeInstall } from '../lib/install'

export function useInstallMode() {
  return useSyncExternalStore(subscribeInstall, getInstallMode)
}

export function useInstallDismissed() {
  return useSyncExternalStore(subscribeInstall, isInstallDismissed)
}
