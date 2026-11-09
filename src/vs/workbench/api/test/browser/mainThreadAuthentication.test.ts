/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { URI, UriComponents } from '../../../../base/common/uri.js';
import { upcastPartial } from '../../../../base/test/common/mock.js';
import { runWithFakedTimers } from '../../../../base/test/common/timeTravelScheduler.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IURLHandler, IURLService } from '../../../../platform/url/common/url.js';
import { AuthenticationSession, IAuthenticationExtensionsService, IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IDynamicAuthenticationProviderStorageService } from '../../../services/authentication/common/dynamicAuthenticationProviderStorage.js';
import { IExtHostContext } from '../../../services/extensions/common/extHostCustomers.js';
import { ExtensionHostKind } from '../../../services/extensions/common/extensionHostKind.js';
import { Dto } from '../../../services/extensions/common/proxyIdentifier.js';
import { MainThreadAuthentication, reviveSessionAccountIcon } from '../../browser/mainThreadAuthentication.js';

suite('MainThreadAuthentication', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	const iconComponents: UriComponents = { scheme: 'https', authority: 'example.com', path: '/avatar.png', query: '', fragment: '' };

	test('reviveSessionAccountIcon revives a session\'s account icon into a URI and leaves a missing icon undefined', () => {
		const withIcon: Dto<AuthenticationSession> = {
			id: 'session-with-icon',
			accessToken: 'token',
			scopes: ['scope'],
			account: { id: 'account-with-icon', label: 'Has Icon', icon: iconComponents }
		};
		const withoutIcon: Dto<AuthenticationSession> = {
			id: 'session-without-icon',
			accessToken: 'token',
			scopes: ['scope'],
			account: { id: 'account-without-icon', label: 'No Icon' }
		};

		assert.deepStrictEqual(
			[reviveSessionAccountIcon(withIcon), reviveSessionAccountIcon(withoutIcon)],
			[
				{ ...withIcon, account: { ...withIcon.account, icon: URI.from(iconComponents) } },
				{ ...withoutIcon, account: { ...withoutIcon.account, icon: undefined } }
			]
		);
	});

	suite('$waitForUriHandler', () => {

		const expectedUri = URI.parse('vscode://dynamicauthprovider/mcp.example.com/authorize?nonce=abc');
		const sameRoute = URI.parse('vscode://dynamicauthprovider/mcp.example.com/authorize?nonce=abc&code=late');

		function createMainThreadAuthentication() {
			const handlers = new Set<IURLHandler>();
			const instantiationService = disposables.add(new TestInstantiationService());
			instantiationService.stub(IURLService, upcastPartial<IURLService>({
				registerHandler: (handler: IURLHandler): IDisposable => {
					handlers.add(handler);
					return { dispose: () => handlers.delete(handler) };
				}
			}));
			instantiationService.stub(IAuthenticationService, upcastPartial<IAuthenticationService>({
				onDidChangeSessions: Event.None,
				onDidUnregisterAuthenticationProvider: Event.None,
				registerAuthenticationProviderHostDelegate: () => Disposable.None,
			}));
			instantiationService.stub(IAuthenticationExtensionsService, upcastPartial<IAuthenticationExtensionsService>({
				onDidChangeAccountPreference: Event.None,
			}));
			instantiationService.stub(IDynamicAuthenticationProviderStorageService, upcastPartial<IDynamicAuthenticationProviderStorageService>({
				onDidChangeTokens: Event.None,
			}));
			const extHostContext = upcastPartial<IExtHostContext>({
				extensionHostKind: ExtensionHostKind.LocalProcess,
				getProxy: () => upcastPartial({}),
			});
			const mainThreadAuthentication = disposables.add(instantiationService.createInstance(MainThreadAuthentication, extHostContext));
			const handleURL = async (uri: URI) => {
				for (const handler of [...handlers]) {
					if (await handler.handleURL(uri)) {
						return true;
					}
				}
				return false;
			};
			return { mainThreadAuthentication, handlers, handleURL };
		}

		test('resolves with the matching URI and unregisters the handler', async () => {
			const { mainThreadAuthentication, handlers, handleURL } = createMainThreadAuthentication();

			const wait = mainThreadAuthentication.$waitForUriHandler(expectedUri, CancellationToken.None);
			assert.strictEqual(await handleURL(sameRoute), true);
			const result = await wait;

			assert.deepStrictEqual({ query: result.query, handlers: handlers.size }, { query: sameRoute.query, handlers: 0 });
		});

		test('unregisters the handler when the wait is cancelled', async () => {
			const { mainThreadAuthentication, handlers, handleURL } = createMainThreadAuthentication();
			const cts = new CancellationTokenSource();

			const wait = mainThreadAuthentication.$waitForUriHandler(expectedUri, cts.token);
			cts.cancel();
			const error = await wait.then(() => undefined, err => err);
			cts.dispose();

			assert.deepStrictEqual({
				cancelled: isCancellationError(error),
				handlers: handlers.size,
				handledLater: await handleURL(sameRoute),
			}, {
				cancelled: true,
				handlers: 0,
				handledLater: false,
			});
		});

		test('unregisters the handler when the wait times out', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
			const { mainThreadAuthentication, handlers, handleURL } = createMainThreadAuthentication();

			const error = await mainThreadAuthentication.$waitForUriHandler(expectedUri, CancellationToken.None).then(() => undefined, err => err);

			assert.deepStrictEqual({
				message: error?.message,
				handlers: handlers.size,
				handledLater: await handleURL(sameRoute),
			}, {
				message: 'Timed out waiting for URI handler',
				handlers: 0,
				handledLater: false,
			});
		}));
	});
});
