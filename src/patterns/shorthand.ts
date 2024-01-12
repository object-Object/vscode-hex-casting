import { Direction } from "./types";

export function shortenDirection(rawDirection: string): string {
    return rawDirection
        .toLowerCase()
        .replace(/[_\-]/g, "")
        .replace("north", "n")
        .replace("south", "s")
        .replace("west", "w")
        .replace("east", "e");
}

export function prepareDirection(rawDirection: string): Direction | undefined {
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
