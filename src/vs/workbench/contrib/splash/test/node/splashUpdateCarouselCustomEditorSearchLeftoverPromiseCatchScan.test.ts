/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SPLASH_REL = 'src/vs/workbench/contrib/splash/browser/partsSplash.ts';
const UPDATE_REL = 'src/vs/workbench/contrib/update/browser/update.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const CAROUSEL_REL = 'src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts';
const CUSTOM_REL = 'src/vs/workbench/contrib/customEditor/common/customEditorModelManager.ts';
const SEARCH_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const SEARCH_INPUT_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditorInput.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

suite('splash/update/imageCarousel/customEditor/searchEditor leftover Promise fire-and-forget catch scan (D695)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const files = [SPLASH_REL, UPDATE_REL, CAROUSEL_REL, CUSTOM_REL, SEARCH_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.strictEqual(sites, 8);
	});

	test('update leftover hadLastFocus then is Promise double-chain; opener stays skipped', () => {
		const source = fs.readFileSync(resolveSource(UPDATE_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		assertPromiseSignature(host, 'hadLastFocus(): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `hostService.hadLastFocus().then(async hadLastFocus => {
			if (!hadLastFocus) {
				return;
			}`;
		assert.ok(source.includes(thenCall));
		assert.ok(source.includes(`		})${doubleCatch};`));
		assert.ok(!source.includes(`		});
	}
}

export class UpdateContribution`));
		assert.ok(source.includes('openerService.open(uri);'));
		assert.ok(!source.includes('openerService.open(uri).catch'));
	});

	test('searchEditor leftover ongoingSearchOperation then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(SEARCH_INPUT_REL), 'utf8');
		assertPromiseSignature(input, 'public ongoingSearchOperation: Promise<ISearchComplete> | undefined;');
		assertPromiseSignature(source, 'private async onSearchComplete(searchOperation: ISearchComplete, startConfig: SearchConfiguration, startInput: SearchEditorInput) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `newInput.ongoingSearchOperation.then(complete => {
				this.onSearchComplete(complete, existingConfig, newInput);
			})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty stay skipped', () => {
		const splash = fs.readFileSync(resolveSource(SPLASH_REL), 'utf8');
		const update = fs.readFileSync(resolveSource(UPDATE_REL), 'utf8');
		const carousel = fs.readFileSync(resolveSource(CAROUSEL_REL), 'utf8');
		const custom = fs.readFileSync(resolveSource(CUSTOM_REL), 'utf8');
		const search = fs.readFileSync(resolveSource(SEARCH_REL), 'utf8');
		assert.ok(update.includes('openerService.open(uri);'));
		assert.ok(!update.includes('openerService.open(uri).catch'));
		assert.ok(carousel.includes('this._loadRawData(adjacentImage).catch(() => { /* ignore */ });'));
		assert.ok(carousel.includes('img.decode().catch(() => { /* invalid image */ });'));
		assert.ok(splash.includes('() => this._savePartsSplash(), 2500);'));
		assert.ok(!splash.includes('this._savePartsSplash().catch'));
		assert.ok(custom.includes('return entry.model.then(model => {'));
		for (const source of [splash, update, carousel, custom, search]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
