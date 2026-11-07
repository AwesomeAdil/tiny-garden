import AppKit

enum Mode: String { case wallpaper, play }

/// One borderless window that is either the desktop picture (wallpaper) or a raised,
/// clickable game screen (play). It can only become key in play mode.
final class GardenWindow: NSWindow {
  private(set) var mode: Mode = .wallpaper
  static let background = NSColor(srgbRed: 0x14 / 255.0, green: 0x15 / 255.0, blue: 0x1f / 255.0, alpha: 1)

  /// Points kept clear at the top in play mode (sketchybar's height).
  static var topInset: CGFloat {
    if let s = ProcessInfo.processInfo.environment["TINY_GARDEN_TOP_INSET"], let v = Double(s), v >= 0 { return CGFloat(v) }
    return 38
  }

  init(screen: NSScreen) {
    super.init(contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    isReleasedWhenClosed = false
    hasShadow = false
    isOpaque = true
    backgroundColor = Self.background
    animationBehavior = .none
    isMovable = false
  }

  override var canBecomeKey: Bool { mode == .play }
  override var canBecomeMain: Bool { mode == .play }

  /// Cocoa frames grow upward, so dropping the top inset only shortens the height.
  static func frame(_ mode: Mode, screen: NSRect, inset: CGFloat) -> NSRect {
    guard mode == .play else { return screen }
    return NSRect(x: screen.minX, y: screen.minY, width: screen.width, height: max(0, screen.height - inset))
  }

  /// `activate` raises and focuses the play window; a screen change re-applies only the frame and level.
  func apply(_ mode: Mode, screen: NSScreen, activate: Bool = true) {
    self.mode = mode
    let f = Self.frame(mode, screen: screen.frame, inset: Self.topInset)
    switch mode {
    case .wallpaper:
      level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
      ignoresMouseEvents = true
      collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
      setFrame(f, display: true)
      orderFrontRegardless()
    case .play:
      level = .floating
      ignoresMouseEvents = false
      collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
      setFrame(f, display: true)
      if activate { makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) } else { orderFrontRegardless() }
    }
    log("mode \(mode.rawValue): \(statusLine)")
  }

  var statusLine: String {
    let cb = collectionBehavior
    let names: [(NSWindow.CollectionBehavior, String)] = [
      (.canJoinAllSpaces, "canJoinAllSpaces"), (.stationary, "stationary"), (.ignoresCycle, "ignoresCycle"),
      (.fullScreenAuxiliary, "fullScreenAuxiliary"), (.moveToActiveSpace, "moveToActiveSpace"), (.managed, "managed"),
    ]
    let f = frame
    return "level=\(level.rawValue) ignoresMouseEvents=\(ignoresMouseEvents) behavior=[\(names.filter { cb.contains($0.0) }.map(\.1).joined(separator: ","))] frame=\(Int(f.minX)),\(Int(f.minY)) \(Int(f.width))x\(Int(f.height)) key=\(isKeyWindow)"
  }
}
