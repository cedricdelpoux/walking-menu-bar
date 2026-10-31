import {contextBridge, ipcRenderer, type IpcRendererEvent} from "electron"
import {IpcChannel, type WalkingBarApi} from "../shared/ipc"

function subscribe<T>(
  channel: string,
  listener: (payload: T) => void
): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: WalkingBarApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannel.getAppInfo),
  getLiveState: () => ipcRenderer.invoke(IpcChannel.getLiveState),
  onLiveState: (listener) => subscribe(IpcChannel.liveStateChanged, listener),
  startBelt: () => ipcRenderer.invoke(IpcChannel.startBelt),
  pauseBelt: () => ipcRenderer.invoke(IpcChannel.pauseBelt),
  endSession: () => ipcRenderer.invoke(IpcChannel.endSession),
  changeSpeed: (direction) =>
    ipcRenderer.invoke(IpcChannel.changeSpeed, direction),
  setSpeed: (speedKmh) => ipcRenderer.invoke(IpcChannel.setSpeed, speedKmh),
  setMode: (mode) => ipcRenderer.invoke(IpcChannel.setMode, mode),
  setGoal: (scope, goal) => ipcRenderer.invoke(IpcChannel.setGoal, scope, goal),
  forgetPad: () => ipcRenderer.invoke(IpcChannel.forgetPad),
  listHistory: (days) => ipcRenderer.invoke(IpcChannel.listHistory, days),
  onHistoryChanged: (listener) =>
    subscribe(IpcChannel.historyChanged, listener),
  deleteSession: (id) => ipcRenderer.invoke(IpcChannel.deleteSession, id),
  getSettings: () => ipcRenderer.invoke(IpcChannel.getSettings),
  updateSettings: (patch) =>
    ipcRenderer.invoke(IpcChannel.updateSettings, patch),
  onSettingsChanged: (listener) =>
    subscribe(IpcChannel.settingsChanged, listener),
  getStravaState: () => ipcRenderer.invoke(IpcChannel.getStravaState),
  onStravaChanged: (listener) => subscribe(IpcChannel.stravaChanged, listener),
  saveStravaCredentials: (credentials) =>
    ipcRenderer.invoke(IpcChannel.saveStravaCredentials, credentials),
  connectStrava: () => ipcRenderer.invoke(IpcChannel.connectStrava),
  disconnectStrava: () => ipcRenderer.invoke(IpcChannel.disconnectStrava),
  syncStrava: (dayCount) => ipcRenderer.invoke(IpcChannel.syncStrava, dayCount),
  getPublication: (target) =>
    ipcRenderer.invoke(IpcChannel.getPublication, target),
  getSpeedProfile: (target) =>
    ipcRenderer.invoke(IpcChannel.getSpeedProfile, target),
  onPublicationChanged: (listener) =>
    subscribe(IpcChannel.publicationChanged, listener),
  publish: (target, overrides) =>
    ipcRenderer.invoke(IpcChannel.publish, target, overrides),
  dismissPublication: (target) =>
    ipcRenderer.invoke(IpcChannel.dismissPublication, target),
  resetPublication: (target) =>
    ipcRenderer.invoke(IpcChannel.resetPublication, target),
  revealDiagnosticsLog: () =>
    ipcRenderer.invoke(IpcChannel.revealDiagnosticsLog),
  quit: () => ipcRenderer.invoke(IpcChannel.quit),
  fitWindowHeight: (contentHeight) =>
    ipcRenderer.invoke(IpcChannel.fitWindowHeight, contentHeight),
}

contextBridge.exposeInMainWorld("walkingBar", api)
