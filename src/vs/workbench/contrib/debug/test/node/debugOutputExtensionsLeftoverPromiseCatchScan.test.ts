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
const OUTPUT_MODEL_REL = 'src/vs/workbench/contrib/output/common/outputChannelModel.ts';
const VARIABLES_REL = 'src/vs/workbench/contrib/debug/browser/variablesView.ts';
const CALL_STACK_REL = 'src/vs/workbench/contrib/debug/browser/callStackWidget.ts';
const EXTENSIONS_CONTRIB_REL = 'src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts';
const EXTENSIONS_VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';

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

suite('debug/output/extensions leftover Promise fire-and-forget catch scan (D688)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('output FileOutputChannelModel / MultiFile leftover loadModelPromise thens are double-chain; poll stays skipped', () => {
		const source = fs.readFileSync(resolveSource(OUTPUT_MODEL_REL), 'utf8');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes(`loadModelPromise.then(() => {
			if (mode === OutputChannelUpdateMode.Clear || mode === OutputChannelUpdateMode.Replace) {
				if (isNumber(till)) {
					this.fileOutput.reset(till);
				} else {
					this.fileOutput.resetToEnd();
				}
			}
			this.doUpdate(mode, immediate);
		})${doubleCatch};`));
		assert.ok(source.includes(`loadModelPromise.then(() => {
			this.multifileOutput.resetToEnd();
			this.doUpdate(OutputChannelUpdateMode.Clear, true);
		})${doubleCatch};`));
		assert.ok(!source.includes(`loadModelPromise.then(() => {
			if (mode === OutputChannelUpdateMode.Clear || mode === OutputChannelUpdateMode.Replace) {
				if (isNumber(till)) {
					this.fileOutput.reset(till);
				} else {
					this.fileOutput.resetToEnd();
				}
			}
			this.doUpdate(mode, immediate);
		});`));
		assert.ok(!source.includes(`loadModelPromise.then(() => {
			this.multifileOutput.resetToEnd();
			this.doUpdate(OutputChannelUpdateMode.Clear, true);
		});`));
		assert.ok(source.includes('const loop = () => this.doWatch().then(() => this.poll());'));
		assert.ok(!source.includes('this.doWatch().then(() => this.poll()).catch(onUnexpectedError)'));
	});

	test('debug variablesView leftover viz.edit / setVariable / getApplicableFor thens are double-chain', () => {
		const source = fs.readFileSync(resolveSource(VARIABLES_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const editThen = `viz.edit(value).then(() => {
						// Do not refresh scopes due to a node limitation #15520
						forgetScopes = false;
						this.debugService.getViewModel().updateViews();
					})`;
		const setThen = `variable.setVariable(value, focusedStackFrame)
						// Need to force watch expressions and variables to update since a variable change can have an effect on both
						.then(() => {
							// Do not refresh scopes due to a node limitation #15520
							forgetScopes = false;
							this.debugService.getViewModel().updateViews();
						})`;
		const vizThen = `this.visualization.getApplicableFor(expression, cts.token).then(result => {
			data.elementDisposable.add(result);

			const originalExpression = (expression instanceof VisualizedExpression && expression.original) || expression;
			const actions = result.object.map(v => toAction({ id: 'debugViz', label: v.name, class: v.iconClass || 'debug-viz-icon', run: this.useVisualizer(v, originalExpression, cts.token) }));
			if (actions.length === 0) {
				// no-op
			} else if (actions.length === 1) {
				actionBar.push(actions[0], { icon: true, label: false });
			} else {
				actionBar.push(toAction({ id: 'debugViz', label: localize('useVisualizer', 'Visualize Variable...'), class: ThemeIcon.asClassName(Codicon.eye), run: () => this.pickVisualizer(actions, originalExpression, data) }), { icon: true, label: false });
			}
		})`;
		assert.ok(source.includes(`${editThen}${doubleCatch};`));
		assert.ok(source.includes(`${setThen}${doubleCatch};`));
		assert.ok(source.includes(`${vizThen}${doubleCatch};`));
		assert.ok(!source.includes(`${editThen};`));
		assert.ok(!source.includes(`${setThen};`));
		assert.ok(!source.includes(`${vizThen};`));
		assert.ok(!source.includes(`${editThen}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${setThen}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${vizThen}.catch(onUnexpectedError);`));
	});

	test('debug callStackWidget leftover createModelReference then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(CALL_STACK_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const call = `this.modelService.createModelReference(uri).then(reference => {
			if (cts.token.isCancellationRequested) {
				return reference.dispose();
			}

			elementStore.add(reference);
			editor.setModel(reference.object.textEditorModel);
			this.setupEditorAfterModel(item, template);
			this.setupEditorLayout(item, template);
		})`;
		assertDoubleChain(source, call, 1);
	});

	test('extensions gallery leftover getExtensionGalleryManifest thens are double-chain', () => {
		const contribution = fs.readFileSync(resolveSource(EXTENSIONS_CONTRIB_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(EXTENSIONS_VIEWLET_REL), 'utf8');
		assert.ok(contribution.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(viewlet.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		const contribThen = `extensionGalleryManifestService.getExtensionGalleryManifest()
			.then(extensionGalleryManifest => {
				this.updateGalleryCapabilitiesContexts(extensionGalleryManifest);
				this._register(extensionGalleryManifestService.onDidChangeExtensionGalleryManifest(extensionGalleryManifest => this.updateGalleryCapabilitiesContexts(extensionGalleryManifest)));
			})`;
		const viewletThen = `extensionGalleryManifestService.getExtensionGalleryManifest()
			.then(galleryManifest => {
				this.extensionGalleryManifest = galleryManifest;
				this._register(extensionGalleryManifestService.onDidChangeExtensionGalleryManifest(galleryManifest => {
					this.extensionGalleryManifest = galleryManifest;
					this.refresh();
				}));
			})`;
		assert.ok(contribution.includes(`${contribThen}${doubleCatch};`));
		assert.ok(viewlet.includes(`${viewletThen}${doubleCatch};`));
		assert.ok(!contribution.includes(`${contribThen};`));
		assert.ok(!viewlet.includes(`${viewletThen};`));
		assert.ok(!contribution.includes(`${contribThen}.catch(onUnexpectedError);`));
		assert.ok(!viewlet.includes(`${viewletThen}.catch(onUnexpectedError);`));
	});
});
