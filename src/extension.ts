import * as vscode from "vscode";
import untypedRegistry from "./data/registry.json";
import untypedShorthandLookup from "./data/shorthand.json";
import showInputBox from "./showInputBox";

interface PatternInfo {
    name?: string;
    modName: string;
    image: {
        filename: string;
        height: number;
        width: number;
    } | null;
    direction: string | null;
    pattern: string | null;
    args: string | null;
    url: string | null;
}

interface DefaultPatternInfo extends PatternInfo {
    name: string;
}

type Direction = "EAST" | "SOUTH_EAST" | "SOUTH_WEST" | "WEST" | "NORTH_WEST" | "NORTH_EAST";

class MacroPatternInfo implements PatternInfo {
    public args: string | null;

    public modName = "macro";
    public image = null;
    public url = null;

    constructor(public direction: Direction, public pattern: string, args?: string) {
        this.args = args ?? null;
    }
}

type AppendNewline = "always" | "auto" | "never";
type Registry<T extends PatternInfo> = { [translation: string]: T };
type ShorthandLookup = { [shorthand: string]: string };

const rootSection = "hex-casting";
const output = vscode.window.createOutputChannel("Hex Casting");
const selector: vscode.DocumentSelector = [
    { scheme: "file", language: "hexcasting" },
    { scheme: "untitled", language: "hexcasting" },
];
let defaultRegistry: Registry<DefaultPatternInfo> = untypedRegistry;
const macroRegistry: Map<vscode.Uri, Registry<MacroPatternInfo>> = new Map();
const themePaths = {
    [vscode.ColorThemeKind.Dark]: "dark/",
    [vscode.ColorThemeKind.HighContrast]: "dark/",
    [vscode.ColorThemeKind.HighContrastLight]: "light/",
    [vscode.ColorThemeKind.Light]: "light/",
};

// put special before normal name before internal name
const specialSortPrefix = "";
const translationSortPrefix = "~";
const nameSortPrefix = "~~";
const specialExtraSortPrefix = "~~~";

function makeShorthandLookup(): ShorthandLookup {
    let lookup: ShorthandLookup = untypedShorthandLookup;
    for (const [translation, pattern] of Object.entries(defaultRegistry)) {
        if (!Object.prototype.hasOwnProperty.call(lookup, pattern.name)) {
            lookup[pattern.name] = translation;
        }
    }
    return lookup;
}

let shorthandLookup = makeShorthandLookup();

let appendNewline: AppendNewline;
let enableDiagnostics: boolean;
let enabledMods: { [modName: string]: boolean };
let showInternalNameHints: boolean;
let showMacroNameHints: boolean;

function filterObject<V>(obj: { [key: string]: V }, callback: (entry: [string, V]) => boolean): { [key: string]: V } {
    return Object.fromEntries(Object.entries(obj).filter(callback));
}

function updateConfiguration() {
    appendNewline = vscode.workspace.getConfiguration(rootSection).get("appendNewline")!;
    enableDiagnostics = vscode.workspace.getConfiguration(rootSection).get("enableDiagnostics")!;
    showInternalNameHints = vscode.workspace.getConfiguration(rootSection).get("inlayHints.internalName")!;
    showMacroNameHints = vscode.workspace.getConfiguration(rootSection).get("inlayHints.macroName")!;
    enabledMods = vscode.workspace.getConfiguration(rootSection).get("enabledMods")!;

    // clone the untyped registry and only include entries where the mod is enabled
    defaultRegistry = filterObject(JSON.parse(JSON.stringify(untypedRegistry)), ([_, { modName }]) => {
        if (!enabledMods.hasOwnProperty(modName)) {
            throw new Error(`Mod missing from config option hex-casting.enabledMods: "${modName}"`);
        }
        return enabledMods[modName];
    });
    shorthandLookup = makeShorthandLookup();
}

