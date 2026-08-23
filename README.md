# Truck Save Editor

Save editor for **Euro Truck Simulator 2** and **American Truck Simulator**. It decrypts the
`ScsC` container, decodes the binary `BSII` payload, edits the save through game-aware
operations, and refuses to write anything that would crash the game.

![tests](https://img.shields.io/badge/vitest-21%20passing-brightgreen)
![lint](https://img.shields.io/badge/oxlint-clean-brightgreen)
![node](https://img.shields.io/badge/node-24-blue)

## Why another one

Every write goes through a validator built from real crash data. When a garage is bought, its
vehicle and driver slot arrays are resized with it - the game indexes `drivers[0]` when a garage
screen opens and dies on an empty array:

```
arrays_base_impl.h(573): array_t<link_ptr_t<driver_u>>::operator[]:
Index outside array boundaries: 0 >= 0
```

The editor now makes that state unrepresentable, and the same check refuses double-booked trucks,
orphaned unit pointers and mismatched parallel arrays.

## Features

| Area | What it does |
| --- | --- |
| Career | money, experience, all driving skills and every ADR class |
| Garages | buy or upgrade every garage (tiny/small/large) with correct slot counts |
| Fleet | park a mint truck in every garage and hire a driver for it, cloned from your own dealer stock so every part exists in your DLC set |
| Map | visit every city, unlock all dealers and recruitment agencies, merge discovered roads from a donor save |
| Vehicles | repair including permanent wear, refuel, reset odometers |
| Units | search all ~28 000 units and edit single fields with a diff preview |
| Doctor | timestamped backups with one-click restore, plus `game.log.txt` triage |

Saves are written as plain `SiiNunit` text, which both games load regardless of the
`g_save_format` setting - no re-encryption, no HMAC risk.

## Install and run

Desktop app (native window, native folder picker):

```bash
pnpm install
pnpm desktop        # dev: Tauri window + Vite HMR
pnpm desktop:build  # installer in packages/desktop/src-tauri/target/release/bundle/nsis
```

Browser mode, same features without Tauri:

```bash
pnpm build          # turbo: core -> cli -> server -> web
pnpm app            # http://127.0.0.1:7311
```

Other tasks:

```bash
pnpm test           # vitest, 21 tests across core and server
pnpm typecheck      # tsc across every package
pnpm lint           # oxlint
pnpm dev:web        # Vite with HMR against a running server
pnpm package        # release/truck-save-editor.exe (UI embedded, single file)
```

Every [release](../../releases) ships two Windows executables: the **desktop installer**
(~27 MB, native window) and the **portable** build (~95 MB, serves the UI on localhost). Neither
needs Node installed.

On first start the app asks for the game folder - the one holding `profiles` and
`steam_profiles`. Detected locations are offered as one-click cards, or pick any folder with the
native browser; the choice is remembered in the app config directory and can be changed from the
header at any time.

## CLI

```bash
node packages/cli/dist/cli.js profiles
node packages/cli/dist/cli.js info  "<save slot>"
node packages/cli/dist/cli.js check "<save slot>"
node packages/cli/dist/cli.js edit  "<save slot>" --money 1000000000 --max-skills --garages \
    --repair --refuel --visit-all-cities --staff-garages
node packages/cli/dist/cli.js decode "<file>" out.txt
```

## Layout

```
packages/core     ScsC crypto, BSII v1-3 decoder, SiiNunit model, edit operations, validator
packages/cli      command line front end
packages/server   local HTTP API, profile discovery, backups, log triage, exe packaging
packages/web      React + Tailwind + shadcn/ui interface
packages/desktop  Tauri v2 shell: native window, folder picker, sidecar lifecycle
```

The desktop app is a Tauri shell (4.7 MB) that spawns the compiled server as a sidecar on a
random free port and loads the same interface in a native webview. The editing core stays in
TypeScript, so the decoder verified against real saves is the one that ships.

## Safety

- Edits can be written to a **new save slot**, leaving the original untouched.
- Overwriting a slot first copies the current save into `<slot>/backups/`.
- Nothing is written while the validator reports a problem.
- The header warns when the game is running, because it overwrites saves on exit.

Tested against a real 1.61 profile: 45 profile and save files decode and round-trip byte for byte,
and the decoder matches the reference file published with `SII_Decrypt`.

## Format notes

- `ScsC`: AES-256-CBC (fixed key) + zlib; the HMAC field is not verified by the game.
- `BSII` v1-3: structure blocks define fields, data blocks carry values; 34 value types.
- Tokens are base-38 identifiers packed into 63 bits; ids print as `_nameless.a.bbbb.cccc`.
- `economy.discovered_items` holds map-item ids that live in the game's map files, so full road
  discovery can only be merged from another save.

## Credits

Format documentation from [TheLazyTomcat/SII_Decrypt](https://github.com/TheLazyTomcat/SII_Decrypt);
garage capacities cross-checked against [LIPtoH/TS-SE-Tool](https://github.com/LIPtoH/TS-SE-Tool).
