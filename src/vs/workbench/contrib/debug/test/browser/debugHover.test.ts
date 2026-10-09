/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createTestCodeEditor } from '../../../../../editor/test/browser/testCodeEditor.js';
import { createTextModel } from '../../../../../editor/test/common/testTextModel.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { DebugHoverWidget, findExpressionInStackFrame } from '../../browser/debugHover.js';
import { IDebugService, IExpression, IScope, State } from '../../common/debug.js';
import { Scope, StackFrame, Thread, Variable } from '../../common/debugModel.js';
import { Source } from '../../common/debugSource.js';
import { MockDebugService } from '../common/mockDebug.js';
import { createTestSession } from './callStack.test.js';
import { createMockDebugModel, mockUriIdentityService } from './mockDebugModel.js';

class TestDebugHoverDebugService extends MockDebugService {
	override get onDidChangeState(): Event<State> { return Event.None; }
	override get state(): State { return State.Inactive; }
	override get onDidNewSession(): Event<any> { return Event.None; }
	override get onWillNewSession(): Event<any> { return Event.None; }
	override get onDidEndSession(): Event<any> { return Event.None; }
	override getModel(): any { return { getSessions: () => [] }; }
	override getViewModel(): any { return { focusedSession: undefined, onDidFocusStackFrame: Event.None }; }
}