// maxImageSize overrides maxImageHeight
function makeDocumentation(
    translation: string,
    { modName, image, direction, pattern, url }: PatternInfo,
    maxImageWidth?: number,
    maxImageHeight?: number,
): vscode.MarkdownString {
    let result = new vscode.MarkdownString(
        url != null ? `**[${translation}](${url})**` : `**${translation}**`,
    ).appendMarkdown(` (${modName})`);

    const { kind: themeKind } = vscode.window.activeColorTheme;
    // this feels sketchy. is there a better way to do this?
    result.baseUri = vscode.Uri.file(__dirname.replace(/out$/, "") + "images/patterns/" + themePaths[themeKind]);
    result.supportHtml = true;

    if (image != null) {
        const { filename, width, height } = image;
        maxImageWidth = Math.min(width, maxImageWidth ?? width);
        maxImageHeight = Math.min(height, maxImageHeight ?? height);

        let sizedWidth = maxImageWidth;
        let sizedHeight = (maxImageWidth * height) / width;

        if (sizedHeight > maxImageHeight) {
            sizedWidth = (maxImageHeight * width) / height;
            sizedHeight = maxImageHeight;
        }

        const style = `width="${sizedWidth}" height="${sizedHeight}"`;

        result = result.appendMarkdown(`\n\n<img src="${filename}" alt="Stroke order for ${translation}" ${style}/>`);
    }

    if (direction != null) result = result.appendMarkdown(`\n\n\`${direction}${pattern ? " " + pattern : ""}\``);

    return result;
}

function getInsertTextSuffix(hasParam: boolean, trimmedNextLine: string, hasTextAfter: boolean): string {
    if (hasParam) return ": ";
    if (hasTextAfter) return "";
    switch (appendNewline) {
        case "always":
            return "\n";
        case "auto":
            return !trimmedNextLine.length || /(?<!\/\*((?!\*\/).)*|\/\/.*)[\]}]/.test(trimmedNextLine) ? "\n" : "";
        case "never":
            return "";
    }
}

