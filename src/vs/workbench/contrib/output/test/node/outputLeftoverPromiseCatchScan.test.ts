/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const VIEW_REL = 'src/vs/workbench/contrib/output/browser/outputView.ts';
const MODEL_REL = 'src/vs/workbench/contrib/output/common/outputChannelModel.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count);
	assert.ok(source.includes(`${call}${doubleCatch};`));
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('Output leftover Promise fire-and-forget catch scan (D685)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('outputView editorPromise leftover then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(VIEW_REL), 'utf8');
		const call = 'this.editorPromise?.then(() => this.editor.focus())';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\.editorPromise\?\.then\(\(\) => this\.editor\.focus\(\)\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}?.catch(onUnexpectedError)?.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});

	test('delegated outputChannelModel leftover thens are double-chain; loadModel / poll stay skipped', () => {
		const source = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, 'this.outputChannelModel.then(outputChannelModel => outputChannelModel.append(output))', 1);
		assertDoubleChain(source, 'this.outputChannelModel.then(outputChannelModel => outputChannelModel.update(mode, till, immediate))', 1);
		assertDoubleChain(source, 'this.outputChannelModel.then(outputChannelModel => outputChannelModel.clear())', 1);
		assertDoubleChain(source, 'this.outputChannelModel.then(outputChannelModel => outputChannelModel.replace(value))', 1);
		assertDoubleChain(source, 'this.outputChannelModel.then(outputChannelModel => outputChannelModel.updateChannelSources(files))', 1);
		assert.ok(source.includes('return this.outputChannelModel.then(outputChannelModel => outputChannelModel.loadModel());'));
		assert.ok(source.includes('const loop = () => this.doWatch().then(() => this.poll());'));
		assert.ok(!source.includes('this.doWatch().then(() => this.poll()).catch(onUnexpectedError)'));
	});
});
