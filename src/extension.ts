import * as vscode from "vscode";
import untypedRegistry from "./data/registry.json";
import untypedShorthandLookup from "./data/shorthand.json";

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

class MacroPatternInfo implements PatternInfo {
    public args: string | null;

    public modName = "macro";
    public image = null;
    public direction = null;
    public pattern = null;
    public url = null;

    constructor(args?: string) {
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
const defaultRegistry: Registry<DefaultPatternInfo> = untypedRegistry;
const macroRegistry: Map<vscode.Uri, Registry<MacroPatternInfo>> = new Map();
const themePaths = {
    [vscode.ColorThemeKind.Dark]: "dark/",
    [vscode.ColorThemeKind.HighContrast]: "dark/",
    [vscode.ColorThemeKind.HighContrastLight]: "light/",
    [vscode.ColorThemeKind.Light]: "light/",
};

const shorthandLookup: ShorthandLookup = untypedShorthandLookup;
for (const [translation, pattern] of Object.entries(defaultRegistry)) {
    if (!Object.prototype.hasOwnProperty.call(shorthandLookup, pattern.name)) {
        shorthandLookup[pattern.name] = translation;
    }
}

let appendNewline: AppendNewline;
let enableDiagnostics: boolean;

function updateConfiguration() {
    appendNewline = vscode.workspace.getConfiguration(rootSection).get("appendNewline")!;
    enableDiagnostics = vscode.workspace.getConfiguration(rootSection).get("enableDiagnostics")!;
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

    if (direction != null && pattern != null) result = result.appendMarkdown(`\n\n\`${direction} ${pattern}\``);

    return result;
}

function getInsertTextSuffix(hasParam: boolean, trimmedNextLine: string): string {
    if (hasParam) return ": ";
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
        .replace(/{/g, "Introspection")
        .replace(/}/g, "Retrospection")
        .replace(
            /(?<=Bookkeeper's Gambit):\s*[v-]+|(?<=Numerical Reflection):\s*-?(?:\d*\.\d*|\d+)|(?<=Consideration):.*/g,
            "",
        );
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

function makeCompletionItem(
    document: vscode.TextDocument,
    label: string,
    hasParam: boolean,
    trimmedNextLine: string,
    range: vscode.Range,
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
        insertText: label + getInsertTextSuffix(hasParam, trimmedNextLine),
        range,
    };
}

function makeCompletionItems(
    document: vscode.TextDocument,
    label: string,
    hasParam: boolean,
    trimmedNextLine: string,
    range: vscode.Range,
    patternInfo?: PatternInfo,
): vscode.CompletionItem[] {
    patternInfo = patternInfo ?? getFromRegistry(document, label)!;
    const { name } = patternInfo;

    const base = makeCompletionItem(document, label, hasParam, trimmedNextLine, range, patternInfo);
    return [base, ...(name ? [{ ...base, filterText: name, sortText: "~" + label }] : [])];
}

function makeCompletionList(
    document: vscode.TextDocument,
    trimmedNextLine: string,
    range: vscode.Range,
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
                patternInfo,
            ),
        );
}

function shouldSkipCompletions(line: string): boolean {
    return /\S\s|\/\/|\/\*/.test(line.replace(/Consideration:/g, "")) || line.startsWith("#");
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
        const range = document.lineAt(position.line).range.with({ start: rangeStart });
        return [
            ...makeCompletionList(document, trimmedNextLine, range),
            ...makeCompletionItems(document, "Consideration", !line.includes("Consideration:"), trimmedNextLine, range),
        ];
    }
}

class SpecialCompletionItemProvider implements vscode.CompletionItemProvider {
    constructor(public translation: string, public regex: RegExp) {}

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
        const range = wordRange.with({ end: document.lineAt(position.line).range.end });

