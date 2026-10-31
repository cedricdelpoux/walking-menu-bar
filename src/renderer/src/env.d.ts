import type {WalkingBarApi} from "@shared/ipc"

declare global {
  interface Window {
    walkingBar: WalkingBarApi
  }
}

export {}
