import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { transpileFile } from '/home/clarence/Projects/Agents/vscode-WorkTrees/merge/build/next/transpile.ts';
const repo = '/home/clarence/Projects/Agents/vscode-WorkTrees/merge';
const directory = (await fs.readFile('/tmp/vscode-closeout-final-integration-current.txt', 'utf8')).trim();
const selection = JSON.parse(await fs.readFile(path.join(directory, 'validation-selection.json'), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const records = [];
for (const source of selection.finalFreshTypescript) {
	const destination = 'out/' + source.slice(4, -3) + '.js';
	const input = await fs.readFile(path.join(repo, source));
	await transpileFile(path.join(repo, source), path.join(repo, destination));
	const output = await fs.readFile(path.join(repo, destination));
	records.push({ source, sourceBytes: input.length, sourceSha256: digest(input), output: destination, outputBytes: output.length, outputSha256: digest(output) });
}
const css = selection.copyCss;
const cssOutput = 'out/' + css.slice(4);
await fs.copyFile(path.join(repo, css), path.join(repo, cssOutput));
const cssBytes = await fs.readFile(path.join(repo, css));
records.push({ source: css, sourceBytes: cssBytes.length, sourceSha256: digest(cssBytes), output: cssOutput, outputBytes: cssBytes.length, outputSha256: digest(cssBytes) });
await fs.writeFile(path.join(directory, 'fresh-source-output-identities.json'), JSON.stringify({ fixedMergedCommit: selection.fixedMergedCommit, records }, null, 2) + '\n');
console.log(JSON.stringify({ freshTypescript: selection.finalFreshTypescript.length, copiedCss: css, identities: records.length }));
