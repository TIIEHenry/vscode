/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { encodeBase64, VSBuffer } from '../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { CancellationError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { URI, UriComponents } from '../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ILogger, ILoggerService, NullLogger } from '../../../../platform/log/common/log.js';
import { IProgressStep, Progress } from '../../../../platform/progress/common/progress.js';
import { IAuthenticationProviderSessionOptions } from '../../../services/authentication/common/authentication.js';
import { DynamicAuthProvider, IAuthorizationToken, reviveAccountIcon, TokenStore } from '../../common/extHostAuthentication.js';
import { MainThreadAuthenticationShape } from '../../common/extHost.protocol.js';
import { IExtHostInitDataService } from '../../common/extHostInitDataService.js';
import { IExtHostProgress } from '../../common/extHostProgress.js';
import { IExtHostUrlsService } from '../../common/extHostUrls.js';
import { IExtHostWindow } from '../../common/extHostWindow.js';
import { Proxied } from '../../../services/extensions/common/proxyIdentifier.js';

/** Builds a structurally-valid JWT carrying the given claims. */
function jwt(claims: object): string {
	const segment = (value: object) => encodeBase64(VSBuffer.fromString(JSON.stringify(value)));
	return `${segment({ alg: 'none', typ: 'JWT' })}.${segment(claims)}.signature`;
}

suite('TokenStore', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function createStore(initialTokens: IAuthorizationToken[]): TokenStore {
		const persistence = {
			onDidChange: disposables.add(new Emitter<IAuthorizationToken[]>()).event,
			set: () => { }
		};
		return disposables.add(new TokenStore(persistence, initialTokens, new NullLogger()));
	}

	// Regression for the MCP sign-in loop: an explicit empty `token.scope` must derive empty session scopes, not the granted scopes from the JWT claims, else empty-scope lookups never match their own session.
	test('derives session scopes from the stored token.scope, falling back to JWT claims only when scope is absent', () => {
		const store = createStore([
			// Explicit empty scope must win over the scopes embedded in the JWT claims.
			{ access_token: jwt({ sub: 'a', scope: 'menu:read orders:create orders:cancel' }), token_type: 'Bearer', scope: '', created_at: 0 },
			// Absent scope (undefined) falls back to the JWT claims.
			{ access_token: jwt({ sub: 'b', scope: 'menu:read orders:create' }), token_type: 'Bearer', created_at: 0 },
			// A non-empty scope is authoritative over the JWT claims.
			{ access_token: jwt({ sub: 'c', scope: 'ignored:claim' }), token_type: 'Bearer', scope: 'read write', created_at: 0 },
		]);

		assert.deepStrictEqual(
			store.sessions.map(session => session.scopes),
			[[], ['menu:read', 'orders:create'], ['read', 'write']]
		);
	});
});