function prepareTranslation(text: string): string {
    return text
        .replace(/[{\[]/g, "Introspection")
        .replace(/[}\]]/g, "Retrospection")
        .replace(
            /(?<=Bookkeeper's Gambit):\s*[v-]+|(?<=Numerical Reflection):\s*-?(?:\d*\.\d*|\d+)|(?<=Consideration):.*/g,
            "",
        );
}

function shortenDirection(rawDirection: string): string {
    return rawDirection
        .toLowerCase()
        .replace(/[_\-]/g, "")
        .replace("north", "n")
        .replace("south", "s")
        .replace("west", "w")
        .replace("east", "e");
}

function prepareDirection(rawDirection: string): Direction | undefined {
    const lookup: { [key: string]: Direction | undefined } = {
        e: "EAST",
        se: "SOUTH_EAST",
        sw: "SOUTH_WEST",
        w: "WEST",
        nw: "NORTH_WEST",
        ne: "NORTH_EAST",
    };
    return lookup[shortenDirection(rawDirection)];
}

function isInDefaultRegistry(translation: string): boolean {
    return Object.prototype.hasOwnProperty.call(defaultRegistry, translation);
}

function isInMacroRegistry(
    document: vscode.TextDocument,
    translation: string,
    newRegistry?: Registry<MacroPatternInfo>,
): boolean {
    const documentMacros = newRegistry ?? macroRegistry.get(document.uri);
    return documentMacros ? Object.prototype.hasOwnProperty.call(documentMacros, translation) : false;
}

function isInRegistry(document: vscode.TextDocument, translation: string): boolean {
    return isInDefaultRegistry(translation) || isInMacroRegistry(document, translation);
}

function getFromRegistry(document: vscode.TextDocument, translation: string): PatternInfo | undefined {
    return defaultRegistry[translation] ?? macroRegistry.get(document.uri)?.[translation];
}

function getRegistryEntries(document: vscode.TextDocument): [string, PatternInfo][] {
    const documentMacros = macroRegistry.get(document.uri);
    return Object.entries<PatternInfo>(defaultRegistry).concat(documentMacros ? Object.entries(documentMacros) : []);
}

function getPatternRange(document: vscode.TextDocument, start: vscode.Position): [vscode.Range, boolean] {
    const range = document.lineAt(start.line).range.with({ start });
    const line = document.getText(range);

    const endIndex = line.search(/<|\/\/|\/\*/);
    if (endIndex > -1) {
        const end = start.translate({ characterDelta: endIndex });
        const rest = line.slice(endIndex + 1);
        return [range.with({ end }), rest.trim().length > 0];
    }
    return [range, false];
}

function makeCompletionItem(
    document: vscode.TextDocument,
    label: string,
    hasParam: boolean,
    trimmedNextLine: string,
    range: vscode.Range,
    hasTextAfter: boolean,
    patternInfo?: PatternInfo,
): vscode.CompletionItem {
    patternInfo = patternInfo ?? getFromRegistry(document, label)!;
    const { name, args } = patternInfo;

    return {
        label: {
            label: label,
            description: name,
        },
        detail: args ?? undefined,
        documentation: makeDocumentation(label, patternInfo, 300, 300),
        kind: vscode.CompletionItemKind.Function,
        insertText: label + getInsertTextSuffix(hasParam, trimmedNextLine, hasTextAfter),
        range,
        sortText: translationSortPrefix + label,
    };
}

function makeCompletionItems(
    document: vscode.TextDocument,
    label: string,
    hasParam: boolean,
    trimmedNextLine: string,
    range: vscode.Range,
    hasTextAfter: boolean,
    patternInfo?: PatternInfo,
): vscode.CompletionItem[] {
    patternInfo = patternInfo ?? getFromRegistry(document, label)!;
    const { name } = patternInfo;

    const base = makeCompletionItem(document, label, hasParam, trimmedNextLine, range, hasTextAfter, patternInfo);
    return [base, ...(name ? [{ ...base, filterText: name, sortText: nameSortPrefix + label }] : [])];
}

function makeCompletionList(
    document: vscode.TextDocument,
    trimmedNextLine: string,
    range: vscode.Range,
    hasTextAfter: boolean,
): vscode.CompletionItem[] {
    return getRegistryEntries(document)
        .filter(([translation]) => translation != "Consideration")
        .flatMap<vscode.CompletionItem>(([translation, patternInfo]) =>
            makeCompletionItems(
                document,
                translation,
                !patternInfo.name ? false : ["mask", "number"].includes(patternInfo.name),
                trimmedNextLine,
                range,
                hasTextAfter,
                patternInfo,
            ),
        );
}

const defineRe =
    /^(?<directionPrefix>(?<directive>#define[ \t]+)(?=[^ \t])(?<translation>[^(\n]+?)[ \t]*\([ \t]*)(?<direction>[a-zA-Z_\-]+)(?:[ \t]+(?<pattern>[aqwedsAQWEDS]+))?[ \t]*\)[ \t]*(?:=[ \t]*(?=[^ \t])(?<args>.+?)[ \t]*)?(?:\/\/|\/\*|$)/;

function shouldSkipCompletions(line: string): boolean {
    return /\S\s|\/\/|\/\*/.test(line.replace(/Consideration:/g, "")) || defineRe.test(line);
}

function getTrimmedNextLine(document: vscode.TextDocument, position: vscode.Position): string {
    const nextLineNum = position.line + 1;
    return document.lineCount > nextLineNum ? document.lineAt(nextLineNum).text.trim() : "";
}

function toTitleCase(text: string): string {
    return text
        .split(/\s+/)
        .map((s) => s.charAt(0).toUpperCase() + s.substring(1).toLowerCase())
        .join(" ");
}

const suffixes: [RegExp, string][] = [
    [/(?<= )(ref|refl)(?= |$)/i, "Reflection"],
    [/(?<= )(pur|prfn|prf)(?= |$)/i, "Purification"],
    [/(?<= )(dist|distill)(?= |$)/i, "Distillation"],
    [/(?<= )(ex|exalt)(?= |$)/i, "Exaltation"],
    [/(?<= )(dec|decomp)(?= |$)/i, "Decomposition"],
    [/(?<= )(dis|disint)(?= |$)/i, "Disintegration"],
    [/(?<= )gam(?= |$)/i, "Gambit"],
];

// ayo
const plurals: [string | RegExp, string][] = [
    ["", ""],
    [/(?<=^\S+)(s?)(?= |$)/, "'s"],
    [/(?<=^\S+)(s)(?= |$)/, "s'"],
];

function tryLookupShorthand(
    document: vscode.TextDocument,
    pattern: string,
    restOfLine: string,
): string | string[] | undefined {
    if (isInRegistry(document, prepareTranslation(pattern))) return;

    let prefix = "";
    let formattedPattern = pattern;
    if (/^consideration +[^ ]+/i.test(pattern)) {
        prefix = "Consideration: ";
        formattedPattern = pattern.replace(/^consideration +/, "");
    } else if (pattern.toLowerCase() == "consideration" && /^ *[{}]/.test(restOfLine)) {
        return "Consideration:";
    }

    let replacement;
    if ((replacement = shorthandLookup[formattedPattern])) return prefix + replacement;

    formattedPattern = formattedPattern
        .replace(/_/g, " ")
        .replace(/^(-?(?:\d*\.\d*|\d+))$/, "Numerical Reflection: $1")
        .replace(/^(?:book|bookkeeper|mask) *([v\-]+)$/i, "Bookkeeper's Gambit: $1");
    if (isInRegistry(document, prepareTranslation(formattedPattern))) return prefix + formattedPattern;

    formattedPattern = toTitleCase(formattedPattern);
    if (isInRegistry(document, prepareTranslation(formattedPattern))) return prefix + formattedPattern;

    // for for for for for for for for for for for for
    const foundPatterns = new Set<string>();
    for (const [suffixSearch, suffixReplace] of suffixes) {
        for (const [pluralSearch, pluralReplace] of plurals) {
            for (const two of ["", " II"]) {
                for (const colon of ["", ":"]) {
                    let moreFormattedPattern = formattedPattern
                        .replace(suffixSearch, suffixReplace + colon)
                        .replace(pluralSearch, pluralReplace);
                    if (isInRegistry(document, moreFormattedPattern + two))
                        foundPatterns.add(prefix + moreFormattedPattern + two);

                    moreFormattedPattern += " " + suffixReplace + colon;
                    if (isInRegistry(document, moreFormattedPattern + two))
                        foundPatterns.add(prefix + moreFormattedPattern + two);
                }
            }
        }
    }

    const results = Array.from(foundPatterns);
    results.sort();

    if (!results.length) return;
    if (results.length == 1) return results[0];
    return results;
}

function getRestOfLine(document: vscode.TextDocument, start: vscode.Position, offset: number): string {
    return document.getText(
        document.lineAt(start.line).range.with({ start: start.translate({ characterDelta: offset }) }),
    );
}

class PatternCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const lineStart = position.with({ character: 0 });
        const rangeStart = document.getWordRangeAtPosition(position)?.start ?? position;
        const line = document.getText(new vscode.Range(lineStart, rangeStart));
        if (shouldSkipCompletions(line)) return;

        const trimmedNextLine = getTrimmedNextLine(document, position);
        const [range, hasTextAfter] = getPatternRange(document, rangeStart);
        return [
            ...makeCompletionList(document, trimmedNextLine, range, hasTextAfter),
            ...makeCompletionItems(
                document,
                "Consideration",
                !line.includes("Consideration:"),
                trimmedNextLine,
                range,
                hasTextAfter,
            ),
        ];
    }
}

class SpecialCompletionItemProvider implements vscode.CompletionItemProvider {
    constructor(
        public translation: string,
        public regex: RegExp,
        public extraSuffixes: string[] = [],
        public extraSuffixMaxRangeLength: number = 1,
    ) {}

    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const wordRange = document.getWordRangeAtPosition(position, this.regex);
        if (wordRange === undefined) return;

        const lineStart = position.with({ character: 0 });
        const line = document.getText(new vscode.Range(lineStart, wordRange.start));
        if (shouldSkipCompletions(line)) return;

        const text = document.getText(wordRange);
        const label = `${this.translation}: ${text}`;
        const patternInfo = getFromRegistry(document, this.translation)!;
        const trimmedNextLine = getTrimmedNextLine(document, position);
        const [range, hasTextAfter] = getPatternRange(document, wordRange.start);

        // god this is awful code
        const extraItems =
            range.end.character - range.start.character <= this.extraSuffixMaxRangeLength
                ? this.extraSuffixes.map((suffix) => ({
                      ...makeCompletionItem(
                          document,
                          label + suffix,
                          false,
                          trimmedNextLine,
                          range,
                          hasTextAfter,
                          patternInfo,
                      ),
                      kind: undefined,
                      preselect: false,
                      filterText: text + suffix,
                      sortText: specialExtraSortPrefix + text + suffix,
                  }))
                : [];

        return [
            {
                ...makeCompletionItem(document, label, false, trimmedNextLine, range, hasTextAfter, patternInfo),
                kind: undefined,
                preselect: true,
                filterText: text,
                sortText: specialSortPrefix + text,
            },
            ...extraItems,
        ];
    }
}

class ConsiderationCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const wordRange = document.getWordRangeAtPosition(position, /(?<=^\s*)(Consideration: \\$|\\\\?)/);
        if (wordRange === undefined) return;

        const lineStart = position.with({ character: 0 });
        const line = document.getText(new vscode.Range(lineStart, wordRange.start));
        if (shouldSkipCompletions(line)) return;

        const text = document.getText(wordRange);
        const isSingle = text === "\\";
        const label = "Consideration" + (isSingle ? "" : ": Consideration");
        const trimmedNextLine = getTrimmedNextLine(document, position);
        const [range, hasTextAfter] = getPatternRange(document, wordRange.start);

        return [
            {
                ...makeCompletionItem(
                    document,
                    label,
                    isSingle,
                    trimmedNextLine,
                    range,
                    hasTextAfter,
                    defaultRegistry["Consideration"],
                ),
                kind: vscode.CompletionItemKind.Snippet,
                preselect: true,
                filterText: text,
            },
        ];
    }
}

class PatternHoverProvider implements vscode.HoverProvider {
    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
    ): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position) ?? document.getWordRangeAtPosition(position, /[{}]/);
        if (range === undefined) return;

        const translation = prepareTranslation(document.getText(range));
        if (!isInRegistry(document, translation)) return;

        const patternInfo = getFromRegistry(document, translation)!;
        const { args } = patternInfo;

        return {
            contents: [
                ...(args ? [new vscode.MarkdownString(args)] : []),
                makeDocumentation(translation, patternInfo, undefined, 180),
            ],
        };
    }
}

