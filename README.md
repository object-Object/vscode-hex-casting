# vscode-hex-casting

VSCode language features for the Hex Casting mod for Minecraft. 

**Note to VSCodium users:** I don't plan on publishing this extension to Open VSX. I'm not a fan of the amount of personal information that the Eclipse Foundation requires me to make public. However, if you'd like to install this extension manually, you can download the latest `.vsix` file from the [Visual Studio Marketplace page](https://marketplace.visualstudio.com/items?itemName=object-Object.hex-casting) by clicking Download Extension in the right sidebar under Resources. To get release notifications, go to the [GitHub repo](https://github.com/object-Object/vscode-hex-casting) and click `Watch > Custom > Releases > Apply`.

## Features

![Feature demo gif](/images/demo.gif)

* Full syntax highlighting
* Pattern autocomplete for Hex Casting, Hexal, MoreIotas, and Hexbound
* Pattern hover text with name, arguments, mod name, angle signature, and a picture of the stroke order
* C-style line and block comments
* Snippets to speed up your workflow
* `#define` support for Brigh's Gambit macros
* Language diagnostics/linting to highlight unknown patterns and invalid directives

## Extension Settings

This extension contributes the following settings:

* `hex-casting.appendNewline`: Controls whether the editor should insert a newline after selecting a pattern from the completion list. If set to `auto`, only appends a newline if the next line is empty or a closing bracket.
* `hex-casting.enableDiagnostics`: Controls whether the editor should show diagnostics, such as warnings for unknown patterns.

## Known Issues

* Many patterns show up twice in the completion list, because it's matching both the name and the translation. As far as I know, there's nothing I can do about this.
* Pattern suggestions show up in block comments. Due to [this open issue](https://github.com/microsoft/vscode/issues/580), there's not really anything I can do about this.

## Unknown Issues

Probably lots of things. This is my first extension, and as such, I'm sure there are many things I've unknowingly done wrong. Please report any issues you may find using the [issue tracker](https://github.com/object-Object/vscode-hex-casting/issues).

## Development

`src/data/registry.json` is generated using [this script in HexBug](https://github.com/object-Object/HexBug/blob/main/generate_pattern_data.py).

## Attribution

Icon: `@d3bugIANgl17ch` on Discord
