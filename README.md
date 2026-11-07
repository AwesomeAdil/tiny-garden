# Tiny Garden

A pixel-art world that lives on your macOS desktop as a live wallpaper, and turns into a playable game on one key.

![The solar system as a wallpaper](docs/img/wallpaper-system.png)

## The four views

| 1 City | 2 System | 3 Galaxy | 4 Close |
| --- | --- | --- | --- |
| ![city](docs/img/city.png) | ![system](docs/img/system.png) | ![galaxy](docs/img/galaxy.png) | ![close](docs/img/closeup.png) |

## Modes

- **Wallpaper**: the world runs behind your windows. Clicks pass through.
- **Play**: the garden takes the keyboard and mouse. Build, connect and grow.

## Keys

| Key | Does |
| --- | --- |
| Option+E | toggle wallpaper and play (bound in skhd) |
| Esc | back out of the current thing; leaves play mode |
| M / R / C | move, rope, cut tools |
| S | shop |
| 1 2 3 4 | city, system, galaxy, close view |
| Tab | next view |
| N | show or hide names (remembered) |

## Build and install

Needs macOS 14+ and the Xcode Command Line Tools.

```
scripts/install
```

This builds, assembles `~/Applications/Tiny Garden.app`, links `~/.local/bin/tiny-garden`, and loads the LaunchAgent `local.tiny-garden` so it runs at login.

## CLI

```
tiny-garden toggle   # wallpaper <-> play
tiny-garden quit     # save and exit
tiny-garden status   # mode, window and screen details
```

## Uninstall

```
tiny-garden quit
launchctl bootout gui/$UID/local.tiny-garden
rm -rf ~/Applications/Tiny\ Garden.app ~/Library/LaunchAgents/local.tiny-garden.plist ~/.local/bin/tiny-garden
```

## Saves

`~/Library/Application Support/tiny-garden/`: `save.json` (live), `save.prev.json` (the map before "New map"), `save.bad-YYYYMMDD-HHMMSS.json` (each unreadable save, kept).

## Tests

```
npm test
```

## Contributing art

Read [docs/ART.md](docs/ART.md) first. The look is guarded. See also [docs/design.md](docs/design.md) and [docs/plan.md](docs/plan.md).

MIT licensed.
