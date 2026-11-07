import AppKit

/// The command line: `tiny-garden [toggle|quit|status|selftest]`, the notification names
/// the running app listens for, logging, and the selftest.
enum Control {
  static let bundleID = "local.tiny-garden"
  static let toggleNote = "local.tiny-garden.toggle"
  static let quitNote = "local.tiny-garden.quit"
  static let statusNote = "local.tiny-garden.status"

  static var stateDir: URL {
    FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".local/state/tiny-garden", isDirectory: true)
  }
  static var statusFile: URL { stateDir.appendingPathComponent("status") }

  /// Runs a subcommand and returns its exit code, or nil when `cmd` is not one.
  static func run(_ cmd: String) -> Int32? {
    switch cmd {
    case "toggle":
      if runningPIDs().isEmpty {
        log("toggle: not running, launching into play")
        return launch(["open", "-b", bundleID, "--args", "--play"])
      }
      post(toggleNote); return 0
    case "quit":
      post(quitNote); return 0
    case "status":
      return status()
    case "selftest":
      return selftest()
    case "help", "-h", "--help":
      print("usage: tiny-garden [--play] [--skip] | toggle | quit | status | selftest"); return 0
    default:
      return nil
    }
  }

  static func post(_ name: String) {
    DistributedNotificationCenter.default().postNotificationName(
      Notification.Name(name), object: nil, userInfo: nil, deliverImmediately: true)
  }

  /// Running copies of the app, not counting this process.
  static func others() -> [NSRunningApplication] {
    let me = ProcessInfo.processInfo.processIdentifier
    return NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).filter { $0.processIdentifier != me }
  }

  /// Pids of the running app. LaunchServices can briefly miss a running app, so a process-name match backs it up.
  static func runningPIDs() -> [pid_t] {
    let me = ProcessInfo.processInfo.processIdentifier
    var pids = Set(others().map(\.processIdentifier))
    let p = Process(), out = Pipe()
    p.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep"); p.arguments = ["-x", "tiny-garden"]; p.standardOutput = out
    if (try? p.run()) != nil {
      p.waitUntilExit()
      let text = String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
      for line in text.split(separator: "\n") { if let v = pid_t(line), v != me { pids.insert(v) } }
    }
    return pids.sorted()
  }

  private static func launch(_ argv: [String]) -> Int32 {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    p.arguments = argv
    do { try p.run(); p.waitUntilExit(); return p.terminationStatus } catch { log("launch failed: \(error)"); return 1 }
  }

  /// Asks the running app to write its window state, then prints it with the window server's view.
  private static func status() -> Int32 {
    let running = runningPIDs()
    guard !running.isEmpty else { print("not running"); return 1 }
    try? FileManager.default.removeItem(at: statusFile)
    post(statusNote)
    for _ in 0..<40 where !FileManager.default.fileExists(atPath: statusFile.path) { usleep(50_000) }
    print((try? String(contentsOf: statusFile, encoding: .utf8)) ?? "app did not answer", terminator: "")
    let pids = Set(running.map { Int($0) })
    let list = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
    for w in list where pids.contains(w[kCGWindowOwnerPID as String] as? Int ?? -1) {
      let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
      print("windowserver: pid=\(w[kCGWindowOwnerPID as String] ?? "?") layer=\(w[kCGWindowLayer as String] ?? "?") onscreen=\(w[kCGWindowIsOnscreen as String] ?? false) bounds=\(b["X"] ?? 0),\(b["Y"] ?? 0) \(b["Width"] ?? 0)x\(b["Height"] ?? 0)")
    }
    print("desktopWindow level=\(CGWindowLevelForKey(.desktopWindow)) floating=\(NSWindow.Level.floating.rawValue)")
    return 0
  }

  // MARK: selftest

  static func selftest() -> Int32 {
    var failures: [String] = []
    func check(_ ok: Bool, _ what: String) { if !ok { failures.append(what) } }

    let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("tiny-garden-selftest-\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: tmp) }
    let store = SaveStore(dir: tmp)
    let a = Data(#"{"v":1,"seed":42}"#.utf8), b = Data(#"{"v":1,"seed":7}"#.utf8)

    check(store.load() == nil, "load with no file is nil")
    check(store.write(a), "write creates the directory and file")
    check(store.load() == a, "load returns what was written")
    check(store.write(b) && store.load() == b, "write replaces the save")
    check(store.archive(), "archive moves the save")
    check(store.load() == nil, "after archive there is no live save")
    check((try? Data(contentsOf: store.prevFile)) == b, "save.prev.json holds the old save")
    check(store.write(a) && store.archive() && (try? Data(contentsOf: store.prevFile)) == a, "a second archive replaces save.prev.json")
    let junk = Data("garbage\n".utf8)
    check(store.write(junk), "write garbage")
    check(store.quarantine(), "quarantine moves the save")
    check(store.load() == nil, "after quarantine there is no live save")
    check((try? Data(contentsOf: store.badFile)) == junk, "save.bad.json holds the garbage")
    check(!store.archive() && !store.quarantine(), "archive/quarantine with no save do nothing")

    // Play frame: the main screen minus the top inset; wallpaper is the whole screen.
    let screen = NSRect(x: 0, y: 0, width: 1512, height: 982)
    check(GardenWindow.frame(.wallpaper, screen: screen, inset: 38) == screen, "wallpaper frame is the screen")
    check(GardenWindow.frame(.play, screen: screen, inset: 38) == NSRect(x: 0, y: 0, width: 1512, height: 944), "play frame drops the top 38 pt")
    let side = NSRect(x: 1512, y: -200, width: 1920, height: 1080)
    check(GardenWindow.frame(.play, screen: side, inset: 38) == NSRect(x: 1512, y: -200, width: 1920, height: 1042), "play frame keeps the screen origin")

    // TINY_GARDEN_TOP_INSET: only finite, non-negative numbers.
    check(GardenWindow.inset(nil) == 38 && GardenWindow.inset("24") == 24 && GardenWindow.inset("0") == 0, "inset parses")
    check(["inf", "-inf", "nan", "-3", "x", ""].allSatisfy { GardenWindow.inset($0) == 38 }, "inset ignores inf, nan, negatives and junk")

    // Scheme handler: paths resolve inside web/, never outside it; module MIME types.
    let root = URL(fileURLWithPath: "/tmp/web", isDirectory: true)
    check(SchemeHandler.resolve(URL(string: "garden://app/js/main.js")!, root: root)?.path == "/tmp/web/js/main.js", "resolve a module path")
    check(SchemeHandler.resolve(URL(string: "garden://app/index.html?skip=1")!, root: root)?.path == "/tmp/web/index.html", "query is ignored")
    check(SchemeHandler.resolve(URL(string: "garden://app/")!, root: root)?.path == "/tmp/web/index.html", "root is index.html")
    check(SchemeHandler.resolve(URL(string: "garden://app/../secret")!, root: root) == nil, "no escaping web/")
    check(SchemeHandler.resolve(URL(string: "garden://app/js/%2E%2E/%2E%2E/x")!, root: root) == nil, "no escaping web/ with escapes")
    check(SchemeHandler.resolve(URL(string: "garden://other/index.html")!, root: root) == nil, "only the app host")
    check(SchemeHandler.mime("js") == "text/javascript", "js MIME")
    check(SchemeHandler.mime("css") == "text/css", "css MIME")
    check(SchemeHandler.mime("html") == "text/html", "html MIME")
    check(SchemeHandler.mime("png") == "image/png", "png MIME")

    if failures.isEmpty { print("selftest ok"); return 0 }
    for f in failures { print("FAIL: \(f)") }
    return 1
  }
}

private let stamp: DateFormatter = {
  let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd HH:mm:ss"; return f
}()

/// One line to stderr (the LaunchAgent sends it to ~/.local/state/tiny-garden/log).
func log(_ s: String) {
  FileHandle.standardError.write(Data("\(stamp.string(from: Date())) tiny-garden[\(getpid())] \(s)\n".utf8))
}
