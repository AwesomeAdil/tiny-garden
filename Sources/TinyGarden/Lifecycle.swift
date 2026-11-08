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
  private var saves = 0
  /// Developer mode: the page is running the sandbox (save.dev.json). Saves are routed by each message's own
  /// dev flag, not by this, so a late sandbox save can never land in save.json.
  private(set) var dev = false
  /// `tiny-garden dev` launched us: turn developer mode on after the first boot.
  private var devAtStart: Bool

  init(window: GardenWindow, host: WebHost, store: SaveStore, startMode: Mode, dev: Bool = false) {
    self.window = window; self.host = host; self.store = store; self.startMode = startMode; self.devAtStart = dev
  }

  /// The main screen: the one with the menu bar, not whichever holds the key window.
  static func screen() -> NSScreen? { NSScreen.screens.first ?? NSScreen.main }

  func start() {
    host.onMessage = { [unowned self] m in self.handle(m) }
    host.onHalt = { [unowned self] in if self.mode == .play { self.enter(.wallpaper, tellJS: false) } }

    let dnc = DistributedNotificationCenter.default()
    dnc.addObserver(forName: Notification.Name(Control.toggleNote), object: nil, queue: .main) { [unowned self] _ in self.toggle() }
    dnc.addObserver(forName: Notification.Name(Control.quitNote), object: nil, queue: .main) { _ in NSApp.terminate(nil) }
    dnc.addObserver(forName: Notification.Name(Control.devNote), object: nil, queue: .main) { [unowned self] _ in self.devOn() }
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

  /// Whether a message comes from developer mode's sandbox (the page adds dev:true to every one).
  static func isDev(_ m: [String: Any]) -> Bool { m["dev"] as? Bool == true }

  /// A save message's object, written to save.dev.json if it says dev:true, else to save.json.
  @discardableResult
  private func persist(_ m: [String: Any]) -> Int? {
    guard let s = m["save"], JSONSerialization.isValidJSONObject(s), let d = try? JSONSerialization.data(withJSONObject: s) else {
      log("save: message without a save object"); return nil
    }
    return store.write(d, dev: Self.isDev(m)) ? d.count : nil
  }

  private func handle(_ m: [String: Any]) {
    let sandbox = Self.isDev(m)
    switch m["type"] as? String {
    case "ready": dev = false; boot()
    case "save":
      persist(m)
      // Every 5 minutes or so (and on the first save), keep a frame to show if the page keeps crashing.
      if saves % 10 == 0 { host.keepFrame() }
      saves += 1
    case "exit": enter(.wallpaper)
    // The sandbox never archives, quarantines or sets aside anything: an unreadable save.dev.json just becomes a
    // fresh sandbox, overwritten by its next save.
    case "bad-save" where sandbox: log("dev: save.dev.json unreadable, starting a fresh sandbox")
    case "old-save" where sandbox: log("dev: save.dev.json is not a v2 save, starting a fresh sandbox")
    case "new-map" where sandbox: log("dev: new sandbox")
    case "bad-save": log("js says the save is unreadable"); store.quarantine()
    case "new-map": store.archive()
    case "old-save": log("js says the save is v1: setting it aside (save.v1.json, or a stamped copy if that exists)"); store.keepV1()
    case "dev":
      if m["on"] as? Bool == true {
        guard mode == .play else { log("dev: asked outside play mode, ignored"); return }
        dev = true; bootDev()
      } else if dev { dev = false; log("dev: off, the real garden is back") }
    case "log": log("web: \((m["msg"] as? String ?? "?").prefix(500))")
    case let t: log("web: unknown message \(t ?? "nil")")
    }
  }

  private func boot() {
    let first = !ready
    ready = true; jsPaused = false
    // Not valid JSON at all: set it aside here; JS reports saves it cannot read as bad-save.
    // A save.json that exists but can't be read is set aside too, never mistaken for "no save" and overwritten.
    var saveJS = "null"
    switch store.load() {
    case .none: break
    case .unreadable: log("save: unreadable, quarantining"); store.quarantine()
    case .data(let d):
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
    if first, devAtStart { devAtStart = false; devOn() }
  }

  /// The sandbox, after the page asked for it ({type:'dev', on:true}, having saved the real game first).
  /// A missing, unreadable or non-JSON save.dev.json is a fresh sandbox; it is never quarantined.
  private func bootDev() {
    var saveJS = "null"
    if case .data(let d) = store.load(dev: true), (try? JSONSerialization.jsonObject(with: d)) is [String: Any], let text = String(data: d, encoding: .utf8) {
      saveJS = "JSON.parse(\(WebHost.literal(text)))"
    }
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    host.call("garden.boot(\(saveJS), 'play', \(now), { topInset: \(Double(GardenWindow.topInset)), dev: true }); 0")
    log("dev: sandbox booted (save.dev.json: \(saveJS == "null" ? "none, fresh" : "loaded"))")
  }

  /// `tiny-garden dev`: play mode, then developer mode on (the page saves the real game and asks for the sandbox).
  func devOn() {
    guard ready else { devAtStart = true; return }
    host.clearCrashes()
    if mode != .play { enter(.play) }
    host.call("garden.dev(true); 0")
  }

  // MARK: modes

  func toggle() {
    host.clearCrashes()
    enter(mode == .play ? .wallpaper : .play)
  }

  func enter(_ m: Mode, tellJS: Bool = true, restore: Bool = true) {
    guard let s = Self.screen() else { return }
    if m == .play, mode != .play {
      let front = NSWorkspace.shared.frontmostApplication
      previous = front?.processIdentifier == getpid() ? nil : front
    }
    mode = m
    // The wallpaper is always the real garden: the page leaves developer mode as it switches (garden.setMode).
    if m == .wallpaper { dev = false }
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
      "mode=\(mode.rawValue)\(dev ? " dev=on" : "") ready=\(ready) paused=\(jsPaused) reasons=[\(pauseReasons.sorted().joined(separator: ","))]\(host.halted ? " web=halted" : "")",
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
    // The page's save message, so the sandbox goes to save.dev.json on quit too (the real game was saved when
    // developer mode began).
    host.call("JSON.stringify(garden.saveMsg())") { [unowned self] v in
      if let s = v as? String, let d = s.data(using: .utf8), let m = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any], let n = self.persist(m) {
        log("saved on quit (\(n) bytes\(Self.isDev(m) ? ", save.dev.json" : ""))")
      } else { log("quit: nothing to save") }
      finish()
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { if !done { log("quit: save timed out") }; finish() }
    return .terminateLater
  }
}
