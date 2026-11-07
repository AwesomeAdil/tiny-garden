import Foundation

/// The save file and its two side files, all in one directory:
/// save.json (live), save.prev.json (the map before "New map"), save.bad.json (an unreadable save).
struct SaveStore {
  let dir: URL

  static var defaultDir: URL {
    FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Application Support/tiny-garden", isDirectory: true)
  }

  var file: URL { dir.appendingPathComponent("save.json") }
  var prevFile: URL { dir.appendingPathComponent("save.prev.json") }
  var badFile: URL { dir.appendingPathComponent("save.bad.json") }

  func load() -> Data? { try? Data(contentsOf: file) }

  /// Atomic: the old save stays whole until the new one is fully on disk.
  @discardableResult
  func write(_ data: Data) -> Bool {
    do {
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      try data.write(to: file, options: .atomic)
      return true
    } catch {
      log("save: write failed: \(error.localizedDescription)")
      return false
    }
  }

  /// New map: keep the old city as save.prev.json.
  @discardableResult
  func archive() -> Bool { move(to: prevFile) }

  /// Unreadable save: set it aside as save.bad.json so a new game can start.
  @discardableResult
  func quarantine() -> Bool { move(to: badFile) }

  private func move(to dest: URL) -> Bool {
    let fm = FileManager.default
    guard fm.fileExists(atPath: file.path) else { return false }
    do {
      if fm.fileExists(atPath: dest.path) { try fm.removeItem(at: dest) }
      try fm.moveItem(at: file, to: dest)
      log("save: \(file.lastPathComponent) -> \(dest.lastPathComponent)")
      return true
    } catch {
      log("save: move to \(dest.lastPathComponent) failed: \(error.localizedDescription)")
      return false
    }
  }
}
