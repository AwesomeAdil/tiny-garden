# Tiny Garden

A pixel-art world that lives on your macOS desktop as a live wallpaper, and turns into a playable game on one key.

![The city as a wallpaper: TIDE's islands and bridges over its horizon, under the Milky band](docs/img/wallpaper-city.png)

## The four views

| 1 City (play) | 2 System (wallpaper) | 3 Galaxy (wallpaper) | 4 Close (play) |
| --- | --- | --- | --- |
| ![The city in play mode, with the dock, the guide line and the side panel](docs/img/city.png) | ![The solar system wallpaper: the sun and its planets on their orbits, TIDE in front](docs/img/system.png) | ![The galaxy wallpaper: the home galaxy's disc around its black hole](docs/img/galaxy.png) | ![The close-up in play mode: HOME at stage 3 over TIDE at dawn](docs/img/closeup.png) |

All shots are 1512×944, from `scripts/shot.mjs` (more in `shots/v2/`).

## Modes

- **Wallpaper**: the world runs behind your windows. Clicks pass through.
- **Play**: the garden takes the keyboard and mouse. Build, connect and grow.

## How v2 plays

- **Three goods: water, light and stone.** Each island makes one of them, from its type (HOME and ANVIL stone,
  EMBER and AMETHYST light, FROST and VERDANT water). An island grows by receiving the two it doesn't make. Goods
  are used the moment they arrive: you only ever see them as the backpack colour of the little astronaut carrying
  them, never lying on an island.
- **Bridges** are free. Each one lands at a pier with a lantern post; an island starts with 2 piers and gains more
  as it grows, and the town has 4. A bridge can only span the island's reach (hovering an island shows it). Walkers
  carry a good toward the nearest island that needs it, and an island on the way takes its share first. An island
  only makes its good while someone it can reach still needs it; otherwise its walker rests on its pier.
- **One-way bridges.** Tap a bridge to cycle it through both ways, A to B only and B to A only, to steer a supply
  past an island.
- **Stages, spots and picks.** Four stages: bare rock, grass, a home, full bloom. Each stage up opens 1 or 2 spots
  on the island's top, which glow in play mode. Click one for a card of 2 or 3 picks. A spot next to a pier offers
  picks that suit the good arriving there (a waterfall, lanterns, a stair); middle spots offer homes, trees and
  gardens from the island's type. Some picks make the island send a second good. A pick is kept for good. In
  wallpaper mode an island still grows; its new spots wait for you.
- **Renaming.** Select an island and give it a name in its panel.
- **Events and gifts.** About once every 6 hours a space whale drifts past, a traveller sails in, or an aurora
  fills the sky, in either mode. Each leaves a gift (song coral, a neighbour's hut, sky banners) in a tray of 3;
  place it on an open spot in play mode. Each gift has one small perk.
- **The town** on TIDE's horizon grows in stages too, from all three goods.
- **The cable.** When every TIDE island is at stage 3 or more, deliver all three goods to the town to build the
  cable to CINDER, which then plays the same way with its own islands.
- The guide in play mode teaches each step, and says when a layout leaves an island unable to get a good.

## Keys

| Key | Does |
| --- | --- |
| Option+E | toggle wallpaper and play (bound in skhd) |
| Esc | back out of the current thing; leaves play mode |
| M / R / C | move, bridge, untie tools |
| 1 2 3 4 | city, system, galaxy, close view |
| Tab | next view |
| N | show or hide names (remembered) |
| Option+Shift+D | developer mode on or off (play mode only) |

## Build and install

Needs macOS 14+ and the Xcode Command Line Tools.

```
scripts/install
```

This builds, assembles `~/Applications/Tiny Garden.app`, links `~/.local/bin/tiny-garden`, and loads the LaunchAgent `local.tiny-garden` so it runs at login.

## CLI

```
tiny-garden toggle   # wallpaper <-> play
tiny-garden dev      # play mode with developer mode on
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

`~/Library/Application Support/tiny-garden/`: `save.json` (live), `save.prev.json` (the map before "New map"), `save.v1.json` (a v1 save, set aside when v2 first starts; a later one never overwrites it and goes to `save.v1-YYYYMMDD-HHMMSS.json`), `save.bad-YYYYMMDD-HHMMSS.json` (each unreadable save, kept), `save.dev.json` (developer mode's sandbox).

## Tests and screenshots

```
npm test
node scripts/shot.mjs "seed=7&mode=play&view=planet" shots/city.png 1512,944
```

`scripts/shot.mjs` drives headless Chrome for Testing from Playwright's cache by default; set `CHROME=/path/to/chrome`
to use another Chrome binary.

## Developer mode

For testing the upgrade path without the wait. Option+Shift+D in play mode (or `tiny-garden dev`) saves the real
garden and swaps in a sandbox from `save.dev.json` (a fresh game if there is none), with a red DEV tag in the dock and a
dev strip in the side panel: speed x1/x60/x600, Grow and Fill for the selected island, a whale, traveller or aurora now,
a gift, the next town stage, the cable, Jump (the `?skip=1` state) and New sandbox. While it is on, every save goes to
`save.dev.json` and `save.json` is never written, archived or set aside. Option+Shift+D again, Esc or any switch to
the wallpaper saves the sandbox and brings the real garden back as it was, caught up for the time spent in dev; the
wallpaper always shows the real garden. The sandbox doesn't catch up while it is off. Standalone, `?dev=1` runs it on
an in-memory sandbox, and `devact=grow,grow` (with `n=<island>`) presses dev buttons for shots:
`node scripts/shot.mjs "seed=7&mode=play&dev=1&n=ember&devact=grow,grow" shots/dev.png 1512,944`.

## Contributing art

Read [docs/ART.md](docs/ART.md) first. The look is guarded. v2's design is [docs/v2-design.md](docs/v2-design.md) and its
build plan [docs/v2-plan.md](docs/v2-plan.md). v1's [design](docs/design.md) and [plan](docs/plan.md) are kept as history.

MIT licensed.
