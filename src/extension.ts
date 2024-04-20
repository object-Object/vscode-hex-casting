import * as vscode from "vscode";
import untypedRegistry from "./data/registry.json";
import untypedShorthandLookup from "./data/shorthand.json";
import showInputBox from "./showInputBox";
import numbers2000 from "./data/numbers_2000.json";
import { normalize, parse } from "path";
import { BBCodeError, generatePatternBBCode } from "./patterns/bbcode";
import { prepareDirection, shortenDirection } from "./patterns/shorthand";
import {
    DefaultPatternInfo,
    Direction,
    MacroPatternInfo,
    PatternInfo,
    Registry,
    ShorthandLookup,
} from "./patterns/types";
import { activateHexDebug } from "./debug";

const rootSection = "hex-casting";
const output = vscode.window.createOutputChannel("Hex Casting");
const selector: vscode.DocumentSelector = [
    { scheme: "file", language: "hexcasting" },
    { scheme: "untitled", language: "hexcasting" },
];

let defaultRegistry: Registry<DefaultPatternInfo> = untypedRegistry;

const macroRegistries: Map<string, Registry<MacroPatternInfo>> = new Map();
const macroRegistriesWithImports: Map<string, Registry<MacroPatternInfo>> = new Map();

const currentlyLoading: Map<string, number> = new Map();

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

interface Configuration {
    appendNewline: "always" | "auto" | "never";
    inlayHints: {
        internalNames: {
            enabled: boolean;
            modID: {
                hexCasting: boolean;
                otherMods: boolean;
            };
        };
        macros: {
            enabled: boolean;
        };
    };
    enabledMods: { [modName: string]: boolean };
}

let config: Configuration;
let diagnosticsEnabled: boolean;

function filterObject<V>(obj: { [key: string]: V }, callback: (entry: [string, V]) => boolean): { [key: string]: V } {
    return Object.fromEntries(Object.entries(obj).filter(callback));
}

function updateConfiguration() {
    // load configuration
    let workspaceConfiguration = vscode.workspace.getConfiguration(rootSection);
    config = workspaceConfiguration as unknown as Configuration;

    // handle deprecated option
    diagnosticsEnabled = workspaceConfiguration.enableDiagnostics ?? workspaceConfiguration.diagnostics.enabled;

    // clone the untyped registry and only include entries where the mod is enabled
    defaultRegistry = filterObject(JSON.parse(JSON.stringify(untypedRegistry)), ([_, { modName }]) => {
        if (!config.enabledMods.hasOwnProperty(modName)) {
            throw new Error(`Mod missing from config option hex-casting.enabledMods: "${modName}"`);
        }
        return config.enabledMods[modName];
    });
    shorthandLookup = makeShorthandLookup();
}

