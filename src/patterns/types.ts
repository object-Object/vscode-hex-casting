interface PatternSignature {
    direction: Direction;
    pattern: string;
}

interface PatternInfo {
    name?: string;
    modid: string;
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
    public modid = "macro";
    public image = null;
    public url = null;

    constructor(public direction: Direction, public pattern: string, args?: string) {
        this.args = args ?? null;
    }
}

type Registry<T extends PatternInfo> = { [translation: string]: T };

type ShorthandLookup = { [shorthand: string]: string };
