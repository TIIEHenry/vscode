/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IConfirmation, IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { openUaClientExternalLink } from './uaClientExternalLink.js';

suite('uaClientExternalLink (unit)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('supersedes a stale confirm so an older link cannot open after a newer click', async () => {
		const configurationService = {} as IConfigurationService;
		const firstUri = URI.parse('https://first.example/');
		const secondUri = URI.parse('https://second.example/');
		let resolveFirstConfirm: (result: { confirmed: boolean }) => void;
		const confirmCalls: IConfirmation[] = [];
		const dialogService = {
			confirm: async (confirmation: IConfirmation) => {
				confirmCalls.push(confirmation);
				if (confirmCalls.length === 1) {
					return new Promise(resolve => {
						resolveFirstConfirm = resolve;
					});
				}
				return { confirmed: true };
			},
		} as unknown as IDialogService;
		const opened: URI[] = [];
		const openerService = {
			open: async (resource: URI | string) => {
				opened.push(URI.isUri(resource) ? resource : URI.parse(String(resource)));
				return true;
			},
		} as unknown as IOpenerService;

		const first = openUaClientExternalLink(firstUri, configurationService, dialogService, openerService);
		const second = openUaClientExternalLink(secondUri, configurationService, dialogService, openerService);

		await second;
		assert.strictEqual(confirmCalls.length, 2);
		assert.strictEqual(opened.length, 1);
		assert.strictEqual(opened[0]?.toString(), secondUri.toString());

		resolveFirstConfirm!({ confirmed: true });
		await first;
		assert.strictEqual(opened.length, 1);
		assert.strictEqual(opened[0]?.toString(), secondUri.toString());
	});

});
