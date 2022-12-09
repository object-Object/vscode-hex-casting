# hex-casting README

VSCode language features for the Hex Casting mod for Minecraft. 

## Features

![Feature demo gif](/images/demo.gif)

* Full syntax highlighting
* Pattern autocomplete for Hex Casting, Hexal, and MoreIotas
* C-style line and block comments
* Snippets to speed up your workflow

## Extension Settings

None at this time.

## Known Issues

* Many patterns show up twice in the completion list, because it's matching both the name and the translation. As far as I know, there's nothing I can do about this.
* Some of the 0.9.x patterns also show up in the completion list, because Hexal, for some reason, has all of Hex's translations in a directory somewhere, and it hasn't been updated. This probably counts as a bug in Hexal and/or HexBug, not this extension.

## Unknown Issues

Probably lots of things. This is my first extension, and as such, I'm sure there are many things I've unknowingly done wrong. Please report any issues you may find using the [issue tracker](https://github.com/object-Object/vscode-hex-casting/issues).

## Release Notes

### 0.0.1

Initial release.

## Development

`src/data/registry.json` is generated using [this script in HexBug](https://github.com/object-Object/HexBug/blob/main/generate_pattern_json.py).
