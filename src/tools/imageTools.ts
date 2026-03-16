import { InferenceClient } from "@huggingface/inference";
import sharp from "sharp";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Image Generation & Manipulation Tools
 *
 * Provides tools for:
 * - AI-powered image generation from text prompts
 * - Image format conversion (JPEG, PNG, WEBP, AVIF, etc.)
 * - Image resizing and optimization
 * - Batch processing support
 */

// Type definitions for better type safety
interface ResizeOptions {
	width?: number;
	height?: number;
	fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

// =============================================================================
// Image Generation Tool
// =============================================================================

export const imageGenerateTool = {
	name: "image_generate",
	description: `Generate images from text prompts using AI models. 
  
  Supports:
  - Text-to-image generation with FLUX.1-schnell (fast, high quality)
  - Multiple image sizes (512x512, 768x768, 1024x1024)
  - Quality and style controls
  - Automatic file saving with optional preview
  - Rate limiting awareness (free tier: ~50 images/day)
  
	Best for: documentation illustrations, website graphics, concept art
  
  Example prompts:
  - "A minimalist icon of a database, flat design, white background"
  - "Professional photo of a modern office workspace"
  - "Abstract geometric pattern in blue and green tones"`,
	inputSchema: z.object({
		prompt: z
			.string()
			.min(3)
			.describe(
				"Text description of the image to generate. Be specific and descriptive."
			),
		output_path: z
			.string()
			.describe(
				"Where to save the generated image (absolute path, e.g., /home/user/images/output.png)"
			),
		size: z
			.enum(["512x512", "768x768", "1024x1024", "1024x768", "768x1024"])
			.default("1024x1024")
			.describe("Image dimensions"),
		model: z
			.enum(["flux-schnell", "flux-dev"])
			.default("flux-schnell")
			.describe("Model: flux-schnell (fast) or flux-dev (detailed)"),
		negative_prompt: z
			.string()
			.optional()
			.describe(
				"What to avoid in the image (e.g., 'blurry, low quality, distorted')"
			),
		guidance_scale: z
			.number()
			.min(1)
			.max(20)
			.default(7.5)
			.optional()
			.describe("How closely to follow prompt (1-20, default 7.5)"),
	}),
	handler: async (args: {
		prompt: string;
		output_path: string;
		size: "512x512" | "768x768" | "1024x1024" | "1024x768" | "768x1024";
		model: "flux-schnell" | "flux-dev";
		negative_prompt?: string | undefined;
		guidance_scale?: number | undefined;
	}) => {
		const HF_TOKEN = process.env.HUGGING_FACE_API_KEY;

		if (!HF_TOKEN) {
			throw new Error(
				"HUGGING_FACE_API_KEY environment variable is required for image generation"
			);
		}

		// Validate and create output directory
		const outputDir = path.dirname(args.output_path);
		if (!existsSync(outputDir)) {
			await fs.mkdir(outputDir, { recursive: true });
		}

		// Initialize Hugging Face Inference Client
		const client = new InferenceClient(HF_TOKEN) as InferenceClient;

		try {
			// Determine which model to use
			const modelId: string =
				args.model === "flux-dev"
					? "black-forest-labs/FLUX.1-dev"
					: "black-forest-labs/FLUX.1-schnell";

			// Parse dimensions
			const [width, height] = (args.size || "1024x1024").split("x").map(Number);

			// Generate image - build parameters object carefully
			const parameters: Record<string, unknown> = {};
			if (args.negative_prompt) {
				parameters.negative_prompt = args.negative_prompt;
			}
			if (args.guidance_scale !== undefined) {
				parameters.guidance_scale = args.guidance_scale;
			}
			parameters.width = width;
			parameters.height = height;

			const imageBlob = await client.textToImage(
				{
					model: modelId,
					inputs: args.prompt,
					parameters,
				},
				{ outputType: "blob" }
			);

			// Convert Blob to Buffer
			const arrayBuffer = await imageBlob.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			// Save to file
			await fs.writeFile(args.output_path, buffer);

			// Get file stats
			const stats = await fs.stat(args.output_path);
			const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

			return {
				content: [
					{
						type: "text" as const,
						text: `✅ Image generated successfully!

📁 Saved to: ${args.output_path}
📐 Dimensions: ${width}x${height}
📦 File size: ${fileSizeMB} MB
🎨 Model: ${args.model}
✨ Prompt: "${args.prompt}"

${args.negative_prompt ? `🚫 Negative prompt: "${args.negative_prompt}"\n` : ""}
The image has been saved and is ready to use in your documentation or other projects.`,
					},
				],
			};
		} catch (error: unknown) {
			const err = error as Error;
			// Handle rate limiting errors
			if (err.message?.includes("rate limit") || err.message?.includes("429")) {
				return {
					content: [
						{
							type: "text" as const,
							text: `⚠️ Rate limit reached for Hugging Face API.

Free tier limits:
- ~50 images per day
- Rate resets daily

Suggestions:
1. Wait a few hours and try again
2. Use a different API key
3. Consider upgrading to a paid tier for higher limits

Error: ${err.message}`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Error: Image generation failed: ${err.message}`,
					},
				],
				isError: true,
			};
		}
	},
};

// =============================================================================
// Image Conversion Tool
// =============================================================================

export const imageConvertTool = {
	name: "image_convert",
	description: `Convert images between formats with optimization.
  
  Supports:
  - WEBP (modern web format, best compression)
  - PNG (lossless, transparency support)
  - JPEG (photos, smaller files)
  - AVIF (next-gen format, excellent compression)
  - GIF (animations, limited colors)
  - TIFF (high quality, large files)
  
  Features:
  - Batch conversion (directory input)
  - Quality control
  - Automatic output directory creation
  - Progress reporting
  - Format-specific optimizations
  
  Use cases:
  - Converting work images to WEBP for web performance
  - Batch processing photo libraries
	- Preparing images for documentation`,
	inputSchema: z.object({
		input: z.string().describe("Input file path or directory (absolute path)"),
		output_format: z
			.enum(["webp", "png", "jpeg", "jpg", "avif", "gif", "tiff"])
			.describe("Target format"),
		output_dir: z
			.string()
			.optional()
			.describe("Output directory (default: {input_dir}/converted/)"),
		quality: z
			.number()
			.min(1)
			.max(100)
			.default(80)
			.optional()
			.describe("Output quality (1-100, default 80)"),
		preserve_structure: z
			.boolean()
			.default(false)
			.optional()
			.describe("Preserve folder structure for batch conversion"),
	}),
	handler: async (args: {
		input: string;
		output_format: "webp" | "png" | "jpeg" | "jpg" | "avif" | "gif" | "tiff";
		output_dir?: string | undefined;
		quality?: number | undefined;
		preserve_structure?: boolean | undefined;
	}) => {
		const stats = await fs.stat(args.input);
		const isDirectory = stats.isDirectory();

		// Determine output directory
		const defaultOutputDir = isDirectory
			? path.join(args.input, "converted")
			: path.join(path.dirname(args.input), "converted");
		const outputDir = args.output_dir || defaultOutputDir;

		// Create output directory
		if (!existsSync(outputDir)) {
			await fs.mkdir(outputDir, { recursive: true });
		}

		const results: string[] = [];
		const errors: string[] = [];

		// Single file conversion
		if (!isDirectory) {
			try {
				const outputPath = path.join(
					outputDir,
					`${path.parse(args.input).name}.${args.output_format}`
				);

				await convertSingleImage(
					args.input,
					outputPath,
					args.output_format,
					args.quality || 80
				);
				results.push(outputPath);
			} catch (error: unknown) {
				const err = error as Error;
				errors.push(`${args.input}: ${err.message}`);
			}
		} else {
			// Batch conversion
			const files = await findImageFiles(args.input);

			for (const file of files) {
				try {
					const relativePath = path.relative(args.input, file);
					const outputPath = args.preserve_structure
						? path.join(
								outputDir,
								path.dirname(relativePath),
								`${path.parse(file).name}.${args.output_format}`
						  )
						: path.join(
								outputDir,
								`${path.parse(file).name}.${args.output_format}`
						  );

					// Create subdirectories if preserving structure
					if (args.preserve_structure) {
						const outputSubdir = path.dirname(outputPath);
						if (!existsSync(outputSubdir)) {
							await fs.mkdir(outputSubdir, { recursive: true });
						}
					}

					await convertSingleImage(
						file,
						outputPath,
						args.output_format,
						args.quality || 80
					);
					results.push(outputPath);
				} catch (error: unknown) {
					const err = error as Error;
					errors.push(`${file}: ${err.message}`);
				}
			}
		}

		const successCount = results.length;
		const errorCount = errors.length;
		const totalSize = await calculateTotalSize(results);

		return {
			content: [
				{
					type: "text" as const,
					text: `✅ Image conversion complete!

📊 Statistics:
- Converted: ${successCount} image${successCount !== 1 ? "s" : ""}
- Failed: ${errorCount}
- Total size: ${totalSize.toFixed(2)} MB
- Format: ${args.output_format.toUpperCase()}
- Quality: ${args.quality || 80}%

📁 Output directory: ${outputDir}

${
	results.length > 0
		? `✨ Converted files:\n${results
				.slice(0, 10)
				.map((f) => `  - ${path.basename(f)}`)
				.join("\n")}${
				results.length > 10 ? `\n  ... and ${results.length - 10} more` : ""
		  }`
		: ""
}

${
	errors.length > 0
		? `\n⚠️ Errors:\n${errors.slice(0, 5).join("\n")}${
				errors.length > 5 ? `\n  ... and ${errors.length - 5} more` : ""
		  }`
		: ""
}`,
				},
			],
		};
	},
};

// =============================================================================
// Image Resize Tool
// =============================================================================

export const imageResizeTool = {
	name: "image_resize",
	description: `Resize images with various strategies and presets.
  
  Resize strategies:
  - cover: Crop to fill dimensions (default)
  - contain: Fit within dimensions (letterbox)
  - fill: Stretch to exact dimensions
  - inside: Shrink to fit (no enlargement)
  - outside: Grow to cover (no reduction)
  
  Presets:
  - thumbnail: 150x150
  - small: 320x240
  - medium: 800x600
  - large: 1920x1080
  - hd: 1280x720
  - fullhd: 1920x1080
  - 4k: 3840x2160
  
  Features:
  - Maintain aspect ratio
  - Batch processing
  - Custom dimensions
  - Quality control`,
	inputSchema: z.object({
		input: z.string().describe("Input file or directory path"),
		width: z.number().positive().optional().describe("Target width in pixels"),
		height: z
			.number()
			.positive()
			.optional()
			.describe("Target height in pixels"),
		preset: z
			.enum(["thumbnail", "small", "medium", "large", "hd", "fullhd", "4k"])
			.optional()
			.describe("Use preset dimensions"),
		fit: z
			.enum(["cover", "contain", "fill", "inside", "outside"])
			.default("cover")
			.optional()
			.describe("Resize strategy"),
		output_dir: z
			.string()
			.optional()
			.describe("Output directory (default: {input_dir}/resized/)"),
		maintain_aspect_ratio: z
			.boolean()
			.default(true)
			.optional()
			.describe("Keep original aspect ratio"),
	}),
	handler: async (args: {
		input: string;
		width?: number | undefined;
		height?: number | undefined;
		output_dir?: string | undefined;
		preset?:
			| "thumbnail"
			| "small"
			| "medium"
			| "large"
			| "hd"
			| "fullhd"
			| "4k"
			| undefined;
		fit?: "cover" | "contain" | "fill" | "inside" | "outside" | undefined;
		maintain_aspect_ratio?: boolean | undefined;
	}) => {
		// Preset dimensions
		const presets: Record<string, { width: number; height: number }> = {
			thumbnail: { width: 150, height: 150 },
			small: { width: 320, height: 240 },
			medium: { width: 800, height: 600 },
			large: { width: 1920, height: 1080 },
			hd: { width: 1280, height: 720 },
			fullhd: { width: 1920, height: 1080 },
			"4k": { width: 3840, height: 2160 },
		};

		// Determine dimensions
		let targetWidth = args.width;
		let targetHeight = args.height;

		if (args.preset) {
			const preset = presets[args.preset];
			if (preset) {
				targetWidth = preset.width;
				targetHeight = preset.height;
			}
		}

		if (!targetWidth && !targetHeight) {
			throw new Error("Either width, height, or preset must be specified");
		}

		const stats = await fs.stat(args.input);
		const isDirectory = stats.isDirectory();

		const defaultOutputDir = isDirectory
			? path.join(args.input, "resized")
			: path.join(path.dirname(args.input), "resized");
		const outputDir = args.output_dir || defaultOutputDir;

		if (!existsSync(outputDir)) {
			await fs.mkdir(outputDir, { recursive: true });
		}

		const results: string[] = [];
		const errors: string[] = [];

		const files = isDirectory ? await findImageFiles(args.input) : [args.input];

		for (const file of files) {
			try {
				const outputPath = path.join(
					outputDir,
					`${path.parse(file).name}-resized${path.extname(file)}`
				);

				const image = sharp(file) as sharp.Sharp;

				// Apply resize
				const resizeOptions: ResizeOptions = {
					fit: (args.fit || "cover") as
						| "cover"
						| "contain"
						| "fill"
						| "inside"
						| "outside",
				};
				if (targetWidth) resizeOptions.width = targetWidth;
				if (targetHeight) resizeOptions.height = targetHeight;

				// If only one dimension is set and maintain aspect ratio, let Sharp auto-calculate
				if (
					args.maintain_aspect_ratio &&
					((targetWidth && !targetHeight) || (!targetWidth && targetHeight))
				) {
					resizeOptions.fit = "inside";
				}

				await image.resize(resizeOptions).toFile(outputPath);
				results.push(outputPath);
			} catch (error: unknown) {
				const err = error as Error;
				errors.push(`${file}: ${err.message}`);
			}
		}

		return {
			content: [
				{
					type: "text" as const,
					text: `✅ Image resizing complete!

📊 Statistics:
- Resized: ${results.length} image${results.length !== 1 ? "s" : ""}
- Failed: ${errors.length}
- Dimensions: ${targetWidth || "auto"}x${targetHeight || "auto"}
- Strategy: ${args.fit || "cover"}
${args.preset ? `- Preset: ${args.preset}\n` : ""}
📁 Output directory: ${outputDir}

${
	results.length > 0
		? `✨ Resized files:\n${results
				.slice(0, 10)
				.map((f) => `  - ${path.basename(f)}`)
				.join("\n")}${
				results.length > 10 ? `\n  ... and ${results.length - 10} more` : ""
		  }`
		: ""
}

${
	errors.length > 0
		? `\n⚠️ Errors:\n${errors.slice(0, 5).join("\n")}${
				errors.length > 5 ? `\n  ... and ${errors.length - 5} more` : ""
		  }`
		: ""
}`,
				},
			],
		};
	},
};

// =============================================================================
// Image Optimization Tool
// =============================================================================

export const imageOptimizeTool = {
	name: "image_optimize",
	description: `Optimize images to reduce file size without significant quality loss.
  
  Optimization strategies:
  - JPEG: mozjpeg compression, progressive scans
  - PNG: palette reduction, compression level 9
  - WEBP: Smart quality adjustment
  - AVIF: High efficiency codec
  
  Features:
  - Batch optimization
  - Automatic format detection
  - Space savings report
  - Preserve metadata option
  
  Perfect for:
  - Web performance optimization
  - Reducing storage costs
	- Faster page loads`,
	inputSchema: z.object({
		input: z.string().describe("Input file or directory path"),
		output_dir: z
			.string()
			.optional()
			.describe("Output directory (default: {input_dir}/optimized/)"),
		quality: z
			.number()
			.min(1)
			.max(100)
			.default(80)
			.optional()
			.describe("Quality level (1-100)"),
		preserve_metadata: z
			.boolean()
			.default(false)
			.optional()
			.describe("Keep EXIF and other metadata"),
	}),
	handler: async (args: {
		input: string;
		output_dir?: string | undefined;
		quality?: number | undefined;
		preserve_metadata?: boolean | undefined;
	}) => {
		const stats = await fs.stat(args.input);
		const isDirectory = stats.isDirectory();

		const defaultOutputDir = isDirectory
			? path.join(args.input, "optimized")
			: path.join(path.dirname(args.input), "optimized");
		const outputDir = args.output_dir || defaultOutputDir;

		if (!existsSync(outputDir)) {
			await fs.mkdir(outputDir, { recursive: true });
		}

		const results: Array<{
			file: string;
			originalSize: number;
			optimizedSize: number;
			savings: number;
		}> = [];
		const errors: string[] = [];

		const files = isDirectory ? await findImageFiles(args.input) : [args.input];

		for (const file of files) {
			try {
				const originalStats = await fs.stat(file);
				const originalSize = originalStats.size;

				const outputPath = path.join(outputDir, path.basename(file));
				const ext = path.extname(file).toLowerCase();

				const sharpImage = sharp(file);
				let processedImage: Buffer;

				if (ext === ".jpg" || ext === ".jpeg") {
					let image = sharpImage;
					if (args.preserve_metadata) {
						image = image.withMetadata();
					}
					processedImage = await image
						.jpeg({
							quality: args.quality || 80,
							mozjpeg: true,
							progressive: true,
						})
						.toBuffer();
				} else if (ext === ".png") {
					let image = sharpImage;
					if (args.preserve_metadata) {
						image = image.withMetadata();
					}
					processedImage = await image
						.png({
							compressionLevel: 9,
							quality: args.quality || 80,
							palette: true,
						})
						.toBuffer();
				} else if (ext === ".webp") {
					let image = sharpImage;
					if (args.preserve_metadata) {
						image = image.withMetadata();
					}
					processedImage = await image
						.webp({ quality: args.quality || 80, effort: 6 })
						.toBuffer();
				} else if (ext === ".avif") {
					let image = sharpImage;
					if (args.preserve_metadata) {
						image = image.withMetadata();
					}
					processedImage = await image
						.avif({ quality: args.quality || 50, effort: 4 })
						.toBuffer();
				} else {
					// Default optimization
					processedImage = await sharpImage.toBuffer();
				}

				// Write the processed image
				await fs.writeFile(outputPath, processedImage);

				const optimizedStats = await fs.stat(outputPath);
				const optimizedSize = optimizedStats.size;
				const savings = ((originalSize - optimizedSize) / originalSize) * 100;

				results.push({
					file: path.basename(file),
					originalSize,
					optimizedSize,
					savings,
				});
			} catch (error: unknown) {
				const err = error as Error;
				errors.push(`${file}: ${err.message}`);
			}
		}

		const totalOriginalSize = results.reduce(
			(sum, r) => sum + r.originalSize,
			0
		);
		const totalOptimizedSize = results.reduce(
			(sum, r) => sum + r.optimizedSize,
			0
		);
		const totalSavings =
			((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100;

		return {
			content: [
				{
					type: "text" as const,
					text: `✅ Image optimization complete!

📊 Statistics:
- Optimized: ${results.length} image${results.length !== 1 ? "s" : ""}
- Failed: ${errors.length}
- Original size: ${(totalOriginalSize / (1024 * 1024)).toFixed(2)} MB
- Optimized size: ${(totalOptimizedSize / (1024 * 1024)).toFixed(2)} MB
- Space saved: ${(
						(totalOriginalSize - totalOptimizedSize) /
						(1024 * 1024)
					).toFixed(2)} MB (${totalSavings.toFixed(1)}%)

📁 Output directory: ${outputDir}

${
	results.length > 0
		? `✨ Top savings:\n${results
				.sort((a, b) => b.savings - a.savings)
				.slice(0, 5)
				.map(
					(r) =>
						`  - ${r.file}: ${r.savings.toFixed(1)}% (${(
							r.originalSize / 1024
						).toFixed(1)}KB → ${(r.optimizedSize / 1024).toFixed(1)}KB)`
				)
				.join("\n")}${
				results.length > 5 ? `\n  ... and ${results.length - 5} more` : ""
		  }`
		: ""
}

${
	errors.length > 0
		? `\n⚠️ Errors:\n${errors.slice(0, 5).join("\n")}${
				errors.length > 5 ? `\n  ... and ${errors.length - 5} more` : ""
		  }`
		: ""
}`,
				},
			],
		};
	},
};

// =============================================================================
// Image Color Match Tool
// =============================================================================
// =============================================================================
// Image Analyze Color Profile Tool
// =============================================================================

export const imageAnalyzeColorProfileTool = {
	name: "image_analyze_color_profile",
	description: `Analyze reference images and save a reusable color profile to disk.

Run this ONCE against your "gold standard" reference images to capture their
color characteristics (per-channel mean and standard deviation). The resulting
JSON profile can then be passed to image_color_correct whenever you need to
correct images that look wrong.

Workflow:
  1. image_analyze_color_profile({ reference: "path/to/good-images" })
     → saves color-profile.json next to the reference images
  2. image_color_correct({ source: "path/to/bad-images", profile_path: "...color-profile.json" })
     → corrects the bad images to match the saved profile

Note: Paths outside the default security allowlist (e.g. Google Drive at G:\\)
require MCP_ALLOWED_PATHS=G:\\My Drive\\... to be set in .env.`,
	inputSchema: z.object({
		reference: z
			.string()
			.describe(
				"Directory or single image file that represents the correct/expected color"
			),
		profile_path: z
			.string()
			.optional()
			.describe(
				"Where to save the profile JSON (default: {reference_dir}/color-profile.json)"
			),
	}),
	handler: async (args: {
		reference: string;
		profile_path?: string | undefined;
	}) => {
		// Collect reference image files
		const refStat = await fs.stat(args.reference);
		const refFiles = refStat.isDirectory()
			? await findImageFiles(args.reference)
			: [args.reference];

		if (refFiles.length === 0) {
			return {
				content: [
					{
						type: "text" as const,
						text: "Error: No image files found in the reference path.",
					},
				],
				isError: true,
			};
		}

		// Compute aggregate channel statistics from all reference images
		let stats: ChannelStats;
		try {
			stats = await computeAggregateStats(refFiles);
		} catch (err: unknown) {
			const error = err as Error;
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: Could not analyze reference images: ${error.message}`,
					},
				],
				isError: true,
			};
		}

		// Determine where to save the profile
		const refDir = refStat.isDirectory()
			? args.reference
			: path.dirname(args.reference);
		const profilePath =
			args.profile_path ?? path.join(refDir, "color-profile.json");

		// Build the profile object — includes provenance metadata
		const profile: ColorProfile = {
			version: 1,
			source: args.reference,
			created: new Date().toISOString(),
			imageCount: refFiles.length,
			r: stats.r,
			g: stats.g,
			b: stats.b,
		};

		await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), "utf8");

		return {
			content: [
				{
					type: "text" as const,
					text: `✅ Color profile saved!

📁 Profile: ${profilePath}
📸 Reference images analyzed: ${refFiles.length}

📈 Measured color profile:
  R: mean=${stats.r.mean.toFixed(1)}, stdev=${stats.r.stdev.toFixed(1)}
  G: mean=${stats.g.mean.toFixed(1)}, stdev=${stats.g.stdev.toFixed(1)}
  B: mean=${stats.b.mean.toFixed(1)}, stdev=${stats.b.stdev.toFixed(1)}

Next step — correct images using this profile:
  image_color_correct({ source: "path/to/bad/images", profile_path: "${profilePath}" })`,
				},
			],
			structuredContent: {
				profilePath,
				imageCount: refFiles.length,
				profile,
			},
		};
	},
};

