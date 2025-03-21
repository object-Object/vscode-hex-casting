import sharp from "sharp";
import init_renderer, { draw_bound_pattern, GridOptions, EndPoint, Color } from "hex_renderer_javascript";
// @ts-ignore
import hex_renderer_wasm from "hex_renderer_javascript/hex_renderer_javascript_bg.wasm";

export interface RenderedImage {
    url: string;
    width: number;
    height: number;
}

export interface PatternRenderingOptions {
    isPerWorld: boolean;
    darkMode: boolean;
}

const patternImages: Map<string, RenderedImage> = new Map();

export async function initPatternRenderer() {
    await init_renderer(hex_renderer_wasm);
}

export function clearRenderedPatternCache() {
    patternImages.clear();
}

export async function renderPattern(
    direction: string,
    pattern: string,
    { isPerWorld, darkMode }: PatternRenderingOptions,
): Promise<RenderedImage> {
    const key = `${direction} ${pattern}`;
    if (patternImages.has(key)) {
        return patternImages.get(key)!!;
    }

    // TODO: customizable palettes/settings

    const lineWidth = 0.08;
    const pointRadius = lineWidth;
    const arrowRadius = lineWidth * 2;
    const maxOverlaps = 3;

    const maxScale = 0.4;
    const maxWidth = 1024;
    const maxHeight = 1024;

    const markerColor: Color = darkMode ? [255, 255, 255, 255] : [0, 0, 0, 255];
    const lineColors: Color[] = [
        [255, 107, 255, 255],
        [168, 30, 227, 255],
        [100, 144, 237, 255],
        [177, 137, 199, 255],
    ];
    const collisionColor: Color = [221, 0, 0, 255];

    const start_point: EndPoint = {
        type: "BorderedMatch",
        match_radius: pointRadius,
        border: {
            color: markerColor,
            radius: pointRadius * 1.5,
        },
    };

    const grid_options: GridOptions = {
        line_thickness: lineWidth,
        pattern_options: {
            type: "Uniform",
            intersections: {
                type: "EndsAndMiddle",
                start: start_point,
                middle: {
                    type: "Single",
                    marker: {
                        color: markerColor,
                        radius: pointRadius,
                    },
                },
                end: start_point,
            },
            lines: {
                type: "SegmentColors",
                colors: lineColors,
                triangles: {
                    type: "BorderStartMatch",
                    match_radius: arrowRadius,
                    border: {
                        color: markerColor,
                        radius: arrowRadius * 1.5,
                    },
                },
                collisions: {
                    type: "OverloadedParallel",
                    max_line: maxOverlaps,
                    overload: {
                        type: "Dashes",
                        color: collisionColor,
                    },
                },
            },
        },
        center_dot: {
            type: "None",
        },
    };

    const rawData = draw_bound_pattern(
        grid_options,
        {
            direction,
            angle_sigs: pattern,
            great_spell: isPerWorld,
        },
        maxScale,
        maxWidth,
        maxHeight,
    );

    // trim transparent margins
    const {
        data,
        info: { width, height },
    } = await sharp(rawData).trim({ lineArt: true }).toBuffer({ resolveWithObject: true });

    const image: RenderedImage = {
        url: `data:image/png;base64,${data.toString("base64")}`,
        width,
        height,
    };
    patternImages.set(key, image);
    return image;
}