        return [
            {
                ...makeCompletionItem(document, label, false, trimmedNextLine, range, patternInfo),
                kind: undefined,
                preselect: true,
                filterText: text,
            },
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
        const range = isSingle ? wordRange : wordRange.with({ end: document.lineAt(position.line).range.end });

        return [
            {
                ...makeCompletionItem(
                    document,
                    label,
                    isSingle,
                    trimmedNextLine,
                    range,
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
    /^(?<prefix>[ \t]*)(?<escape>Consideration: *)?(?!\/\/|\/\*| )(?<pattern>[a-zA-Z0-9:'+\-\./ _]+?)(?= *(?:\/\/|\/\*|{|}|$))/;
const defineRe = /^(#define[ \t]+)(?=[^ \t])([^=]+?)[ \t]*(?:=[ \t]*(?=[^ \t])(.+?)[ \t]*)?(?:\/\/|\/\*|$)/;

/**
 * @returns [prefix, pattern, isEscaped]
 */
function getPatternFromLine(text: string): [string, string, boolean] | [undefined, undefined, undefined] {
    const groups = patternRe.exec(text.trimEnd())?.groups;
    return groups
        ? [groups.prefix + (groups.escape ?? ""), groups.pattern, !!groups.escape]
        : [undefined, undefined, undefined];
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
            const [prefix, pattern] = getPatternFromLine(line.text);
            if (pattern != null && !isInRegistry(document, prepareTranslation(pattern))) {
                const start = new vscode.Position(lineIndex, prefix.length);
                const end = start.translate({ characterDelta: pattern.length });

                const diagnostic = new vscode.Diagnostic(
                    new vscode.Range(start, end),
                    `Unknown pattern: "${pattern}".`,
                    vscode.DiagnosticSeverity.Warning,
                );
                diagnostic.source = patternDiagnosticsSource;
                patternDiagnostics.push(diagnostic);
            }

            // #define diagnostics
            if (/^#define([^a-zA-Z]|$)/.test(line.text)) {
                defineRe.lastIndex = 0;
                const match = defineRe.exec(line.text);
                let diagnostic: vscode.Diagnostic | undefined;

                if (match == null) {
                    diagnostic = new vscode.Diagnostic(
                        line.range,
                        "Malformed #define directive.",
                        vscode.DiagnosticSeverity.Error,
                    );
                } else {
                    const nameStart = new vscode.Position(lineIndex, match[1].length);
                    const nameEnd = nameStart.translate({ characterDelta: match[2].length });

                    if (isInDefaultRegistry(prepareTranslation(match[2]))) {
                        diagnostic = new vscode.Diagnostic(
                            new vscode.Range(nameStart, nameEnd),
                            `Pattern "${match[2]}" already exists.`,
                            vscode.DiagnosticSeverity.Error,
                        );
                    } else if (isInMacroRegistry(document, match[2], newMacroRegistry)) {
                        diagnostic = new vscode.Diagnostic(
                            new vscode.Range(nameStart, nameEnd),
                            `Pattern "${match[2]}" is defined in a previous #define directive.`,
                            vscode.DiagnosticSeverity.Error,
                        );
                    } else {
                        newMacroRegistry[match[2]] = new MacroPatternInfo(match[3]?.replace(/\-\>/g, "→"));
                    }
                }

                if (diagnostic) {
                    diagnostic.source = directiveDiagnosticsSource;
                    directiveDiagnostics.push(diagnostic);
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

class MacroInlayHintsProvider implements vscode.InlayHintsProvider {
    provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        _token: vscode.CancellationToken,
    ): vscode.ProviderResult<vscode.InlayHint[]> {
        const lines = document.getText(range).split("\n");
        const hints = [];

        let inComment = false;

        for (const [i, line] of lines.entries()) {
            const [prefix, pattern] = getPatternFromLine(line);
            if (pattern != null && isInMacroRegistry(document, pattern)) {
                const line = range.start.line + i;
                const character = (i == 0 ? range.start.character : 0) + prefix.length + pattern.length;

                const hint = new vscode.InlayHint(
                    new vscode.Position(line, character),
                    " (macro)",
                    vscode.InlayHintKind.Type,
                );
                hints.push(hint);
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
        const [prefix, pattern] = getPatternFromLine(text);
        let result;
        if (
            pattern != null &&
            !isInRegistry(document, prepareTranslation(pattern)) &&
            (result = tryLookupShorthand(
                document,
                pattern,
                getRestOfLine(document, range.start, prefix.length + pattern.length),
            ))
        ) {
            const start = range.start.translate({ characterDelta: prefix.length });
            const end = start.translate({ characterDelta: pattern.length });
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
            const [prefix, pattern] = getPatternFromLine(document.getText(diagnostic.range));
            let result;
            if (
                pattern != null &&
                (result = tryLookupShorthand(
                    document,
                    pattern,
                    getRestOfLine(document, diagnostic.range.start, prefix.length + pattern.length),
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
            new PatternCompletionItemProvider(),
            ..."abcdefghijklmnopqrstuvwxyz0123456789",
        ),
        vscode.languages.registerCompletionItemProvider(
            selector,
            new SpecialCompletionItemProvider("Numerical Reflection", /-?(\d*\.\d*|\d+)/),
            ..."-0123456789.",
        ),
        vscode.languages.registerCompletionItemProvider(
            selector,
            new SpecialCompletionItemProvider("Bookkeeper's Gambit", /[v\-]+/),
            ..."v-",
        ),
        vscode.languages.registerCompletionItemProvider(selector, new ConsiderationCompletionItemProvider(), "\\"),

        // hover
        vscode.languages.registerHoverProvider(selector, new PatternHoverProvider()),

        // inlay hints
        vscode.languages.registerInlayHintsProvider(selector, new MacroInlayHintsProvider()),

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
    );
}

export function deactivate() {}