// ew.
const patternRe =
    /^(?<prefix>[ \t]*)(?<escape>Consideration: *)?(?!\/\/|\/\*| )(?<pattern>(?:[a-zA-Z0-9:'+\-\./ _]+?|[{}\[\]]))(?= *(?:\/\/|\/\*|{|}|$))/gm;

interface PatternMatch {
    prefix: string;
    pattern: string;
    isEscaped: boolean;
}

function getPatternFromLine(text: string): PatternMatch | undefined {
    patternRe.lastIndex = 0;
    const groups = patternRe.exec(text.trimEnd())?.groups;
    return groups
        ? { prefix: groups.prefix + (groups.escape ?? ""), pattern: groups.pattern, isEscaped: !!groups.escape }
        : undefined;
}

function getPatternsFromText(text: string): PatternMatch[] {
    return text.split("\n").flatMap((line) => {
        const match = getPatternFromLine(line);
        return match ? [match] : [];
    });
}

const patternDiagnosticsSource = "hex-casting.pattern";
const directiveDiagnosticsSource = "hex-casting.directive";

function refreshDiagnostics(
    document: vscode.TextDocument,
    patternCollection: vscode.DiagnosticCollection,
    directiveCollection: vscode.DiagnosticCollection,
): void {
    if (!enableDiagnostics) return;

    const patternDiagnostics: vscode.Diagnostic[] = [];
    const directiveDiagnostics: vscode.Diagnostic[] = [];

    const newMacroRegistry: Registry<MacroPatternInfo> = {};

    let inComment = false;

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);

        if (!inComment) {
            // pattern diagnostics
            const match = getPatternFromLine(line.text);
            if (match != null && !isInRegistry(document, prepareTranslation(match.pattern))) {
                const start = new vscode.Position(lineIndex, match.prefix.length);
                const end = start.translate({ characterDelta: match.pattern.length });

                patternDiagnostics.push({
                    range: new vscode.Range(start, end),
                    message: `Unknown pattern: "${match.pattern}".`,
                    severity: vscode.DiagnosticSeverity.Warning,
                    source: patternDiagnosticsSource,
                });
            }

            // #define diagnostics
            if (/#define([^a-zA-Z]|$)/.test(line.text)) {
                const match = defineRe.exec(line.text);

                if (match == null) {
                    // hopefully more helpful error messages for broken #define
                    let causes = [];
                    if (!/^#define/.test(line.text)) {
                        causes.push("illegal whitespace at start of line");
                    }
                    if (!/\(.+\)/.test(line.text)) {
                        causes.push("missing angle signature");
                    }
                    if (/^[^=]+=\s*(\/\/|\/\*|$)/.test(line.text)) {
                        causes.push("missing args after `=`");
                    }

                    // in case nothing matched, make sure it still looks all nice and pretty
                    let message = "Malformed #define directive";
                    if (causes.length > 1) {
                        message += `:\n- ${causes.join("\n- ")}`;
                    } else if (causes.length == 1) {
                        message += `: ${causes[0]}.`;
                    } else {
                        message += ".";
                    }

                    directiveDiagnostics.push({
                        range: line.range,
                        message,
                        severity: vscode.DiagnosticSeverity.Error,
                        source: directiveDiagnosticsSource,
                    });
                } else {
                    const {
                        directionPrefix,
                        directive,
                        translation,
                        direction: rawDirection,
                        pattern,
                        args,
                    } = match.groups as {
                        [key: string]: string;
                    } & { args: string | undefined };

                    const nameStart = new vscode.Position(lineIndex, directive.length);
                    const nameEnd = nameStart.translate({ characterDelta: translation.length });
                    const nameRange = new vscode.Range(nameStart, nameEnd);

                    const directionStart = new vscode.Position(lineIndex, directionPrefix.length);
                    const directionEnd = directionStart.translate({ characterDelta: rawDirection.length });
                    const directionRange = new vscode.Range(directionStart, directionEnd);

                    const direction = prepareDirection(rawDirection);
                    if (!direction) {
                        directiveDiagnostics.push({
                            range: directionRange,
                            message: `Invalid direction "${rawDirection}".`,
                            severity: vscode.DiagnosticSeverity.Error,
                            source: directiveDiagnosticsSource,
                        });
                    }

                    if (isInDefaultRegistry(prepareTranslation(translation))) {
                        directiveDiagnostics.push({
                            range: nameRange,
                            message: `Pattern "${translation}" already exists.`,
                            severity: vscode.DiagnosticSeverity.Error,
                            source: directiveDiagnosticsSource,
                        });
                    } else if (isInMacroRegistry(document, translation, newMacroRegistry)) {
                        directiveDiagnostics.push({
                            range: nameRange,
                            message: `Pattern "${translation}" is defined in a previous #define directive.`,
                            severity: vscode.DiagnosticSeverity.Error,
                            source: directiveDiagnosticsSource,
                        });
                    } else if (direction) {
                        newMacroRegistry[translation] = new MacroPatternInfo(
                            direction,
                            pattern,
                            args?.replace(/\-\>/g, "→"),
                        );
                    }
                }
            }

            if (/\/\*((?!\*\/).)*$/.test(line.text)) {
                inComment = true;
            }
        } else if (/\*\/((?!\/\*).)*$/.test(line.text)) {
            inComment = false;
        }
    }

    patternCollection.set(document.uri, patternDiagnostics);
    directiveCollection.set(document.uri, directiveDiagnostics);

    macroRegistry.set(document.uri, newMacroRegistry);
}

class DiagnosticsProvider implements vscode.DocumentLinkProvider {
    constructor(
        public patternCollection: vscode.DiagnosticCollection,
        public directiveCollection: vscode.DiagnosticCollection,
    ) {}

    provideDocumentLinks(
        document: vscode.TextDocument,
        token: vscode.CancellationToken,
    ): vscode.ProviderResult<vscode.DocumentLink[]> {
        refreshDiagnostics(document, this.patternCollection, this.directiveCollection);
        return;
    }
}

class PatternInlayHintsProvider implements vscode.InlayHintsProvider {
    provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        _token: vscode.CancellationToken,
    ): vscode.ProviderResult<vscode.InlayHint[]> {
        const lines = document.getText(range).split("\n");
        const hints = [];

        let inComment = false;

        for (const [i, line] of lines.entries()) {
            const match = getPatternFromLine(line);

            if (match != null && match.pattern != "{" && match.pattern != "}") {
                const translation = prepareTranslation(match.pattern);

                let hint_text;
                if (showMacroNameHints && isInMacroRegistry(document, match.pattern)) {
                    hint_text = "(macro)";
                } else if (showInternalNameHints && isInDefaultRegistry(translation)) {
                    const patternInfo = getFromRegistry(document, translation)!;
                    hint_text = `${patternInfo.name}`;
                }

                if (hint_text != null) {
                    const line = range.start.line + i;
                    const character = (i == 0 ? range.start.character : 0) + match.prefix.length + match.pattern.length;

                    const hint = new vscode.InlayHint(
                        new vscode.Position(line, character),
                        ` ${hint_text}`,
                        vscode.InlayHintKind.Type,
                    );
                    hints.push(hint);
                }
            }
        }

        return hints;
    }
}

