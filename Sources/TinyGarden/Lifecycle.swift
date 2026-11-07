import AppKit

/// Mode switching, the JS bridge's Swift side, pausing while nobody can see the garden,
/// following screen changes, and saving on the way out.
final class Lifecycle: NSObject, NSApplicationDelegate {
  let window: GardenWindow
  let host: WebHost
  let store: SaveStore
  private(set) var mode: Mode = .wallpaper
  private let startMode: Mode
  private var ready = false
  private var previous: NSRunningApplication?
  private var pauseReasons = Set<String>()
  private var jsPaused = false
  private var terminating = false
  private var sigterm: DispatchSourceSignal?

  init(window: GardenWindow, host: WebHost, store: SaveStore, startMode: Mode) {
    self.window = window; self.host = host; self.store = store; self.startMode = startMode
  }

  /// The main screen: the one with the menu bar, not whichever holds the key window.
  static func screen() -> NSScreen? { NSScreen.screens.first ?? NSScreen.main }

  func start() {
    host.onMessage = { [unowned self] m in self.handle(m) }

    let dnc = DistributedNotificationCenter.default()
    dnc.addObserver(forName: Notification.Name(Control.toggleNote), object: nil, queue: .main) { [unowned self] _ in self.toggle() }
    dnc.addObserver(forName: Notification.Name(Control.quitNote), object: nil, queue: .main) { _ in NSApp.terminate(nil) }
    dnc.addObserver(forName: Notification.Name(Control.statusNote), object: nil, queue: .main) { [unowned self] _ in self.writeStatus() }

    let ws = NSWorkspace.shared.notificationCenter
    let reasons: [(Notification.Name, String, Bool)] = [
      (NSWorkspace.screensDidSleepNotification, "screens-asleep", true),
      (NSWorkspace.screensDidWakeNotification, "screens-asleep", false),
      (NSWorkspace.sessionDidResignActiveNotification, "session-inactive", true),
      (NSWorkspace.sessionDidBecomeActiveNotification, "session-inactive", false),
    ]
    for (name, reason, on) in reasons {
      ws.addObserver(forName: name, object: nil, queue: .main) { [unowned self] _ in self.setPause(reason, on) }
    }
    NotificationCenter.default.addObserver(forName: NSWindow.didChangeOcclusionStateNotification, object: window, queue: .main) { [unowned self] _ in
      self.setPause("hidden", !self.window.occlusionState.contains(.visible))
    }
    NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [unowned self] _ in
      guard let s = Self.screen() else { return }
      log("screens changed")
      self.window.apply(self.mode, screen: s, activate: false)
    }
    // Another app took focus (a click elsewhere, ⌘Tab, a system dialog): play must not stay on top of it.
    // That app is already in front, so don't hand focus back to the one play started from.
    NotificationCenter.default.addObserver(forName: NSApplication.didResignActiveNotification, object: nil, queue: .main) { [unowned self] _ in
      guard self.mode == .play else { return }
      log("lost focus in play: back to wallpaper")
      self.enter(.wallpaper, restore: false)
    }

