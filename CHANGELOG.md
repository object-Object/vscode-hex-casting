# Change Log

All notable changes to the "hex-casting" extension will be documented in this file.

## 0.1.6 - 2023-03-22

### Mod Updates

- Hexal: 0.2.11

### Notes

- Retroactively updated changelog format: added dedicated section for mod updates

## 0.1.5 - 2023-03-03

### Mod Updates

- Hexbound: 0.1.1+1.19.2

## 0.1.4 - 2023-02-16

### Mod Updates

- Hexal: 0.2.7
- Hexbound: 0.1.0+1.19.2

## 0.1.3 - 2023-01-27

### Changes

- New extension icon (very based)

## 0.1.2 - 2023-01-24

### Changes

- Use HexBug's new pattern rendering (highlighted start arrow, larger start/end dots)

### Fixes

- Fix old translations still being used for some patterns (eg. Chronicler's Purification was Scribe's Purification)

## 0.1.1 - 2023-01-01

### Fixes

- Fix BBCode number input box disappearing if you tab out

## 0.1.0 - 2022-12-28

### Additions

- Add command to copy selection as BBCode (currently disabled with multi-selections)

### Changes

- BREAKING: Require angle signature for `#define` directives

### Fixes

- Fix diagnostics being provided for non-Hex files if the editor was reloaded with a Hex and a non-Hex file in split view

## 0.0.12 - 2022-12-21

### Additions

- Add code actions to convert shorthand / internal names to full patterns

## 0.0.11 - 2022-12-19

### Additions

- Add macro support with `#define`
- Add diagnostics to warn on unknown patterns or invalid `#` directives
- Add inlay hints for macros

### Fixes

- Fix pattern args containing unparsed Markdown

## 0.0.10 - 2022-12-18

### Changes

- Update Hexbound data, adding web book links

## 0.0.9 - 2022-12-17

### Additions

- Add Hexbound support

### Fixes

- Fix a couple of patterns still using the old abbreviated type (eg. Multiplicative Dstl.)

## 0.0.8 - 2022-12-14

### Changes

- The `\` and `\\` snippets now respect the `appendNewline` setting

### Fixes

- Fix `auto` option for the `appendNewline` setting appending a newline for opening brackets, not closing

## 0.0.7 - 2022-12-14

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

## 0.0.6 - 2022-12-10

### Changes

- Pattern images now have a transparent background and will adapt to your color theme
- `:` is now themed as punctuation instead of a keyword

### Fixes

- Fix brackets having no colour when rainbow brackets are disabled

## 0.0.5 - 2022-12-10

### Additions

- Add `appendNewline` setting to control whether the editor should go to the next line after selecting a pattern from the completion list
- Add pattern name, mod name, args, image, and angle signature to completion list and hover text

### Fixes

- Fix `:` causing issues in comments

## 0.0.4 - 2022-12-09

### Fixes

- Add / to the characters that can be in a word, so `read/local` now completes properly

## 0.0.3 - 2022-12-09

### Changes

- Stop completions from being shown when editing the parameter of a number or bookkeeper
- Tweak what's considered a "word", so completion now works after spaces in a pattern name as well
- Add numbers to trigger characters for normal patterns, so `2dup` now completes properly

## 0.0.2 - 2022-12-09

### Fixes

- Fix completions not being provided for an empty line
- Fix `Dstl.` not being highlighted as a type

## 0.0.1

- Initial release
