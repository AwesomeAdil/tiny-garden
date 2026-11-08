import Foundation

/// The save file and its side files, all in one directory: save.json (live), save.prev.json (the map before
/// "New map"), save.v1.json (a v1 save set aside; a later one gets save.v1-YYYYMMDD-HHMMSS.json), and
/// save.bad-YYYYMMDD-HHMMSS.json (each save that could not be read, kept, never overwritten), and save.dev.json
/// (developer mode's sandbox: only ever loaded and written with `dev: true`; nothing else touches it, and nothing
/// with `dev: true` touches save.json).
struct SaveStore {
  let dir: URL

  static var defaultDir: URL {
    FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Application Support/tiny-garden", isDirectory: true)
  }

  var file: URL { dir.appendingPathComponent("save.json") }
  var prevFile: URL { dir.appendingPathComponent("save.prev.json") }
  var v1File: URL { dir.appendingPathComponent("save.v1.json") }
  var devFile: URL { dir.appendingPathComponent("save.dev.json") }

  /// The file a load or write goes to: the sandbox in developer mode, the real save otherwise.
  func target(dev: Bool) -> URL { dev ? devFile : file }

  /// What load() found: no save yet, a save's bytes, or a save.json that exists but can't be read.
  enum Loaded: Equatable { case none, data(Data), unreadable }

  func load(dev: Bool = false) -> Loaded {
    let file = target(dev: dev)
    guard FileManager.default.fileExists(atPath: file.path) else { return .none }
    do { return .data(try Data(contentsOf: file)) } catch {
      log("save: cannot read \(file.lastPathComponent): \(error.localizedDescription)")
      return .unreadable
    }
  }

  /// Atomic: the old save stays whole until the new one is fully on disk.
  @discardableResult
  func write(_ data: Data, dev: Bool = false) -> Bool {
    let file = target(dev: dev)
    do {
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      try data.write(to: file, options: .atomic)
      return true
    } catch {
      log("save: write failed: \(error.localizedDescription)")
      return false
    }
  }

  /// New map: keep the old city as save.prev.json, replacing the one before in a single step.
  @discardableResult
  func archive() -> Bool {
    let fm = FileManager.default
    guard fm.fileExists(atPath: file.path) else { return false }
    do {
      if fm.fileExists(atPath: prevFile.path) { _ = try fm.replaceItemAt(prevFile, withItemAt: file) }
      else { try fm.moveItem(at: file, to: prevFile) }
      log("save: \(file.lastPathComponent) -> \(prevFile.lastPathComponent)")
      return true
    } catch {
      log("save: archive failed: \(error.localizedDescription)")
      return false
    }
  }

  /// A v1 save is a different game: keep it as save.v1.json so a new game can start. An existing save.v1.json is
  /// never overwritten: a later v1 save goes to save.v1-YYYYMMDD-HHMMSS.json instead.
  @discardableResult
  func keepV1(now: Date = Date()) -> Bool {
    let fm = FileManager.default
    guard fm.fileExists(atPath: file.path) else { return false }
    var dest = v1File
    if fm.fileExists(atPath: dest.path) {
      let stem = "save.v1-" + Self.stamp.string(from: now)
      dest = dir.appendingPathComponent(stem + ".json")
      var k = 2
      while fm.fileExists(atPath: dest.path) { dest = dir.appendingPathComponent("\(stem)-\(k).json"); k += 1 }
    }
    do {
      try fm.moveItem(at: file, to: dest)
      log("save: \(file.lastPathComponent) -> \(dest.lastPathComponent)")
      return true
    } catch {
      log("save: keepV1 failed: \(error.localizedDescription)")
      return false
    }
  }

  /// Unreadable save: set it aside under a new timestamped name so a new game can start. Returns where it went.
  @discardableResult
  func quarantine(now: Date = Date()) -> URL? {
    let fm = FileManager.default
    guard fm.fileExists(atPath: file.path) else { return nil }
    let stem = "save.bad-" + Self.stamp.string(from: now)
    var dest = dir.appendingPathComponent(stem + ".json"), k = 2
    while fm.fileExists(atPath: dest.path) { dest = dir.appendingPathComponent("\(stem)-\(k).json"); k += 1 }
    do {
      try fm.moveItem(at: file, to: dest)
      log("save: \(file.lastPathComponent) -> \(dest.lastPathComponent)")
      return dest
    } catch {
      log("save: quarantine failed: \(error.localizedDescription)")
      return nil
    }
  }

  /// Quarantined saves, oldest first.
  func badFiles() -> [URL] {
    let names = (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
    return names.filter { $0.hasPrefix("save.bad-") && $0.hasSuffix(".json") }.sorted().map { dir.appendingPathComponent($0) }
  }

  private static let stamp: DateFormatter = {
    let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyyMMdd-HHmmss"; return f
  }()
}