    // launchctl bootout / kill: save like a normal quit.
    signal(SIGTERM, SIG_IGN)
    let src = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
    src.setEventHandler { NSApp.terminate(nil) }
    src.resume(); sigterm = src
  }

  // MARK: JS -> Swift

  private func handle(_ m: [String: Any]) {
    switch m["type"] as? String {
    case "ready": boot()
    case "save":
      guard let s = m["save"], JSONSerialization.isValidJSONObject(s), let d = try? JSONSerialization.data(withJSONObject: s) else {
        log("save: message without a save object"); return
      }
      store.write(d)
    case "exit": enter(.wallpaper)
    case "bad-save": log("js says the save is unreadable"); store.quarantine()
    case "new-map": store.archive()
    case let t: log("web: unknown message \(t ?? "nil")")
    }
  }

  private func boot() {
    let first = !ready
    ready = true; jsPaused = false
    // Not valid JSON at all: set it aside here; JS reports saves it cannot read as bad-save.
    var saveJS = "null"
    if let d = store.load() {
      if (try? JSONSerialization.jsonObject(with: d)) is [String: Any], let text = String(data: d, encoding: .utf8) {
        saveJS = "JSON.parse(\(WebHost.literal(text)))"
      } else {
        log("save: not JSON, quarantining"); store.quarantine()
      }
    }
    let m: Mode = first ? startMode : mode
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    host.call("garden.boot(\(saveJS), '\(m.rawValue)', \(now), { topInset: \(Double(GardenWindow.topInset)) }); 0")
    log("booted in \(m.rawValue) (save: \(saveJS == "null" ? "none" : "loaded"))")
    if m != mode { enter(m, tellJS: false) }
    setPause("hidden", !window.occlusionState.contains(.visible))
    syncPause()
  }

  // MARK: modes

  func toggle() { enter(mode == .play ? .wallpaper : .play) }

  func enter(_ m: Mode, tellJS: Bool = true, restore: Bool = true) {
    guard let s = Self.screen() else { return }
    if m == .play, mode != .play {
      let front = NSWorkspace.shared.frontmostApplication
      previous = front?.processIdentifier == getpid() ? nil : front
    }
    mode = m
    window.apply(m, screen: s)
    if m == .play { window.makeFirstResponder(host.webView) }
    if ready, tellJS { host.call("garden.setMode('\(m.rawValue)'); 0") }
    if m == .wallpaper {
      if restore { restoreFocus() } else { previous = nil }
    }
  }

  /// Hands focus back to the app play started from, but only while the garden is still the active app:
  /// if something else is already in front, leave it there. If the garden is still active afterwards, it steps back.
  private func restoreFocus() {
    let prev = previous; previous = nil
    guard NSApp.isActive else { return }
    if let prev, !prev.isTerminated {
      NSApp.yieldActivation(to: prev)
      prev.activate()
      log("focus back to \(prev.bundleIdentifier ?? prev.localizedName ?? "?")")
    }
    // Activation is asynchronous: check once it has had time to land.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
      guard let self, self.mode == .wallpaper, NSApp.isActive else { return }
      log("still active after leaving play: deactivating")
      NSApp.deactivate()
    }
  }

  // MARK: pausing

  private func setPause(_ reason: String, _ on: Bool) {
    if on { pauseReasons.insert(reason) } else { pauseReasons.remove(reason) }
    syncPause()
  }

  private func syncPause() {
    guard ready else { return }
    let want = !pauseReasons.isEmpty
    guard want != jsPaused else { return }
    jsPaused = want
    host.call(want ? "garden.pause(); 0" : "garden.resume(); 0")
    log(want ? "paused (\(pauseReasons.sorted().joined(separator: ",")))" : "resumed")
  }

  // MARK: status

  private func writeStatus() {
    let front = NSWorkspace.shared.frontmostApplication
    let lines = [
      "mode=\(mode.rawValue) ready=\(ready) paused=\(jsPaused) reasons=[\(pauseReasons.sorted().joined(separator: ","))]",
      "window: \(window.statusLine) visible=\(window.occlusionState.contains(.visible))",
      "app: active=\(NSApp.isActive) policy=\(NSApp.activationPolicy().rawValue) frontmost=\(front?.bundleIdentifier ?? "?") pid=\(getpid())",
      "screen: \(Self.screen().map { "\(Int($0.frame.width))x\(Int($0.frame.height)) @\($0.backingScaleFactor)x" } ?? "none") inset=\(Int(GardenWindow.topInset))",
    ]
    try? FileManager.default.createDirectory(at: Control.stateDir, withIntermediateDirectories: true)
    try? (lines.joined(separator: "\n") + "\n").write(to: Control.statusFile, atomically: true, encoding: .utf8)
  }

  // MARK: quitting

  func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    guard ready, !terminating else { return .terminateNow }
    terminating = true
    var done = false
    let finish = { if !done { done = true; NSApp.reply(toApplicationShouldTerminate: true) } }
    host.call("JSON.stringify(garden.saveNow())") { [store] v in
      if let s = v as? String, s != "null", let d = s.data(using: .utf8) { store.write(d); log("saved on quit (\(d.count) bytes)") }
      else { log("quit: nothing to save") }
      finish()
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { if !done { log("quit: save timed out") }; finish() }
    return .terminateLater
  }
}
