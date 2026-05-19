import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import potrace from "potrace";
import svgPathParser from "svg-path-parser";
import { validatePath } from "../utils/security.js";
import { makeStructuredError } from "../utils/errors.js";

const DEFAULT_THRESHOLD = 160;
const DEFAULT_TURDSIZE = 2;
const DEFAULT_SIMPLIFY_EPSILON = 1.5;

function distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
	const dx = bx - ax;
	const dy = by - ay;
	if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
	const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
	const x = ax + t * dx;
	const y = ay + t * dy;
	return Math.hypot(px - x, py - y);
}

function simplifyRdp(points: Array<[number, number]>, epsilon: number): Array<[number, number]> {
	if (points.length <= 3) return points;
	const first = points[0]!;
	const last = points[points.length - 1]!;
	let maxDist = 0;
	let index = 0;
	for (let i = 1; i < points.length - 1; i++) {
		const pt = points[i]!;
		const d = distPointToSegment(pt[0], pt[1], first[0], first[1], last[0], last[1]);
		if (d > maxDist) {
			index = i;
			maxDist = d;
		}
	}
	if (maxDist > epsilon) {
		const left = simplifyRdp(points.slice(0, index + 1), epsilon);
		const right = simplifyRdp(points.slice(index), epsilon);
		return left.slice(0, -1).concat(right);
	}
	return [first, last];
}

function sampleCubic(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], segments = 20) {
	const points: Array<[number, number]> = [];
	for (let i = 1; i <= segments; i++) {
		const t = i / segments;
		const mt = 1 - t;
		const x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0];
		const y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1];
		points.push([x, y]);
	}
	return points;
}

function sampleQuad(p0: [number, number], p1: [number, number], p2: [number, number], segments = 16) {
	const points: Array<[number, number]> = [];
	for (let i = 1; i <= segments; i++) {
		const t = i / segments;
		const mt = 1 - t;
		const x = mt ** 2 * p0[0] + 2 * mt * t * p1[0] + t ** 2 * p2[0];
		const y = mt ** 2 * p0[1] + 2 * mt * t * p1[1] + t ** 2 * p2[1];
		points.push([x, y]);
	}
	return points;
}

function extractPointsFromPath(d: string, epsilon: number): Array<[number, number]> {
	const commands = svgPathParser.parseSVG(d) as Array<any>;
	const points: Array<[number, number]> = [];
	let current: [number, number] = [0, 0];
	let subpathStart: [number, number] | null = null;
	let lastControl: [number, number] | null = null;
	for (const cmd of commands) {
		switch (cmd.code) {
			case "moveto":
				current = [cmd.x, cmd.y];
				subpathStart = [cmd.x, cmd.y];
				points.push(current);
				lastControl = null;
				break;
			case "lineto":
				current = [cmd.x, cmd.y];
				points.push(current);
				lastControl = null;
				break;
			case "horizontal lineto":
				current = [cmd.x, current[1]];
				points.push(current);
				lastControl = null;
				break;
			case "vertical lineto":
				current = [current[0], cmd.y];
				points.push(current);
				lastControl = null;
				break;
			case "curveto": {
				const p0 = current;
				const p1: [number, number] = [cmd.x1, cmd.y1];
				const p2: [number, number] = [cmd.x2, cmd.y2];
				const p3: [number, number] = [cmd.x, cmd.y];
				points.push(...sampleCubic(p0, p1, p2, p3));
				current = p3;
				lastControl = p2;
				break;
			}
			case "smooth curveto": {
				const p0 = current;
				const reflected: [number, number] = lastControl ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]] : current;
				const p2: [number, number] = [cmd.x2, cmd.y2];
				const p3: [number, number] = [cmd.x, cmd.y];
				points.push(...sampleCubic(p0, reflected, p2, p3));
				current = p3;
				lastControl = p2;
				break;
			}
			case "quadratic curveto": {
				const p0 = current;
				const p1: [number, number] = [cmd.x1, cmd.y1];
				const p2: [number, number] = [cmd.x, cmd.y];
				points.push(...sampleQuad(p0, p1, p2));
				current = p2;
				lastControl = p1;
				break;
			}
			case "smooth quadratic curveto": {
				const p0 = current;
				const reflected: [number, number] = lastControl ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]] : current;
				const p2: [number, number] = [cmd.x, cmd.y];
				points.push(...sampleQuad(p0, reflected, p2));
				current = p2;
				lastControl = reflected;
				break;
			}
			case "closepath":
				if (subpathStart) points.push(subpathStart);
				lastControl = null;
				break;
		}
	}
	return simplifyRdp(points, epsilon);
}

