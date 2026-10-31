import {join} from "node:path"
import {readFileSync} from "node:fs"
import {BrowserWindow, Menu, nativeImage, screen, shell, Tray} from "electron"
import trayIconPath from "../../resources/trayTemplate.png?asset"
import trayIconRetinaPath from "../../resources/trayTemplate@2x.png?asset"

const WINDOW_WIDTH = 360
const INITIAL_WINDOW_HEIGHT = 580
const MIN_WINDOW_HEIGHT = 200
const SCREEN_MARGIN = 8

export interface MenuBarOptions {
  tooltip: string
  contextMenuLabels: {open: string; quit: string}
  onQuit: () => void
}

function createTrayIcon(): Electron.NativeImage {
  const image = nativeImage.createFromPath(trayIconPath)
  image.addRepresentation({
    scaleFactor: 2,
    buffer: readFileSync(trayIconRetinaPath),
  })
  image.setTemplateImage(true)
  return image
}

export class MenuBar {
  readonly tray: Tray
  readonly window: BrowserWindow
  private contentHeight = INITIAL_WINDOW_HEIGHT

  constructor(private options: MenuBarOptions) {
    this.tray = new Tray(createTrayIcon())
    this.tray.setToolTip(options.tooltip)
    this.window = this.createWindow()

    this.tray.on("click", () => this.toggle())
    this.tray.on("right-click", () =>
      this.tray.popUpContextMenu(this.buildContextMenu())
    )
    this.window.on("blur", () => {
      const keepOpen =
        this.window.webContents.isDevToolsOpened() ||
        process.env.WALKING_BAR_KEEP_OPEN
      if (!keepOpen) this.window.hide()
    })
  }

  setTitle(title: string): void {
    this.tray.setTitle(title, {fontType: "monospacedDigit"})
  }

  updateLabels(
    options: Pick<MenuBarOptions, "tooltip" | "contextMenuLabels">
  ): void {
    this.options = {...this.options, ...options}
    this.tray.setToolTip(options.tooltip)
  }

  // The window follows the height of its content, up to the bottom of the screen.
  fitHeight(contentHeight: number): void {
    this.contentHeight = contentHeight
    this.resizeToContent()
  }

  show(): void {
    this.positionUnderTray()
    this.resizeToContent()
    this.joinCurrentSpace()
    this.window.show()
    this.window.focus()
  }

  toggle(): void {
    if (this.window.isVisible()) this.window.hide()
    else this.show()
  }

  private createWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: INITIAL_WINDOW_HEIGHT,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      transparent: true,
      vibrancy: "popover",
      visualEffectState: "active",
      roundedCorners: true,
      // A panel takes the keyboard without activating the app, so macOS does not switch Space.
      type: "panel",
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    })
    window.webContents.setWindowOpenHandler(({url}) => {
      void shell.openExternal(url)
      return {action: "deny"}
    })

    // WALKING_BAR_VIEW opens another view on start, which helps when working on it.
    const query: Record<string, string> = process.env.WALKING_BAR_VIEW
      ? {view: process.env.WALKING_BAR_VIEW}
      : {}
    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    if (rendererUrl)
      void window.loadURL(`${rendererUrl}?${new URLSearchParams(query)}`)
    else
      void window.loadFile(join(__dirname, "../renderer/index.html"), {query})
    return window
  }

  // Without skipTransformProcessType, Electron turns the app into a regular one and back, which
  // drops this setting. It is applied on every opening since macOS may reset it.
  private joinCurrentSpace(): void {
    this.window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    })
  }

  private resizeToContent(): void {
    if (this.window.isDestroyed()) return
    const {workArea} = screen.getDisplayMatching(this.window.getBounds())
    const maxHeight =
      workArea.y + workArea.height - this.window.getBounds().y - SCREEN_MARGIN
    const height = Math.round(
      Math.min(maxHeight, Math.max(MIN_WINDOW_HEIGHT, this.contentHeight))
    )
    this.window.setSize(WINDOW_WIDTH, height, false)
  }

  private positionUnderTray(): void {
    const trayBounds = this.tray.getBounds()
    const {workArea} = screen.getDisplayNearestPoint({
      x: trayBounds.x,
      y: trayBounds.y,
    })
    const centeredX = Math.round(
      trayBounds.x + trayBounds.width / 2 - WINDOW_WIDTH / 2
    )
    const x = Math.min(
      Math.max(centeredX, workArea.x + SCREEN_MARGIN),
      workArea.x + workArea.width - WINDOW_WIDTH - SCREEN_MARGIN
    )
    const y = Math.round(trayBounds.y + trayBounds.height + 4)
    this.window.setPosition(x, Math.max(y, workArea.y))
  }

  private buildContextMenu(): Menu {
    return Menu.buildFromTemplate([
      {label: this.options.contextMenuLabels.open, click: () => this.show()},
      {type: "separator"},
      {
        label: this.options.contextMenuLabels.quit,
        click: () => this.options.onQuit(),
      },
    ])
  }
}
