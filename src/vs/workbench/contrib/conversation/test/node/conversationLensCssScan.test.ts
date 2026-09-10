/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

suite('ConversationLens reveal navigation (T5a) - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('maximize CSS hides the Conversation tree, not the shared slot on Trajectory', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8');
		assert.ok(css.includes('.conversation-lens-input-maximized:not(:has(.conversation-lens-phase-prefirst)) .conversation-lens-timeline'));
		assert.ok(css.includes('.conversation-lens-input-maximized:not(:has(.conversation-lens-phase-prefirst)):not(.conversation-lens-showing-trajectory)'));
		assert.ok(!/\.conversation-timeline\.conversation-lens-input-maximized:not\(:has\(\.conversation-lens-phase-prefirst\)\)\s*\{\s*display:\s*none;/.test(css));
	});

	test('conversation contrib has no fake voice transcript or stub Route chrome', () => {
		const contribRoot = path.join(repoRoot, 'src/vs/workbench/contrib/conversation');
		const files: string[] = [];
		const walk = (dir: string) => {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					if (entry.name === 'test') {
						continue;
					}
					walk(full);
					continue;
				}
				if (/\.(ts|css)$/.test(entry.name)) {
					files.push(full);
				}
			}
		};
		walk(contribRoot);
		const forbidden = [
			'getUserMedia',
			'MediaRecorder',
			'STUB_VOICE_TRANSCRIPT_PHRASES',
			'durationLabel: \'0:01\'',
			'Stub voice segment',
			'Stub Balanced',
			'finishVoiceClip',
			'conversation-lens-dock-mic',
			'conversation-lens-dock-route',
			'conversation-lens-session-route',
			'conversation-lens-voice-transcript-bar',
			'Stub agent',
			'Stub model',
			'dockStubAgent',
			'dockStubModel',
		];
		const hits: string[] = [];
		for (const file of files) {
			const rel = path.relative(contribRoot, file);
			const text = fs.readFileSync(file, 'utf8');
			for (const needle of forbidden) {
				if (text.includes(needle)) {
					hits.push(`${rel}: ${needle}`);
				}
			}
		}
		assert.deepStrictEqual(hits, []);
	});
});
