# vscode-hex-casting

VSCode language features for the Hex Casting mod for Minecraft. 

## Features

![Feature demo gif](/images/demo.gif)

* Full syntax highlighting
* Pattern autocomplete for Hex Casting, Hexal, MoreIotas, and Hexbound
* Pattern hover text with name, arguments, mod name, angle signature, and a picture of the stroke order
* C-style line and block comments
* Snippets to speed up your workflow

## Extension Settings

This extension contributes the following settings:

* `hex-casting.appendNewline`: Controls whether the editor should insert a newline after selecting a pattern from the completion list. If set to `auto`, only appends a newline if the next line is empty or a closing bracket.

## Known Issues

* Many patterns show up twice in the completion list, because it's matching both the name and the translation. As far as I know, there's nothing I can do about this.
* Pattern suggestions show up in block comments. Due to [this open issue](https://github.com/microsoft/vscode/issues/580), there's not really anything I can do about this.

## Unknown Issues

Probably lots of things. This is my first extension, and as such, I'm sure there are many things I've unknowingly done wrong. Please report any issues you may find using the [issue tracker](https://github.com/object-Object/vscode-hex-casting/issues).

## Development

`src/data/registry.json` is generated using [this script in HexBug](https://github.com/object-Object/HexBug/blob/main/generate_pattern_data.py).
