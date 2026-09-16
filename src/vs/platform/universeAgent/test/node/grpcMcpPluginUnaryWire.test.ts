/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { asUnaryProtoBytes } from '../../node/grpc/grpcClientCalls.js';
import {
	mapAddMcpServerResponse,
	mapGetMcpServerStatusesResponse,
	mapGetMcpServerToolsResponse,
	mapListMcpServersResponse,
	mapListPluginsResponse,
	mapMcpServerConfigFromWire,
	mapPluginInfoResponse,
	mapPluginSummary,
	mapRemoveMcpServerResponse,
	mapToggleMcpServerResponse,
	mapUpdateMcpServerResponse,
} from '../../node/grpc/grpcClientMappers.js';
import { EMPTY_PROTO_MESSAGE, encodeEmptyProtoMessage } from '../../node/grpc/grpcCatalogUnaryWire.js';
import {
	decodeAddMcpServerResponse,
	decodeEnablePluginResponse,
	decodeGetMcpServerStatusesResponse,
	decodeGetMcpServerToolsResponse,
	decodeListMcpServersResponse,
	decodeListPluginsResponse,
	decodePluginInfoResponse,
	decodeReloadPluginResponse,
	decodeRemoveMcpServerResponse,
	decodeScanNewPluginsResponse,
	decodeToggleMcpServerResponse,
	decodeUnloadPluginResponse,
	decodeUpdateMcpServerResponse,
	encodeAddMcpServerRequest,
	encodeEnablePluginRequest,
	encodeGetMcpServerStatusesRequest,
	encodeGetMcpServerToolsRequest,
	encodeListMcpServersRequest,
	encodeListPluginsRequest,
	encodePluginInfoRequest,
	encodeReloadPluginRequest,
	encodeRemoveMcpServerRequest,
	encodeScanNewPluginsRequest,
	encodeToggleMcpServerRequest,
	encodeUnloadPluginRequest,
	encodeUpdateMcpServerRequest,
} from '../../node/grpc/grpcMcpPluginUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc mcp/plugin unary protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeListMcpServersRequest writes enabled_only=2 work_dir=3; omits filter and false, not JSON', () => {
		const encoded = encodeListMcpServersRequest({ enabledOnly: true, workDir: '/proj' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.ok(!protoVarints(encoded).has(1));
		assert.strictEqual(protoVarints(encoded).get(2), 1);
		assert.strictEqual(protoStrings(encoded).get(3), '/proj');

		const omitted = encodeListMcpServersRequest({ enabledOnly: false, workDir: '' });
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(1));
		assert.ok(!protoVarints(omitted).has(2));
		assert.ok(!protoStrings(omitted).has(3));
	});

	test('decodeListMcpServersResponse maps transport enum to mapper strings; unknown unread', () => {
		const server = Buffer.concat([
			encodeStringField(1, 'mcp-1'),
			encodeStringField(2, 'filesystem'),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'unused-command'),
			encodeInt32Field(8, 1),
			encodeStringField(10, 'project'),
			encodeInt32Field(11, 1),
			encodeInt32Field(12, 1),
			encodeInt32Field(13, 1),
			encodeStringField(14, 'unused-server'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, server),
			encodeInt32Field(2, 9),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeListMcpServersResponse(encoded);
		assert.deepStrictEqual(wire, {
			servers: [{
				id: 'mcp-1',
				name: 'filesystem',
				transport: 'stdio',
				origin: 'project',
				enabled: true,
				effective_enabled: true,
				has_project_override: true,
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.strictEqual(JSON.stringify(wire).includes('unused-command'), false);
		assert.ok(!('total' in wire));
		assert.ok(!('project_override_enabled' in (wire.servers?.[0] ?? {})));
		assert.deepStrictEqual(mapListMcpServersResponse(wire), {
			servers: [{
				id: 'mcp-1',
				name: 'filesystem',
				transport: 'stdio',
				origin: 'project',
				enabled: true,
				effectiveEnabled: true,
				hasProjectOverride: true,
			}],
		});

		const sse = Buffer.concat([encodeInt32Field(3, 2)]);
		const http = Buffer.concat([encodeInt32Field(3, 3)]);
		const unspecified = Buffer.concat([encodeStringField(1, 'x')]);
		assert.strictEqual(decodeListMcpServersResponse(encodeMessageField(1, sse)).servers?.[0]?.transport, 'sse');
		assert.strictEqual(decodeListMcpServersResponse(encodeMessageField(1, http)).servers?.[0]?.transport, 'streamable_http');
		assert.strictEqual(decodeListMcpServersResponse(encodeMessageField(1, unspecified)).servers?.[0]?.transport, undefined);
		assert.strictEqual(mapListMcpServersResponse(decodeListMcpServersResponse(encodeMessageField(1, unspecified))).servers[0].transport, 'unknown');
		assert.deepStrictEqual(decodeListMcpServersResponse(new Uint8Array(0)), { servers: [] });
	});

	test('encodeGetMcpServerStatusesRequest writes repeated server_ids=1; omits empty, not JSON', () => {
		const encoded = encodeGetMcpServerStatusesRequest(['a', 'b']);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 1), ['a', 'b']);
		assert.ok(!protoStrings(encoded).has(2));
		assert.strictEqual(encodeGetMcpServerStatusesRequest([]).length, 0);
		assert.strictEqual(encodeGetMcpServerStatusesRequest(undefined).length, 0);
	});

	test('decodeGetMcpServerStatusesResponse reads statuses=1 checked_at=2; Status 1-4; unknown unread', () => {
		const status = Buffer.concat([
			encodeStringField(1, 'mcp-1'),
			encodeInt32Field(2, 3),
			encodeStringField(3, 'ok'),
			encodeInt64Field(4, 99),
			encodeStringField(5, 'unused-status'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, status),
			encodeInt64Field(2, 100),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeGetMcpServerStatusesResponse(encoded);
		assert.deepStrictEqual(wire, {
			statuses: [{
				server_id: 'mcp-1',
				status: 3,
				error_message: 'ok',
				last_connected_at: 99,
			}],
			checked_at: 100,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapGetMcpServerStatusesResponse(wire), {
			statuses: [{
				serverId: 'mcp-1',
				status: 'connected',
				errorMessage: 'ok',
				lastConnectedAt: 99,
			}],
			checkedAt: 100,
		});
		assert.deepStrictEqual(decodeGetMcpServerStatusesResponse(new Uint8Array(0)), {
			statuses: [],
			checked_at: undefined,
		});
	});

	test('encodeGetMcpServerToolsRequest writes server_id=1; force_refresh false omit, not JSON', () => {
		const encoded = encodeGetMcpServerToolsRequest('mcp-1', true);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'mcp-1');
		assert.strictEqual(protoVarints(encoded).get(2), 1);
		const omitted = encodeGetMcpServerToolsRequest('mcp-1', false);
		assert.strictEqual(protoStrings(omitted).get(1), 'mcp-1');
		assert.ok(!protoVarints(omitted).has(2));
		assert.strictEqual(encodeGetMcpServerToolsRequest('', false).length, 0);
	});

	test('decodeGetMcpServerToolsResponse reads tools=1 total=2 cached_at=3; Tool 1-3; unknown unread', () => {
		const tool = Buffer.concat([
			encodeStringField(1, 'read'),
			encodeStringField(2, 'Read a file'),
			encodeStringField(3, '{"type":"object"}'),
			encodeStringField(4, 'unused-tool'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, tool),
			encodeInt32Field(2, 4),
			encodeInt64Field(3, 55),
			encodeStringField(4, 'unused-field'),
		]);
		const wire = decodeGetMcpServerToolsResponse(encoded);
		assert.deepStrictEqual(wire, {
			tools: [{
				name: 'read',
				description: 'Read a file',
				input_schema_json: '{"type":"object"}',
			}],
			total: 4,
			cached_at: 55,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapGetMcpServerToolsResponse(wire), {
			tools: [{
				name: 'read',
				description: 'Read a file',
				inputSchemaJson: '{"type":"object"}',
			}],
			total: 4,
			cachedAt: 55,
		});
		assert.deepStrictEqual(decodeGetMcpServerToolsResponse(new Uint8Array(0)), {
			tools: [],
			total: undefined,
			cached_at: undefined,
		});
	});

	test('encodeListPluginsRequest is empty proto bytes, not JSON {}', () => {
		const encoded = encodeListPluginsRequest();
		assert.strictEqual(encoded.length, 0);
		assert.strictEqual(encodeEmptyProtoMessage().length, 0);
		assert.ok(encoded === EMPTY_PROTO_MESSAGE || encoded.length === 0);
		assert.notStrictEqual(JSON.stringify({}), Buffer.from(encoded).toString('utf8'));
		assert.notStrictEqual(encoded[0], 0x7b);
		const framed = asUnaryProtoBytes(encoded);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
	});

	test('decodeListPluginsResponse reads plugins=1; Summary 1-7; ACTIVE status=0 omit; unknown unread', () => {
		const plugin = Buffer.concat([
			encodeStringField(1, 'plugin-1'),
			encodeStringField(2, 'Hooks'),
			encodeStringField(3, '1.0.0'),
			encodeStringField(4, 'bundled'),
			encodeInt32Field(5, 2),
			encodeInt64Field(7, 1700000000000),
			encodeStringField(8, 'unused-plugin'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, plugin),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeListPluginsResponse(encoded);
		assert.deepStrictEqual(wire, {
			plugins: [{
				id: 'plugin-1',
				display_name: 'Hooks',
				version: '1.0.0',
				source: 'bundled',
				hook_count: 2,
				status: 0,
				loaded_at: 1700000000000,
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapListPluginsResponse(wire), {
			plugins: [{
				id: 'plugin-1',
				displayName: 'Hooks',
				version: '1.0.0',
				source: 'bundled',
				hookCount: 2,
				status: 'active',
				loadedAt: 1700000000000,
			}],
		});

		const disabled = Buffer.concat([
			encodeStringField(1, 'p2'),
			encodeInt32Field(6, 1),
		]);
		assert.strictEqual(decodeListPluginsResponse(encodeMessageField(1, disabled)).plugins?.[0]?.status, 1);
		assert.strictEqual(mapListPluginsResponse(decodeListPluginsResponse(encodeMessageField(1, disabled))).plugins[0].status, 'disabled');
		assert.deepStrictEqual(decodeListPluginsResponse(new Uint8Array(0)), { plugins: [] });
	});

	test('encodePluginInfoRequest writes plugin_id=1; omits empty, not JSON', () => {
		const encoded = encodePluginInfoRequest('plugin-1');
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'plugin-1');
		assert.ok(!protoStrings(encoded).has(2));
		assert.strictEqual(encodePluginInfoRequest('').length, 0);
	});

	test('decodePluginInfoResponse reads summary/hooks/map config; MapEntry key=1 value=2; unknown unread', () => {
		const summary = Buffer.concat([
			encodeStringField(1, 'plugin-1'),
			encodeStringField(2, 'Hooks'),
			encodeInt32Field(6, 2),
		]);
		const hook = Buffer.concat([
			encodeStringField(1, 'ToolHook'),
			encodeInt32Field(2, 10),
			encodeStringField(3, 'pkg.Hook'),
			encodeStringField(4, 'unused-hook'),
		]);
		const mapEntry = Buffer.concat([
			encodeStringField(1, 'token'),
			encodeStringField(2, '***'),
			encodeStringField(3, 'unused-entry'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, summary),
			encodeMessageField(2, hook),
			encodeMessageField(3, mapEntry),
			encodeStringField(4, 'boom'),
			encodeStringField(5, 'unused-field'),
		]);
		const wire = decodePluginInfoResponse(encoded);
		assert.deepStrictEqual(wire, {
			summary: {
				id: 'plugin-1',
				display_name: 'Hooks',
				version: undefined,
				source: undefined,
				hook_count: undefined,
				status: 2,
				loaded_at: undefined,
			},
			hooks: [{
				hook_type: 'ToolHook',
				priority: 10,
				class_name: 'pkg.Hook',
			}],
			config: { token: '***' },
			error_message: 'boom',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapPluginInfoResponse(wire), {
			summary: {
				id: 'plugin-1',
				displayName: 'Hooks',
				version: '',
				source: '',
				hookCount: 0,
				status: 'error',
				loadedAt: undefined,
			},
			hooks: [{
				hookType: 'ToolHook',
				priority: 10,
				className: 'pkg.Hook',
			}],
			config: { token: '***' },
			errorMessage: 'boom',
		});
		assert.deepStrictEqual(decodePluginInfoResponse(new Uint8Array(0)), {
			summary: undefined,
			hooks: [],
			config: undefined,
			error_message: undefined,
		});
	});

	test('encodeEnablePluginRequest writes plugin_id=1; enabled default true; false omit; not JSON', () => {
		const encoded = encodeEnablePluginRequest('plugin-1');
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'plugin-1');
		assert.strictEqual(protoVarints(encoded).get(2), 1);
		const omitted = encodeEnablePluginRequest('plugin-1', false);
		assert.strictEqual(protoStrings(omitted).get(1), 'plugin-1');
		assert.ok(!protoVarints(omitted).has(2));
		assert.strictEqual(encodeEnablePluginRequest('', false).length, 0);
	});

	test('decodeEnablePluginResponse reads plugin=1; Summary 1-7; unknown unread', () => {
		const plugin = Buffer.concat([
			encodeStringField(1, 'plugin-1'),
			encodeStringField(2, 'Hooks'),
			encodeInt32Field(6, 1),
			encodeStringField(8, 'unused-plugin'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, plugin),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeEnablePluginResponse(encoded);
		assert.deepStrictEqual(wire, {
			plugin: {
				id: 'plugin-1',
				display_name: 'Hooks',
				version: undefined,
				source: undefined,
				hook_count: undefined,
				status: 1,
				loaded_at: undefined,
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapPluginSummary(wire.plugin), {
			id: 'plugin-1',
			displayName: 'Hooks',
			version: '',
			source: '',
			hookCount: 0,
			status: 'disabled',
			loadedAt: undefined,
		});
		assert.deepStrictEqual(decodeEnablePluginResponse(new Uint8Array(0)), { plugin: undefined });
	});

	test('encodeReloadPluginRequest writes plugin_id=1; omits empty, not JSON', () => {
		const encoded = encodeReloadPluginRequest('plugin-1');
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'plugin-1');
		assert.ok(!protoStrings(encoded).has(2));
		assert.strictEqual(encodeReloadPluginRequest('').length, 0);
	});

	test('decodeReloadPluginResponse reads plugin=1; unknown unread', () => {
		const plugin = Buffer.concat([
			encodeStringField(1, 'plugin-1'),
			encodeStringField(2, 'Hooks'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, plugin),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeReloadPluginResponse(encoded);
		assert.strictEqual(wire.plugin?.id, 'plugin-1');
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(decodeReloadPluginResponse(new Uint8Array(0)), { plugin: undefined });
	});

	test('encodeUnloadPluginRequest writes plugin_id=1; omits empty, not JSON', () => {
		const encoded = encodeUnloadPluginRequest('plugin-1');
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'plugin-1');
		assert.strictEqual(encodeUnloadPluginRequest('').length, 0);
	});

	test('decodeUnloadPluginResponse reads removed_hook_count=1; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 4),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeUnloadPluginResponse(encoded);
		assert.deepStrictEqual(wire, { removed_hook_count: 4 });
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(decodeUnloadPluginResponse(new Uint8Array(0)), {
			removed_hook_count: undefined,
		});
	});

	test('encodeScanNewPluginsRequest is empty proto bytes, not JSON {}', () => {
		const encoded = encodeScanNewPluginsRequest();
		assert.strictEqual(encoded.length, 0);
		assert.strictEqual(encodeEmptyProtoMessage().length, 0);
		assert.ok(encoded === EMPTY_PROTO_MESSAGE || encoded.length === 0);
		assert.notStrictEqual(JSON.stringify({}), Buffer.from(encoded).toString('utf8'));
		assert.notStrictEqual(encoded[0], 0x7b);
		const framed = asUnaryProtoBytes(encoded);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
	});

	test('decodeScanNewPluginsResponse reads new_plugins=1 skipped_count=2; unknown unread', () => {
		const plugin = Buffer.concat([
			encodeStringField(1, 'plugin-new'),
			encodeStringField(2, 'Fresh'),
			encodeStringField(8, 'unused-plugin'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, plugin),
			encodeInt32Field(2, 3),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeScanNewPluginsResponse(encoded);
		assert.deepStrictEqual(wire, {
			new_plugins: [{
				id: 'plugin-new',
				display_name: 'Fresh',
				version: undefined,
				source: undefined,
				hook_count: undefined,
				status: 0,
				loaded_at: undefined,
			}],
			skipped_count: 3,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(decodeScanNewPluginsResponse(new Uint8Array(0)), {
			new_plugins: [],
			skipped_count: undefined,
		});
	});

	test('encodeToggleMcpServerRequest writes 1-4; false/empty omit; not JSON', () => {
		const encoded = encodeToggleMcpServerRequest({
			id: 'mcp-1',
			enabled: true,
			scope: 'project',
			workDir: '/proj',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'mcp-1');
		assert.strictEqual(protoVarints(encoded).get(2), 1);
		assert.strictEqual(protoStrings(encoded).get(3), 'project');
		assert.strictEqual(protoStrings(encoded).get(4), '/proj');
		const omitted = encodeToggleMcpServerRequest({
			id: '',
			enabled: false,
			scope: 'global',
			workDir: '',
		});
		assert.ok(!protoVarints(omitted).has(2));
		assert.ok(!protoStrings(omitted).has(4));
		assert.strictEqual(protoStrings(omitted).get(3), 'global');
	});

	test('decodeToggleMcpServerResponse reads success=1 error_message=2; actual_enabled unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'unused-field'),
		]);
		const wire = decodeToggleMcpServerResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			error_message: 'ok',
		});
		assert.ok(!('actual_enabled' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapToggleMcpServerResponse(wire), {
			ok: true,
			reason: 'ok',
		});
		assert.deepStrictEqual(decodeToggleMcpServerResponse(new Uint8Array(0)), {
			success: false,
			error_message: undefined,
		});
	});

	test('encodeAddMcpServerRequest writes config enum+env map; false/empty omit; not JSON', () => {
		const encoded = encodeAddMcpServerRequest({
			config: {
				id: 'mcp-1',
				name: 'filesystem',
				transport: 'stdio',
				command: 'npx',
				args: ['-y', 'mcp'],
				env: { TOKEN: 'secret' },
				url: 'http://mcp',
				enabled: true,
			},
			testConnection: true,
			scope: 'project',
			workDir: '/proj',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.ok(!Buffer.from(encoded).toString('utf8').includes('STDIO'));
		const configs = protoMessages(encoded, 1);
		assert.strictEqual(configs.length, 1);
		const config = configs[0]!;
		assert.strictEqual(protoStrings(config).get(1), 'mcp-1');
		assert.strictEqual(protoStrings(config).get(2), 'filesystem');
		assert.strictEqual(protoVarints(config).get(3), 1);
		assert.ok(!protoStrings(config).has(3));
		assert.strictEqual(protoStrings(config).get(4), 'npx');
		assert.deepStrictEqual(protoRepeatedStrings(config, 5), ['-y', 'mcp']);
		const envEntries = protoMessages(config, 6);
		assert.strictEqual(envEntries.length, 1);
		assert.strictEqual(protoStrings(envEntries[0]!).get(1), 'TOKEN');
		assert.strictEqual(protoStrings(envEntries[0]!).get(2), 'secret');
		assert.ok(!protoStrings(envEntries[0]!).has(3));
		assert.strictEqual(protoStrings(config).get(7), 'http://mcp');
		assert.strictEqual(protoVarints(config).get(8), 1);
		assert.ok(!protoStrings(config).has(10));
		assert.strictEqual(protoVarints(encoded).get(2), 1);
		assert.strictEqual(protoStrings(encoded).get(3), 'project');
		assert.strictEqual(protoStrings(encoded).get(4), '/proj');

		const omitted = encodeAddMcpServerRequest({
			config: { name: '', transport: 'unknown' },
			testConnection: false,
			scope: 'global',
			workDir: '',
		});
		assert.ok(!protoMessages(omitted, 1).length);
		assert.ok(!protoVarints(omitted).has(2));
		assert.strictEqual(protoStrings(omitted).get(3), 'global');
		assert.ok(!protoStrings(omitted).has(4));

		const sse = encodeAddMcpServerRequest({
			config: { name: 'sse', transport: 'sse' },
			scope: 'global',
		});
		assert.strictEqual(protoVarints(protoMessages(sse, 1)[0]!).get(3), 2);
		const http = encodeAddMcpServerRequest({
			config: { name: 'http', transport: 'streamable_http' },
			scope: 'global',
		});
		assert.strictEqual(protoVarints(protoMessages(http, 1)[0]!).get(3), 3);
	});

	test('decodeAddMcpServerResponse reads 1-3; test_status unread; mapper unchanged', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
			encodeStringField(3, 'assigned-1'),
			encodeInt32Field(4, 3),
			encodeStringField(5, 'unused-test'),
			encodeStringField(6, 'unused-field'),
		]);
		const wire = decodeAddMcpServerResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			error_message: 'ok',
			assigned_id: 'assigned-1',
		});
		assert.ok(!('test_status' in wire));
		assert.ok(!('test_error' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapAddMcpServerResponse(wire), {
			ok: true,
			reason: 'ok',
			assignedId: 'assigned-1',
		});
		assert.deepStrictEqual(decodeAddMcpServerResponse(new Uint8Array(0)), {
			success: false,
			error_message: undefined,
			assigned_id: undefined,
		});
	});

	test('encodeUpdateMcpServerRequest writes server_id=1 config=2; restart false omit; not JSON', () => {
		const encoded = encodeUpdateMcpServerRequest({
			serverId: 'mcp-1',
			config: {
				name: 'filesystem',
				transport: 'sse',
				enabled: false,
			},
			restartConnection: true,
			scope: 'global',
			workDir: '/proj',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'mcp-1');
		const config = protoMessages(encoded, 2)[0]!;
		assert.strictEqual(protoVarints(config).get(3), 2);
		assert.ok(!protoVarints(config).has(8));
		assert.strictEqual(protoVarints(encoded).get(3), 1);
		assert.strictEqual(protoStrings(encoded).get(4), 'global');
		assert.strictEqual(protoStrings(encoded).get(5), '/proj');
		const omitted = encodeUpdateMcpServerRequest({
			serverId: '',
			config: { name: '', transport: 'unknown' },
			restartConnection: false,
			scope: 'global',
			workDir: '',
		});
		assert.ok(!protoVarints(omitted).has(3));
		assert.ok(!protoStrings(omitted).has(5));
	});

	test('decodeUpdateMcpServerResponse maps updated_config enum+env; unknown unread', () => {
		const envEntry = Buffer.concat([
			encodeStringField(1, 'TOKEN'),
			encodeStringField(2, 'secret'),
			encodeStringField(3, 'unused-entry'),
		]);
		const config = Buffer.concat([
			encodeStringField(1, 'mcp-1'),
			encodeStringField(2, 'filesystem'),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'npx'),
			encodeStringField(5, '-y'),
			encodeMessageField(6, envEntry),
			encodeStringField(7, 'http://mcp'),
			encodeInt32Field(8, 1),
			encodeStringField(9, 'unused-app'),
			encodeStringField(10, 'project'),
		]);
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
			encodeMessageField(3, config),
			encodeStringField(4, 'unused-field'),
		]);
		const wire = decodeUpdateMcpServerResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			error_message: 'ok',
			updated_config: {
				id: 'mcp-1',
				name: 'filesystem',
				transport: 'stdio',
				command: 'npx',
				args: ['-y'],
				env: { TOKEN: 'secret' },
				url: 'http://mcp',
				enabled: true,
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.ok(!('origin' in (wire.updated_config ?? {})));
		assert.deepStrictEqual(mapUpdateMcpServerResponse(wire), {
			ok: true,
			reason: 'ok',
			config: {
				id: 'mcp-1',
				name: 'filesystem',
				transport: 'stdio',
				command: 'npx',
				args: ['-y'],
				env: { TOKEN: 'secret' },
				url: 'http://mcp',
				enabled: true,
			},
		});
		assert.strictEqual(mapMcpServerConfigFromWire({ transport: 1 as unknown as string })?.transport, 'unknown');
		assert.strictEqual(mapMcpServerConfigFromWire({ transport: 'stdio' })?.transport, 'stdio');
		assert.deepStrictEqual(decodeUpdateMcpServerResponse(new Uint8Array(0)), {
			success: false,
			error_message: undefined,
			updated_config: undefined,
		});
	});

	test('encodeRemoveMcpServerRequest writes 1-4; force false omit; not JSON', () => {
		const encoded = encodeRemoveMcpServerRequest({
			serverId: 'mcp-1',
			force: true,
			scope: 'project',
			workDir: '/proj',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'mcp-1');
		assert.strictEqual(protoVarints(encoded).get(2), 1);
		assert.strictEqual(protoStrings(encoded).get(3), 'project');
		assert.strictEqual(protoStrings(encoded).get(4), '/proj');
		const omitted = encodeRemoveMcpServerRequest({
			serverId: '',
			force: false,
			scope: 'global',
			workDir: '',
		});
		assert.ok(!protoVarints(omitted).has(2));
		assert.ok(!protoStrings(omitted).has(4));
	});

	test('decodeRemoveMcpServerResponse reads 1-3; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
			encodeStringField(3, 'filesystem'),
			encodeStringField(4, 'unused-field'),
		]);
		const wire = decodeRemoveMcpServerResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			error_message: 'ok',
			removed_name: 'filesystem',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapRemoveMcpServerResponse(wire), {
			ok: true,
			reason: 'ok',
			removedName: 'filesystem',
		});
		assert.deepStrictEqual(decodeRemoveMcpServerResponse(new Uint8Array(0)), {
			success: false,
			error_message: undefined,
			removed_name: undefined,
		});
	});

	test('grpcClient MCP list/mutators and plugin list/mutators use bytes', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.join(thisDir, '../../../../../../');
		const clientPath = path.join(repoRoot, 'src/vs/platform/universeAgent/node/grpc/grpcClient.ts');
		const source = fs.readFileSync(clientPath, 'utf8');
		const methods: Array<{ name: string; encoder: string; decoder: string; mapper?: string }> = [
			{ name: 'listMcpServers', encoder: 'encodeListMcpServersRequest', decoder: 'decodeListMcpServersResponse', mapper: 'mapListMcpServersResponse' },
			{ name: 'getMcpServerStatuses', encoder: 'encodeGetMcpServerStatusesRequest', decoder: 'decodeGetMcpServerStatusesResponse', mapper: 'mapGetMcpServerStatusesResponse' },
			{ name: 'getMcpServerTools', encoder: 'encodeGetMcpServerToolsRequest', decoder: 'decodeGetMcpServerToolsResponse', mapper: 'mapGetMcpServerToolsResponse' },
			{ name: 'listPlugins', encoder: 'encodeListPluginsRequest', decoder: 'decodeListPluginsResponse', mapper: 'mapListPluginsResponse' },
			{ name: 'getPluginInfo', encoder: 'encodePluginInfoRequest', decoder: 'decodePluginInfoResponse', mapper: 'mapPluginInfoResponse' },
			{ name: 'enablePlugin', encoder: 'encodeEnablePluginRequest', decoder: 'decodeEnablePluginResponse', mapper: 'mapPluginSummary' },
			{ name: 'reloadPlugin', encoder: 'encodeReloadPluginRequest', decoder: 'decodeReloadPluginResponse', mapper: 'mapPluginSummary' },
			{ name: 'unloadPlugin', encoder: 'encodeUnloadPluginRequest', decoder: 'decodeUnloadPluginResponse' },
			{ name: 'scanNewPlugins', encoder: 'encodeScanNewPluginsRequest', decoder: 'decodeScanNewPluginsResponse', mapper: 'mapPluginSummary' },
			{ name: 'toggleMcpServer', encoder: 'encodeToggleMcpServerRequest', decoder: 'decodeToggleMcpServerResponse', mapper: 'mapToggleMcpServerResponse' },
			{ name: 'addMcpServer', encoder: 'encodeAddMcpServerRequest', decoder: 'decodeAddMcpServerResponse', mapper: 'mapAddMcpServerResponse' },
			{ name: 'updateMcpServer', encoder: 'encodeUpdateMcpServerRequest', decoder: 'decodeUpdateMcpServerResponse', mapper: 'mapUpdateMcpServerResponse' },
			{ name: 'removeMcpServer', encoder: 'encodeRemoveMcpServerRequest', decoder: 'decodeRemoveMcpServerResponse', mapper: 'mapRemoveMcpServerResponse' },
		];
		for (const { name, encoder, decoder, mapper } of methods) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			if (mapper) {
				assert.ok(body.includes(mapper), `${name} must call ${mapper}`);
			}
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
		}
		assert.ok(!source.includes('mapMcpTransportToWire'));
		assert.ok(!source.includes('mapMcpServerConfigToWire'));
	});
});

function protoStrings(encoded: Uint8Array): Map<number, string> {
	const strings = new Map<number, string>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 2) {
			strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return strings;
}

function protoRepeatedStrings(encoded: Uint8Array, fieldNumber: number): string[] {
	const values: string[] = [];
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			values.push(Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return values;
}

function protoVarints(encoded: Uint8Array): Map<number, number> {
	const numbers = new Map<number, number>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 0) {
			numbers.set(field.field, Number(field.varint));
		}
	}
	return numbers;
}

function protoMessages(encoded: Uint8Array, fieldNumber: number): Uint8Array[] {
	const values: Uint8Array[] = [];
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			values.push(field.bytes);
		}
	}
	return values;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}