suite('Debug - Hover', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('find expression in stack frame', async () => {
		const model = createMockDebugModel(disposables);
		const session = disposables.add(createTestSession(model));

		const thread = new class extends Thread {
			public override getCallStack(): StackFrame[] {
				return [stackFrame];
			}
		}(session, 'mockthread', 1);

		const firstSource = new Source({
			name: 'internalModule.js',
			path: 'a/b/c/d/internalModule.js',
			sourceReference: 10,
		}, 'aDebugSessionId', mockUriIdentityService, new NullLogService());

		const stackFrame = new class extends StackFrame {
			override getScopes(): Promise<IScope[]> {
				return Promise.resolve([scope]);
			}
		}(thread, 1, firstSource, 'app.js', 'normal', { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 }, 1, true);


		const scope = new class extends Scope {
			override getChildren(): Promise<IExpression[]> {
				return Promise.resolve([variableA]);
			}
		}(stackFrame, 1, 'local', 1, false, 10, 10);

		const variableA = new class extends Variable {
			override getChildren(): Promise<IExpression[]> {
				return Promise.resolve([variableB]);
			}
		}(session, 1, scope, 2, 'A', 'A', undefined, 0, 0, undefined, {}, 'string');
		const variableB = new Variable(session, 1, scope, 2, 'B', 'A.B', undefined, 0, 0, undefined, {}, 'string');

		assert.strictEqual(await findExpressionInStackFrame(stackFrame, []), undefined);
		assert.strictEqual(await findExpressionInStackFrame(stackFrame, ['A']), variableA);
		assert.strictEqual(await findExpressionInStackFrame(stackFrame, ['doesNotExist', 'no']), undefined);
		assert.strictEqual(await findExpressionInStackFrame(stackFrame, ['a']), undefined);
		assert.strictEqual(await findExpressionInStackFrame(stackFrame, ['B']), undefined);
		assert.strictEqual(await findExpressionInStackFrame(stackFrame, ['A', 'B']), variableB);
		assert.strictEqual(await findExpressionInStackFrame(stackFrame, ['A', 'C']), undefined);

		// We do not search in expensive scopes
		scope.expensive = true;
		assert.strictEqual(await findExpressionInStackFrame(stackFrame, ['A']), undefined);
	});

	test('complex value hover setInput completion updates layout and sequence handling', async () => {
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		const debugService = new TestDebugHoverDebugService();
		instantiationService.stub(IDebugService, debugService);

		const model = disposables.add(createTextModel('let x = 1;'));
		const editor = disposables.add(createTestCodeEditor(model));
		const hover = disposables.add(instantiationService.createInstance(DebugHoverWidget, editor));

		const expression: IExpression = {
			name: 'complexVar',
			value: '{...}',
			hasChildren: true,
			getSession: () => undefined,
			getId: () => 'id_1',
			evaluateLazy: () => Promise.resolve(),
			getChildren: () => Promise.resolve([])
		} as IExpression;

		let layoutCount = 0;
		(hover as any).layoutTreeAndContainer = () => {
			layoutCount++;
		};

		const contentHeightEmitter = disposables.add(new Emitter<void>());
		let deferredInput = new DeferredPromise<void>();

		const mockTree = {
			setInput: () => deferredInput.p,
			onDidChangeContentHeight: contentHeightEmitter.event,
			dispose: () => { }
		};
		(hover as any).tree = mockTree;
		(hover as any).toDispose.push(mockTree.onDidChangeContentHeight(() => {
			if (!(hover as any).isUpdatingTree) {
				(hover as any).layoutTreeAndContainer();
			}
		}));

		const visibleStore = disposables.add(new DisposableStore());
		(hover as any)._isVisible = { store: visibleStore };

		// 1. Content height events during setInput are suppressed while isUpdatingTree is true
		(hover as any).expressionToRender = expression;
		hover.beforeRender();

		assert.strictEqual((hover as any).isUpdatingTree, true);
		assert.strictEqual((hover as any).setInputSequence, 1);
		contentHeightEmitter.fire();
		assert.strictEqual(layoutCount, 0, 'layout should be suppressed while isUpdatingTree is true');

		// 2. When setInput resolves and hover is visible, layoutTreeAndContainer is invoked once and isUpdatingTree is false
		deferredInput.complete();
		await deferredInput.p;
		await Promise.resolve();

		assert.strictEqual((hover as any).isUpdatingTree, false);
		assert.strictEqual(layoutCount, 1, 'layoutTreeAndContainer should be invoked on setInput fulfillment');

		// And subsequent content height events trigger layout now that isUpdatingTree is false
		contentHeightEmitter.fire();
		assert.strictEqual(layoutCount, 2);

		// 3. When setInput rejects, layoutTreeAndContainer is not called and isUpdatingTree is not cleared
		layoutCount = 0;
		const rejectDeferred = new DeferredPromise<void>();
		(hover as any).tree.setInput = () => rejectDeferred.p;
		(hover as any).expressionToRender = expression;

		const origHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { /* swallow expected error from double catch */ });
		try {
			hover.beforeRender();

			assert.strictEqual((hover as any).isUpdatingTree, true);
			assert.strictEqual((hover as any).setInputSequence, 2);
			rejectDeferred.error(new Error('tree setInput failed'));
			await rejectDeferred.p.catch(() => { });
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			assert.strictEqual(layoutCount, 0, 'layout should not be invoked on rejection');
			assert.strictEqual((hover as any).isUpdatingTree, false, 'isUpdatingTree should be cleared on rejection');

			// Content height events after rejection should trigger layout
			contentHeightEmitter.fire();
			assert.strictEqual(layoutCount, 1, 'content height change after rejection should trigger layout');
		} finally {
			setUnexpectedErrorHandler(origHandler);
		}

		// 4. When a newer setInput starts, older promise completion does not invoke layoutTreeAndContainer
		layoutCount = 0;
		const olderDeferred = new DeferredPromise<void>();
		const newerDeferred = new DeferredPromise<void>();

		(hover as any).tree.setInput = () => olderDeferred.p;
		(hover as any).expressionToRender = expression;
		hover.beforeRender();
		assert.strictEqual((hover as any).setInputSequence, 3);

		(hover as any).tree.setInput = () => newerDeferred.p;
		(hover as any).expressionToRender = expression;
		hover.beforeRender();
		assert.strictEqual((hover as any).setInputSequence, 4);

		// Older promise completes
		olderDeferred.complete();
		await olderDeferred.p;
		await Promise.resolve();
		assert.strictEqual(layoutCount, 0, 'stale sequence promise completion should not trigger layout');
		assert.strictEqual((hover as any).isUpdatingTree, true);

		// Newer promise completes
		newerDeferred.complete();
		await newerDeferred.p;
		await Promise.resolve();
		assert.strictEqual(layoutCount, 1, 'latest sequence promise completion should trigger layout');
		assert.strictEqual((hover as any).isUpdatingTree, false);

		// 5. When hover is not visible (!_isVisible), fulfillment does not invoke layout
		layoutCount = 0;
		const hiddenDeferred = new DeferredPromise<void>();
		(hover as any).tree.setInput = () => hiddenDeferred.p;
		(hover as any).expressionToRender = expression;
		hover.beforeRender();
		assert.strictEqual((hover as any).setInputSequence, 5);

		// Hover becomes invisible before fulfillment
		(hover as any)._isVisible = undefined;

		hiddenDeferred.complete();
		await hiddenDeferred.p;
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(layoutCount, 0, 'hidden hover fulfillment should not trigger layout');
		assert.strictEqual((hover as any).isUpdatingTree, false, 'isUpdatingTree should be cleared on hidden hover fulfillment');
	});
});
