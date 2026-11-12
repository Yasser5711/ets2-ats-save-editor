# Truck Save Editor

Save editor for **Euro Truck Simulator 2** and **American Truck Simulator**. It decrypts the
`ScsC` container, decodes the binary `BSII` payload, edits the save through game-aware
operations, and refuses to write anything that would crash the game.

![tests](https://img.shields.io/badge/vitest-27%20passing-brightgreen)
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
| Career | money, experience, all driving skills and every ADR class; coach experience and the six coach skills of the Coaches DLC |
| Garages | buy or upgrade every garage (tiny/small/large) with correct slot counts |
| Fleet | park a mint truck in every garage and hire a driver for it, cloned from your own dealer stock so every part exists in your DLC set; send hired drivers that sit idle to work |
| Map | discover every road straight from the installed game files, visit every city, unlock all dealers and recruitment agencies, put every company and bus stop on the map |
| Vehicles | repair including permanent wear, refuel, reset odometers |
| Raw data | search all ~28 000 records and edit single values, with the result checked before it is written |
| Backups | a copy of every save that is replaced, restored with one click, plus `game.log.txt` triage |

Saves are written as plain `SiiNunit` text, which both games load regardless of the
`g_save_format` setting - no re-encryption, no HMAC risk.

The interface is in English and French. Everything common is a switch on one page - money, levels,
garages, fleet, map - with what the save has today next to it. A bar at the bottom of the window
lists the pending changes in plain words, says whether the result is safe, and offers the two
ways to write it: as a new save, or over the opened one with a backup.

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
pnpm test           # vitest, 27 tests across core and server
pnpm typecheck      # tsc across every package
pnpm lint           # oxlint
pnpm dev:web        # Vite with HMR against a running server
pnpm package        # release/truck-save-editor.exe: the portable app, one file
```

Every [release](../../releases) ships two Windows executables, and both open the same native
window:

- the **installer** (~30 MB download) puts the app and its server side by side in your user folder;
- the **portable app** (~100 MB) is one file to run from anywhere. It carries the server inside
  and unpacks it once to `%LOCALAPPDATA%\com.yassermekhfi.trucksaveeditor`.

Neither needs Node installed; both use the WebView2 runtime that ships with Windows 10 and 11.

On first start the app asks where your saves are. It scans both places the games use:

- **Documents** - `Documents\Euro Truck Simulator 2`, `Documents\American Truck Simulator`,
  including the OneDrive copies of Documents.
- **Steam Cloud** - `Steam\userdata\<account>\227300\remote` (ETS2) and `...\270880\remote`
  (ATS), found through the Steam path in the registry. American Truck Simulator normally keeps its
  saves here, and only settings in Documents.

Each candidate shows its source, profile count and save count, so a folder with no saves is
greyed out instead of opening empty. Any other folder can be picked by hand; the choice is
remembered in the app config directory and can be changed from the header.

## CLI

```bash
node packages/cli/dist/cli.js profiles
node packages/cli/dist/cli.js info  "<save slot>"
node packages/cli/dist/cli.js check "<save slot>"
node packages/cli/dist/cli.js edit  "<save slot>" --money 1000000000 --max-skills --bus-xp 10000000 \
    --garages --repair --refuel --visit-all-cities --staff-garages --dispatch-drivers \
    --discover-map "<Steam>\steamapps\common\Euro Truck Simulator 2"
node packages/cli/dist/cli.js decode "<file>" out.txt
```

## Layout

```
packages/core     ScsC crypto, BSII v1-3 decoder, SiiNunit model, HashFS archive reader, map sector scan, edit operations, validator
packages/cli      command line front end
packages/server   local HTTP API, profile discovery, backups, log triage
packages/web      React + Tailwind + shadcn/ui interface, English and French
packages/desktop  Tauri v2 shell: native window, folder picker, server lifecycle
```

The desktop app is a Tauri shell (4.7 MB) that starts the compiled server on a random free port
and loads the interface in a native webview. The installer ships that server as a sidecar; the
`portable` cargo feature embeds it in the executable instead. The editing core stays in
TypeScript, so the decoder verified against real saves is the one that ships.

## Safety

- Edits can be written to a **new save slot**, leaving the original untouched.
- Overwriting a slot first copies the current save into `<slot>/backups/`.
- Nothing is written while the validator reports a problem.
- A banner warns when the game is running, because it overwrites saves on exit.

Tested against real 1.61 and 1.62 profiles: 45 profile and save files decode and round-trip byte for
byte, and the decoder matches the reference file published with `SII_Decrypt`.

## Format notes

- `ScsC`: AES-256-CBC (fixed key) + zlib; the HMAC field is not verified by the game.
- `BSII` v1-3: structure blocks define fields, data blocks carry values; 34 value types.
- Tokens are base-38 identifiers packed into 63 bits; ids print as `_nameless.a.bbbb.cccc`.
- `economy.discovered_items` holds the ids of the roads, prefabs and map areas the player has seen.
  The ids live in the game's map sectors (`map/<name>/sec+XXXX+ZZZZ.base` inside `base_map.scs` and
  the map DLC archives), so the editor reads them from the installed game: 181 677 items for ETS2
  1.62 with every map DLC. A donor save from another map version covers far less - 82 000 of them in
  our case - which is why a merged map stayed short of 100%.
- `.scs` archives are HashFS v2: entries are keyed by the CityHash64 of their path, directories are
  entries that list their children.
- A hired `driver_ai` only moves when `economy_event_queue` holds an event for it (`param` 1 rest
  begins, 2 rest ends, 4 job ends). A driver on the payroll without one never takes a job, so hiring
  queues a `param: 4` event and writes the driver like the game writes one on an empty leg home.
- Game 1.62 added the coach skills `long_duty`, `tight_schedule`, `satisfaction_decrease`,
  `low_acceleration`, `satisfaction_increase` and `ecodriving` (three ranks each) next to
  `bus_experience_points`; coach levels use the same experience table as truck levels.

## Credits

Format documentation from [TheLazyTomcat/SII_Decrypt](https://github.com/TheLazyTomcat/SII_Decrypt);
garage capacities cross-checked against [LIPtoH/TS-SE-Tool](https://github.com/LIPtoH/TS-SE-Tool);
archive and map-item layout from [sk-zk/TruckLib](https://github.com/sk-zk/TruckLib).