class ExpandShorthandProvider implements vscode.CodeActionProvider {
    static metadata: vscode.CodeActionProviderMetadata = {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    };

    makeFix(document: vscode.TextDocument, range: vscode.Range, replacement: string): vscode.CodeAction {
        const fix: vscode.CodeAction = {
            title: `Replace with "${replacement}"`,
            kind: vscode.CodeActionKind.QuickFix,
            edit: new vscode.WorkspaceEdit(),
        };
        fix.edit!.replace(document.uri, range, replacement);
        return fix;
    }

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        _context: vscode.CodeActionContext,
        _token: vscode.CancellationToken,
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        if (range.isEmpty) range = document.getWordRangeAtPosition(range.start) ?? range;
        if (range.isEmpty) return;

        const text = document.getText(range);
        const match = getPatternFromLine(text);
        let result;
        if (
            match != null &&
            !isInRegistry(document, prepareTranslation(match.pattern)) &&
            (result = tryLookupShorthand(
                document,
                match.pattern,
                getRestOfLine(document, range.start, match.prefix.length + match.pattern.length),
            ))
        ) {
            const start = range.start.translate({ characterDelta: match.prefix.length });
            const end = start.translate({ characterDelta: match.pattern.length });
            const fixRange = new vscode.Range(start, end);

            if (Array.isArray(result)) {
                return result.map((replacement) => this.makeFix(document, fixRange, replacement));
            } else {
                return [this.makeFix(document, fixRange, result)];
            }
        }
    }
}

