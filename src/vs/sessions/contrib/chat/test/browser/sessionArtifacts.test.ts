/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { isMarkdownString } from '../../../../../base/common/htmlContent.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { buildSessionArtifactSections, SessionArtifacts, type ISessionArtifactActions } from '../../browser/sessionArtifacts.js';
import { type ISessionArtifact, SessionArtifactKind } from '../../../../services/sessions/common/session.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';

suite('Session Artifacts', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const actions: ISessionArtifactActions = {
		openExternal() { },
		openResource() { },
		openImages() { },
		copy() { },
	};

	test('shows each artifact URI or link beside its dropdown entry', () => {
		const fileUri = URI.file('/artifacts/report.md');
		const resourceUri = URI.parse('vscode://sessions/resource');
		const pullRequestLink = URI.parse('https://github.com/microsoft/vscode/pull/12');
		const artifacts: readonly ISessionArtifact[] = [
			{ id: 'pr', kind: SessionArtifactKind.PullRequest, label: 'PR #12', isArtifact: true, link: pullRequestLink },
			{ id: 'file', kind: SessionArtifactKind.File, label: 'Report', isArtifact: true, uri: fileUri },
			{ id: 'resource', kind: SessionArtifactKind.Resource, label: 'Resource', isArtifact: true, uri: resourceUri },
		];

		const entries = buildSessionArtifactSections(artifacts, actions, true, new Set()).flatMap(section => section.entries);
		assert.deepStrictEqual(entries.map(entry => {
			const content = entry.hover?.content;
			return {
				label: entry.label,
				ariaLabel: entry.ariaLabel,
				ariaDescription: entry.ariaDescription,
				hover: isMarkdownString(content) ? content.value : undefined,
				tooltip: entry.tooltip,
			};
		}), [
			{ label: 'PR #12', ariaLabel: 'Open PR #12', ariaDescription: pullRequestLink.toString(true), hover: pullRequestLink.toString(true), tooltip: pullRequestLink.toString(true) },
			{ label: 'report.md', ariaLabel: 'Open report.md', ariaDescription: fileUri.toString(true), hover: fileUri.toString(true), tooltip: fileUri.toString(true) },
			{ label: 'Resource', ariaLabel: 'Open Resource', ariaDescription: resourceUri.toString(true), hover: resourceUri.toString(true), tooltip: resourceUri.toString(true) },
		]);
	});

	test('leaves out websites the browsers pill already lists', () => {
		const pullRequestLink = URI.parse('https://github.com/microsoft/vscode/pull/12');
		const artifacts: readonly ISessionArtifact[] = [
			{ id: 'docs', kind: SessionArtifactKind.Website, label: 'Docs', isArtifact: true, link: URI.parse('https://example.com/docs') },
			{ id: 'docs-slash', kind: SessionArtifactKind.Website, label: 'Docs Index', isArtifact: true, link: URI.parse('https://Example.com/docs/') },
			{ id: 'deep', kind: SessionArtifactKind.Website, label: 'Deep Link', isArtifact: true, link: URI.parse('https://example.com/docs/api') },
			{ id: 'blog', kind: SessionArtifactKind.Website, label: 'Blog', isArtifact: true, link: URI.parse('https://other.test/blog') },
			{ id: 'pr', kind: SessionArtifactKind.PullRequest, label: 'PR #12', isArtifact: true, link: pullRequestLink },
		];
		const labels = (browserUrls: readonly string[]) => buildSessionArtifactSections(artifacts, actions, true, new Set(browserUrls))
			.flatMap(section => section.entries)
			.map(entry => entry.label);

		assert.deepStrictEqual({
			withBrowsers: labels(['https://example.com/docs', pullRequestLink.toString()]),
			withoutBrowsers: labels([]),
		}, {
			withBrowsers: ['PR #12', 'Deep Link', 'Blog'],
			withoutBrowsers: ['PR #12', 'Docs', 'Docs Index', 'Deep Link', 'Blog'],
		});
	});

	test('offers a copy link action for pull request and issue entries', () => {
		const copied: string[] = [];
		const pullRequestLink = URI.parse('https://github.com/microsoft/vscode/pull/12');
		const issueLink = URI.parse('https://github.com/microsoft/vscode/issues/34');
		const artifacts: readonly ISessionArtifact[] = [
			{ id: 'pr', kind: SessionArtifactKind.PullRequest, label: 'PR #12', isArtifact: true, link: pullRequestLink },
			{ id: 'issue', kind: SessionArtifactKind.Issue, label: 'Issue #34', isArtifact: true, link: issueLink },
			{ id: 'docs', kind: SessionArtifactKind.Website, label: 'Docs', isArtifact: true, link: URI.parse('https://example.com/docs') },
		];

		const entries = buildSessionArtifactSections(artifacts, { ...actions, copy: text => copied.push(text) }, true, new Set()).flatMap(section => section.entries);
		for (const entry of entries) {
			entry.toolbarActions?.forEach(action => action.run());
		}

		assert.deepStrictEqual({
			entries: entries.map(entry => [entry.label, entry.toolbarActions?.map(action => action.label) ?? []]),
			copied,
		}, {
			entries: [
				['PR #12', ['Copy Pull Request Link']],
				['Issue #34', ['Copy Issue Link']],
				['Docs', []],
			],
			copied: [pullRequestLink.toString(true), issueLink.toString(true)],
		});
	});

	test('does not leak unhandled rejection when copy rejects and onUnexpectedError warn-then-rethrows', async () => {
		const pullRequestLink = URI.parse('https://github.com/microsoft/vscode/pull/12');
		const session = upcastPartial<IActiveSession>({
			artifacts: constObservable<readonly ISessionArtifact[]>([
				{ id: 'pr', kind: SessionArtifactKind.PullRequest, label: 'PR #12', isArtifact: true, link: pullRequestLink },
			]),
		});
		let copyCalls = 0;
		const clipboardService = new class extends mock<IClipboardService>() {
			override writeText(): Promise<void> {
				copyCalls++;
				return Promise.reject('boom');
			}
		}();
		const sessionArtifacts = new SessionArtifacts(
			constObservable(session),
			constObservable(new Set()),
			clipboardService,
			new class extends mock<ICommandService>() { }(),
			new class extends mock<IConfigurationService>() {
				override readonly onDidChangeConfiguration = Event.None;
				override getValue() { return true; }
			}(),
			new class extends mock<IOpenerService>() { }(),
		);

		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			const entries = sessionArtifacts.sections.get().flatMap(section => section.entries);
			for (const entry of entries) {
				entry.toolbarActions?.forEach(action => action.run());
			}
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, copyCalls, unexpectedWarns }, {
				unhandledRejections: [],
				copyCalls: 1,
				unexpectedWarns: ['boom', 'boom'],
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
			sessionArtifacts.dispose();
		}
	});

});
