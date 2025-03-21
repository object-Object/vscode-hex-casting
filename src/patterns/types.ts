export interface PatternSignature {
    direction: Direction;
    pattern: string;
}

export interface PatternInfo {
    name?: string;
    modid: string;
    modName: string;
    direction: string | null;
    pattern: string | null;
    args: string | null;
    url: string | null;
    description: string | null;
}

export interface DefaultPatternInfo extends PatternInfo {
    name: string;
}

export type Direction = "EAST" | "SOUTH_EAST" | "SOUTH_WEST" | "WEST" | "NORTH_WEST" | "NORTH_EAST";

export class MacroPatternInfo implements PatternInfo {
    public direction: Direction | null;
    public pattern: string | null;
    public args: string | null;

    public modName = "macro";
    public modid = "macro";
    public url = null;
    public description = null;

    constructor(direction?: Direction, pattern?: string, args?: string) {
        this.direction = direction ?? null;
        this.pattern = pattern ?? null;
        this.args = args ?? null;
    }
}

export type Registry<T extends PatternInfo> = { [translation: string]: T };

export type ShorthandLookup = { [shorthand: string]: string };
