/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { IReference } from '../../../../../base/common/lifecycle.js';
import { autorun, observableValue, transaction } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IDataChannelService } from '../../../../../platform/dataChannel/common/dataChannel.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { Position } from '../../../../common/core/position.js';
import { Range } from '../../../../common/core/range.js';
import { InlineCompletionTriggerKind, InlineCompletionsProvider, ProviderId } from '../../../../common/languages.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../common/services/resolverService.js';
import { createTextModel } from '../../../../test/common/testTextModel.js';
import { InlineCompletionsSource } from '../../browser/model/inlineCompletionsSource.js';
import { InlineCompletionEditorType } from '../../browser/model/provideInlineCompletions.js';
import { IWithAsyncTestCodeEditorAndInlineCompletionsModel, withAsyncTestCodeEditorAndInlineCompletionsModel } from './utils.js';

suite('InlineCompletionsSource - cross-file model references', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const otherUri = URI.parse('file:///other.ts');

	const provider: InlineCompletionsProvider = {
		providerId: ProviderId.fromExtensionId('test.crossFile'),
		provideInlineCompletions: async () => ({
			items: [{ insertText: 'edit', range: new Range(1, 1, 1, 1), uri: otherUri, isInlineEdit: true }],
		}),
		disposeInlineCompletions: () => { },
	};

	async function withSource(callback: (args: IWithAsyncTestCodeEditorAndInlineCompletionsModel & {
		source: InlineCompletionsSource;
		fetch: () => Promise<boolean>;
		refs: { acquired: number; disposed: number };
		onAcquire: (fn: () => void) => void;
		moveCursor: (position: Position) => void;
	}) => Promise<void>) {
		const serviceCollection = new ServiceCollection([IDataChannelService, upcastPartial<IDataChannelService>({
			onDidSendData: Event.None,
			getDataChannel: () => ({ sendData: () => { } }),
		})]);
		await withAsyncTestCodeEditorAndInlineCompletionsModel('hello', { provider, serviceCollection, inlineSuggest: { enabled: false } }, async args => {
			const otherModel = args.store.add(createTextModel('other content', undefined, undefined, otherUri));
			const refs = { acquired: 0, disposed: 0 };
			let beforeReturn: (() => void) | undefined;
			args.instantiationService.stub(ITextModelService, upcastPartial<ITextModelService>({
				createModelReference: async (): Promise<IReference<IResolvedTextEditorModel>> => {
					refs.acquired++;
					beforeReturn?.();
					return {
						object: upcastPartial<IResolvedTextEditorModel>({ textEditorModel: otherModel }),
						dispose: () => refs.disposed++,
					};
				}
			}));
			const cursorPosition = observableValue<Position>('testCursorPosition', args.editor.getPosition()!);
			const source = args.store.add(args.instantiationService.createInstance(
				InlineCompletionsSource,
				args.model.textModel,
				args.model._textModelVersionId,
				{ get: () => 0, update: () => 0, default: () => 0 },
				cursorPosition,
				undefined,
			));
			args.store.add(autorun(reader => source.inlineCompletions.read(reader)));
			const fetch = () => source.fetch([provider], undefined, {
				triggerKind: InlineCompletionTriggerKind.Explicit,
				selectedSuggestionInfo: undefined,
				earliestShownDateTime: 0,
				includeInlineCompletions: true,
				includeInlineEdits: true,
				requestIssuedDateTime: Date.now(),
			}, undefined, false, observableValue('userJumpedToActiveCompletion', false), {
				startTime: Date.now(),
				sku: undefined,
				editorType: InlineCompletionEditorType.TextEditor,
				languageId: 'plaintext',
				availableProviders: [provider.providerId!],
				reason: '',
				typingInterval: 0,
				typingIntervalCharacterCount: 0,
			});
			await callback({
				...args, source, fetch, refs,
				onAcquire: fn => beforeReturn = fn,
				moveCursor: position => cursorPosition.set(position, undefined),
			});
		});
	}

	test('releases the reference when the fetch is discarded because the document changed', async () => {
		await withSource(async ({ editor, fetch, refs, onAcquire }) => {
			onAcquire(() => editor.getModel()!.applyEdits([{ range: new Range(1, 1, 1, 1), text: 'x' }]));

			const result = await fetch();

			assert.deepStrictEqual({ result, refs }, { result: false, refs: { acquired: 1, disposed: 1 } });
		});
	});

	test('keeps the reference while the suggestion is in the state and releases it once with the state', async () => {
		await withSource(async ({ source, fetch, refs }) => {
			const result = await fetch();
			const whileShown = { ...refs, items: source.inlineCompletions.get().inlineCompletions.length };
			transaction(tx => source.clear(tx));

			assert.deepStrictEqual({ result, whileShown, afterClear: refs }, {
				result: true,
				whileShown: { acquired: 1, disposed: 0, items: 1 },
				afterClear: { acquired: 1, disposed: 1 },
			});
		});
	});

	test('releases the reference of a refetched suggestion that reuses the identity of the shown one', async () => {
		await withSource(async ({ source, fetch, refs, moveCursor }) => {
			await fetch();
			const shown = source.inlineCompletions.get().inlineCompletions[0];
			moveCursor(new Position(1, 2));
			await fetch();
			const reshown = source.inlineCompletions.get().inlineCompletions[0];
			const afterRefetch = { ...refs };
			transaction(tx => source.clear(tx));

			assert.deepStrictEqual({ sameIdentity: reshown.identity === shown.identity, afterRefetch, afterClear: refs }, {
				sameIdentity: true,
				afterRefetch: { acquired: 2, disposed: 1 },
				afterClear: { acquired: 2, disposed: 2 },
			});
		});
	});
});
