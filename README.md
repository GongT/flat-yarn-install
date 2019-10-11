# flat-yarn-install

Run `yarn --install --flat` in current working directory, and parse it's output.

Usage:
```bash
flat-yarn-install --newest
flat-yarn-install /path/to/auto-response-script.js
```

Content of auto response script:
````typescript
export default async function resolve(packageName:string, versions: string[]) {
	return versions[0]; // select first option
}
````

For example:
```
info Unable to find a suitable version for "supports-color", please choose one by typing one of the numbers below:
    1) "supports-color@^4.5.0" which resolved to "4.5.0"
    2) "supports-color@^5.3.0" which resolved to "5.5.0"
    3) "supports-color@^6.1.0" which resolved to "6.1.0"
```

Will call:
```typescript
const result = await resolve('supports-color', ["4.5.0", "5.5.0", "6.1.0"]);
```
If `result` is "5.5.0", `2\n` will send to yarn's stdin.
