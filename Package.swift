// swift-tools-version:6.0
import PackageDescription

// Swift 5 language mode: AppKit/WebKit callbacks all run on the main thread,
// and strict Swift 6 isolation checking would only add annotations, not safety.
let package = Package(
  name: "tiny-garden",
  platforms: [.macOS(.v14)],
  targets: [
    .executableTarget(
      name: "tiny-garden",
      path: "Sources/TinyGarden",
      swiftSettings: [.swiftLanguageMode(.v5)]
    )
  ]
)
