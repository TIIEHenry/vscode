/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { connectionTokenCookieName, connectionTokenQueryName } from '../../../base/common/network.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { MandatoryServerConnectionToken, NoneServerConnectionToken } from '../../node/serverConnectionToken.js';
import { routeDelayShutdown } from '../../node/remoteExtensionHostAgentServerRequest.js';

suite('delay-shutdown', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const connectionToken = new MandatoryServerConnectionToken('server-token');

	test('returns forbidden without cookie or matching query token and does not delay', () => {
		let delayCalls = 0;
		const result = routeDelayShutdown(
			'/delay-shutdown',
			connectionToken,
			{ headers: {} },
			new URLSearchParams(),
			() => { delayCalls++; },
		);

		assert.strictEqual(result, 'forbidden');
		assert.strictEqual(delayCalls, 0);
	});

	test('returns ok with matching query token and delays once', () => {
		let delayCalls = 0;
		const searchParams = new URLSearchParams(`${connectionTokenQueryName}=server-token`);
		const result = routeDelayShutdown(
			'/delay-shutdown',
			connectionToken,
			{ headers: {} },
			searchParams,
			() => { delayCalls++; },
		);

		assert.strictEqual(result, 'ok');
		assert.strictEqual(delayCalls, 1);
	});

	test('returns ok with valid cookie and delays once', () => {
		let delayCalls = 0;
		const headers = { cookie: `${connectionTokenCookieName}=server-token` };
		const result = routeDelayShutdown(
			'/delay-shutdown',
			connectionToken,
			{ headers },
			new URLSearchParams(),
			() => { delayCalls++; },
		);

		assert.strictEqual(result, 'ok');
		assert.strictEqual(delayCalls, 1);
	});

	test('does not treat other paths as delay-shutdown', () => {
		let delayCalls = 0;
		const result = routeDelayShutdown(
			'/version',
			connectionToken,
			{ headers: {} },
			new URLSearchParams(),
			() => { delayCalls++; },
		);

		assert.strictEqual(result, 'not-matched');
		assert.strictEqual(delayCalls, 0);
	});

	test('None connection token still allows delay-shutdown without credentials', () => {
		let delayCalls = 0;
		const result = routeDelayShutdown(
			'/delay-shutdown',
			new NoneServerConnectionToken(),
			{ headers: {} },
			new URLSearchParams(),
			() => { delayCalls++; },
		);

		assert.strictEqual(result, 'ok');
		assert.strictEqual(delayCalls, 1);
	});
});
