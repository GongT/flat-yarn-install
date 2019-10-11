import { loadJsonFile } from '@idlebox/node-json-edit';
import { access as accessAsync } from 'fs';
import { intersects, maxSatisfying, validRange } from 'semver';
import { promisify } from 'util';
import { die } from './common/die';
import { getSelector, ISelectionFunction } from './common/getSelector';
import { convertJson } from './common/json';
import { runYarnFlat } from './common/runYarnFlat';
import { spawnYarn } from './common/spawn';

const access = promisify(accessAsync);

type StringMap = { [id: string]: string };

interface IPackage {
	name: string;
	children: IPackage[];
}

const packageRegistry: { [id: string]: string[] } = {};
const selection: StringMap = {};

function splitVersion(name: string) {
	const parts = name.split(/@/g);
	const version = parts.pop()!;
	return {
		name: parts.join('@'),
		version,
	};
}

function handleFlatPackage(p: IPackage) {
	const { name, version } = splitVersion(p.name);

	if (!packageRegistry[name]) {
		packageRegistry[name] = [];
	}
	packageRegistry[name].push(version);

	if (p.children) {
		for (const item of p.children) {
			handleFlatPackage(item);
		}
	}
}

async function handleManualResolve() {
	const json = await loadJsonFile('package.json');

	function set(name: string, version: string) {
		const cv = validRange(version);
		if (!version) {
			die('invalid version "%s" for package "%s"', version, name);
		}
		if (selection[name]) {
			if (intersects(cv, selection[name])) {
				selection[name] += ' ' + cv;
			} else {
				die('conflict version "%s" and "%s" for package "%s"', cv, selection[name], name);
			}
		} else {
			selection[name] = cv;
		}
	}

	for (const depType of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
		if (json[depType]) {
			Object.entries(json[depType] as StringMap).forEach(([name, version]) => set(name, version));
		}
	}
	if (json.resolutions) {
		for (const [name, version] of Object.entries(json.resolutions as StringMap)) {
			if (name.includes('/')) {
				const parts = name.split('/');
				const last = parts.pop()!;
				const second = parts.pop()!;
				if (second.startsWith('@')) {
					set(second + '/' + last, version);
				} else {
					set(last, version);
				}
			} else {
				set(name, version);
			}
		}
	}
}

(async () => {
	process.env.LANG = 'en_US.UTF-8';

	const selector = getSelector();

	if (!await access('package.json').then(() => true, () => false)) {
		die('Can not read package.json');
	}
	if (!await access('yarn.lock').then(() => true, () => false)) {
		die('File yarn.lock did not exists, you must run yarn install at least once');
	}

	await handleManualResolve();
	console.error('loaded %s forcing resolution from package.json', Object.keys(selection).length);

	const { output, promise } = spawnYarn('list', '--json');
	const pp = new Promise((resolve) => {
		convertJson(output).on('data', (line: any) => {
			if (line && line.type === 'tree' && line.data && line.data.type === 'list') {
				resolve(line.data.trees);
			}
		});
	});
	const treeData: IPackage[] = await Promise.race<any>([promise, pp]);
	if (!treeData) {
		throw die('yarn list --json did not return the dependencies tree.');
	}

	for (const item of treeData) {
		handleFlatPackage(item);
	}
	for (const name of Object.keys(packageRegistry)) {
		if (packageRegistry[name].length === 1) {
			selection[name] = packageRegistry[name][0];
			delete packageRegistry[name];
		}
	}
	console.error('there are %s packages have multiple version', Object.keys(packageRegistry).length);

	const wrappedSelector: ISelectionFunction = async (name: string, versions: string[]) => {
		let fitVersion: string | null;
		if (selection[name]) {
			fitVersion = maxSatisfying(versions, selection[name]);
		} else {
			const result = await Promise.resolve(selector(name, versions)).catch((e) => {
				die('Exception when select version for %s, %s', name, e);
			});
			if (typeof result !== 'string') {
				die('Can not select version for %s, selector function return invalid.');
			}
			fitVersion = maxSatisfying(versions, result);
		}
		if (!fitVersion) {
			throw die('Can not find any version fit %s, known versions are [%s]', selection[name], versions.join(', '));
		}
		return fitVersion;
	};

	await runYarnFlat(wrappedSelector);
})().catch((e) => {
	die('Exception:', e.message);
});
