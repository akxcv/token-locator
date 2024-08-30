# Token Locator (Foundry VTT Module)

> Based on [GM vision by dev7355608](https://github.com/dev7355608/gm-vision).

This module adds a toggleable mode for players that reveals non-hiding tokens.

Tokens that wouldn't be visible normally are highlighted by a hatched overlay.

The mode can be toggled by a keybinding (default: `CTRL+G`) or with a script macro.

```js
game.settings.set("token-locator", "active", !game.settings.get("token-locator", "active"));
```
