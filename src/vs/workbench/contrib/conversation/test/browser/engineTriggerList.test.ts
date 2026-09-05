/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	canSendEngineTriggerDelete,
	canSendEngineTriggerFire,
	canSendEngineTriggerListRequest,
	canSendEngineTriggerSetEnabled,
	canSendEngineTriggerUpsert,
	emptyEngineTrigger,
	ENGINE_TRIGGER_ADD_LABEL,
	ENGINE_TRIGGER_DELETE_LABEL,
	ENGINE_TRIGGER_DISABLE_LABEL,
	ENGINE_TRIGGER_EDIT_LABEL,
	ENGINE_TRIGGER_ENABLE_LABEL,
	ENGINE_TRIGGER_FIRE_LABEL,
	ENGINE_TRIGGER_LIST_EMPTY_COPY,
	engineTriggerDeleteRequest,
	engineTriggerFireRequest,
	engineTriggerListRequest,
	engineTriggerSetEnabledRequest,
	engineTriggerUpsertRequest,
	formatEngineTriggerListLabel,
} from '../../browser/engineTriggerList.js';

suite('Engine trigger list bind', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ListTriggers gate is connected + hook; empty ids stay empty', () => {
		assert.strictEqual(canSendEngineTriggerListRequest(false, true), false);
		assert.strictEqual(canSendEngineTriggerListRequest(true, false), false);
		assert.strictEqual(canSendEngineTriggerListRequest(true, true), true);
		assert.deepStrictEqual(engineTriggerListRequest(), {
			scope: '',
			scopeId: '',
			typeFilter: '',
		});
	});

	test('trigger label keeps empty fields as-is', () => {
		assert.strictEqual(formatEngineTriggerListLabel({
			triggerId: '',
			name: '',
			type: '',
			promptTemplate: '',
			enabled: false,
			pauseReason: '',
			target: { kind: 'unspecified' },
			intervalMs: 0,
			cronExpression: '',
			runAtEpochMs: 0,
		}), ' —  — ');
		assert.strictEqual(formatEngineTriggerListLabel({
			triggerId: '  trig  ',
			name: '  Nightly  ',
			type: 'cron',
			promptTemplate: '',
			enabled: false,
			pauseReason: '',
			target: { kind: 'self' },
			intervalMs: 0,
			cronExpression: '',
			runAtEpochMs: 0,
		}), '  Nightly   — cron —   trig  ');
		assert.strictEqual(ENGINE_TRIGGER_LIST_EMPTY_COPY, 'No triggers.');
	});

	test('FireTrigger gate is connected + hook; empty ids stay empty', () => {
		assert.strictEqual(canSendEngineTriggerFire(false, true), false);
		assert.strictEqual(canSendEngineTriggerFire(true, false), false);
		assert.strictEqual(canSendEngineTriggerFire(true, true), true);
		assert.deepStrictEqual(engineTriggerFireRequest(undefined), {
			scope: '',
			scopeId: '',
			triggerId: '',
		});
		assert.deepStrictEqual(engineTriggerFireRequest({ triggerId: '' }), {
			scope: '',
			scopeId: '',
			triggerId: '',
		});
		assert.deepStrictEqual(engineTriggerFireRequest({ triggerId: '  trig  ' }), {
			scope: '',
			scopeId: '',
			triggerId: '  trig  ',
		});
		assert.strictEqual(ENGINE_TRIGGER_FIRE_LABEL, 'Fire');
	});

	test('SetTriggerEnabled gate is connected + hook; empty ids and enabled false stay as-is', () => {
		assert.strictEqual(canSendEngineTriggerSetEnabled(false, true), false);
		assert.strictEqual(canSendEngineTriggerSetEnabled(true, false), false);
		assert.strictEqual(canSendEngineTriggerSetEnabled(true, true), true);
		assert.deepStrictEqual(engineTriggerSetEnabledRequest(undefined, false), {
			scope: '',
			scopeId: '',
			triggerId: '',
			enabled: false,
		});
		assert.deepStrictEqual(engineTriggerSetEnabledRequest({ triggerId: '' }, false), {
			scope: '',
			scopeId: '',
			triggerId: '',
			enabled: false,
		});
		assert.deepStrictEqual(engineTriggerSetEnabledRequest({ triggerId: '  trig  ' }, false), {
			scope: '',
			scopeId: '',
			triggerId: '  trig  ',
			enabled: false,
		});
		assert.deepStrictEqual(engineTriggerSetEnabledRequest({ triggerId: '  trig  ' }, true), {
			scope: '',
			scopeId: '',
			triggerId: '  trig  ',
			enabled: true,
		});
		assert.strictEqual(ENGINE_TRIGGER_ENABLE_LABEL, 'Enable');
		assert.strictEqual(ENGINE_TRIGGER_DISABLE_LABEL, 'Disable');
	});

	test('DeleteTrigger gate is connected + hook; empty ids stay empty', () => {
		assert.strictEqual(canSendEngineTriggerDelete(false, true), false);
		assert.strictEqual(canSendEngineTriggerDelete(true, false), false);
		assert.strictEqual(canSendEngineTriggerDelete(true, true), true);
		assert.deepStrictEqual(engineTriggerDeleteRequest(undefined), {
			scope: '',
			scopeId: '',
			triggerId: '',
		});
		assert.deepStrictEqual(engineTriggerDeleteRequest({ triggerId: '' }), {
			scope: '',
			scopeId: '',
			triggerId: '',
		});
		assert.deepStrictEqual(engineTriggerDeleteRequest({ triggerId: '  trig  ' }), {
			scope: '',
			scopeId: '',
			triggerId: '  trig  ',
		});
		assert.strictEqual(ENGINE_TRIGGER_DELETE_LABEL, 'Delete');
	});

	test('UpsertTrigger gate is connected + hook; empty ids stay empty on add and edit', () => {
		assert.strictEqual(canSendEngineTriggerUpsert(false, true), false);
		assert.strictEqual(canSendEngineTriggerUpsert(true, false), false);
		assert.strictEqual(canSendEngineTriggerUpsert(true, true), true);
		const empty = emptyEngineTrigger();
		assert.deepStrictEqual(engineTriggerUpsertRequest(undefined, 'add'), {
			scope: '',
			scopeId: '',
			trigger: empty,
		});
		assert.deepStrictEqual(engineTriggerUpsertRequest({
			...empty,
			triggerId: '  trig  ',
		}, 'add'), {
			scope: '',
			scopeId: '',
			trigger: empty,
		});
		assert.deepStrictEqual(engineTriggerUpsertRequest(undefined, 'edit'), {
			scope: '',
			scopeId: '',
			trigger: empty,
		});
		assert.deepStrictEqual(engineTriggerUpsertRequest({
			...empty,
			triggerId: '',
			name: '',
			type: '',
			enabled: false,
		}, 'edit'), {
			scope: '',
			scopeId: '',
			trigger: empty,
		});
		assert.deepStrictEqual(engineTriggerUpsertRequest({
			triggerId: '  trig  ',
			name: '  Nightly  ',
			type: 'cron',
			promptTemplate: '',
			enabled: false,
			pauseReason: '',
			target: { kind: 'self' },
			intervalMs: 0,
			cronExpression: '',
			runAtEpochMs: 0,
		}, 'edit'), {
			scope: '',
			scopeId: '',
			trigger: {
				triggerId: '  trig  ',
				name: '  Nightly  ',
				type: 'cron',
				promptTemplate: '',
				enabled: false,
				pauseReason: '',
				target: { kind: 'self' },
				intervalMs: 0,
				cronExpression: '',
				runAtEpochMs: 0,
			},
		});
		assert.strictEqual(ENGINE_TRIGGER_ADD_LABEL, 'Add');
		assert.strictEqual(ENGINE_TRIGGER_EDIT_LABEL, 'Edit');
	});
});
