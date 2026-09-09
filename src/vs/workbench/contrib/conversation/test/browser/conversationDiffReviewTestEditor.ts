/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { DisposableStore, IDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IEditorOptions } from '../../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { NullTelemetryService } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry, IEditorOpenContext, IEditorSerializer } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { EditorPane } from '../../../../browser/parts/editor/editorPane.js';
import { IEditorGroup } from '../../../../services/editor/common/editorGroupsService.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { ConversationDiffReviewInput } from '../../../sources/browser/conversationDiffReviewInput.js';
import { ConversationDiffReviewInputTypeId } from '../../../sources/common/conversationDiffReviewInput.js';

export const TEST_CONVERSATION_DIFF_REVIEW_EDITOR_ID = 'workbench.editor.conversationDiffReview.test';

/**
 * Lightweight pane + serializer for conversation suites that open
 * ConversationDiffReviewInput. The real contribution constructs
 * ConversationDiffReviewPane (DiffEditorWidget + model refs) and
 * aborts mocha root afterEach when those disposables leak.
 */
export function registerTestConversationDiffReviewEditor(disposables: Pick<DisposableStore, 'add'>): IDisposable {
	class TestConversationDiffReviewEditorPane extends EditorPane {
		constructor(group: IEditorGroup) {
			super(TEST_CONVERSATION_DIFF_REVIEW_EDITOR_ID, group, NullTelemetryService, new TestThemeService(), disposables.add(new TestStorageService()));
		}

		layout(): void { }

		protected createEditor(): void { }

		override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
			await super.setInput(input, options, context, token);
		}
	}

	class ConversationDiffReviewInputSerializer implements IEditorSerializer {
		canSerialize(input: EditorInput): input is ConversationDiffReviewInput {
			return input instanceof ConversationDiffReviewInput;
		}

		serialize(input: ConversationDiffReviewInput): string | undefined {
			return JSON.stringify({
				modified: input.modified.toString(),
				original: input.original?.toString(),
				groupId: input.groupId,
			});
		}

		deserialize(instantiationService: IInstantiationService, serialized: string): ConversationDiffReviewInput | undefined {
			try {
				const parsed = JSON.parse(serialized) as { modified: string; original?: string; groupId?: string };
				return instantiationService.createInstance(
					ConversationDiffReviewInput,
					URI.parse(parsed.modified),
					parsed.original ? URI.parse(parsed.original) : undefined,
					parsed.groupId ?? '',
				);
			} catch {
				return undefined;
			}
		}
	}

	const paneRegistration = disposables.add(Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
		EditorPaneDescriptor.create(
			TestConversationDiffReviewEditorPane,
			TEST_CONVERSATION_DIFF_REVIEW_EDITOR_ID,
			'Conversation Diff Review Test',
		),
		[new SyncDescriptor(ConversationDiffReviewInput)],
	));

	const serializerRegistration = disposables.add(Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
		ConversationDiffReviewInputTypeId,
		ConversationDiffReviewInputSerializer,
	));

	return toDisposable(() => {
		paneRegistration.dispose();
		serializerRegistration.dispose();
	});
}