class ExpandAllShorthandProvider implements vscode.CodeActionProvider {
    static metadata: vscode.CodeActionProviderMetadata = {
        providedCodeActionKinds: [vscode.CodeActionKind.SourceFixAll],
    };

    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        _context: vscode.CodeActionContext,
        _token: vscode.CancellationToken,
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const diagnostics = vscode.languages
            .getDiagnostics(document.uri)
            .filter((diagnostic) => diagnostic.source === patternDiagnosticsSource);

        const fix: vscode.CodeAction = {
            title: "Replace all shorthand in document with full patterns",
            kind: vscode.CodeActionKind.SourceFixAll,
            edit: new vscode.WorkspaceEdit(),
            diagnostics: [],
        };

        for (const diagnostic of diagnostics) {
            const match = getPatternFromLine(document.getText(diagnostic.range));
            let result;
            if (
                match != null &&
                (result = tryLookupShorthand(
                    document,
                    match.pattern,
                    getRestOfLine(document, diagnostic.range.start, match.prefix.length + match.pattern.length),
                )) &&
                !Array.isArray(result)
            ) {
                fix.edit!.replace(document.uri, diagnostic.range, result);
                fix.diagnostics!.push(diagnostic);
            }
        }

        if (fix.diagnostics!.length) return [fix];
    }
}

const bbCodeColors = ["orange", "yellow", "lightgreen", "cyan", "pink"];

function getBBCodeColor(indent: number): string {
    if (indent < 0) return "red";
    if (indent == 0) return "#9966cc";
    return bbCodeColors[(indent - 1) % bbCodeColors.length];
}

function generateBookkeeper(mask: string): { direction: Direction; pattern: string } {
    let direction: Direction, pattern: string;
    if (mask[0] == "v") {
        direction = "SOUTH_EAST";
        pattern = "a";
    } else {
        direction = "EAST";
        pattern = "";
    }

    for (let i = 0; i < mask.length - 1; i++) {
        const previous = mask[i];
        const current = mask[i + 1];

        switch (previous + current) {
            case "--":
                pattern += "w";
                break;
            case "-v":
                pattern += "ea";
                break;
            case "v-":
                pattern += "e";
                break;
            case "vv":
                pattern += "da";
                break;
        }
    }

    return { direction, pattern };
}

function validateAngleSignature(value: string): string | undefined {
    if (!value) return "Field is required.";
}

const numbers = new Map<number, { direction: Direction; pattern: string }>();

async function copySelectionAsBBCodeCommand({ selection, document }: vscode.TextEditor): Promise<void> {
    const diagnostics = vscode.languages
        .getDiagnostics(document.uri)
        .filter((diagnostic) => diagnostic.source === patternDiagnosticsSource && selection.contains(diagnostic.range));

    if (diagnostics.length) {
        vscode.window.showErrorMessage("Selection contains unknown patterns.");
        return;
    }

    const patterns: (PatternInfo & { num?: number; translation: string })[] = [];
    const unknownNumbers = new Set<number>();

    for (const { pattern: translation, isEscaped } of getPatternsFromText(document.getText(selection))) {
        const patternInfo = getFromRegistry(document, prepareTranslation(translation))!;
        const param = /: (.+)/.exec(translation)?.[1];

        if (isEscaped) {
            patterns.push({
                ...defaultRegistry["Consideration"],
                translation: "Consideration",
            });
        }

        switch (patternInfo.name) {
            case "mask":
                patterns.push({
                    ...patternInfo,
                    translation,
                    ...generateBookkeeper(param!),
                });
                break;

            case "number":
                const num = parseFloat(param!);
                patterns.push({
                    ...patternInfo,
                    translation,
                    num,
                });
                if (!numbers.has(num)) unknownNumbers.add(num);
                break;

            default:
                patterns.push({
                    ...patternInfo,
                    translation,
                });
        }
    }

    if (!patterns.length) {
        vscode.window.showErrorMessage("Selection doesn't contain any patterns.");
        return;
    }

    if (unknownNumbers.size) {
        let step = 1;

        for (const num of unknownNumbers.values()) {
            const result = await showInputBox({
                title: `Enter angle signature for Numerical Reflection: ${num}`,
                step: step++,
                totalSteps: unknownNumbers.size,
                placeholder: "EAST aqwed",
                ignoreFocusOut: true,
                valuePrefix: num >= 0 ? "SOUTH_EAST aqaa" : "NORTH_EAST dedd",
                validate: validateAngleSignature,
            });

            if (!result) {
                vscode.window.showErrorMessage("Cancelled.");
                return;
            }

            const [rawDirection, pattern] = result.split(" ");
            const direction = prepareDirection(rawDirection)!;
            numbers.set(num, { direction, pattern });
        }
    }

    let bbCode = `[pcolor=${getBBCodeColor(0)}]`;
    let indent = 0;
    let isEscaped = false;
    let stopEscape = false;

    for (const { name, translation, num, ...rest } of patterns) {
        const { direction, pattern } = num != undefined ? numbers.get(num) ?? rest : rest;

        // consider color
        if (isEscaped) {
            if (stopEscape) {
                isEscaped = false;
                stopEscape = false;
            } else {
                stopEscape = true;
            }
        }
        if (name === "escape" && !isEscaped) isEscaped = true;
        const color = isEscaped ? ` color=${getBBCodeColor(0)}` : "";

        // retro color
        if (name === "close_paren" && !isEscaped) bbCode += `[/pcolor][pcolor=${getBBCodeColor(--indent)}]`;

        // the actual pattern
        if (pattern != null && direction != null) {
            bbCode += `[pat=${pattern!} dir=${shortenDirection(direction!)}${color}]`;
        } else if (name != null) {
            bbCode += `[pat=${name}${color}]`;
        } else {
            vscode.window.showErrorMessage(`Couldn't generate BBCode for "${translation}".`);
            return;
        }

        // intro color
        if (name === "open_paren" && !isEscaped) bbCode += `[/pcolor][pcolor=${getBBCodeColor(++indent)}]`;
    }

    bbCode += "[/pcolor]";
    vscode.env.clipboard.writeText(bbCode);
    vscode.window.showInformationMessage("Copied BBCode for selected patterns.");
}

