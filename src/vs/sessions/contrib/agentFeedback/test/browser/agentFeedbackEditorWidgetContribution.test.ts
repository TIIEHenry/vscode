/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IOverlayWidget } from '../../../../../editor/browser/editorBrowser.js';
import { ITestCodeEditor, withTestCodeEditor } from '../../../../../editor/test/browser/testCodeEditor.js';
import { createTextModel } from '../../../../../editor/test/common/testTextModel.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IMarkdownRendererService, MarkdownRendererService } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { IChatSessionFileChange2 } from '../../../../../workbench/contrib/chat/common/chatSessionsService.js';
import { ISession, ISessionFileChange } from '../../../../services/sessions/common/session.js';
import { ISessionsManagementService } from '../../../../services/sessions/common/sessionsManagement.js';
import { ICodeReviewService, PRReviewStateKind } from '../../../codeReview/browser/codeReviewService.js';
import { AgentFeedbackEditorWidgetContribution } from '../../browser/agentFeedbackEditorWidgetContribution.js';
import { AgentFeedbackOverviewRulerContribution } from '../../browser/agentFeedbackOverviewRulerContribution.js';
import { AgentFeedbackKind, AgentFeedbackState, IAgentFeedback, IAgentFeedbackService } from '../../browser/agentFeedbackService.js';

suite('AgentFeedbackEditorWidgetContribution', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const sessionResource = URI.parse('vscode-agent-session://test/session-1');
	const file = URI.file('/workspace/deleted.ts');
	const deletedOriginal = URI.parse('agenthost:/snapshots/deleted-before');
	const modifiedSnapshot = URI.parse('agenthost:/snapshots/after');
	const originalSnapshot = URI.parse('agenthost:/snapshots/before');

	function comment(text: string, resourceUri: URI): IAgentFeedback {
		return {
			id: 'feedback-1',
			text,
			resourceUri,
			range: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 4 },
			sessionResource,
			kind: AgentFeedbackKind.UserReview,
			state: AgentFeedbackState.Accepted,
		};
	}

	function deletion(): IChatSessionFileChange2 {
		return { uri: file, originalUri: deletedOriginal, modifiedUri: undefined, insertions: 0, deletions: 4 };
	}

	function modification(): IChatSessionFileChange2 {
		return { uri: file, originalUri: originalSnapshot, modifiedUri: modifiedSnapshot, insertions: 2, deletions: 1 };
	}

	function shown(modelUri: URI, changes: readonly ISessionFileChange[], feedback: IAgentFeedback): { titles: string[]; ruler: number } {
		const services = new ServiceCollection();
		services.set(IAgentFeedbackService, new class extends mock<IAgentFeedbackService>() {
			override readonly onDidChangeFeedback = Event.None;
			override readonly onDidChangeFeedbackVisibility = Event.None;
			override readonly onDidChangeNavigation = Event.None;
			override readonly onDidChangeFeedbackScope = Event.None;
			override getFeedbackSessionResource(): URI { return sessionResource; }
			override getFeedback(): readonly IAgentFeedback[] { return [feedback]; }
			override getVisibleResolvedFeedbackIds(): ReadonlySet<string> { return new Set(); }
			override getNavigationBearing() { return { activeIdx: -1, totalCount: 1 }; }
		});
		services.set(ISessionsManagementService, new class extends mock<ISessionsManagementService>() {
			override getSession(): ISession | undefined {
				return { changes: constObservable(changes) } as unknown as ISession;
			}
		});
		services.set(ICodeReviewService, new class extends mock<ICodeReviewService>() {
			override getPRReviewState() { return constObservable({ kind: PRReviewStateKind.None }); }
		});
		services.set(IMarkdownRendererService, new SyncDescriptor(MarkdownRendererService));

		const model = createTextModel('alpha\nbeta\ngamma\n', null, undefined, modelUri);
		try {
			let shownFeedback: { titles: string[]; ruler: number } = { titles: [], ruler: 0 };
			withTestCodeEditor(model, { serviceCollection: services }, editor => {
				// Test editors start with an empty contribution list.
				editor.registerAndInstantiateContribution(AgentFeedbackEditorWidgetContribution.ID, AgentFeedbackEditorWidgetContribution);
				editor.registerAndInstantiateContribution(AgentFeedbackOverviewRulerContribution.ID, AgentFeedbackOverviewRulerContribution);
				shownFeedback = {
					titles: feedbackWidgetTitles(editor),
					ruler: editor.getModel()!.getAllDecorations().filter(decoration => decoration.options.description === 'agent-feedback-overview-ruler').length,
				};
			});
			return shownFeedback;
		} finally {
			model.dispose();
		}
	}

	function feedbackWidgetTitles(editor: ITestCodeEditor): string[] {
		const overlays = (editor as unknown as { _overlayWidgets: Record<string, { widget: IOverlayWidget }> })._overlayWidgets;
		return Object.values(overlays)
			.map(entry => entry.widget.getDomNode())
			.filter(node => node.classList.contains('agent-feedback-widget'))
			.map(node => node.querySelector('.agent-feedback-widget-title')?.textContent ?? '');
	}

	test('shows a comment stored on the deleted file when the editor has its original snapshot', () => {
		assert.deepStrictEqual(
			shown(deletedOriginal, [deletion()], comment('Bring this line back', file)),
			{ titles: ['Bring this line back'], ruler: 1 },
		);
	});

	test('shows a comment stored on the file when the diff editor is showing the modified snapshot', () => {
		assert.deepStrictEqual(
			shown(modifiedSnapshot, [modification()], comment('Keep the new name', file)),
			{ titles: ['Keep the new name'], ruler: 1 },
		);
	});

	test('does not repeat that comment on the original side of a modification', () => {
		assert.deepStrictEqual(
			shown(originalSnapshot, [modification()], comment('Keep the new name', file)),
			{ titles: [], ruler: 0 },
		);
	});

	test('still shows a comment whose resource is the editor model when the file has no session change', () => {
		const model = URI.file('/workspace/plain.ts');
		assert.deepStrictEqual(
			shown(model, [], comment('Plain file note', model)),
			{ titles: ['Plain file note'], ruler: 1 },
		);
	});
});
