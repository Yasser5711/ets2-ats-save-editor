# Changelog

## [0.3.0](https://github.com/Yasser5711/ets2-ats-save-editor/compare/v0.2.0...v0.3.0) (2026-08-23)


### Features

* choose the game folder on first start ([35bba24](https://github.com/Yasser5711/ets2-ats-save-editor/commit/35bba24d2209ff25cb08dff848270f20b34e08b6))
* **desktop:** ship a tauri app around the editor core ([33a8e11](https://github.com/Yasser5711/ets2-ats-save-editor/commit/33a8e117637e23b8b0fce3ac497757b04b70bea5))
* **web:** clearer wording on the folder picker ([34cf944](https://github.com/Yasser5711/ets2-ats-save-editor/commit/34cf944621abf2360814c5f0a2e152d3811dffc9))
* **web:** restyle the interface with shadcn/ui ([c3ec264](https://github.com/Yasser5711/ets2-ats-save-editor/commit/c3ec264fc4d00da0132a3f5119d4b86a10c3095f))


### Bug Fixes

* **desktop:** make the api reachable from the tauri window ([c52125e](https://github.com/Yasser5711/ets2-ats-save-editor/commit/c52125eb9fcee90041786b94b7eabc41d6fdb3aa))


### Refactors

* **web:** drop the hand rolled ui primitives ([d4d1549](https://github.com/Yasser5711/ets2-ats-save-editor/commit/d4d1549c882d13ba06ba3abb4e619f215985bb8f))

## [0.2.0](https://github.com/Yasser5711/ets2-ats-save-editor/compare/v0.1.0...v0.2.0) (2026-08-23)


### Features

* **cli:** add profiles, info, decode, edit and check commands ([72a99f2](https://github.com/Yasser5711/ets2-ats-save-editor/commit/72a99f2bf32a1a657abfe017d7a43da0dc94f9a6))
* **core:** add the SiiNunit document model ([59c9c2d](https://github.com/Yasser5711/ets2-ats-save-editor/commit/59c9c2da6977e4bbbaf54f424e1209b46d1dd281))
* **core:** build fleets from cloned dealer trucks ([63adff9](https://github.com/Yasser5711/ets2-ats-save-editor/commit/63adff93f62d3a9f57760e74c22a9f93c956d925))
* **core:** decode BSII binary saves into SiiNunit text ([c1ad484](https://github.com/Yasser5711/ets2-ats-save-editor/commit/c1ad4845bb175905808a32a99a703738060c8682))
* **core:** decrypt and repack ScsC save containers ([98d389b](https://github.com/Yasser5711/ets2-ats-save-editor/commit/98d389bc04f43cad99cf370a7b4368b78a455eb5))
* **core:** edit money, skills, garages and vehicle condition ([2563773](https://github.com/Yasser5711/ets2-ats-save-editor/commit/25637733c05373b6b102098650639f113c601f9e))
* **core:** read any profile file and write plain text saves ([b7a5769](https://github.com/Yasser5711/ets2-ats-save-editor/commit/b7a576939c768d73afe0424f49bf4b3ddb4c45a5))
* **core:** unlock every city and merge map discovery ([8ffd871](https://github.com/Yasser5711/ets2-ats-save-editor/commit/8ffd87106042babf24a0d3d7dad4a17e00679522))
* **server:** serve the editor core over a local http api ([14ff163](https://github.com/Yasser5711/ets2-ats-save-editor/commit/14ff1631ae30703e67fdeb9e640ff2c39cf1e284))
* **web:** add the save editor interface ([d9a1057](https://github.com/Yasser5711/ets2-ats-save-editor/commit/d9a1057ba814cf928eb13db946659834c1a888b3))


### Bug Fixes

* **server:** embed the web interface in the executable ([bfe1728](https://github.com/Yasser5711/ets2-ats-save-editor/commit/bfe1728189c5a7353964e719bcc8854096a8df41))


### Refactors

* clear the oxlint findings ([0be55fc](https://github.com/Yasser5711/ets2-ats-save-editor/commit/0be55fc4310621d83ce19baa966f4fd3caf8affb))


### Build

* package a single file windows executable ([4ba60b5](https://github.com/Yasser5711/ets2-ats-save-editor/commit/4ba60b508e349619c1c3602b28980f9f5973d95b))
