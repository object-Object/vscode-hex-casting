import * as vscode from "vscode";
import untypedRegistry from "./data/registry.json";

interface PatternInfo {
    name: string;
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

type AppendNewline = "always" | "auto" | "never";

const rootSection = "hex-casting";

const output = vscode.window.createOutputChannel("Hex Casting");
let appendNewline: AppendNewline = vscode.workspace.getConfiguration(rootSection).get("appendNewline")!;

const selector: vscode.DocumentSelector = [
    { scheme: "file", language: "hexcasting" },
    { scheme: "untitled", language: "hexcasting" },
];

const registry: { [translation: string]: PatternInfo } = untypedRegistry;

const themePaths = {
    [vscode.ColorThemeKind.Dark]: "dark/",
    [vscode.ColorThemeKind.HighContrast]: "dark/",
    [vscode.ColorThemeKind.HighContrastLight]: "light/",
    [vscode.ColorThemeKind.Light]: "light/",
};

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
            return !trimmedNextLine.length || /(?<!\/\*((?!\*\/).)*|\/\/.*)[\[{]/.test(trimmedNextLine) ? "\n" : "";
        case "never":
            return "";
    }
}

function makeCompletionItem(
    translation: string,
    hasParam: boolean,
    trimmedNextLine: string,
    range: vscode.Range,
    patternInfo?: PatternInfo,
): vscode.CompletionItem {
    patternInfo = patternInfo ?? registry[translation];
    const { name, args } = patternInfo;

    return {
        label: {
            label: translation,
            description: name,
        },
        detail: args ?? undefined,
        documentation: makeDocumentation(translation, patternInfo, 300, 300),
        kind: vscode.CompletionItemKind.Function,
        insertText: translation + getInsertTextSuffix(hasParam, trimmedNextLine),
        range,
    };
}

function makeCompletionItems(
    translation: string,
    hasParam: boolean,
    trimmedNextLine: string,
    range: vscode.Range,
    patternInfo?: PatternInfo,
): vscode.CompletionItem[] {
    patternInfo = patternInfo ?? registry[translation];
    const { name } = patternInfo;

    const base = makeCompletionItem(translation, hasParam, trimmedNextLine, range, patternInfo);
    return [base, { ...base, filterText: name, sortText: "~" + translation }];
}

function makeCompletionList(trimmedNextLine: string, range: vscode.Range): vscode.CompletionItem[] {
    return Object.entries(registry)
        .filter(([name]) => name != "escape")
        .flatMap<vscode.CompletionItem>(([translation, patternInfo]) =>
            makeCompletionItems(
                translation,
                ["mask", "number"].includes(patternInfo.name),
                trimmedNextLine,
                range,
                patternInfo,
            ),
        );
}

function shouldSkipCompletions(line: string): boolean {
    return /\S\s/.test(line.replace("Consideration:", ""));
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
            ...makeCompletionList(trimmedNextLine, range),
            ...makeCompletionItems("Consideration", !line.includes("Consideration:"), trimmedNextLine, range),
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
        const patternInfo = registry[this.translation];
        const trimmedNextLine = getTrimmedNextLine(document, position);
        const range = wordRange.with({ end: document.lineAt(position.line).range.end });

        return [
            {
                ...makeCompletionItem(label, false, trimmedNextLine, range, patternInfo),
                kind: undefined,
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
        const range = document.getWordRangeAtPosition(position);
        if (range === undefined) return;

        const translation = document
            .getText(range)
            .replace(/(?<=Bookkeeper's Gambit):\s*[v-]+|(?<=Numerical Reflection):\s*-?[0-9]+/, "")
            .trim();
        if (!(translation in registry)) return;

        const patternInfo = registry[translation];
        const { args } = patternInfo;

        return {
            contents: [
                ...(args ? [new vscode.MarkdownString(args)] : []),
                makeDocumentation(translation, patternInfo, undefined, 180),
            ],
        };
    }
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            selector,
            new PatternCompletionItemProvider(),
            ..."abcdefghijklmnopqrstuvwxyz0123456789\\", // \ is just so the consideration snippet will trigger
        ),
        vscode.languages.registerCompletionItemProvider(
            selector,
            new SpecialCompletionItemProvider("Numerical Reflection", /-?\d+/),
            ..."-0123456789",
        ),
        vscode.languages.registerCompletionItemProvider(
            selector,
            new SpecialCompletionItemProvider("Bookkeeper's Gambit", /[v\-]+/),
            ..."v-",
        ),
        vscode.languages.registerHoverProvider(selector, new PatternHoverProvider()),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("hex-casting.appendNewline")) {
                appendNewline = vscode.workspace.getConfiguration(rootSection).get("appendNewline")!;
            }
        }),
    );
}

export function deactivate() {}
