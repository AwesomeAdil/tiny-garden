import AppKit

// tiny-garden            run the app (wallpaper; --play starts in play)
// tiny-garden toggle     flip wallpaper <-> play (launches into play if not running)
// tiny-garden quit       save and quit
// tiny-garden status     print the running window's mode, level and behaviour
// tiny-garden selftest   exits 0 or 1
let args = Array(CommandLine.arguments.dropFirst())
if let cmd = args.first, !cmd.hasPrefix("-") {
  guard let code = Control.run(cmd) else {
    FileHandle.standardError.write(Data("tiny-garden: unknown command \(cmd)\n".utf8)); exit(2)
  }
  exit(code)
}

let play = args.contains("--play")
// One garden at a time: a second launch hands over and leaves.
if !Control.others().isEmpty {
  log("already running")
  if play { Control.post(Control.toggleNote) }
  exit(0)
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
guard let screen = Lifecycle.screen() else { log("no screen"); exit(1) }

let window = GardenWindow(screen: screen)
let host = WebHost(root: WebHost.webRoot())
host.webView.frame = window.contentLayoutRect
window.contentView = host.webView
let life = Lifecycle(window: window, host: host, store: SaveStore(dir: SaveStore.defaultDir), startMode: play ? .play : .wallpaper)
app.delegate = life
life.start()
window.apply(.wallpaper, screen: screen)
host.load()
log("started (\(play ? "play" : "wallpaper"))")
app.run()
