import type { OAuthToken, PluginManifest } from '@shared/types/plugin'
import { createStore, useStore } from 'zustand'
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import storage from '@/storage'

interface PluginState {
  manifests: PluginManifest[]
  activePluginId: string | null
  pluginStates: Record<string, unknown>
  oauthTokens: Record<string, OAuthToken>
  degraded: Record<string, boolean>
  failureCounts: Record<string, number>
}

interface PluginActions {
  registerPlugin: (manifest: PluginManifest) => void
  setActivePlugin: (id: string | null) => void
  dismissPlugin: () => void
  cachePluginState: (id: string, state: unknown) => void
  storeOAuthToken: (pluginId: string, token: OAuthToken) => void
  markDegraded: (id: string) => void
  incrementFailure: (id: string) => void
}

export const pluginStore = createStore<PluginState & PluginActions>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        manifests: [],
        activePluginId: null,
        pluginStates: {},
        oauthTokens: {},
        degraded: {},
        failureCounts: {},

        registerPlugin: (manifest) =>
          set((state) => {
            const idx = state.manifests.findIndex((m) => m.id === manifest.id)
            if (idx >= 0) {
              state.manifests[idx] = manifest
            } else {
              state.manifests.push(manifest)
            }
          }),

        setActivePlugin: (id) =>
          set((state) => {
            state.activePluginId = id
          }),

        dismissPlugin: () =>
          set((state) => {
            state.activePluginId = null
          }),

        cachePluginState: (id, pluginState) =>
          set((state) => {
            state.pluginStates[id] = pluginState
          }),

        storeOAuthToken: (pluginId, token) =>
          set((state) => {
            state.oauthTokens[pluginId] = token
          }),

        markDegraded: (id) =>
          set((state) => {
            state.degraded[id] = true
          }),

        incrementFailure: (id) =>
          set((state) => {
            state.failureCounts[id] = (state.failureCounts[id] || 0) + 1
            if (state.failureCounts[id] >= 3) {
              state.degraded[id] = true
            }
          }),
      })),
      {
        name: 'plugin-store',
        storage: createJSONStorage(() => ({
          getItem: async (key) => {
            const res = await storage.getItem<(Pick<PluginState, 'manifests' | 'oauthTokens'> & { __version?: number }) | null>(key, null)
            if (res) {
              const { __version = 0, ...state } = res
              return JSON.stringify({
                state,
                version: __version,
              })
            }
            return null
          },
          setItem: async (name, value) => {
            const { state, version } = JSON.parse(value) as { state: Pick<PluginState, 'manifests' | 'oauthTokens'>; version?: number }
            await storage.setItem(name, { ...state, __version: version || 0 })
          },
          removeItem: async (name) => await storage.removeItem(name),
        })),
        version: 0,
        partialize: (state) => ({
          manifests: state.manifests,
          oauthTokens: state.oauthTokens,
        }),
        skipHydration: true,
      }
    )
  )
)

let _initPluginStorePromise: Promise<PluginState> | undefined
export const initPluginStore = async () => {
  if (!_initPluginStorePromise) {
    _initPluginStorePromise = new Promise<PluginState>((resolve) => {
      const unsub = pluginStore.persist.onFinishHydration((val) => {
        unsub()
        resolve(val)
      })
      pluginStore.persist.rehydrate()
    })
  }
  return await _initPluginStorePromise
}

export function usePluginStore<U>(selector: Parameters<typeof useStore<typeof pluginStore, U>>[1]) {
  return useStore<typeof pluginStore, U>(pluginStore, selector)
}
