import { shortenDirection } from "./shorthand";
import { PatternInfo, HexPattern } from "./types";

export class BBCodeError extends Error {}

type BBCodePatternInfo = PatternInfo & { num?: number; translation: string };

export function generatePatternBBCode(patterns: BBCodePatternInfo[], numberLiterals: Map<number, HexPattern>): string {
    let bbCode = `[pcolor=${getBBCodeColor(0)}]`;
    let indent = 0;
    let isEscaped = false;
    let stopEscape = false;

    for (let { id, idPath, translation, num, direction, signature } of patterns) {
        // look up number literals if possible
        if (num != null && numberLiterals.has(num)) {
            ({ direction, signature } = numberLiterals.get(num)!);
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
        if (id === "hexcasting:escape" && !isEscaped) isEscaped = true;
        const color = isEscaped ? ` color=${getBBCodeColor(0)}` : "";

        // retro color
        if (id === "hexcasting:close_paren" && !isEscaped) bbCode += `[/pcolor][pcolor=${getBBCodeColor(--indent)}]`;

        // the actual pattern
        if (signature != null && direction != null) {
            bbCode += `[pat=${signature!} dir=${shortenDirection(direction!)}${color}]`;
        } else if (idPath != null) {
            bbCode += `[pat=${idPath}${color}]`;
        } else {
            throw new BBCodeError(`Couldn't generate BBCode for "${translation}".`);
        }

        // intro color
        if (id === "hexcasting:open_paren" && !isEscaped) bbCode += `[/pcolor][pcolor=${getBBCodeColor(++indent)}]`;
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
