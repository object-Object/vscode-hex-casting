# Change Log

All notable changes to the "hex-casting" extension will be documented in this file.

## [unreleased]

### Additions

- Add `auto` option to `appendNewline` setting, which only appends a newline if the next line is empty or a closing bracket

### Changes

- Pressing tab within nested brackets now indents as far as necessary instead of just one level
- Selecting a completion in the middle of a line now removes the text after the cursor
- `[` and `]` are now considered brackets, for better HexBug/hexdecode compatibility
- Hovering over `{` and `}` now shows the tooltip for Introspection and Retrospection

### Fixes

- TODO: Fix pattern suggestions being shown in comments
- TODO: Fix `.` not counting as part of a number

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
