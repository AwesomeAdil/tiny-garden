import AppKit
import WebKit

/// Serves web/ at garden://app/… so index.html's relative ES module imports load
/// with real MIME types and one origin.
final class SchemeHandler: NSObject, WKURLSchemeHandler {
  let root: URL
  init(root: URL) { self.root = root.standardizedFileURL }

  static func mime(_ ext: String) -> String {
    switch ext.lowercased() {
    case "html", "htm": return "text/html"
    case "js", "mjs": return "text/javascript"
    case "css": return "text/css"
    case "json": return "application/json"
    case "png": return "image/png"
    case "svg": return "image/svg+xml"
    case "woff2": return "font/woff2"
    default: return "application/octet-stream"
    }
  }

  /// The file a garden://app URL names, or nil when it is any other host or lies outside web/.
  static func resolve(_ url: URL, root: URL) -> URL? {
    guard url.scheme == "garden", url.host == "app" else { return nil }
    let base = root.standardizedFileURL
    var p = url.path
    if p.isEmpty || p == "/" { p = "/index.html" }
    let f = base.appendingPathComponent(String(p.dropFirst())).standardizedFileURL
    return f.path.hasPrefix(base.path + "/") ? f : nil
  }

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url else { return }
    guard let f = Self.resolve(url, root: root), let data = try? Data(contentsOf: f) else {
      log("web: 404 \(url.absoluteString)")
      let r = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "text/plain"])!
      task.didReceive(r); task.didReceive(Data()); task.didFinish()
      return
    }
    let headers = ["Content-Type": Self.mime(f.pathExtension), "Content-Length": String(data.count), "Cache-Control": "no-store"]
    task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
    task.didReceive(data)
    task.didFinish()
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

/// The web view, the `garden` message handler, and calls into `window.garden`.
final class WebHost: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
  let webView: WKWebView
  /// Each JS -> Swift message body, e.g. ["type": "save", "save": {...}].
  var onMessage: (([String: Any]) -> Void)?
  private var url: URL!

  /// web/ inside the app bundle; for `swift run` from the repo, ./web (or $TINY_GARDEN_WEB).
  static func webRoot() -> URL {
    let fm = FileManager.default
    if let r = Bundle.main.resourceURL?.appendingPathComponent("web"), fm.fileExists(atPath: r.appendingPathComponent("index.html").path) { return r }
    if let e = ProcessInfo.processInfo.environment["TINY_GARDEN_WEB"] { return URL(fileURLWithPath: e, isDirectory: true) }
    return URL(fileURLWithPath: fm.currentDirectoryPath).appendingPathComponent("web", isDirectory: true)
  }

  init(root: URL) {
    let cfg = WKWebViewConfiguration()
    cfg.setURLSchemeHandler(SchemeHandler(root: root), forURLScheme: "garden")
    cfg.suppressesIncrementalRendering = true
    webView = WKWebView(frame: .zero, configuration: cfg)
    super.init()
    cfg.userContentController.add(self, name: "garden")
    webView.navigationDelegate = self
    webView.allowsMagnification = false
    webView.allowsBackForwardNavigationGestures = false
    webView.allowsLinkPreview = false
    webView.underPageBackgroundColor = GardenWindow.background
    webView.autoresizingMask = [.width, .height]
    log("web root \(root.path)")
  }

  func load(skip: Bool) {
    url = URL(string: "garden://app/index.html" + (skip ? "?skip=1" : ""))!
    webView.load(URLRequest(url: url))
  }

  /// Runs a script; the completion gets its value (nil on error, which is logged).
  func call(_ js: String, _ done: ((Any?) -> Void)? = nil) {
    webView.evaluateJavaScript(js) { v, err in
      if let err = err { log("js error in \(js.prefix(60)): \(err.localizedDescription)") }
      done?(err == nil ? v : nil)
    }
  }

  /// A Swift string as a JS string literal.
  static func literal(_ s: String) -> String {
    String(data: (try? JSONEncoder().encode(s)) ?? Data("\"\"".utf8), encoding: .utf8) ?? "\"\""
  }

  func userContentController(_ u: WKUserContentController, didReceive m: WKScriptMessage) {
    guard let body = m.body as? [String: Any] else { log("web: odd message \(m.body)"); return }
    onMessage?(body)
  }

  // Only our own pages load in this view.
  func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    decisionHandler(a.request.url?.scheme == "garden" ? .allow : .cancel)
  }

  func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) {
    log("web: load failed: \(e.localizedDescription)")
  }

  // MARK: crashes

  /// Crash times since the last toggle, a pending reload, and whether reloading has stopped.
  private var crashes: [Date] = []
  private var reload: DispatchWorkItem?
  private(set) var halted = false
  /// Called once reloading stops (3 crashes in 5 minutes), so the app can drop back to wallpaper.
  var onHalt: (() -> Void)?
  /// The last frame known to be good, shown over a dead page.
  private var lastGood: NSImage?
  private var cover: NSImageView?

  /// What to do after a crash, given the crash times so far (including this one): reload after 1, 5, then 30 s,
  /// or nil to stop once 3 of them fall within 5 minutes.
  static func crashDelay(_ times: [Date], now: Date) -> TimeInterval? {
    if times.filter({ now.timeIntervalSince($0) <= 300 }).count >= 3 { return nil }
    return [1, 5, 30][min(max(times.count - 1, 0), 2)]
  }

  /// A crashed page reloads, with back-off, and boots again from the last save.
  func webViewWebContentProcessDidTerminate(_ w: WKWebView) {
    let now = Date()
    crashes.append(now)
    reload?.cancel(); reload = nil
    guard let delay = Self.crashDelay(crashes, now: now) else {
      log("web: content process ended \(crashes.count) times, 3 within 5 minutes: not reloading until the next toggle")
      halted = true; showCover(); onHalt?(); return
    }
    log("web: content process ended, reloading in \(Int(delay)) s")
    let item = DispatchWorkItem { [weak self] in guard let self, !self.halted else { return }; self.reload = nil; self.webView.load(URLRequest(url: self.url)) }
    reload = item
    DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: item)
  }

  /// A toggle starts over: the crash count clears, and a halted page reloads.
  func clearCrashes() {
    crashes.removeAll()
    guard halted else { return }
    halted = false; cover?.removeFromSuperview(); cover = nil
    log("web: reloading after a halt")
    webView.load(URLRequest(url: url))
  }

  /// Keeps a copy of what is on screen now (called now and then while the page is healthy).
  func keepFrame() {
    guard !halted, webView.bounds.width > 0 else { return }
    webView.takeSnapshot(with: nil) { [weak self] img, _ in if let img { self?.lastGood = img } }
  }

  private func showCover() {
    guard let img = lastGood, cover == nil else { return }
    let v = NSImageView(frame: webView.bounds)
    v.image = img; v.imageScaling = .scaleAxesIndependently; v.autoresizingMask = [.width, .height]
    webView.addSubview(v); cover = v
  }
}