// maxImageSize overrides maxImageHeight
function makeDocumentation(
    translation: string,
    { modName, image, direction, pattern, url, description }: PatternInfo,
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

    if (description != null) result = result.appendMarkdown(`\n\n${description}`);

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
    switch (config.appendNewline) {
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

function isInDefaultRegistry(translation: string): boolean {
    return Object.prototype.hasOwnProperty.call(defaultRegistry, translation);
}

function isInMacroRegistry(
    document: vscode.TextDocument,
    translation: string,
    newRegistry?: Registry<MacroPatternInfo>,
): boolean {
    const documentMacros = newRegistry ?? macroRegistriesWithImports.get(document.uri.fsPath);
    return documentMacros ? Object.prototype.hasOwnProperty.call(documentMacros, translation) : false;
}

function isInRegistry(document: vscode.TextDocument, translation: string): boolean {
    return isInDefaultRegistry(translation) || isInMacroRegistry(document, translation);
}

function getFromRegistry(document: vscode.TextDocument, translation: string): PatternInfo | undefined {
    return defaultRegistry[translation] ?? macroRegistriesWithImports.get(document.uri.fsPath)?.[translation];
}

function getRegistryEntries(document: vscode.TextDocument): [string, PatternInfo][] {
    const documentMacros = macroRegistriesWithImports.get(document.uri.fsPath);
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

const includeRe = /^#include[ \t]+"(?<path>.+?)"(?:\/\/|\/\*|$)/;

interface DefineRegexGroups {
    directionPrefix: string;
    directive: string;
    translation: string;
    direction: string;
    pattern: string;
    args: string | undefined;
}

function shouldSkipCompletions(line: string): boolean {
    return /\S\s|\/\/|\/\*/.test(line.replace(/Consideration:/g, "")) || defineRe.test(line) || includeRe.test(line);
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
    /^(?<prefix>[ \t]*)(?<escape>Consideration: *)?(?!\/\/|\/\*| )(?<pattern>(?:[a-zA-Z0-9:'+\-\./ _]+?|[{}\[\]]))(?: *<(?<iota>.+?)>)?(?= *(?:\/\/|\/\*|{|$))/gm;

interface PatternMatch {
    prefix: string;
    pattern: string;
    isEscaped: boolean;
    iota?: string;
}

function getPatternFromLine(text: string): PatternMatch | undefined {
    patternRe.lastIndex = 0;
    const groups = patternRe.exec(text.trimEnd())?.groups;
    return groups
        ? {
              prefix: groups.prefix + (groups.escape ?? ""),
              pattern: groups.pattern,
              isEscaped: !!groups.escape,
              iota: groups.iota,
          }
        : undefined;
}

function getPatternsFromText(text: string): PatternMatch[] {
    return text.split("\n").flatMap((line) => {
        const match = getPatternFromLine(line);
        return match ? [match] : [];
    });
}

async function forEachNonCommentLine(
    document: string[],
    callback: (line: string, lineIndex: number) => void | Promise<void>,
): Promise<void>;

async function forEachNonCommentLine(
    document: vscode.TextDocument,
    callback: (line: vscode.TextLine, lineIndex: number) => void | Promise<void>,
): Promise<void>;

async function forEachNonCommentLine(
    document: vscode.TextDocument | string[],
    callback: (line: any, lineIndex: number) => void | Promise<void>,
) {
    let inComment = false;
    let lineCount = Array.isArray(document) ? document.length : document.lineCount;

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        let line, lineText;
        if (Array.isArray(document)) {
            line = lineText = document[lineIndex];
        } else {
            line = document.lineAt(lineIndex);
            lineText = line.text;
        }

        if (!inComment) {
            if (/\/\*((?!\*\/).)*$/.test(lineText)) {
                inComment = true;
                continue;
            }
            await callback(line, lineIndex);
        } else if (/\*\/((?!\/\*).)*$/.test(lineText)) {
            inComment = false;
        }
    }
}

async function loadIncludedFile(
    document: vscode.TextDocument,
    lineText: string,
    patternCollection: vscode.DiagnosticCollection,
    directiveCollection: vscode.DiagnosticCollection,
): Promise<Registry<MacroPatternInfo> | Error | undefined> {
    if (!/^#include([^a-zA-Z]|$)/.test(lineText) || /^[^#]*\/\/.*#include/.test(lineText)) return;

    // show diagnostics
    const includeMatch = includeRe.exec(lineText);

    if (includeMatch == null) {
        let causes = [];
        if (!/^#include/.test(lineText)) {
            causes.push("illegal whitespace at start of line");
        }

        if (/^#include\s*$/.test(lineText)) {
            causes.push("missing file path");
        } else if (!/^#include\s*".+"/.test(lineText)) {
            causes.push("missing double quotes around file path");
        }

        // in case nothing matched, make sure it still looks all nice and pretty
        // this is copypasta, but so is literally everything else in this extension, so I don't care
        let message = "Malformed #include directive";
        if (causes.length > 1) {
            message += `:\n- ${causes.join("\n- ")}`;
        } else if (causes.length == 1) {
            message += `: ${causes[0]}.`;
        } else {
            message += ".";
        }

        return new Error(message);
    }

    // load the actual macros

    if (document.uri.scheme !== "file") {
        return new Error(
            `Can't use #include because the current file is not saved on disk (expected scheme file, got ${document.uri.scheme}).`,
        );
    }

    const { path: relativePath } = includeMatch.groups!;
    if (!relativePath.startsWith("./") && !relativePath.startsWith("../")) {
        return new Error("Path must start with ./ or ../ (ie. must be relative to the current file).");
    }

    const documentDir = parse(document.uri.fsPath).dir;
    let importUri = document.uri.with({ path: normalize(`${documentDir}/${relativePath}`) });

    if (document.uri.fsPath === importUri.fsPath) {
        return new Error(`Self-imports are not permitted.`);
    }

    // if the uri isn't in macroRegistries, load the document
    if (!macroRegistries.has(importUri.fsPath)) {
        output.appendLine(`Loading: ${importUri.fsPath}`);

        // hopefully this never happens
        let loadCount = currentlyLoading.get(importUri.fsPath) ?? 0;
        if (loadCount > 256) {
            const paths = [...currentlyLoading].join(", ");
            const message = `Infinite loop detected while importing. Please report this error to the extension developer. Paths: ${paths}`;

            vscode.window.showErrorMessage(message);
            return new Error(message);
        }

        currentlyLoading.set(importUri.fsPath, loadCount);
        try {
            const openedDocument = await vscode.workspace.openTextDocument(importUri);
            await refreshDirectivesAndDiagnostics(openedDocument, patternCollection, directiveCollection);
        } catch (error) {
            return new Error(`Failed to load "${importUri.fsPath}": ${error}`);
        } finally {
            currentlyLoading.delete(importUri.fsPath);
        }
    }

    // if the uri *still* isn't in macroRegistries, show a diagnostic
    // otherwise go ahead and return the imported macros
    return (
        macroRegistries.get(importUri.fsPath) ??
        new Error(`File "${importUri.fsPath}" couldn't be loaded or is not a hexpattern file.`)
    );
}

const patternDiagnosticsSource = "hex-casting.pattern";
const directiveDiagnosticsSource = "hex-casting.directive";

async function refreshDirectivesAndDiagnostics(
    document: vscode.TextDocument,
    patternCollection: vscode.DiagnosticCollection,
    directiveCollection: vscode.DiagnosticCollection,
): Promise<void> {
    const patternDiagnostics: vscode.Diagnostic[] = [];
    const directiveDiagnostics: vscode.Diagnostic[] = [];

    const newMacroRegistry: Registry<MacroPatternInfo> = {};
    let newMacroRegistryWithImports: Registry<MacroPatternInfo> = {};

    // local macros
    await forEachNonCommentLine(document, (line, lineIndex) => {
        if (!/#define([^a-zA-Z]|$)/.test(line.text) || /^[^#]*\/\/.*#define/.test(line.text)) return;

        const defineMatch = defineRe.exec(line.text);

        if (defineMatch == null) {
            // hopefully more helpful error messages for broken #define
            let causes = [];
            if (!/^#define/.test(line.text)) {
                causes.push("illegal whitespace at start of line");
            }
            if (/^#define\s*(\(|=|\/\/|\/\*|$)/.test(line.text)) {
                causes.push("missing name");
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
            return;
        }

        const {
            directionPrefix,
            directive,
            translation,
            direction: rawDirection,
            pattern,
            args,
        } = defineMatch.groups as unknown as DefineRegexGroups;

        const nameStart = new vscode.Position(lineIndex, directive.length);
        const nameEnd = nameStart.translate({ characterDelta: translation.length });
        const nameRange = new vscode.Range(nameStart, nameEnd);

        const directionStart = new vscode.Position(lineIndex, directionPrefix.length);
        const directionEnd = directionStart.translate({ characterDelta: rawDirection.length });
        const directionRange = new vscode.Range(directionStart, directionEnd);

        const newDiagnostics = [];

        const direction = prepareDirection(rawDirection);
        if (!direction) {
            newDiagnostics.push({
                range: directionRange,
                message: `Invalid direction "${rawDirection}".`,
                severity: vscode.DiagnosticSeverity.Error,
                source: directiveDiagnosticsSource,
            });
        }

        if (isInDefaultRegistry(prepareTranslation(translation))) {
            newDiagnostics.push({
                range: nameRange,
                message: `Pattern "${translation}" already exists.`,
                severity: vscode.DiagnosticSeverity.Error,
                source: directiveDiagnosticsSource,
            });
        } else if (isInMacroRegistry(document, translation, newMacroRegistryWithImports)) {
            newDiagnostics.push({
                range: nameRange,
                message: `Macro "${translation}" is defined in a previous #define directive.`,
                severity: vscode.DiagnosticSeverity.Error,
                source: directiveDiagnosticsSource,
            });
        }

        // only add the macro to the registry if there were no errors
        if (newDiagnostics.length) {
            directiveDiagnostics.push(...newDiagnostics);
            return;
        }

        newMacroRegistryWithImports[translation] = newMacroRegistry[translation] = new MacroPatternInfo(
            direction!,
            pattern,
            args?.replace(/\-\>/g, "→"),
        );
    });
    macroRegistries.set(document.uri.fsPath, newMacroRegistry);

    // imported macros
    await forEachNonCommentLine(document, async (line) => {
        let importedMacros = await loadIncludedFile(document, line.text, patternCollection, directiveCollection);
        if (importedMacros == null) return;
        if (importedMacros instanceof Error) {
            directiveDiagnostics.push({
                range: line.range,
                message: importedMacros.message,
                severity: vscode.DiagnosticSeverity.Error,
                source: directiveDiagnosticsSource,
            });
            return;
        }

        // check for conflicts
        let hasConflict = false;
        for (const translation of Object.keys(importedMacros)) {
            if (isInMacroRegistry(document, translation, newMacroRegistryWithImports)) {
                directiveDiagnostics.push({
                    range: line.range,
                    message: `Macro "${translation}" is also defined in another imported file.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    source: directiveDiagnosticsSource,
                });
            }

            if (isInMacroRegistry(document, translation, newMacroRegistry)) {
                directiveDiagnostics.push({
                    range: line.range,
                    message: `Macro "${translation}" is also defined in this file.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    source: directiveDiagnosticsSource,
                });
            }
        }
        if (hasConflict) return;

        // add to registry
        newMacroRegistryWithImports = { ...newMacroRegistryWithImports, ...importedMacros };
    });
    macroRegistriesWithImports.set(document.uri.fsPath, newMacroRegistryWithImports);

    // patterns
    await forEachNonCommentLine(document, (line, lineIndex) => {
        const patternMatch = getPatternFromLine(line.text);
        if (patternMatch != null && !isInRegistry(document, prepareTranslation(patternMatch.pattern))) {
            const start = new vscode.Position(lineIndex, patternMatch.prefix.length);
            const end = start.translate({ characterDelta: patternMatch.pattern.length });

            patternDiagnostics.push({
                range: new vscode.Range(start, end),
                message: `Unknown pattern: "${patternMatch.pattern}".`,
                severity: vscode.DiagnosticSeverity.Warning,
                source: patternDiagnosticsSource,
            });
        }
    });

    if (diagnosticsEnabled) {
        patternCollection.set(document.uri, patternDiagnostics);
        directiveCollection.set(document.uri, directiveDiagnostics);
    }
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
        return refreshDirectivesAndDiagnostics(document, this.patternCollection, this.directiveCollection).then(
            () => null,
        );
    }
}

class PatternInlayHintsProvider implements vscode.InlayHintsProvider {
    async provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        _token: vscode.CancellationToken,
    ): Promise<vscode.InlayHint[]> {
        const lines = document.getText(range).split(/\n|\r\n/);
        const hints: vscode.InlayHint[] = [];

        await forEachNonCommentLine(lines, (lineText, i) => {
            const match = getPatternFromLine(lineText);

            if (
                match == null ||
                match.pattern == "{" ||
                match.pattern == "}" ||
                match.pattern == "Consideration:" ||
                match.iota != null
            )
                return;

            const translation = prepareTranslation(match.pattern);

            let hintText;
            if (config.inlayHints.macros.enabled && isInMacroRegistry(document, translation)) {
                hintText = "(macro)";
            } else if (config.inlayHints.internalNames.enabled && isInDefaultRegistry(translation)) {
                const patternInfo = getFromRegistry(document, translation)!;

                const isFromHex = patternInfo.modid == "hexcasting";
                if (
                    (config.inlayHints.internalNames.modID.hexCasting && isFromHex) ||
                    (config.inlayHints.internalNames.modID.otherMods && !isFromHex)
                ) {
                    hintText = `${patternInfo.modid}:${patternInfo.name}`;
                } else {
                    hintText = patternInfo.name;
                }
            }
            if (hintText == null) return;

            const line = range.start.line + i;
            const character = (i == 0 ? range.start.character : 0) + match.prefix.length + match.pattern.length;

            const hint = new vscode.InlayHint(
                new vscode.Position(line, character),
                ` <${hintText}>`,
                vscode.InlayHintKind.Type,
            );
            hints.push(hint);
        });

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

const NUMBER_LITERALS = new Map<number, { direction: Direction; pattern: string }>(
    Object.entries(numbers2000).map(([num, [direction, pattern]]) => [
        parseInt(num),
        { direction: prepareDirection(direction)!, pattern },
    ]),
);

// converts the current primary selection to a list of patterns, prompting the user for an angle signature for any unknown numbers
async function getSelectionPatterns({ selection, document }: vscode.TextEditor, selectedText?: string) {
    const diagnostics = vscode.languages
        .getDiagnostics(document.uri)
        .filter(
            (diagnostic) =>
                (diagnostic.source === patternDiagnosticsSource || diagnostic.source === directiveDiagnosticsSource) &&
                selection.contains(diagnostic.range),
        );

    if (diagnostics.length) {
        vscode.window.showErrorMessage("Selection contains errors and/or unknown patterns.");
        return;
    }

    const patterns: (PatternInfo & { num?: number; translation: string; param?: string })[] = [];
    const unknownNumbers = new Set<number>();

    for (const { pattern: translation, isEscaped } of getPatternsFromText(
        selectedText ?? document.getText(selection),
    )) {
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
                    param,
                });
                break;

            case "number":
                const num = parseFloat(param!);
                patterns.push({
                    ...patternInfo,
                    translation,
                    num,
                    param,
                });
                if (!NUMBER_LITERALS.has(num)) unknownNumbers.add(num);
                break;

            default:
                patterns.push({
                    ...patternInfo,
                    translation,
                    name: patternInfo.modName !== "macro" ? patternInfo.name : undefined,
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
            NUMBER_LITERALS.set(num, { direction, pattern });
        }
    }

    return patterns;
}

async function copySelectionAsBBCodeCommand(editor: vscode.TextEditor): Promise<void> {
    const patterns = await getSelectionPatterns(editor);
    if (patterns == null) return;

    let bbCode;
    try {
        bbCode = generatePatternBBCode(patterns, NUMBER_LITERALS);
    } catch (e) {
        if (!(e instanceof BBCodeError)) throw e;
        vscode.window.showErrorMessage(e.message);
        return;
    }

    vscode.env.clipboard.writeText(bbCode);
    vscode.window.showInformationMessage("Copied BBCode for selected patterns.");
}

const FORUM_POST_REGEX = /(?<directive>#define .+$)\n(?:(?<comment>(?:^\s*\/\/+.*\n?)+)\n)?(?<patterns>(?:.|\n)+)/gm;

interface ForumPostRegexGroups {
    directive: string;
    comment: string | undefined;
    patterns: string;
}

async function copySelectedMacroAsForumPostCommand(editor: vscode.TextEditor): Promise<void> {
    const selectedText = editor.document.getText(editor.selection).trim();

    // waugh
    // replace \r\n with \n because otherwise it fails to match with CRLF line endings
    // use matchAll.next.value because otherwise it only finds the first named group?????
    const forumPostMatch = selectedText.replace(/\r\n/g, "\n").matchAll(FORUM_POST_REGEX).next().value;

    if (!forumPostMatch) {
        vscode.window.showErrorMessage(
            "Unsupported macro format. Must start with #define, then an optional comment, then at least one pattern. Multi-line comments (/* */) are not supported.",
        );
        return;
    }

    const {
        directive,
        comment: rawComment,
        patterns: rawPatterns,
    } = forumPostMatch.groups! as unknown as ForumPostRegexGroups;

    const defineMatch = defineRe.exec(directive);
    if (!forumPostMatch) {
        vscode.window.showErrorMessage("Failed to parse #define directive.");
        return;
    }

    const { translation: name, args, direction, pattern } = defineMatch?.groups! as unknown as DefineRegexGroups;

    let macroInput, macroOutput;
    if (args) {
        [macroInput, macroOutput] = args.split("->", 2).map((s) => (s ? `[u]${s.trim()}[/u]` : ""));
    }

    const comment = rawComment?.replace(/^[ \t]*\/\/+[ \t]*/gm, "");

    const patterns = await getSelectionPatterns(editor, rawPatterns);
    if (patterns == null) return; // getSelectionPatterns prints its own errors

    let bbCode;
    try {
        bbCode = generatePatternBBCode(patterns, NUMBER_LITERALS);
    } catch (e) {
        if (!(e instanceof BBCodeError)) throw e;
        vscode.window.showErrorMessage(e.message);
        return;
    }

    let forumPost = `[size=150]${name}[/size]\n`;
    if (macroInput || macroOutput) forumPost += `[b]${macroInput} → ${macroOutput}[/b]\n`;
    if (comment) forumPost += `${comment}\n`;
    forumPost += `[pat=${pattern} dir=${shortenDirection(direction)}]
[spoiler=Patterns]${bbCode}[/spoiler]
[code]${selectedText}[/code]`;

    vscode.env.clipboard.writeText(forumPost);
    vscode.window.showInformationMessage("Copied BBCode forum post for selected macro.");
}

async function copySelectionAsListCommand(editor: vscode.TextEditor): Promise<void> {
    let patterns = await getSelectionPatterns(editor);
    if (patterns == null) return;

    let list = [];

    for (const { name, translation, num, param, ...rest } of patterns) {
        let { direction, pattern } = num != undefined ? NUMBER_LITERALS.get(num) ?? rest : rest;

        if (name != null) {
            list.push(param ? `${name} ${param}` : name);
        } else if (direction != null) {
            direction = shortenDirection(direction);
            list.push(pattern ? `${direction} ${pattern}` : direction);
        } else {
            list.push(translation);
        }
    }

    vscode.env.clipboard.writeText(list.join(","));
    vscode.window.showInformationMessage("Copied selected patterns as a list for rendering with HexBug.");
}

export async function activate(context: vscode.ExtensionContext) {
    updateConfiguration();

    const patternCollection = vscode.languages.createDiagnosticCollection("hex-casting.patterns");
    const directiveCollection = vscode.languages.createDiagnosticCollection("hex-casting.directives");

    let document: vscode.TextDocument | undefined;
    if ((document = vscode.window.activeTextEditor?.document) && vscode.languages.match(selector, document)) {
        await refreshDirectivesAndDiagnostics(document, patternCollection, directiveCollection);
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

                if (!diagnosticsEnabled) {
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
                refreshDirectivesAndDiagnostics(editor.document, patternCollection, directiveCollection);
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
        vscode.commands.registerTextEditorCommand(
            "hex-casting.copySelectedMacroAsForumPost",
            copySelectedMacroAsForumPostCommand,
        ),
        vscode.commands.registerTextEditorCommand("hex-casting.copySelectionAsList", copySelectionAsListCommand),
    );

    activateHexDebug(context);
}

export function deactivate() {}
