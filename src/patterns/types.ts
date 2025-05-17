import * as vscode from "vscode";

export type Direction = "EAST" | "SOUTH_EAST" | "SOUTH_WEST" | "WEST" | "NORTH_WEST" | "NORTH_EAST";

export interface HexPattern {
    direction: Direction;
    signature: string;
}

export interface HexBugRegistry {
    mods: { [id: string]: ModInfo };
    patterns: { [id: string]: HexBugPatternInfo };
    special_handlers: { [id: string]: SpecialHandlerInfo };
}

export type Modloader = "Fabric" | "Forge" | "NeoForge" | "Quilt";

export interface ModInfo {
    // StaticModInfo
    id: string;
    name: string;
    description: string;
    icon_url: string | null;
    curseforge_slug: string | null;
    modrinth_slug: string | null;
    modloaders: Modloader[];

    // DynamicModInfo
    version: string;
    book_url: string;
    github_author: string;
    github_repo: string;
    github_commit: string;
    pattern_count: number;
    special_handler_count: number;
    first_party_operator_count: number;
    third_party_operator_count: number;
}

export interface HexBugPatternInfo {
    id: string;
    name: string;
    direction: Direction;
    signature: string;
    is_per_world: boolean;
    // there must be at least one operator
    operators: [PatternOperator, ...PatternOperator[]];
}

export interface PatternOperator {
    description: string | null;
    inputs: string | null;
    outputs: string | null;
    book_url: string | null;
    mod_id: string;
}

export interface SpecialHandlerInfo {
    id: string;
    raw_name: string;
    base_name: string;
    operator: PatternOperator;
}

// i hate it here
export interface RegistryPatternInfo {
    id: string;
    modid: string;
    idPath: string;
    translation: string;
    // null only for special handlers
    direction: Direction | null;
    signature: string | null;
    isPerWorld: boolean;
    operators: [PatternOperator, ...PatternOperator[]];
}

export const MACRO_MOD_ID = "macro";

export class MacroPatternInfo {
    public location: vscode.Location;
    public id: string | null = null;
    public modid: string = MACRO_MOD_ID;
    public idPath: string | null = null;
    public translation: string;
    public direction: Direction | null;
    public signature: string | null;
    public isPerWorld: boolean;
    public operators: [PatternOperator, ...PatternOperator[]];

    constructor({
        location,
        modid,
        idPath,
        translation,
        direction,
        signature,
        isPerWorld,
        description,
        inputs,
        outputs,
    }: {
        location: vscode.Location;
        modid?: string;
        idPath?: string;
        translation: string;
        direction?: Direction;
        signature?: string;
        isPerWorld: boolean;
        description?: string;
        inputs?: string;
        outputs?: string;
    }) {
        if (modid && idPath) {
            this.id = `${modid}:${idPath}`;
            this.modid = modid;
            this.idPath = idPath;
        }
        this.location = location;
        this.translation = translation;
        this.direction = direction ?? null;
        this.signature = signature ?? null;
        this.isPerWorld = isPerWorld;
        this.operators = [
            {
                description: description ?? null,
                inputs: inputs ?? null,
                outputs: outputs ?? null,
                book_url: null,
                mod_id: MACRO_MOD_ID,
            },
        ];
    }
}

export type PatternInfo = RegistryPatternInfo | MacroPatternInfo;

export type PatternLookup<T extends PatternInfo> = { [translation: string]: T };

export type ShorthandLookup = { [shorthand: string]: string };
