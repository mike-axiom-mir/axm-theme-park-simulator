# Vendored 3D runtime

`three.module.min.js` and `three.core.min.js` are the official Three.js r180
(0.180.0) browser modules from `mrdoob/three.js`, pinned to Git tag `r180`.
They are kept locally so the editable source and test suite do not need a
runtime package download. Three.js is MIT-licensed; the unmodified license is
stored in `THREE-LICENSE.txt`.

The production `dist/game.js` bundles the needed runtime code. Players do not
load these files separately and the game makes no network requests.
