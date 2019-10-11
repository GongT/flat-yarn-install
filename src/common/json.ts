import split2 = require('split2');

function safeJsonParse(line: string) {
	try {
		return JSON.parse(line);
	} catch (e) {
		return { type: 'json-error', line, error: e };
	}
}

export function convertJson(stream: NodeJS.ReadableStream) {
	return stream.pipe(split2(safeJsonParse));
}