// =============================================================================
// Image Color Correct Tool
// =============================================================================

export const imageColorCorrectTool = {
	name: "image_color_correct",
	description: `Correct the color levels of images to match a saved reference color profile.

Loads a color profile JSON produced by image_analyze_color_profile and applies
a per-channel linear transform so that the source images match the expected
color distribution. The AI agent only needs the source path and the profile
path — no reference images required at correction time.

Algorithm (per channel):
  scale  = ref_stdev / src_stdev
  offset = ref_mean − scale × src_mean
  output = clamp(input × scale + offset)
  blended by 'strength' (0 = no change, 1 = full correction)

Note: Paths outside the default security allowlist (e.g. Google Drive at G:\\)
require MCP_ALLOWED_PATHS=G:\\My Drive\\... to be set in .env.`,
	inputSchema: z.object({
		source: z.string().describe("File or directory of images to correct"),
		profile_path: z
			.string()
			.describe(
				"Path to the color-profile.json saved by image_analyze_color_profile"
			),
		output_dir: z
			.string()
			.optional()
			.describe("Output directory (default: {source_dir}/corrected/)"),
		strength: z
			.number()
			.min(0)
			.max(1)
			.default(1.0)
			.optional()
			.describe(
				"Correction blend: 0 = no change, 1 = full correction (default: 1.0)"
			),
		quality: z
			.number()
			.min(1)
			.max(100)
			.default(90)
			.optional()
			.describe("JPEG output quality 1-100 (default: 90)"),
		preserve_format: z
			.boolean()
			.default(false)
			.optional()
			.describe("Keep original file format instead of converting to JPEG"),
	}),
	handler: async (args: {
		source: string;
		profile_path: string;
		output_dir?: string | undefined;
		strength?: number | undefined;
		quality?: number | undefined;
		preserve_format?: boolean | undefined;
	}) => {
		const strength = args.strength ?? 1.0;
		const quality = args.quality ?? 90;

		// Load color profile
		let profile: ColorProfile;
		try {
			const raw = await fs.readFile(args.profile_path, "utf8");
			profile = JSON.parse(raw) as ColorProfile;
			if (!profile.r || !profile.g || !profile.b) {
				throw new Error("Profile is missing r/g/b channel data");
			}
		} catch (err: unknown) {
			const error = err as Error;
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: Could not load color profile from ${args.profile_path}: ${error.message}`,
					},
				],
				isError: true,
			};
		}

		// Collect source image files
		const srcStat = await fs.stat(args.source);
		const srcFiles = srcStat.isDirectory()
			? await findImageFiles(args.source)
			: [args.source];

		if (srcFiles.length === 0) {
			return {
				content: [
					{
						type: "text" as const,
						text: "Error: No image files found in source path.",
					},
				],
				isError: true,
			};
		}

		// Determine output directory
		const defaultOutputDir = srcStat.isDirectory()
			? path.join(args.source, "corrected")
			: path.join(path.dirname(args.source), "corrected");
		const outputDir = args.output_dir || defaultOutputDir;

		if (!existsSync(outputDir)) {
			await fs.mkdir(outputDir, { recursive: true });
		}

		const results: string[] = [];
		const errors: string[] = [];
		let firstAdjustments: { r: string; g: string; b: string } | null = null;

		for (const srcFile of srcFiles) {
			try {
				const imgStats = await sharp(srcFile).stats();
				const srcR = imgStats.channels[0] ?? { mean: 128, stdev: 30 };
				const srcG = imgStats.channels[1] ?? { mean: 128, stdev: 30 };
				const srcB = imgStats.channels[2] ?? { mean: 128, stdev: 30 };

				// Per-channel linear transform: scale = ref_std/src_std, offset = ref_mean - scale×src_mean
				// Guard against flat channels (stdev ≈ 0) to avoid extreme scale values
				const rScale = srcR.stdev > 1 ? profile.r.stdev / srcR.stdev : 1;
				const gScale = srcG.stdev > 1 ? profile.g.stdev / srcG.stdev : 1;
				const bScale = srcB.stdev > 1 ? profile.b.stdev / srcB.stdev : 1;

				const rOffset = profile.r.mean - rScale * srcR.mean;
				const gOffset = profile.g.mean - gScale * srcG.mean;
				const bOffset = profile.b.mean - bScale * srcB.mean;

				// Blend toward identity (scale=1, offset=0) when strength < 1
				const rScaleFinal = 1 + strength * (rScale - 1);
				const gScaleFinal = 1 + strength * (gScale - 1);
				const bScaleFinal = 1 + strength * (bScale - 1);
				const rOffsetFinal = strength * rOffset;
				const gOffsetFinal = strength * gOffset;
				const bOffsetFinal = strength * bOffset;

				if (firstAdjustments === null) {
					firstAdjustments = {
						r: `scale=${rScaleFinal.toFixed(3)}, offset=${rOffsetFinal.toFixed(1)}`,
						g: `scale=${gScaleFinal.toFixed(3)}, offset=${gOffsetFinal.toFixed(1)}`,
						b: `scale=${bScaleFinal.toFixed(3)}, offset=${bOffsetFinal.toFixed(1)}`,
					};
				}

				// Output file path
				const ext = args.preserve_format
					? path.extname(srcFile).toLowerCase()
					: ".jpg";
				const outputPath = path.join(
					outputDir,
					`${path.parse(srcFile).name}${ext}`
				);

				// Apply per-channel linear transform; flatten handles alpha channels
				let pipeline = sharp(srcFile)
					.flatten({ background: { r: 255, g: 255, b: 255 } })
					.linear(
						[rScaleFinal, gScaleFinal, bScaleFinal],
						[rOffsetFinal, gOffsetFinal, bOffsetFinal]
					);

				if (!args.preserve_format || ext === ".jpg" || ext === ".jpeg") {
					pipeline = pipeline.jpeg({ quality, mozjpeg: true });
				} else if (ext === ".png") {
					pipeline = pipeline.png({ compressionLevel: 9 });
				} else if (ext === ".webp") {
					pipeline = pipeline.webp({ quality });
				} else if (ext === ".avif") {
					pipeline = pipeline.avif({ quality: Math.max(50, quality - 30) });
				}

				await pipeline.toFile(outputPath);
				results.push(outputPath);
			} catch (error: unknown) {
				const err = error as Error;
				errors.push(`${srcFile}: ${err.message}`);
			}
		}

		const adj = firstAdjustments ?? { r: "N/A", g: "N/A", b: "N/A" };

		return {
			content: [
				{
					type: "text" as const,
					text: `✅ Color correction complete!

📊 Results:
- Corrected: ${results.length} image${results.length !== 1 ? "s" : ""}
- Failed: ${errors.length}
- Strength: ${(strength * 100).toFixed(0)}%
- Profile used: ${args.profile_path}

📈 Target color profile:
  R: mean=${profile.r.mean.toFixed(1)}, stdev=${profile.r.stdev.toFixed(1)}
  G: mean=${profile.g.mean.toFixed(1)}, stdev=${profile.g.stdev.toFixed(1)}
  B: mean=${profile.b.mean.toFixed(1)}, stdev=${profile.b.stdev.toFixed(1)}

🎨 First-image transform:
  R: ${adj.r}
  G: ${adj.g}
  B: ${adj.b}

📁 Output directory: ${outputDir}
${
	results.length > 0
		? `\n✨ Output files:\n${results
				.slice(0, 10)
				.map((f) => `  - ${path.basename(f)}`)
				.join("\n")}${
				results.length > 10 ? `\n  ... and ${results.length - 10} more` : ""
		  }`
		: ""
}
${
	errors.length > 0
		? `\n⚠️ Errors:\n${errors.slice(0, 5).join("\n")}${
				errors.length > 5 ? `\n  ... and ${errors.length - 5} more` : ""
		  }`
		: ""
}`,
				},
			],
			structuredContent: {
				results,
				errors,
				outputDir,
				profilePath: args.profile_path,
			},
		};
	},
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a single image to a different format
 */
async function convertSingleImage(
	inputPath: string,
	outputPath: string,
	format: string,
	quality: number
): Promise<void> {
	const image = sharp(inputPath);

	switch (format.toLowerCase()) {
		case "webp":
			await image.webp({ quality, effort: 6 }).toFile(outputPath);
			break;
		case "png":
			await image.png({ compressionLevel: 9, quality }).toFile(outputPath);
			break;
		case "jpeg":
		case "jpg":
			await image.jpeg({ quality, mozjpeg: true }).toFile(outputPath);
			break;
		case "avif":
			await image
				.avif({ quality: Math.max(50, quality - 30), effort: 4 })
				.toFile(outputPath);
			break;
		case "gif":
			await image.gif().toFile(outputPath);
			break;
		case "tiff":
			await image.tiff({ compression: "jpeg", quality }).toFile(outputPath);
			break;
		default:
			throw new Error(`Unsupported format: ${format}`);
	}
}

/**
 * Recursively find all image files in a directory
 */
async function findImageFiles(dir: string): Promise<string[]> {
	const imageExtensions = [
		".jpg",
		".jpeg",
		".png",
		".gif",
		".webp",
		".tiff",
		".bmp",
		".avif",
	];
	const files: string[] = [];

	async function scan(currentDir: string) {
		const entries = await fs.readdir(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);

			if (entry.isDirectory()) {
				await scan(fullPath);
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name).toLowerCase();
				if (imageExtensions.includes(ext)) {
					files.push(fullPath);
				}
			}
		}
	}

	await scan(dir);
	return files;
}

/**
 * Calculate total size of files in MB
 */
async function calculateTotalSize(files: string[]): Promise<number> {
	let totalSize = 0;
	for (const file of files) {
		try {
			const stats = await fs.stat(file);
			totalSize += stats.size;
		} catch {
			// Skip files that can't be accessed
		}
	}
	return totalSize / (1024 * 1024);
}

/** Per-channel mean and stdev summary (internal, used by computeAggregateStats) */
interface ChannelStats {
	r: { mean: number; stdev: number };
	g: { mean: number; stdev: number };
	b: { mean: number; stdev: number };
}

/**
 * Compute aggregate per-channel mean and stdev across an array of images.
 * Values are averaged so that a batch of reference images produces a single profile.
 */
async function computeAggregateStats(files: string[]): Promise<ChannelStats> {
	let rMeanSum = 0,
		gMeanSum = 0,
		bMeanSum = 0;
	let rStdevSum = 0,
		gStdevSum = 0,
		bStdevSum = 0;
	let count = 0;

	for (const file of files) {
		try {
			const stats = await sharp(file).stats();
			const [r, g, b] = stats.channels;
			if (r === undefined || g === undefined || b === undefined) continue;
			rMeanSum += r.mean;
			gMeanSum += g.mean;
			bMeanSum += b.mean;
			rStdevSum += r.stdev;
			gStdevSum += g.stdev;
			bStdevSum += b.stdev;
			count++;
		} catch {
			// Skip unreadable files
		}
	}

	if (count === 0) {
		throw new Error("Could not compute statistics from any reference image");
	}

	return {
		r: { mean: rMeanSum / count, stdev: rStdevSum / count },
		g: { mean: gMeanSum / count, stdev: gStdevSum / count },
		b: { mean: bMeanSum / count, stdev: bStdevSum / count },
	};
}

// =============================================================================
// Registration Function
/** Schema for the color-profile.json saved to disk by image_analyze_color_profile */
interface ColorProfile extends ChannelStats {
	version: number;
	source: string;
	created: string;
	imageCount: number;
}

// =============================================================================
// Registration Function
// =============================================================================

/**
 * Register all image tools with the MCP server
 */
export function registerImageTools(server: McpServer): void {
	// IMAGE GENERATE TOOL
	server.registerTool(
		"image_generate",
		{
			title: "Generate Images from Text",
			description: imageGenerateTool.description,
			inputSchema: imageGenerateTool.inputSchema.shape,
		},
		imageGenerateTool.handler
	);

	// IMAGE CONVERT TOOL
	server.registerTool(
		"image_convert",
		{
			title: "Convert Image Formats",
			description: imageConvertTool.description,
			inputSchema: imageConvertTool.inputSchema.shape,
		},
		imageConvertTool.handler
	);

	// IMAGE RESIZE TOOL
	server.registerTool(
		"image_resize",
		{
			title: "Resize Images",
			description: imageResizeTool.description,
			inputSchema: imageResizeTool.inputSchema.shape,
		},
		imageResizeTool.handler
	);

	// IMAGE OPTIMIZE TOOL
	server.registerTool(
		"image_optimize",
		{
			title: "Optimize Images",
			description: imageOptimizeTool.description,
			inputSchema: imageOptimizeTool.inputSchema.shape,
		},
		imageOptimizeTool.handler
	);

	// IMAGE ANALYZE COLOR PROFILE TOOL
	server.registerTool(
		"image_analyze_color_profile",
		{
			title: "Analyze Reference Images — Save Color Profile",
			description: imageAnalyzeColorProfileTool.description,
			inputSchema: imageAnalyzeColorProfileTool.inputSchema.shape,
		},
		imageAnalyzeColorProfileTool.handler
	);

	// IMAGE COLOR CORRECT TOOL
	server.registerTool(
		"image_color_correct",
		{
			title: "Correct Image Colors Using Saved Profile",
			description: imageColorCorrectTool.description,
			inputSchema: imageColorCorrectTool.inputSchema.shape,
		},
		imageColorCorrectTool.handler
	);

	console.error(
		"✅ Image tools registered: generate, convert, resize, optimize, analyze_color_profile, color_correct"
	);
}
