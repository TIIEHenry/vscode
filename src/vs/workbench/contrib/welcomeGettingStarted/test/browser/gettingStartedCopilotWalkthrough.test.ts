/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { walkthroughs } from '../../common/gettingStartedContent.js';

const COPILOT_SETUP_STEP_IDS = [
	'CopilotSetupAnonymous',
	'CopilotSetupSignedOut',
	'CopilotSetupComplete',
	'CopilotSetupSignedIn',
] as const;

function evalWhen(when: string | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	const expr = ContextKeyExpr.deserialize(when);
	assert.ok(expr, `expected valid when expression: ${when}`);
	return expr.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function getSetupCopilotSteps() {
	const setupWalkthrough = walkthroughs.find(w => w.id === 'Setup');
	assert.ok(setupWalkthrough);
	assert.strictEqual(setupWalkthrough.content.type, 'steps');
	return setupWalkthrough.content.steps.filter(step => COPILOT_SETUP_STEP_IDS.includes(step.id as typeof COPILOT_SETUP_STEP_IDS[number]));
}

suite('Getting Started Copilot walkthrough (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default Code window hides Copilot setup steps in Setup walkthrough', () => {
		const defaultWindow: Record<string, ContextKeyValue> = {
			[IsSessionsWindowContext.key]: false,
			chatAnonymous: true,
			chatSetupCompleted: false,
			chatSetupHidden: false,
			chatSetupDisabledInWorkspace: false,
		};

		const copilotSteps = getSetupCopilotSteps();
		assert.strictEqual(copilotSteps.length, COPILOT_SETUP_STEP_IDS.length);

		for (const step of copilotSteps) {
			assert.ok(step.when, `${step.id} should have a when clause`);
			assert.strictEqual(
				evalWhen(step.when, defaultWindow),
				false,
				`default Code window must hide ${step.id}`
			);
		}
	});

	test('Agents Window retains Copilot setup steps when chat setup is eligible', () => {
		const sessionsWindow: Record<string, ContextKeyValue> = {
			[IsSessionsWindowContext.key]: true,
			chatAnonymous: true,
			chatSetupCompleted: false,
			chatSetupHidden: false,
			chatSetupDisabledInWorkspace: false,
		};

		const anonymousStep = getSetupCopilotSteps().find(step => step.id === 'CopilotSetupAnonymous');
		assert.ok(anonymousStep?.when);
		assert.strictEqual(
			evalWhen(anonymousStep.when, sessionsWindow),
			true,
			'Agents Window should retain CopilotSetupAnonymous when chat setup is eligible'
		);
	});
});
