/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');
const BROWSER_ROOT = path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser');
const MEDIA_ROOT = path.join(BROWSER_ROOT, 'media');

const CHEVRON_TRANSITION_CSS = [
	'conversationLens.css',
	'conversationVisualize.css',
] as const;

/** Transition must sit on `.…chevron.ua-motion`, not the bare chevron selector. */
const BARE_CHEVRON_TRANSITION = /\.conversation-(?:process-fold(?:-tool)?|visualize)-chevron\s*\{[^}]*\btransition\s*:/s;

const CHEVRON_CREATE_SOURCES = [
	'conversationProcessFold.ts',
	'conversationTrajectory.ts',
	'conversationVisualizeCard.ts',
] as const;

suite('conversationUaMotionContract', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('conversation chevron transitions hang only on .ua-motion selectors', () => {
		const violations: string[] = [];
		for (const fileName of CHEVRON_TRANSITION_CSS) {
			const filePath = path.join(MEDIA_ROOT, fileName);
			const css = fs.readFileSync(filePath, 'utf8');
			if (BARE_CHEVRON_TRANSITION.test(css)) {
				violations.push(fileName);
			}
		}
		assert.deepStrictEqual(
			violations,
			[],
			`Bare chevron selectors must not declare transition (use .ua-motion):\n${violations.join('\n')}`,
		);
	});

	test('conversation chevron create sites hang .ua-motion', () => {
		const violations: string[] = [];
		for (const fileName of CHEVRON_CREATE_SOURCES) {
			const source = fs.readFileSync(path.join(BROWSER_ROOT, fileName), 'utf8');
			const creates = source.match(/\$\('span\.conversation-[^']*chevron[^']*'\)/g) ?? [];
			for (const create of creates) {
				if (!create.includes('ua-motion')) {
					violations.push(`${fileName}: ${create}`);
				}
			}
		}
		assert.deepStrictEqual(
			violations,
			[],
			`Chevron create sites must include .ua-motion:\n${violations.join('\n')}`,
		);
	});
});
