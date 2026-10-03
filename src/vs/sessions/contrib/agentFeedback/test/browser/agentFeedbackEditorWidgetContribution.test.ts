/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { constObservable, IObservable, observableValue } from '../../../../../base/common/observable.js';
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
		let shownFeedback: { titles: string[]; ruler: number } = { titles: [], ruler: 0 };
		withFeedbackEditor(modelUri, constObservable(changes), feedback, editor => {
			shownFeedback = readShown(editor);
		});
		return shownFeedback;
	}

	function withFeedbackEditor(modelUri: URI, changes: IObservable<readonly ISessionFileChange[]>, feedback: IAgentFeedback, run: (editor: ITestCodeEditor) => void): void {
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
				return { changes } as unknown as ISession;
			}
		});
		services.set(ICodeReviewService, new class extends mock<ICodeReviewService>() {
			override getPRReviewState() { return constObservable({ kind: PRReviewStateKind.None }); }
		});
		services.set(IMarkdownRendererService, new SyncDescriptor(MarkdownRendererService));

		const model = createTextModel('alpha\nbeta\ngamma\n', null, undefined, modelUri);
		try {
			withTestCodeEditor(model, { serviceCollection: services }, editor => {
				// Test editors start with an empty contribution list.
				editor.registerAndInstantiateContribution(AgentFeedbackEditorWidgetContribution.ID, AgentFeedbackEditorWidgetContribution);
				editor.registerAndInstantiateContribution(AgentFeedbackOverviewRulerContribution.ID, AgentFeedbackOverviewRulerContribution);
				run(editor);
			});
		} finally {
			model.dispose();
		}
	}

	function readShown(editor: ITestCodeEditor): { titles: string[]; ruler: number } {
		return {
			titles: feedbackWidgetTitles(editor),
			ruler: editor.getModel()!.getAllDecorations().filter(decoration => decoration.options.description === 'agent-feedback-overview-ruler').length,
		};
	}

	function feedbackWidgetNodes(editor: ITestCodeEditor): HTMLElement[] {
		const overlays = (editor as unknown as { _overlayWidgets: Record<string, { widget: IOverlayWidget }> })._overlayWidgets;
		return Object.values(overlays)
			.map(entry => entry.widget.getDomNode())
			.filter(node => node.classList.contains('agent-feedback-widget'));
	}

	function feedbackWidgetTitles(editor: ITestCodeEditor): string[] {
		return feedbackWidgetNodes(editor).map(node => node.querySelector('.agent-feedback-widget-title')?.textContent ?? '');
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

	test('moves a comment onto the open original snapshot when that file is deleted', () => {
		const changes = observableValue<readonly ISessionFileChange[]>('changes', [modification()]);
		withFeedbackEditor(deletedOriginal, changes, comment('Bring this line back', file), editor => {
			assert.deepStrictEqual(readShown(editor), { titles: [], ruler: 0 });

			changes.set([deletion()], undefined);

			assert.deepStrictEqual(readShown(editor), { titles: ['Bring this line back'], ruler: 1 });
		});
	});

	test('drops a comment from the open modified snapshot once that file is deleted', () => {
		const changes = observableValue<readonly ISessionFileChange[]>('changes', [modification()]);
		withFeedbackEditor(modifiedSnapshot, changes, comment('Keep the new name', file), editor => {
			assert.deepStrictEqual(readShown(editor), { titles: ['Keep the new name'], ruler: 1 });

			changes.set([deletion()], undefined);

			assert.deepStrictEqual(readShown(editor), { titles: [], ruler: 0 });
		});
	});

	test('keeps the open comment widget when another file change is republished', () => {
		const current = modification();
		const changes = observableValue<readonly ISessionFileChange[]>('changes', [current]);
		withFeedbackEditor(modifiedSnapshot, changes, comment('Keep the new name', file), editor => {
			const widget = feedbackWidgetNodes(editor)[0];
			assert.ok(widget);

			changes.set([{ ...current, insertions: 9, deletions: 8 }], undefined);
			changes.set([
				current,
				{ uri: URI.file('/workspace/other.ts'), originalUri: URI.parse('agenthost:/snapshots/other-before'), modifiedUri: URI.parse('agenthost:/snapshots/other-after'), insertions: 1, deletions: 0 },
			], undefined);

			assert.strictEqual(feedbackWidgetNodes(editor)[0], widget);
			assert.deepStrictEqual(readShown(editor), { titles: ['Keep the new name'], ruler: 1 });
		});
	});
});
