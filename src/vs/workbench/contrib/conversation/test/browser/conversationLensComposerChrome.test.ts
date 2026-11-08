/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	clearPostFailure,
	composerWriteBusyReason,
	dismissPostFailure,
	showPostFailure,
	updateSendEnabled,
	conversationLensDockAgentUnavailable,
	conversationLensDockEngineCapabilityUnsupported,
	conversationLensDockModelUnavailable,
	conversationLensDockPermissionUnavailable,
	syncComposerPlacement,
	updateAgentSelectEnabled,
	updateComposerEditChrome,
	updateGateRow,
	updateModelSelectEnabled,
	updatePermissionSelectEnabled,
	type IConversationLensComposerChromeHost,
} from '../../browser/conversationLensComposerChrome.js';
import { conversationLensDockEditingMessage, conversationLensDockEditUnchanged, conversationLensDockSendBusy, conversationLensDockSessionLoading, conversationLensDockSessionUnavailable, conversationLensDockSessionUnavailableReason } from '../../browser/conversationLensDockStrings.js';

suite('ConversationLensComposerChrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function flushAnimationFrames(): Promise<void> {
		return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	}

	test('turnEdit placement rAF after composer disconnect does not mount into timeline edit host', async () => {
		const composerCluster = document.createElement('div');
		const composer = document.createElement('div');
		composerCluster.appendChild(composer);
		const dockRoot = document.createElement('div');
		const prefirstHero = document.createElement('div');
		const editHost = document.createElement('div');
		document.body.append(composerCluster, dockRoot, prefirstHero, editHost);

		let editHostReady = false;
		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'turn-1',
			composer,
			composerCluster,
			dockRoot,
			prefirstHero,
			isPreFirst: () => false,
			timelineTree: {
				getTurnEditHost: (turnId: string) => (turnId === 'turn-1' && editHostReady ? editHost : undefined),
			},
		} as unknown as IConversationLensComposerChromeHost;

		try {
			syncComposerPlacement(host);
			composer.remove();
			editHostReady = true;
			await flushAnimationFrames();
			assert.strictEqual(editHost.contains(composer), false);
		} finally {
			composerCluster.remove();
			dockRoot.remove();
			prefirstHero.remove();
			editHost.remove();
		}
	});

	test('session unavailable gate row is a warning status with an icon', () => {
		const gateRow = document.createElement('div');
		gateRow.className = 'conversation-lens-dock-gate-row';
		const gateLabel = document.createElement('span');
		gateLabel.className = 'conversation-lens-dock-gate-label';
		gateRow.append(gateLabel);
		let sessionReady = false;
		const host = {
			postFailureVisible: false,
			gateRow,
			gateLabel,
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => sessionReady,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected' as const, path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
		} as unknown as IConversationLensComposerChromeHost;

		updateGateRow(host);
		const message = `${conversationLensDockSessionUnavailable} — ${conversationLensDockSessionUnavailableReason}`;
		assert.strictEqual(gateRow.hidden, false);
		assert.strictEqual(gateRow.getAttribute('role'), 'status');
		assert.strictEqual(gateRow.getAttribute('aria-label'), message);
		assert.ok(gateRow.classList.contains('is-warning'));
		assert.ok(!gateRow.classList.contains('is-error'));
		const icon = gateRow.querySelector('.conversation-lens-dock-gate-icon') as HTMLElement | null;
		assert.ok(icon);
		assert.strictEqual(icon.hidden, false);
		assert.ok(icon.classList.contains('codicon-warning'));
		assert.strictEqual(icon.getAttribute('aria-hidden'), 'true');

		sessionReady = true;
		updateGateRow(host);
		assert.strictEqual(gateRow.hidden, true);
		assert.ok(!gateRow.classList.contains('is-warning'));
		assert.strictEqual(icon.hidden, true);
	});

	test('loading session gate is status copy without the warning chrome', () => {
		const gateRow = document.createElement('div');
		gateRow.className = 'conversation-lens-dock-gate-row';
		const gateLabel = document.createElement('span');
		gateLabel.className = 'conversation-lens-dock-gate-label';
		gateRow.append(gateLabel);
		const host = {
			postFailureVisible: false,
			gateRow,
			gateLabel,
			stubService: {
				isEngineConnected: () => true,
				getEngineSessionReadiness: () => 'loading' as const,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected' as const, path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
		} as unknown as IConversationLensComposerChromeHost;

		updateGateRow(host);

		assert.strictEqual(gateLabel.textContent, conversationLensDockSessionLoading);
		assert.ok(!gateRow.classList.contains('is-warning'));
		assert.ok(!gateRow.classList.contains('is-error'));
	});

	test('agent permission and model copy follows connection, readiness, and engine support', () => {
		const dockRoot = document.createElement('div');
		const permission = document.createElement('div');
		permission.className = 'conversation-lens-dock-permission';
		const model = document.createElement('div');
		model.className = 'conversation-lens-dock-model';
		dockRoot.append(permission, model);
		const agentContainer = document.createElement('div');
		const aria: { permission?: string; model?: string } = {};
		const selectBox = {
			setEnabled() { },
			setAriaLabel(label: string) {
				if (!aria.permission) {
					aria.permission = label;
				} else {
					aria.model = label;
				}
			},
		};
		let connected = false;
		let pairing = false;
		let readiness: 'ready' | 'loading' | 'unavailable' = 'ready';
		const host = {
			postFailureVisible: false,
			dockRoot,
			agentContainer,
			permissionSelectBox: selectBox,
			modelSelectBox: {
				setEnabled() { },
				setAriaLabel(label: string) { aria.model = label; },
			},
			sessionConfigBySessionId: new Map(),
			getBoundSessionId: () => 'sess-1',
			stubService: {
				isEngineConnected: () => connected,
				getEngineSessionReadiness: () => readiness,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: connected ? 'connected' as const : 'disconnected' as const, path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: pairing }),
			},
		} as unknown as IConversationLensComposerChromeHost;

		const paint = () => {
			aria.permission = undefined;
			aria.model = undefined;
			updateAgentSelectEnabled(host);
			updatePermissionSelectEnabled(host);
			updateModelSelectEnabled(host);
		};
		const agentText = () => agentContainer.textContent;

		paint();
		assert.strictEqual(agentText(), conversationLensDockAgentUnavailable);
		assert.strictEqual(permission.title, conversationLensDockPermissionUnavailable);
		assert.strictEqual(model.title, conversationLensDockModelUnavailable);

		connected = true;
		pairing = true;
		paint();
		assert.strictEqual(agentText(), conversationLensDockAgentUnavailable);
		assert.strictEqual(permission.title, conversationLensDockPermissionUnavailable);

		pairing = false;
		readiness = 'loading';
		paint();
		assert.strictEqual(agentText(), conversationLensDockSessionLoading);
		assert.strictEqual(permission.title, conversationLensDockSessionLoading);
		assert.strictEqual(model.title, conversationLensDockSessionLoading);

		readiness = 'unavailable';
		paint();
		assert.strictEqual(agentText(), conversationLensDockSessionUnavailable);
		assert.strictEqual(permission.title, conversationLensDockSessionUnavailable);
		assert.strictEqual(model.title, conversationLensDockSessionUnavailable);

		readiness = 'ready';
		paint();
		assert.strictEqual(agentText(), conversationLensDockEngineCapabilityUnsupported);
		assert.strictEqual(permission.title, conversationLensDockEngineCapabilityUnsupported);
		assert.strictEqual(model.title, conversationLensDockEngineCapabilityUnsupported);
	});

	test('turnEdit while the edit surface is live puts a disconnected composer back in the cluster', () => {
		const composerCluster = document.createElement('div');
		const composer = document.createElement('div');
		composerCluster.appendChild(composer);
		const dockRoot = document.createElement('div');
		const prefirstHero = document.createElement('div');
		const editHost = document.createElement('div');
		document.body.append(composerCluster, dockRoot, prefirstHero, editHost);

		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'turn-1',
			composer,
			composerCluster,
			dockRoot,
			prefirstHero,
			isPreFirst: () => false,
			timelineTree: {
				getTurnEditHost: () => editHost,
			},
		} as unknown as IConversationLensComposerChromeHost;

		try {
			composer.remove();
			assert.strictEqual(composer.isConnected, false);
			syncComposerPlacement(host);
			assert.strictEqual(composerCluster.contains(composer), true);
			assert.strictEqual(composer.isConnected, true);
			assert.strictEqual(editHost.contains(composer), false);

			syncComposerPlacement(host);
			assert.strictEqual(editHost.contains(composer), true);
			assert.ok(composer.classList.contains('conversation-lens-composer--in-turn'));
			assert.strictEqual(composerCluster.contains(composer), false);
			assert.strictEqual(dockRoot.contains(composerCluster), true);
		} finally {
			composerCluster.remove();
			dockRoot.remove();
			prefirstHero.remove();
			editHost.remove();
		}
	});

	test('turnEdit placement mounts a connected composer into the timeline edit host', () => {
		const composerCluster = document.createElement('div');
		const composer = document.createElement('div');
		composerCluster.appendChild(composer);
		const dockRoot = document.createElement('div');
		const prefirstHero = document.createElement('div');
		const editHost = document.createElement('div');
		document.body.append(composerCluster, dockRoot, prefirstHero, editHost);

		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'turn-1',
			composer,
			composerCluster,
			dockRoot,
			prefirstHero,
			isPreFirst: () => false,
			timelineTree: {
				getTurnEditHost: () => editHost,
			},
		} as unknown as IConversationLensComposerChromeHost;

		try {
			syncComposerPlacement(host);
			assert.strictEqual(composer.parentElement, editHost);
			assert.ok(composer.classList.contains('conversation-lens-composer--in-turn'));
			assert.strictEqual(composerCluster.contains(composer), false);
		} finally {
			composerCluster.remove();
			dockRoot.remove();
			prefirstHero.remove();
			editHost.remove();
		}
	});

	test('turnEdit after user turn disappears hides edit chrome and skips timeline editHost placement', async () => {
		const composerCluster = document.createElement('div');
		const composer = document.createElement('div');
		composerCluster.appendChild(composer);
		const composerEditHeader = document.createElement('div');
		composerEditHeader.hidden = false;
		const composerEditTitle = document.createElement('span');
		composerEditTitle.textContent = conversationLensDockEditingMessage;
		composerEditHeader.append(composerEditTitle);
		composer.classList.add('conversation-lens-composer--edit');
		const dockRoot = document.createElement('div');
		const prefirstHero = document.createElement('div');
		const editHost = document.createElement('div');
		document.body.append(composerCluster, dockRoot, prefirstHero, editHost);

		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'turn-gone',
			composer,
			composerCluster,
			composerEditHeader,
			composerEditTitle,
			dockRoot,
			prefirstHero,
			sendButton: {
				setTitle() { },
				setAriaLabel() { },
			},
			isPreFirst: () => false,
			getBoundSessionId: () => 'sess-1',
			stubService: {
				getTurns: () => [],
			},
			timelineTree: {
				getTurnEditHost: () => editHost,
			},
		} as unknown as IConversationLensComposerChromeHost;

		try {
			updateComposerEditChrome(host);
			assert.strictEqual(composerEditHeader.hidden, true);
			assert.ok(!composer.classList.contains('conversation-lens-composer--edit'));

			syncComposerPlacement(host);
			assert.strictEqual(composerCluster.contains(composer), true);
			assert.strictEqual(editHost.contains(composer), false);
			await flushAnimationFrames();
			assert.strictEqual(editHost.contains(composer), false);
		} finally {
			composerCluster.remove();
			dockRoot.remove();
			prefirstHero.remove();
			editHost.remove();
		}
	});

	test('turnEdit when composer is disconnected restores into the dock cluster and stays there', () => {
		const composerCluster = document.createElement('div');
		const composer = document.createElement('div');
		composerCluster.appendChild(composer);
		const dockRoot = document.createElement('div');
		const prefirstHero = document.createElement('div');
		const editHost = document.createElement('div');
		document.body.append(composerCluster, dockRoot, prefirstHero, editHost);

		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'turn-1',
			composer,
			composerCluster,
			dockRoot,
			prefirstHero,
			isPreFirst: () => false,
			timelineTree: {
				getTurnEditHost: (turnId: string) => (turnId === 'turn-1' ? editHost : undefined),
			},
		} as unknown as IConversationLensComposerChromeHost;

		try {
			// Disconnect composer from document
			composer.remove();
			assert.strictEqual(composer.isConnected, false);

			// Call syncComposerPlacement while disconnected
			syncComposerPlacement(host);
			assert.strictEqual(composerCluster.contains(composer), true);
			assert.strictEqual(composer.isConnected, true);
			assert.strictEqual(editHost.contains(composer), false);

			// Once the node is connected again, the same edit host receives it.
			syncComposerPlacement(host);
			assert.strictEqual(editHost.contains(composer), true);
			assert.ok(composer.classList.contains('conversation-lens-composer--in-turn'));
			assert.strictEqual(composerCluster.contains(composer), false);
			assert.strictEqual(dockRoot.contains(composerCluster), true);
		} finally {
			composerCluster.remove();
			dockRoot.remove();
			prefirstHero.remove();
			editHost.remove();
		}
	});
});

