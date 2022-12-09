"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const registry_json_1 = __importDefault(require("./data/registry.json"));
const output = vscode.window.createOutputChannel("Hex Casting");
const selector = { scheme: "file", language: "hexcasting" };
const completionList = Object.entries(registry_json_1.default).flatMap(([name, translation]) => {
    const base = {
        label: translation,
        detail: name,
        kind: vscode.CompletionItemKind.Function,
        insertText: ["mask", "number"].includes(name) ? translation + ": " : undefined,
    };
    return [base, { ...base, filterText: name }];
});
class PatternCompletionItemProvider {
    provideCompletionItems(document, position, token, context) {
        return completionList;
    }
}
class NumberCompletionItemProvider {
    provideCompletionItems(document, position, token, context) {
        const range = document.getWordRangeAtPosition(position, /-?\d+/);
        if (range === undefined)
            return;
        const text = document.getText(range);
        return [{
                label: `Numerical Reflection: ${text}`,
                range,
                preselect: true,
                filterText: text,
            }];
    }
}
class BookkeeperCompletionItemProvider {
    provideCompletionItems(document, position, token, context) {
        const range = document.getWordRangeAtPosition(position, /[v\-]+/);
        if (range === undefined)
            return;
        const text = document.getText(range);
        return [{
                label: `Bookkeeper's Gambit: ${text}`,
                range,
                preselect: true,
                filterText: text,
            }];
    }
}
function activate(context) {
    vscode.languages.registerCompletionItemProvider(selector, new PatternCompletionItemProvider(), ..."abcdefghijklmnopqrstuvwxyz");
    vscode.languages.registerCompletionItemProvider(selector, new NumberCompletionItemProvider(), ..."-0123456789");
    vscode.languages.registerCompletionItemProvider(selector, new BookkeeperCompletionItemProvider(), ..."v-");
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map