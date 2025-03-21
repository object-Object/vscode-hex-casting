# Changelog

All notable changes to the "hex-casting" extension will be documented in this file.

## [0.1.36] - 2025-03-21

### Additions

- Added support for Hexical 1.3.2, Hexcellular 1.0.2, and Hexcassettes 1.1.1.
  - Note: Hexical's special handler patterns (Nephthys and Sekhmet) are not yet supported.

### Changes

- Pattern images are now generated on the fly via [hex_renderer_javascript](https://www.npmjs.com/package/hex_renderer_javascript) instead of bundling static images with the extension.
- Macros and special handlers (eg. Bookkeeper's Gambit, Numerical Reflection) are now rendered on hover when possible.
- Removed the angle signature from the hover info for great spells.

### Mod Updates

- Hexbound: 0.1.4
- HexDebug: 0.2.2
- Hex Keys: 0.1.3
- HexKinetics: 0.7.3
- Oneironaut: 0.3.4

## [0.1.35] - 2024-07-08

### Changes

- `#define` directives without angle signatures (eg. `#define Custom Pattern`) are now legal.
  - Note: the `Copy Selection as Macro Forum Post` command still requires the `#define` directive to have an angle signature.

## [0.1.34] - 2024-05-18

### Additions

- Added support for patterns from HexDebug.

## [0.1.33] - 2024-05-02

### Additions

- Added support for debugging ingame hexes with [HexDebug](https://github.com/object-Object/HexDebug)!

## [0.1.32] - 2024-02-29

### Additions

- Added support for Hex Keys.
- Added pattern descriptions to IntelliSense where available.

## [0.1.31] - 2024-01-12

### Additions

- New command to generate and copy BBCode for sharing a macro on the forums.

## [0.1.30] - 2024-01-06

### Mod Updates

- Oneironaut: 0.2.1

## [0.1.29] - 2023-12-27

### Mod Updates

- Hex Gloop: 0.2.1 (unreleased)
- Oneironaut: 0.1.2
- Mediaworks: 1.0.5

## [0.1.28] - 2023-12-16

### Additions

- Add support for Hex Gloop and Oneironaut.

## [0.1.27] - 2023-10-09

### Additions

- Add support for Mediaworks.

## [0.1.26] - 2023-08-24

### Additions

- Add command to copy selection as a list for rendering with HexBug's `/patterns hex`.

### Changes

- Copy as BBCode and Copy as List will now use a lookup table for number literals between -2000 and 2000.

## [0.1.25] - 2023-08-14

### Mod Updates

- Hexal: 0.2.18

## [0.1.24] - 2023-08-13

Version bump to update the README and fix an incorrect date in the changelog. Oops.

## [0.1.23] - 2023-08-13

### Additions

- Add `#include` directive for importing macros from other files
  - Syntax: `#include "./path/to/file.hexpattern"`
  - Paths are always relative to the file containing the `#include` and must start with `./` or `../`
  - Circular imports are permitted
- Add inlay hints for internal pattern names (contributed by Master-Bw3 in #9)

### Changes

- Error messages for invalid `#define` directives will now give more helpful hints when possible (#8)

## [0.1.22] - 2023-06-28

### Mod Updates

- Hexal: 0.2.16
- HexKinetics: 0.7.2

## [0.1.21] - 2023-06-04

### Mod Updates

- HexKinetics: 0.7.1

## [0.1.20] - 2023-05-29

### Changes

- Block comments are now collapsible (#5)

### Mod Updates

- Hexal: 0.2.15
- HexKinetics: 0.7.0
- HexTweaks: 3.2.2

## [0.1.19] - 2023-05-21

### Mod Updates

- HexKinetics: 0.6.1

## [0.1.18] - 2023-05-18

### Mod Updates

- HexKinetics: 0.6.0

## [0.1.17] - 2023-05-13

### Additions

- Add the ability to configure which mods are enabled using the setting `enabledMods`; patterns from disabled mods will not be recognized or suggested
- Add support for HexKinetics 0.5.0 by Sonunte

## [0.1.16] - 2023-05-11

### Additions

- Add basic support for iota embedding syntax (thanks to walksanatora for pushing me to get this done)
  - `<iota>`: default syntax, represents directly embedding an iota; may be placed after a pattern placeholder on the same line
  - `<{iota}>`: parsers should expand this, adding patterns to embed the iota using Intro/Retro/Flock
  - `{\iota}`: parsers should embed the iota using Consideration
  - `<<iota>>`: parsers should embed the iota using Intro/Retro/Flock or Consideration, whichever is shorter

### Fixes

- Fix incorrect indentation after brackets in comments
- Fix Bookkeeper's Gambit short suggestions not displaying on the second character typed (eg. `v-`)
- Fix end-of-line comments being overwritten by accepting a pattern suggestion on the same line

## [0.1.15] - 2023-05-10

### Changes

- Update pattern overlap rendering

### Mod Updates

- HexTweaks: 3.2.1

## [0.1.14] - 2023-05-04

### Changes

- Allow using the `s` angle in macro patterns

### Mod Updates

- HexTweaks: 3.0.0

## [0.1.13] - 2023-04-27

### Mod Updates

- MoreIotas: 0.0.4

## [0.1.12] - 2023-04-21

### Mod Updates

- HexTweaks: 2.2.0

## [0.1.11] - 2023-04-21

### Changes

- Add support for HexTweaks 2.0.0 by walksanatora

## [0.1.10] - 2023-04-15

### Mod Updates

- Hexal: 0.2.14

## [0.1.9] - 2023-04-13

### Mod Updates

- Hexbound: 0.1.3

## [0.1.8] - 2023-04-02

### Mod Updates

- Hexal: 0.2.13

## [0.1.7] - 2023-03-22

### Changes

- Updated README

### Notes

- This is a test release to ensure that my GitHub release workflow is working properly, sorry!

## [0.1.6] - 2023-03-22

### Mod Updates

- Hexal: 0.2.11

### Notes

- Retroactively update changelog format: add dedicated section for mod updates

## [0.1.5] - 2023-03-03

### Mod Updates

- Hexbound: 0.1.1+1.19.2

## [0.1.4] - 2023-02-16

### Mod Updates

- Hexal: 0.2.7
- Hexbound: 0.1.0+1.19.2

## [0.1.3] - 2023-01-27

### Changes

- New extension icon (very based)

## [0.1.2] - 2023-01-24

### Changes

- Use HexBug's new pattern rendering (highlighted start arrow, larger start/end dots)

### Fixes

- Fix old translations still being used for some patterns (eg. Chronicler's Purification was Scribe's Purification)

## [0.1.1] - 2023-01-01

### Fixes

- Fix BBCode number input box disappearing if you tab out

## [0.1.0] - 2022-12-28

### Additions

- Add command to copy selection as BBCode (currently disabled with multi-selections)

### Changes

- BREAKING: Require angle signature for `#define` directives

### Fixes

- Fix diagnostics being provided for non-Hex files if the editor was reloaded with a Hex and a non-Hex file in split view

## [0.0.12] - 2022-12-21

### Additions

- Add code actions to convert shorthand / internal names to full patterns

## [0.0.11] - 2022-12-19

### Additions

- Add macro support with `#define`
- Add diagnostics to warn on unknown patterns or invalid `#` directives
- Add inlay hints for macros

### Fixes

- Fix pattern args containing unparsed Markdown

## [0.0.10] - 2022-12-18

### Changes

- Update Hexbound data, adding web book links

## [0.0.9] - 2022-12-17

### Additions

- Add Hexbound support

### Fixes

- Fix a couple of patterns still using the old abbreviated type (eg. Multiplicative Dstl.)

## [0.0.8] - 2022-12-14

### Changes

- The `\` and `\\` snippets now respect the `appendNewline` setting

### Fixes

- Fix `auto` option for the `appendNewline` setting appending a newline for opening brackets, not closing

## [0.0.7] - 2022-12-14

### Additions

- Add `auto` option to `appendNewline` setting, which only appends a newline if the next line is empty or a closing bracket

### Changes

- Pressing tab within nested brackets now indents as far as necessary instead of just one level
- Selecting a completion in the middle of a line now removes the text after the cursor
- `[` and `]` are now considered brackets for better HexBug/hexdecode compatibility
- Hovering over `{` and `}` now shows the hover text for Introspection and Retrospection, respectively

### Fixes

- Partially fix pattern suggestions being shown in comments
- Fix `.` not counting as part of a number for Numerical Reflection shortcut
- Fix leading Consideration not showing hover text
- Fix upside down Consideration image

## [0.0.6] - 2022-12-10

### Changes

- Pattern images now have a transparent background and will adapt to your color theme
- `:` is now themed as punctuation instead of a keyword

### Fixes

- Fix brackets having no colour when rainbow brackets are disabled

## [0.0.5] - 2022-12-10

### Additions

- Add `appendNewline` setting to control whether the editor should go to the next line after selecting a pattern from the completion list
- Add pattern name, mod name, args, image, and angle signature to completion list and hover text

### Fixes

- Fix `:` causing issues in comments

## [0.0.4] - 2022-12-09

### Fixes

- Add / to the characters that can be in a word, so `read/local` now completes properly

## [0.0.3] - 2022-12-09

### Changes

- Stop completions from being shown when editing the parameter of a number or bookkeeper
- Tweak what's considered a "word", so completion now works after spaces in a pattern name as well
- Add numbers to trigger characters for normal patterns, so `2dup` now completes properly

## [0.0.2] - 2022-12-09

### Fixes

- Fix completions not being provided for an empty line
- Fix `Dstl.` not being highlighted as a type

## [0.0.1]

- Initial release