suite('ConversationLensComposerChrome failure row and send copy', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const liveConnection = {
		getConnectionPhase: () => ({ kind: 'connected' as const, path: 'loopback' }),
		getConnectionSnapshot: () => ({ pairingPending: false }),
	};

	function createGateHost(sessionReady = true) {
		const gateRow = document.createElement('div');
		const gateLabel = document.createElement('span');
		const dismissHost = document.createElement('div');
		gateRow.append(gateLabel, dismissHost);
		const gateDismissButton = store.add(new Button(dismissHost, { title: 'Dismiss', ariaLabel: 'Dismiss' }));
		gateDismissButton.element.hidden = true;
		const dockTextarea = document.createElement('textarea');
		document.body.append(gateRow, dockTextarea);
		const host = {
			postFailureVisible: false,
			sendFailureTimeout: undefined,
			gateRow,
			gateLabel,
			gateDismissButton,
			dockTextarea,
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => sessionReady,
			},
			uaConnection: liveConnection,
		} as unknown as IConversationLensComposerChromeHost;
		const state = () => ({
			hidden: gateRow.hidden,
			error: gateRow.classList.contains('is-error'),
			role: gateRow.getAttribute('role'),
			dismissHidden: gateDismissButton.element.hidden,
		});
		return { host, gateRow, gateDismissButton, dockTextarea, state, dispose: () => { gateRow.remove(); dockTextarea.remove(); } };
	}

	test('failure row offers Dismiss, which hides it and returns focus to the input', () => {
		const fixture = createGateHost();
		try {
			showPostFailure(fixture.host, 'engine_disconnected');
			const shown = fixture.state();
			fixture.gateDismissButton.element.focus();
			dismissPostFailure(fixture.host);
			assert.deepStrictEqual({ shown, dismissed: fixture.state(), focused: document.activeElement === fixture.dockTextarea, visible: fixture.host.postFailureVisible }, {
				shown: { hidden: false, error: true, role: 'alert', dismissHidden: false },
				dismissed: { hidden: true, error: false, role: null, dismissHidden: true },
				focused: true,
				visible: false,
			});
		} finally {
			fixture.dispose();
		}
	});

	test('clearing the failure row falls back to the session status gate', () => {
		const fixture = createGateHost(false);
		try {
			showPostFailure(fixture.host, 'failed');
			clearPostFailure(fixture.host);
			assert.deepStrictEqual({ state: fixture.state(), label: fixture.host.gateLabel.textContent }, {
				state: { hidden: false, error: false, role: 'status', dismissHidden: true },
				label: `${conversationLensDockSessionUnavailable} — ${conversationLensDockSessionUnavailableReason}`,
			});
		} finally {
			fixture.dispose();
		}
	});

	function createSendHost(options: { enterBehavior?: 'send' | 'newline'; policy?: 'compose' | 'turnEdit'; text: string; turnText?: string }) {
		const titles: string[] = [];
		const element = document.createElement('div');
		const dockTextarea = document.createElement('textarea');
		dockTextarea.value = options.text;
		const sendButton = {
			enabled: false,
			element,
			setTitle: (title: string) => titles.push(title),
			setAriaLabel: (label: string) => element.setAttribute('aria-label', label),
		};
		const host = {
			composerPolicy: options.policy ?? 'compose',
			editingTurnId: options.policy === 'turnEdit' ? 'u1' : undefined,
			dockTextarea,
			composerRefResources: [],
			sendButton,
			lastAttachedEntries: [],
			configurationService: { getValue: () => options.enterBehavior ?? 'send' },
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				getTurns: () => options.turnText === undefined ? [] : [{ id: 'u1', kind: 'user', text: options.turnText }],
			},
			uaConnection: liveConnection,
			getBoundSessionId: () => 'sess-A',
			composer: undefined,
		} as unknown as IConversationLensComposerChromeHost;
		return { host, sendButton, titles, element };
	}

	test('Send tooltip names the key that actually sends; an unchanged edit says why Send is off', () => {
		const enter = createSendHost({ text: 'hello' });
		updateSendEnabled(enter.host);
		const newline = createSendHost({ text: 'hello', enterBehavior: 'newline' });
		updateSendEnabled(newline.host);
		const unchanged = createSendHost({ text: 'same', policy: 'turnEdit', turnText: 'same' });
		updateSendEnabled(unchanged.host);

		assert.deepStrictEqual({
			enter: [enter.titles.at(-1), enter.element.getAttribute('aria-label'), enter.element.getAttribute('aria-keyshortcuts'), enter.sendButton.enabled],
			newline: [newline.titles.at(-1), newline.element.getAttribute('aria-keyshortcuts')],
			unchanged: [unchanged.titles.at(-1), unchanged.sendButton.enabled],
		}, {
			enter: ['Send (Enter)', 'Send', 'Enter', true],
			newline: ['Send (Shift+Enter)', 'Shift+Enter'],
			unchanged: [conversationLensDockEditUnchanged, false],
		});
	});

	test('Send and the timeline write buttons read one streaming hold', () => {
		const streaming = createSendHost({ text: 'hello' });
		(streaming.host as unknown as { lastAttachedEntries: unknown[] }).lastAttachedEntries = [{ kind: 'assistant', streaming: true }];
		updateSendEnabled(streaming.host);
		assert.deepStrictEqual([composerWriteBusyReason(streaming.host), streaming.titles.at(-1), streaming.sendButton.enabled], [conversationLensDockSendBusy, conversationLensDockSendBusy, false]);
	});
});
