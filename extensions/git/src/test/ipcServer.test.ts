/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { IPCServer } from '../ipc/ipcServer';

interface IResponse {
	readonly status: number | undefined;
	readonly body: string;
}

suite('IPCServer', () => {
	let server: http.Server;
	let ipcServer: IPCServer;
	let port: number;
	let handlePath: string;

	setup(async () => {
		server = http.createServer();
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		port = (server.address() as { port: number }).port;

		// `dispose` unlinks the handle path on non-Windows platforms, so give it a real file.
		handlePath = path.join(os.tmpdir(), `vscode-git-ipc-${crypto.randomBytes(6).toString('hex')}`);
		fs.writeFileSync(handlePath, '');
		ipcServer = new IPCServer(server, handlePath);
	});

	teardown(() => {
		ipcServer.dispose();
	});

	function post(route: string, body: unknown, timeout = 1000): Promise<IResponse> {
		return new Promise((resolve, reject) => {
			const request = http.request({
				host: '127.0.0.1',
				port,
				path: route,
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			}, response => {
				const chunks: Buffer[] = [];
				response.on('data', chunk => chunks.push(chunk));
				response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
			});
			request.setTimeout(timeout, () => request.destroy(new Error('timeout')));
			request.on('error', reject);
			request.end(JSON.stringify(body));
		});
	}

	async function assertRouteCallsHandler(name: string): Promise<void> {
		const requests: unknown[] = [];
		const registration = ipcServer.registerHandler(name, {
			handle: async request => {
				requests.push(request);
				return { handled: true };
			}
		});

		const before = await post(`/${name}`, { value: name });
		registration.dispose();

		await assert.rejects(post(`/${name}`, { value: name }, 200), /timeout/);

		assert.deepStrictEqual({
			status: before.status,
			body: JSON.parse(before.body),
			requests
		}, {
			status: 200,
			body: { handled: true },
			requests: [{ value: name }]
		});
	}

	test('unregisters the askpass route when its registration is disposed', async () => {
		await assertRouteCallsHandler('askpass');
	});

	test('unregisters the git-editor route when its registration is disposed', async () => {
		await assertRouteCallsHandler('git-editor');
	});
});