function svgToLineSegments(svg: string, epsilon: number): Array<Array<[number, number]>> {
	const paths = [...svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*>/g)].map((m) => m[1]).filter((d): d is string => Boolean(d));
	return paths.map((d) => extractPointsFromPath(d, epsilon)).filter((pts) => pts.length > 2);
}

function writeDxfLinework(paths: Array<Array<[number, number]>>): string {
	const out: string[] = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
	for (const pts of paths) {
		for (let i = 0; i < pts.length - 1; i++) {
			const [x1, y1] = pts[i]!;
			const [x2, y2] = pts[i + 1]!;
			out.push("0", "LINE", "8", "0", "10", String(x1), "20", String(-y1), "11", String(x2), "21", String(-y2));
		}
	}
	out.push("0", "ENDSEC", "0", "EOF");
	return out.join("\n");
}

function writeParametricGasketDxf(opts: {
	output_dxf_path: string;
	output_svg_path?: string | undefined;
	outer_diameter_mm: number;
	inner_diameter_mm: number;
	bolt_circle_diameter_mm: number;
	bolt_hole_diameter_mm: number;
	bolt_count: number;
	rotation_deg: number;
}) {
	const { outer_diameter_mm, inner_diameter_mm, bolt_circle_diameter_mm, bolt_hole_diameter_mm, bolt_count, rotation_deg } = opts;
	const rot = (rotation_deg * Math.PI) / 180;
	const outerR = outer_diameter_mm / 2;
	const innerR = inner_diameter_mm / 2;
	const boltR = bolt_circle_diameter_mm / 2;
	const pts: Array<[number, number]> = [];
	const steps = 48;
	for (let i = 0; i < steps; i++) {
		const a = (i / steps) * Math.PI * 2;
		pts.push([Math.cos(a) * outerR, Math.sin(a) * outerR]);
	}
	const ent: string[] = ["0","SECTION","2","HEADER","9","$ACADVER","1","AC1009","0","ENDSEC","0","SECTION","2","ENTITIES"];
	ent.push("0","LWPOLYLINE","8","0","90",String(pts.length),"70","1");
	for (const [x, y] of pts) ent.push("10", String(x), "20", String(-y));
	ent.push("0","CIRCLE","8","0","10","0","20","0","40",String(innerR));
	for (let i = 0; i < bolt_count; i++) {
		const a = rot + (i / bolt_count) * Math.PI * 2;
		ent.push("0","CIRCLE","8","0","10",String(Math.cos(a) * boltR),"20",String(-Math.sin(a) * boltR),"40",String(bolt_hole_diameter_mm/2));
	}
	ent.push("0","ENDSEC","0","EOF");
	return ent.join("\n");
}

