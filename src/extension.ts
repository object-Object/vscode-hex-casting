import * as vscode from "vscode";
import untypedRegistry from "./data/registry.json";

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
        .replace("{", "Introspection")
        .replace("}", "Retrospection")
        .replace(/(?<=Bookkeeper's Gambit):\s*[v-]+|(?<=Numerical Reflection):\s*-?[0-9]+|(?<=Consideration):.*/, "")
        .trim();
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
    return /\S\s|\/\/|\/\*/.test(line.replace("Consideration:", "")) || line.startsWith("#");
}

function getTrimmedNextLine(document: vscode.TextDocument, position: vscode.Position): string {
    const nextLineNum = position.line + 1;
    return document.lineCount > nextLineNum ? document.lineAt(nextLineNum).text.trim() : "";
}

class PatternCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
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
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
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
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
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
        token: vscode.CancellationToken,
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
    /(?<=^\s*Consideration:\s*)(?!\/\/|\/\*)[a-zA-Z0-9+\-\./][a-zA-Z0-9:'+\-\./ ]*(?!\*)|(?<=^\s*)Consideration:?|(?<=^\s*)(?!\/\/)[a-zA-Z0-9:'+\-\./][a-zA-Z0-9:'+\-\./ ]*?(?=\/\/|\/\*)|(?<=^\s*)(?!\/\/|\/\*)[a-zA-Z0-9+\-\./][a-zA-Z0-9:'+\-\./ ]*/g;
const defineRe = /^(#define[ \t]+)(?=[^ \t])([^=]+?)[ \t]*(?:=[ \t]*(?=[^ \t])(.+?)[ \t]*)?(?:\/\/|\/\*|$)/;

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
            for (const match of line.text.matchAll(patternRe)) {
                const translation = prepareTranslation(match[0]);
                if (!isInRegistry(document, translation)) {
                    const start = new vscode.Position(lineIndex, match.index!);
                    const end = start.translate({ characterDelta: translation.length });

                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(start, end),
                        `Unknown pattern: "${translation}".`,
                        vscode.DiagnosticSeverity.Warning,
                    );
                    patternDiagnostics.push(diagnostic);
                }
            }

            // #define diagnostics
            if (/^#define([^a-zA-Z]|$)/.test(line.text)) {
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
                        newMacroRegistry[match[2]] = new MacroPatternInfo(match[3]?.replace("->", "→"));
                    }
                }

                if (diagnostic) directiveDiagnostics.push(diagnostic);
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
        token: vscode.CancellationToken,
    ): vscode.ProviderResult<vscode.InlayHint[]> {
        const lines = document.getText(range).split("\n");
        const hints = [];

        let inComment = false;

        for (const [i, line] of lines.entries()) {
            for (const match of line.matchAll(patternRe)) {
                if (isInMacroRegistry(document, match[0])) {
                    const line = range.start.line + i;
                    const character = (i == 0 ? range.start.character : 0) + match.index! + match[0].length;

                    const hint = new vscode.InlayHint(
                        new vscode.Position(line, character),
                        " (macro)",
                        vscode.InlayHintKind.Type,
                    );
                    hints.push(hint);
                }
            }
        }

        return hints;
    }
}

export function activate(context: vscode.ExtensionContext) {
    updateConfiguration();

    const patternCollection = vscode.languages.createDiagnosticCollection("hex-casting.patterns");
    const directiveCollection = vscode.languages.createDiagnosticCollection("hex-casting.directives");

    let document: vscode.TextDocument | undefined;
    if ((document = vscode.window.activeTextEditor?.document)) {
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
    );
}

export function deactivate() {}
