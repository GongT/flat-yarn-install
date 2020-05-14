export function die(why: string, ...args: any[]): never {
	console.error(why, ...args);
	process.exit(1);
}