export function registerImageToDxfTools(server: McpServer): void {
	server.registerTool(
		"trace_image_to_dxf",
		{
			title: "Trace Image to DXF",
			description: "Convert a traced raster silhouette into a cut-ready DXF using image cleanup, Potrace vectorization, and DXF linework export.",
			inputSchema: {
				image_path: z.string().describe("Source image file path"),
				output_dxf_path: z.string().describe("Output DXF file path"),
				output_svg_path: z.string().optional().describe("Optional output SVG path for inspection"),
				threshold: z.number().min(0).max(255).default(DEFAULT_THRESHOLD).optional(),
				turdsize: z.number().int().min(0).default(DEFAULT_TURDSIZE).optional(),
				simplify_epsilon: z.number().min(0).default(DEFAULT_SIMPLIFY_EPSILON).optional(),
				invert: z.boolean().default(false).optional(),
				scale_mm_per_px: z.number().positive().optional().describe("Optional scale factor in millimeters per pixel"),
				gasket_mode: z.boolean().default(false).optional(),
				outer_diameter_mm: z.number().positive().optional(),
				inner_diameter_mm: z.number().positive().optional(),
				bolt_circle_diameter_mm: z.number().positive().optional(),
				bolt_hole_diameter_mm: z.number().positive().optional(),
				bolt_count: z.number().int().min(3).max(12).optional(),
				rotation_deg: z.number().optional(),
			},
		},
		async ({ image_path, output_dxf_path, output_svg_path, threshold = DEFAULT_THRESHOLD, turdsize = DEFAULT_TURDSIZE, simplify_epsilon = DEFAULT_SIMPLIFY_EPSILON, invert = false, scale_mm_per_px, gasket_mode = false, outer_diameter_mm, inner_diameter_mm, bolt_circle_diameter_mm, bolt_hole_diameter_mm, bolt_count = 3, rotation_deg = 0 }) => {
			try {
				const inCheck = validatePath(image_path, "read");
				if (!inCheck.valid) throw new Error(inCheck.checks.join(", "));
				const outCheck = validatePath(output_dxf_path, "write");
				if (!outCheck.valid) throw new Error(outCheck.checks.join(", "));
				if (output_svg_path) {
					const svgCheck = validatePath(output_svg_path, "write");
					if (!svgCheck.valid) throw new Error(svgCheck.checks.join(", "));
				}

				if (gasket_mode) {
					if (!outer_diameter_mm || !inner_diameter_mm || !bolt_circle_diameter_mm || !bolt_hole_diameter_mm) {
						throw new Error("gasket_mode requires outer_diameter_mm, inner_diameter_mm, bolt_circle_diameter_mm, and bolt_hole_diameter_mm");
					}
					const dxf = writeParametricGasketDxf({
						output_dxf_path,
						output_svg_path: output_svg_path ?? undefined,
						outer_diameter_mm,
						inner_diameter_mm,
						bolt_circle_diameter_mm,
						bolt_hole_diameter_mm,
						bolt_count,
						rotation_deg,
					});
					if (output_svg_path) {
						const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outer_diameter_mm}mm" height="${outer_diameter_mm}mm" viewBox="-${outer_diameter_mm/2} -${outer_diameter_mm/2} ${outer_diameter_mm} ${outer_diameter_mm}"><g fill="none" stroke="#000" stroke-width="0.2"><circle cx="0" cy="0" r="${outer_diameter_mm/2}"/><circle cx="0" cy="0" r="${inner_diameter_mm/2}"/></g></svg>`;
						await fs.mkdir(path.dirname(output_svg_path), { recursive: true });
						await fs.writeFile(output_svg_path, svg, "utf-8");
					}
					await fs.mkdir(path.dirname(output_dxf_path), { recursive: true });
					await fs.writeFile(output_dxf_path, dxf, "utf-8");
					return { content: [{ type: "text", text: `✅ Wrote parametric gasket DXF to ${output_dxf_path}` }], structuredContent: { output_dxf_path, gasket_mode: true } };
				}

				const image = sharp(await fs.readFile(image_path)).rotate();
				const metadata = await image.metadata();
				const png = await image.grayscale().normalize().threshold(threshold).png().toBuffer();

				const svg = await new Promise<string>((resolve, reject) => {
					potrace.trace(
						png,
						{ threshold: invert ? 1 : 128, turdSize: turdsize, optCurve: true, alphaMax: 1, optTolerance: 0.2 },
						(err: Error | null, tracedSvg: string) => (err ? reject(err) : resolve(tracedSvg))
					);
				});

				if (output_svg_path) {
					await fs.mkdir(path.dirname(output_svg_path), { recursive: true });
					await fs.writeFile(output_svg_path, svg, "utf-8");
				}

				const paths = svgToLineSegments(svg, simplify_epsilon);
				let dxf = writeDxfLinework(paths);
				if (scale_mm_per_px) {
					dxf = dxf
						.replace(/\n10\n(-?[0-9.]+)/g, (_m, n) => `\n10\n${Number(n) * scale_mm_per_px}`)
						.replace(/\n20\n(-?[0-9.]+)/g, (_m, n) => `\n20\n${Number(n) * scale_mm_per_px}`)
						.replace(/\n11\n(-?[0-9.]+)/g, (_m, n) => `\n11\n${Number(n) * scale_mm_per_px}`)
						.replace(/\n21\n(-?[0-9.]+)/g, (_m, n) => `\n21\n${Number(n) * scale_mm_per_px}`);
				}

				await fs.mkdir(path.dirname(output_dxf_path), { recursive: true });
				await fs.writeFile(output_dxf_path, dxf, "utf-8");

				return {
					content: [{ type: "text", text: `✅ Traced ${path.basename(image_path)} to DXF (${paths.length} paths) via Potrace` }],
					structuredContent: {
						image_path,
						output_dxf_path: path.resolve(output_dxf_path),
						output_svg_path: output_svg_path ? path.resolve(output_svg_path) : null,
						width: metadata.width,
						height: metadata.height,
						paths: paths.length,
						threshold,
						turdsize,
						simplify_epsilon,
						scale_mm_per_px: scale_mm_per_px ?? null,
					},
				};
			} catch (err) {
				const se = makeStructuredError(err, "trace_image_to_dxf_failed", false);
				return { content: [{ type: "text", text: `❌ Image-to-DXF trace failed: ${se.message}` }], structuredContent: { error: se }, isError: true };
			}
		}
	);
}
