declare module "potrace" {
	const potrace: any;
	export default potrace;
}

declare module "svg-path-parser" {
	const svgPathParser: {
		parseSVG(pathData: string): any[];
	};
	export default svgPathParser;
}