export function activate(context: vscode.ExtensionContext) {
    updateConfiguration();

    const patternCollection = vscode.languages.createDiagnosticCollection("hex-casting.patterns");
    const directiveCollection = vscode.languages.createDiagnosticCollection("hex-casting.directives");

    let document: vscode.TextDocument | undefined;
    if ((document = vscode.window.activeTextEditor?.document) && vscode.languages.match(selector, document)) {
        refreshDiagnostics(document, patternCollection, directiveCollection);
    }

    context.subscriptions.push(
        // completions
        vscode.languages.registerCompletionItemProvider(
            selector,
            new SpecialCompletionItemProvider("Numerical Reflection", /-?(\d*\.\d*|\d+)/),
            ..."-0123456789.",
        ),
        vscode.languages.registerCompletionItemProvider(
            selector,
            new SpecialCompletionItemProvider("Bookkeeper's Gambit", /[v\-]+/, [..."v-"]),
            ..."v-",
        ),
        vscode.languages.registerCompletionItemProvider(selector, new ConsiderationCompletionItemProvider(), "\\"),
        vscode.languages.registerCompletionItemProvider(
            selector,
            new PatternCompletionItemProvider(),
            ..."abcdefghijklmnopqrstuvwxyz0123456789-",
        ),

        // hover
        vscode.languages.registerHoverProvider(selector, new PatternHoverProvider()),

        // inlay hints
        vscode.languages.registerInlayHintsProvider(selector, new PatternInlayHintsProvider()),

        // configuration
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("hex-casting")) {
                updateConfiguration();

                if (!enableDiagnostics) {
                    patternCollection.clear();
                    directiveCollection.clear();
                }
            }
        }),

        // diagnostics
        patternCollection,
        directiveCollection,
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && vscode.languages.match(selector, editor.document)) {
                refreshDiagnostics(editor.document, patternCollection, directiveCollection);
            }
        }),
        // because onDidChangeTextDocument fires way too often
        vscode.languages.registerDocumentLinkProvider(
            selector,
            new DiagnosticsProvider(patternCollection, directiveCollection),
        ),
        vscode.workspace.onDidCloseTextDocument((document) => {
            patternCollection.delete(document.uri);
            directiveCollection.delete(document.uri);
        }),

        // code actions
        vscode.languages.registerCodeActionsProvider(
            selector,
            new ExpandShorthandProvider(),
            ExpandShorthandProvider.metadata,
        ),
        vscode.languages.registerCodeActionsProvider(
            selector,
            new ExpandAllShorthandProvider(),
            ExpandAllShorthandProvider.metadata,
        ),

        // commands
        vscode.commands.registerTextEditorCommand("hex-casting.copySelectionAsBBCode", copySelectionAsBBCodeCommand),
    );
}

export function deactivate() {}
