/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
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
} from './conversationLensComposerChrome.js';
import { conversationLensDockEditingMessage, conversationLensDockSessionLoading, conversationLensDockSessionUnavailable, conversationLensDockSessionUnavailableReason } from './conversationLensDockStrings.js';

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
			assert.strictEqual(composerCluster.contains(composer), true);
			assert.strictEqual(dockRoot.contains(composerCluster), true);
			assert.strictEqual(editHost.contains(composer), false);
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

			// A later placement keeps the composer in the dock cluster.
			syncComposerPlacement(host);
			assert.strictEqual(composerCluster.contains(composer), true);
			assert.strictEqual(dockRoot.contains(composerCluster), true);
			assert.strictEqual(editHost.contains(composer), false);
		} finally {
			composerCluster.remove();
			dockRoot.remove();
			prefirstHero.remove();
			editHost.remove();
		}
	});
});
