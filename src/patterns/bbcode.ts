import { shortenDirection } from "./shorthand";
import { PatternInfo, PatternSignature } from "./types";

export class BBCodeError extends Error {}

type BBCodePatternInfo = PatternInfo & { num?: number; translation: string };

export function generatePatternBBCode(
    patterns: BBCodePatternInfo[],
    numberLiterals: Map<number, PatternSignature>,
): string {
    let bbCode = `[pcolor=${getBBCodeColor(0)}]`;
    let indent = 0;
    let isEscaped = false;
    let stopEscape = false;

    for (let { name, translation, num, direction, pattern } of patterns) {
        // look up number literals if possible
        if (num != null && numberLiterals.has(num)) {
            ({ direction, pattern } = numberLiterals.get(num)!);
        }

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
            throw new BBCodeError(`Couldn't generate BBCode for "${translation}".`);
        }

        // intro color
        if (name === "open_paren" && !isEscaped) bbCode += `[/pcolor][pcolor=${getBBCodeColor(++indent)}]`;
    }

    bbCode += "[/pcolor]";
    return bbCode;
}

const bbCodeColors = ["orange", "yellow", "lightgreen", "cyan", "pink"];

function getBBCodeColor(indent: number): string {
    if (indent < 0) return "red";
    if (indent == 0) return "#9966cc";
    return bbCodeColors[(indent - 1) % bbCodeColors.length];
}
