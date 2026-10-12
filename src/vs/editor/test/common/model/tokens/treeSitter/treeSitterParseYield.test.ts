/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { setTimeout0 } from '../../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { Range } from '../../../../../common/core/range.js';
import { TreeSitterTree } from '../../../../../common/model/tokens/treeSitter/treeSitterTree.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import { NullTelemetryService } from '../../../../../../platform/telemetry/common/telemetryUtils.js';
import { createTextModel } from '../../../../common/testTextModel.js';

suite('tree-sitter parse yield', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	class FakeTree {
		deleteCount = 0;
		delete(): void {
			this.deleteCount++;
		}
		copy(): FakeTree {
			return new FakeTree();
		}
	}

	function flushYield(): Promise<void> {
		return new Promise(resolve => setTimeout0(resolve));
	}

	test('deletes the parsed tree when the version changes across the yield, and returns it unchanged otherwise', async () => {
		const textModel = createTextModel('const value = 1;\n');
		const trees: FakeTree[] = [];
		let bumpVersion = false;
		const parser = {
			language: undefined,
			delete() { },
			parse(): FakeTree {
				const tree = new FakeTree();
				trees.push(tree);
				if (bumpVersion) {
					setTimeout0(() => {
						textModel.applyEdits([{ range: new Range(1, 1, 1, 1), text: 'z' }]);
					});
				}
				return tree;
			},
		};
		const treeSitter = new TreeSitterTree(
			'typescript',
			undefined,
			parser as unknown as ConstructorParameters<typeof TreeSitterTree>[2],
			class { } as unknown as ConstructorParameters<typeof TreeSitterTree>[3],
			textModel,
			new NullLogService(),
			NullTelemetryService,
		);
		const parseAndYield = (treeSitter as unknown as { _parseAndYield(parseType: string): Promise<FakeTree | undefined> })._parseAndYield.bind(treeSitter);

		try {
			for (let i = 0; i < 30 && !treeSitter.tree.get(); i++) {
				await flushYield();
			}
			assert.ok(treeSitter.tree.get(), 'initial parse did not install a tree');

			bumpVersion = true;
			const stale = await parseAndYield('fullParse');
			bumpVersion = false;
			assert.strictEqual(stale, undefined);
			assert.strictEqual(trees.at(-1)!.deleteCount, 1);

			const fresh = await parseAndYield('fullParse');
			assert.strictEqual(fresh, trees.at(-1));
			assert.strictEqual(fresh!.deleteCount, 0);
		} finally {
			treeSitter.dispose();
			textModel.dispose();
		}
	});
});
