/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IEditorMouseEvent, MouseTargetType } from '../../../../browser/editorBrowser.js';
import { Position } from '../../../../common/core/position.js';
import { Range } from '../../../../common/core/range.js';
import * as languages from '../../../../common/languages.js';
import { IIdentifiedSingleEditOperation, ITextModel } from '../../../../common/model.js';
import { InjectedText } from '../../../../common/modelLineProjectionData.js';
import { ModelDecorationInjectedTextOptions } from '../../../../common/model/textModel.js';
import { ILanguageFeatureDebounceService } from '../../../../common/services/languageFeatureDebounce.js';
import { ILanguageFeaturesService } from '../../../../common/services/languageFeatures.js';
import { TextModelEditSource } from '../../../../common/textModelEditSource.js';
import { ITestCodeEditor, withAsyncTestCodeEditor } from '../../../../test/browser/testCodeEditor.js';
import { instantiateTextModel } from '../../../../test/common/testTextModel.js';
import { InlayHintAnchor, InlayHintItem } from '../../browser/inlayHints.js';
import { InlayHintsController, RenderedInlayHintLabelPart } from '../../browser/inlayHintsController.js';

suite('InlayHintsController double click', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	async function flush(): Promise<void> {
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	function doubleClickEvent(part: RenderedInlayHintLabelPart): IEditorMouseEvent {
		return {
			event: {
				detail: 2,
				leftButton: true,
				middleButton: false,
				rightButton: false,
				ctrlKey: false,
				shiftKey: false,
				altKey: false,
				metaKey: false,
				preventDefault() { },
				stopPropagation() { },
			},
			target: {
				type: MouseTargetType.CONTENT_TEXT,
				element: null,
				position: new Position(1, 1),
				mouseColumn: 1,
				range: new Range(1, 1, 1, 1),
				detail: {
					mightBeForeignElement: false,
					injectedText: new InjectedText(ModelDecorationInjectedTextOptions.from({
						content: 'hint',
						attachedData: part,
					})),
				},
			},
		} as IEditorMouseEvent;
	}

	type RecordedExecuteEdit = {
		source: string | TextModelEditSource | null | undefined;
		edits: IIdentifiedSingleEditOperation[];
	};

	async function runDoubleClick(
		duringResolve: (editor: ITestCodeEditor, model: ITextModel, instantiationService: TestInstantiationService) => void,
		assertAfter: (model: ITextModel, calls: RecordedExecuteEdit[], editor: ITestCodeEditor) => void,
	): Promise<void> {
		await withAsyncTestCodeEditor('foo bar', {}, async (editor, _viewModel, instantiationService) => {
			const languageFeatures = instantiationService.get(ILanguageFeaturesService);
			const gate = new DeferredPromise<void>();
			const hint: languages.InlayHint = {
				label: 'hint',
				position: { lineNumber: 1, column: 1 },
				textEdits: [{ range: new Range(1, 1, 1, 4), text: 'HELLO' }],
			};
			const model = editor.getModel()!;
			const provider: languages.InlayHintsProvider = {
				provideInlayHints: () => ({ hints: [], dispose() { } }),
				resolveInlayHint: async (next) => {
					await gate.p;
					duringResolve(editor, model, instantiationService);
					return next;
				},
			};
			const registration = languageFeatures.inlayHintsProvider.register('*', provider);
			const item = new InlayHintItem(hint, new InlayHintAnchor(new Range(1, 1, 1, 2), 'before'), provider);
			const calls: RecordedExecuteEdit[] = [];
			const originalExecuteEdits = editor.executeEdits.bind(editor) as (
				source: RecordedExecuteEdit['source'],
				edits: IIdentifiedSingleEditOperation[],
				endCursorState?: Parameters<ITestCodeEditor['executeEdits']>[2],
			) => boolean;
			editor.executeEdits = ((source: RecordedExecuteEdit['source'], edits: IIdentifiedSingleEditOperation[], endCursorState?: Parameters<ITestCodeEditor['executeEdits']>[2]) => {
				calls.push({ source, edits });
				return originalExecuteEdits(source, edits, endCursorState);
			}) as typeof editor.executeEdits;
			const cache = {
				get() { return undefined; },
				set() { },
			} as unknown as ConstructorParameters<typeof InlayHintsController>[3];
			const controller = new InlayHintsController(
				editor,
				languageFeatures,
				instantiationService.get(ILanguageFeatureDebounceService),
				cache,
				instantiationService.get(ICommandService),
				instantiationService.get(INotificationService),
				instantiationService,
			);
			try {
				(editor as unknown as { _onMouseUp: { fire(next: IEditorMouseEvent): void } })._onMouseUp.fire(doubleClickEvent(new RenderedInlayHintLabelPart(item, 0)));
				gate.complete();
				await flush();
				assertAfter(model, calls, editor);
			} finally {
				controller.dispose();
				registration.dispose();
			}
		});
	}

	test('applies hint textEdits when the model and version are unchanged', async () => {
		await runDoubleClick(() => { }, (model, calls) => {
			assert.strictEqual(calls.length, 1);
			assert.strictEqual(calls[0].source, 'inlayHint.default');
			assert.strictEqual(calls[0].edits.length, 1);
			assert.strictEqual(calls[0].edits[0].text, 'HELLO');
			assert.deepStrictEqual(Range.lift(calls[0].edits[0].range), new Range(1, 1, 1, 4));
			assert.strictEqual(model.getValue(), 'HELLO bar');
		});
	});

	test('does not apply hint textEdits when the version changed during resolve', async () => {
		await runDoubleClick((_editor, model) => {
			model.applyEdits([{ range: new Range(1, 1, 1, 1), text: 'Z' }]);
		}, (model, calls) => {
			assert.strictEqual(calls.length, 0);
			assert.strictEqual(model.getValue(), 'Zfoo bar');
		});
	});

	test('does not apply hint textEdits when the model changed during resolve', async () => {
		await runDoubleClick((editor, _model, instantiationService) => {
			const other = instantiateTextModel(instantiationService, 'other text');
			editor.registerDisposable(other);
			editor.setModel(other);
		}, (model, calls, editor) => {
			assert.strictEqual(calls.length, 0);
			assert.strictEqual(model.getValue(), 'foo bar');
			assert.strictEqual(editor.getModel()!.getValue(), 'other text');
			editor.setModel(model);
		});
	});
});