suite('DynamicAuthProvider', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	class TestDynamicAuthProvider extends DynamicAuthProvider {
		generateNewClientIdCalls = 0;

		protected override async _generateNewClientId(): Promise<void> {
			this.generateNewClientIdCalls++;
		}
	}

	test('does not rotate the client while silently refreshing a token', async () => {
		let fetchCalls = 0;
		const fetcher: typeof fetch = async () => {
			fetchCalls++;
			return new Response(JSON.stringify({ error: 'invalid_client' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		};
		const loggerService = new class extends mock<ILoggerService>() {
			override createLogger(): ILogger {
				return new NullLogger();
			}
		}();
		const proxy = new class extends mock<Proxied<MainThreadAuthenticationShape>>() {
			override $setSessionsForDynamicAuthProvider = (): Promise<void> => Promise.resolve();
		}();
		const provider = disposables.add(new TestDynamicAuthProvider(
			new class extends mock<IExtHostWindow>() { }(),
			new class extends mock<IExtHostUrlsService>() { }(),
			new class extends mock<IExtHostInitDataService>() { }(),
			new class extends mock<IExtHostProgress>() { }(),
			loggerService,
			proxy,
			URI.parse('https://mcp.example.com'),
			{
				issuer: 'https://mcp.example.com',
				response_types_supported: ['code'],
				token_endpoint: 'https://mcp.example.com/token',
			},
			{ resource: 'https://mcp.example.com/resource' },
			'client-id',
			undefined,
			disposables.add(new Emitter()),
			[{
				access_token: jwt({ sub: 'account' }),
				token_type: 'Bearer',
				scope: '',
				expires_in: 1,
				refresh_token: 'refresh-token',
				created_at: 0,
			}],
			fetcher,
		));

		const sessions = await provider.getSessions([], { silent: true } satisfies IAuthenticationProviderSessionOptions);

		assert.deepStrictEqual({
			sessions,
			fetchCalls,
			generateNewClientIdCalls: provider.generateNewClientIdCalls,
			clientId: provider.clientId,
		}, {
			sessions: [],
			fetchCalls: 1,
			generateNewClientIdCalls: 0,
			clientId: 'client-id',
		});
	});

	function createProvider(options: {
		fetcher: typeof fetch;
		initialTokens?: IAuthorizationToken[];
		/** Query of the redirect the main thread hands back; without it the wait only ends on cancellation. */
		redirectQuery?: (expectedQuery: string) => string;
		opened?: boolean;
	}) {
		const setSessionsCalls: IAuthorizationToken[][] = [];
		const waitForUriHandlerTokens: CancellationToken[] = [];
		const loggerService = new class extends mock<ILoggerService>() {
			override createLogger(): ILogger {
				return new NullLogger();
			}
		}();
		const proxy = new class extends mock<Proxied<MainThreadAuthenticationShape>>() {
			override $setSessionsForDynamicAuthProvider = (_id: string, _clientId: string, tokens: IAuthorizationToken[]): Promise<void> => {
				setSessionsCalls.push(tokens);
				return Promise.resolve();
			};
			override $waitForUriHandler = async (expectedUri: UriComponents, token: CancellationToken): Promise<UriComponents> => {
				waitForUriHandlerTokens.push(token);
				const redirectQuery = options.redirectQuery;
				if (!redirectQuery) {
					return new Promise<UriComponents>((_resolve, reject) => {
						const listener = token.onCancellationRequested(() => {
							listener.dispose();
							reject(new CancellationError());
						});
					});
				}
				return URI.from({ ...expectedUri, query: redirectQuery(expectedUri.query ?? '') });
			};
		}();
		const provider = disposables.add(new TestDynamicAuthProvider(
			new class extends mock<IExtHostWindow>() {
				override openUri = async () => options.opened ?? true;
			}(),
			new class extends mock<IExtHostUrlsService>() {
				override createAppUri = async (uri: URI) => uri;
			}(),
			new class extends mock<IExtHostInitDataService>() {
				override environment = upcastPartial<IExtHostInitDataService['environment']>({ appUriScheme: 'vscode', appName: 'Code' });
			}(),
			new class extends mock<IExtHostProgress>() {
				override withProgressFromSource = <R>(_source: unknown, _options: unknown, task: (progress: Progress<IProgressStep>, token: CancellationToken) => Thenable<R>): Promise<R> => Promise.resolve(task(new Progress<IProgressStep>(() => { }), CancellationToken.None));
			}(),
			loggerService,
			proxy,
			URI.parse('https://mcp.example.com'),
			{
				issuer: 'https://mcp.example.com',
				response_types_supported: ['code'],
				authorization_endpoint: 'https://mcp.example.com/authorize',
				token_endpoint: 'https://mcp.example.com/token',
			},
			{ resource: 'https://mcp.example.com/resource' },
			'client-id',
			undefined,
			disposables.add(new Emitter()),
			options.initialTokens ?? [],
			options.fetcher,
		));
		return { provider, setSessionsCalls, waitForUriHandlerTokens };
	}

	function tokenResponse(accessToken: string): Response {
		return new Response(JSON.stringify({ access_token: accessToken, token_type: 'Bearer', scope: '' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	test('keeps a token that is about to expire when refreshing it fails with a network error', async () => {
		const accessToken = jwt({ sub: 'account' });
		const { provider, setSessionsCalls } = createProvider({
			fetcher: async () => { throw new TypeError('Failed to fetch'); },
			initialTokens: [{
				access_token: accessToken,
				token_type: 'Bearer',
				scope: '',
				expires_in: 300,
				refresh_token: 'refresh-token',
				created_at: Date.now() - 1000,
			}],
		});

		const sessions = await provider.getSessions([], { silent: true } satisfies IAuthenticationProviderSessionOptions);

		assert.deepStrictEqual({
			accessTokens: sessions.map(s => s.accessToken),
			setSessionsCalls: setSessionsCalls.length,
		}, {
			accessTokens: [accessToken],
			setSessionsCalls: 0,
		});
	});

	test('drops a token when the server rejects its refresh token with invalid_grant', async () => {
		const { provider, setSessionsCalls } = createProvider({
			fetcher: async () => new Response(JSON.stringify({ error: 'invalid_grant' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			}),
			initialTokens: [{
				access_token: jwt({ sub: 'account' }),
				token_type: 'Bearer',
				scope: '',
				expires_in: 300,
				refresh_token: 'refresh-token',
				created_at: Date.now() - 1000,
			}],
		});

		const sessions = await provider.getSessions([], { silent: true } satisfies IAuthenticationProviderSessionOptions);

		assert.deepStrictEqual({ sessions, setSessions: setSessionsCalls }, { sessions: [], setSessions: [[]] });
	});

	test('exchanges the authorization code when the redirect carries the nonce of this sign-in', async () => {
		let fetchCalls = 0;
		const accessToken = jwt({ sub: 'account' });
		const { provider, setSessionsCalls, waitForUriHandlerTokens } = createProvider({
			fetcher: async () => { fetchCalls++; return tokenResponse(accessToken); },
			redirectQuery: expectedQuery => `${expectedQuery}&code=the-code`,
		});

		const session = await provider.createSession([], {});

		assert.deepStrictEqual({
			accessToken: session.accessToken,
			fetchCalls,
			setSessionsCalls: setSessionsCalls.length,
			uriHandlerCancelledAfterSignIn: waitForUriHandlerTokens.map(t => t.isCancellationRequested),
		}, {
			accessToken,
			fetchCalls: 1,
			setSessionsCalls: 1,
			uriHandlerCancelledAfterSignIn: [true],
		});
	});

	for (const [name, redirectQuery] of [
		['without a nonce', () => 'windowId=1&code=forged-code'],
		['with a different nonce', () => 'nonce=someone-else&code=forged-code'],
	] as const) {
		test(`rejects a redirect ${name} without exchanging its code`, async () => {
			let fetchCalls = 0;
			const { provider, setSessionsCalls } = createProvider({
				fetcher: async () => { fetchCalls++; return tokenResponse(jwt({ sub: 'attacker' })); },
				redirectQuery,
			});

			await assert.rejects(provider.createSession([], {}));

			assert.deepStrictEqual({ fetchCalls, setSessionsCalls: setSessionsCalls.length }, { fetchCalls: 0, setSessionsCalls: 0 });
		});
	}

	test('cancels the URI handler wait when the browser cannot be opened', async () => {
		const { provider, waitForUriHandlerTokens } = createProvider({
			fetcher: async () => { throw new Error('unexpected fetch'); },
			opened: false,
		});

		await assert.rejects(provider.createSession([], {}));

		assert.deepStrictEqual(waitForUriHandlerTokens.map(t => t.isCancellationRequested), [true]);
	});
});

suite('Account Icon Revival', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const iconComponents: UriComponents = { scheme: 'https', authority: 'example.com', path: '/avatar.png', query: '', fragment: '' };

	test('reviveAccountIcon revives a present icon into a URI and leaves a missing icon undefined', () => {
		const withIcon: { id: string; label: string; icon?: UriComponents } = { id: 'account-with-icon', label: 'Has Icon', icon: iconComponents };
		const withoutIcon: { id: string; label: string; icon?: UriComponents } = { id: 'account-without-icon', label: 'No Icon' };

		assert.deepStrictEqual(
			[reviveAccountIcon(withIcon), reviveAccountIcon(withoutIcon)],
			[
				{ ...withIcon, icon: URI.from(iconComponents) },
				{ ...withoutIcon, icon: undefined }
			]
		);
	});
});
