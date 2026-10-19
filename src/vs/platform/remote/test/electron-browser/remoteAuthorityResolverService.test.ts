/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import product from '../../../product/common/product.js';
import { IProductService } from '../../../product/common/productService.js';
import { RemoteAuthorityResolverError, RemoteAuthorityResolverErrorCode } from '../../common/remoteAuthorityResolver.js';
import { RemoteAuthorityResolverService } from '../../electron-browser/remoteAuthorityResolverService.js';

suite('RemoteAuthorityResolverService', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('issue #147318: RemoteAuthorityResolverError keeps the same type', async () => {
		const productService: IProductService = { _serviceBrand: undefined, ...product };
		// eslint-disable-next-line local/code-no-any-casts
		const service = new RemoteAuthorityResolverService(productService, undefined as any);
		const result = service.resolveAuthority('test+x');
		service._setResolvedAuthorityError('test+x', new RemoteAuthorityResolverError('something', RemoteAuthorityResolverErrorCode.TemporarilyNotAvailable));
		try {
			await result;
			assert.fail();
		} catch (err) {
			assert.strictEqual(RemoteAuthorityResolverError.isTemporarilyNotAvailable(err), true);
		}
		service.dispose();
	});

	test('a rejected canonical URI is not reused; the next call asks again', async () => {
		const productService: IProductService = { _serviceBrand: undefined, ...product };
		// eslint-disable-next-line local/code-no-any-casts
		const service = new RemoteAuthorityResolverService(productService, undefined as any);
		try {
			const uri = URI.parse('vscode-remote://localhost/workspace');
			const canonical = uri.with({ path: '/canonical' });
			const error = new Error('canonical failed');
			let calls = 0;
			let rejectFirst: ((reason: unknown) => void) | undefined;
			service._setCanonicalURIProvider(() => {
				calls++;
				if (calls === 1) {
					return new Promise<URI>((_resolve, reject) => {
						rejectFirst = reject;
					});
				}
				return Promise.resolve(canonical);
			});

			const first = service.getCanonicalURI(uri);
			const shared = service.getCanonicalURI(uri);
			assert.strictEqual(calls, 1);

			rejectFirst!(error);
			let firstError: unknown;
			try {
				await first;
				assert.fail('first canonical URI should reject');
			} catch (err) {
				firstError = err;
			}
			try {
				await shared;
				assert.fail('in-flight canonical URI should reject with the same attempt');
			} catch (err) {
				assert.strictEqual(err, firstError);
			}
			assert.strictEqual(calls, 1, 'a rejected canonical URI must not ask again inside the same call');

			const retried = await service.getCanonicalURI(uri);
			assert.strictEqual(calls, 2, 'the next call must ask again');
			assert.strictEqual(retried.toString(), canonical.toString());

			await service.getCanonicalURI(uri);
			assert.strictEqual(calls, 2, 'a fulfilled canonical URI stays cached');
		} finally {
			service.dispose();
		}
	});
});
