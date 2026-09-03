/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as grpc from '@grpc/grpc-js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import type {
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentChatStream,
	UniverseAgentConnectRequest,
	UniverseAgentConnectResult,
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentDeleteSessionRequest,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentListSessionsRequest,
	UniverseAgentListSessionsResult,
	UniverseAgentListSkillsResult,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentSkillSource,
	UniverseAgentSkillSummary,
	UniverseAgentListAgentProfilesRequest,
	UniverseAgentListAgentProfilesResult,
	UniverseAgentAgentProfileSource,
	UniverseAgentAgentProfileSummary,
	UniverseAgentAgentProfileDetail,
	UniverseAgentSaveAgentProfileRequest,
	UniverseAgentSaveAgentProfileResult,
	UniverseAgentDeleteAgentProfileRequest,
	UniverseAgentDeleteAgentProfileResult,
	UniverseAgentResetAgentProfileRequest,
	UniverseAgentResetAgentProfileResult,
	UniverseAgentListMcpServersRequest,
	UniverseAgentListMcpServersResult,
	UniverseAgentGetMcpServerStatusesResult,
	UniverseAgentGetMcpServerToolsResult,
	UniverseAgentMcpRuntimeStatus,
	UniverseAgentMcpServerStatus,
	UniverseAgentMcpToolDefinition,
	UniverseAgentListPluginsResult,
	UniverseAgentPluginInfoResult,
	UniverseAgentEnablePluginResult,
	UniverseAgentReloadPluginResult,
	UniverseAgentUnloadPluginResult,
	UniverseAgentScanNewPluginsResult,
	UniverseAgentPluginStatus,
	UniverseAgentPluginSummary,
	UniverseAgentPluginHookEntry,
	UniverseAgentMcpServerOrigin,
	UniverseAgentMcpTransport,
	UniverseAgentMcpServerSummary,
	UniverseAgentMcpServerConfig,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentToggleMcpServerResult,
	UniverseAgentAddMcpServerRequest,
	UniverseAgentAddMcpServerResult,
	UniverseAgentUpdateMcpServerRequest,
	UniverseAgentUpdateMcpServerResult,
	UniverseAgentRemoveMcpServerRequest,
	UniverseAgentRemoveMcpServerResult,
	UniverseAgentListToolsResult,
	UniverseAgentListModelsResult,
	UniverseAgentModelEntry,
	UniverseAgentToolSummary,
	UniverseAgentAgentTreeNode,
	UniverseAgentFetchToolDetailRequest,
	UniverseAgentFetchToolDetailWireResult,
	UniverseAgentTeamInfo,
	UniverseAgentTeamMemberInfo,
	UniverseAgentTeamTaskInfo,
} from '../../common/universeAgentTypes.js';
import {
	GrpcStatusCode,
	IUniverseAgentGrpcTransport,
	UniverseAgentAuthNonceRequest,
	UniverseAgentAuthNonceResult,
	UniverseAgentDeviceAuthConnectRequest,
	UniverseAgentGrpcServices,
	UniverseAgentTransportError,
} from './grpcTransport.js';
import { createPinnedChannelOptions, createPinnedTlsChannelCredentials, type UniverseAgentPinnedTlsTarget } from '../universeAgentChannel.js';

interface ConnectResponseWire {
	session_token?: string;
	work_dir?: string;
	pairing_nonce?: string;
	sas_code?: string;
	capabilities?: {
		methods?: string[];
		events?: string[];
	};
}

interface AuthNonceResponseWire {
	auth_nonce?: string;
	engine_identity_id?: string;
	engine_cert_fingerprint?: string;
	expires_at_ms?: number;
}

interface DeviceAuthWire {
	client_identity_id?: string;
	client_public_key?: string;
	auth_nonce?: string;
	signature?: string;
}

interface ListSessionsResponseWire {
	sessions?: Array<{
		session_id?: string;
		title?: string;
		status?: string;
		created_at?: number;
		last_accessed_at?: number;
		turn_count?: number;
		model?: string;
	}>;
	total_count?: number;
}

interface CreateSessionResponseWire {
	session_id?: string;
}

interface GetHistoryResponseWire {
	envelopes?: Array<{ cursor_seq?: string; payload?: unknown }>;
	next_cursor_seq?: string;
}

function grpcErrorCode(error: grpc.ServiceError | null | undefined): number {
	return error?.code ?? GrpcStatusCode.OK;
}

function makeUnaryClient<TRequest, TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (request: TRequest) => Promise<TResponse> {
	const path = `/${servicePath}/${method}`;
	return (request: TRequest) => new Promise<TResponse>((resolve, reject) => {
		channel.makeUnaryRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
			request,
			(error, response) => {
				if (error) {
					reject(new UniverseAgentTransportError(error.code, error.message));
					return;
				}
				resolve(response as TResponse);
			},
		);
	});
}

function makeServerStreamClient<TRequest, TEvent>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (request: TRequest, listener: (event: TEvent) => void) => { dispose(): void } {
	const path = `/${servicePath}/${method}`;
	return (request: TRequest, listener: (event: TEvent) => void) => {
		const disposables = new DisposableStore();
		const call = channel.makeServerStreamRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TEvent,
			request,
		);
		call.on('data', (data: TEvent) => listener(data));
		call.on('error', () => { /* stream errors surface on next RPC for v1 */ });
		disposables.add({ dispose: () => call.cancel() });
		return disposables;
	};
}

function makeResidentBidiStreamClient<TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (
	sessionId: string,
	onResponse: (response: TResponse) => void,
	onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
) => UniverseAgentChatStream {
	const path = `/${servicePath}/${method}`;
	return (sessionId, onResponse, onClosed) => {
		const call = channel.makeBidiStreamRequest(
			path,
			(value: Record<string, unknown>) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
		);
		let closed = false;
		const finish = (cause: UniverseAgentSessionStreamCloseCause): void => {
			if (closed) {
				return;
			}
			closed = true;
			onClosed?.(cause);
		};
		call.on('data', (data: TResponse) => onResponse(data));
		call.on('error', (error: grpc.ServiceError) => {
			if (closed) {
				return;
			}
			const message = typeof error?.message === 'string' && error.message ? error.message : 'stream error';
			finish({ kind: 'error', message });
		});
		call.on('end', () => {
			finish({ kind: 'remote' });
		});
		return {
			write(payload: unknown): void {
				if (closed) {
					return;
				}
				call.write({ session_id: sessionId, payload });
			},
			dispose(): void {
				if (closed) {
					call.cancel();
					return;
				}
				closed = true;
				call.end();
				call.cancel();
			},
		};
	};
}

function makeBidiStreamClient<TRequest, TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (request: TRequest, onResponse: (response: TResponse) => void) => Promise<void> {
	const path = `/${servicePath}/${method}`;
	return (request: TRequest, onResponse: (response: TResponse) => void) => new Promise<void>((resolve, reject) => {
		const call = channel.makeBidiStreamRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
		);
		call.on('data', (data: TResponse) => onResponse(data));
		call.on('error', (error: grpc.ServiceError) => reject(new UniverseAgentTransportError(error.code, error.message)));
		call.on('end', () => resolve());
		call.write(request);
		call.end();
	});
}

function mapConnectResponse(wire: ConnectResponseWire): UniverseAgentConnectResult {
	return {
		sessionToken: wire.session_token,
		workDir: wire.work_dir,
		pairingNonce: wire.pairing_nonce,
		sasCode: wire.sas_code,
		methods: wire.capabilities?.methods ?? [],
		events: wire.capabilities?.events ?? [],
	};
}

function bytesToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value: string | undefined): Uint8Array {
	if (!value) {
		return new Uint8Array(0);
	}
	return Uint8Array.from(Buffer.from(value, 'base64'));
}

function mapAuthNonceResponse(wire: AuthNonceResponseWire): UniverseAgentAuthNonceResult {
	return {
		authNonce: base64ToBytes(wire.auth_nonce),
		engineIdentityId: wire.engine_identity_id ?? '',
		engineCertFingerprint: wire.engine_cert_fingerprint ?? '',
		expiresAtMs: wire.expires_at_ms,
	};
}

function mapListSessionsResponse(wire: ListSessionsResponseWire): UniverseAgentListSessionsResult {
	return {
		sessions: (wire.sessions ?? []).map(session => ({
			sessionId: session.session_id ?? '',
			title: session.title,
			status: session.status,
			createdAt: session.created_at,
			lastAccessedAt: session.last_accessed_at,
			turnCount: session.turn_count,
			model: session.model,
		})),
		totalCount: wire.total_count,
	};
}

function mapGetHistoryResponse(wire: GetHistoryResponseWire): UniverseAgentGetHistoryResult {
	return {
		envelopes: (wire.envelopes ?? []).map(envelope => ({
			cursorSeq: envelope.cursor_seq ?? '',
			payload: envelope.payload !== undefined && envelope.payload !== null ? envelope.payload : envelope,
		})),
		nextCursorSeq: wire.next_cursor_seq,
	};
}

interface ListSkillsResponseWire {
	skills?: Array<{
		name?: string;
		description?: string;
		source?: string;
		enabled?: boolean;
		slash_enabled?: boolean;
	}>;
}

interface SetSkillEnabledResponseWire {
	ok?: boolean;
	reason?: string;
}

interface SaveSkillContentResponseWire {
	ok?: boolean;
	reason?: string;
}

interface SkillInfoResponseWire {
	name?: string;
	content?: string;
	source?: string;
	enabled?: boolean;
}

function mapSkillSource(source: string | undefined): UniverseAgentSkillSource {
	switch (source?.toLowerCase()) {
		case 'bundled':
			return 'bundled';
		case 'user':
			return 'user';
		case 'project':
			return 'project';
		default:
			return 'unknown';
	}
}

function mapSkillSummary(wire: NonNullable<ListSkillsResponseWire['skills']>[number]): UniverseAgentSkillSummary {
	return {
		name: wire.name ?? '',
		description: wire.description,
		source: mapSkillSource(wire.source),
		enabled: wire.enabled === true,
		slashEnabled: wire.slash_enabled,
	};
}

function mapListSkillsResponse(wire: ListSkillsResponseWire): UniverseAgentListSkillsResult {
	return {
		skills: (wire.skills ?? []).map(mapSkillSummary),
	};
}

function mapSetSkillEnabledResponse(wire: SetSkillEnabledResponseWire): UniverseAgentSetSkillEnabledResult {
	return {
		ok: wire.ok === true,
		reason: wire.reason,
	};
}

function mapSaveSkillContentResponse(wire: SaveSkillContentResponseWire): UniverseAgentSaveSkillContentResult {
	return {
		ok: wire.ok === true,
		reason: wire.reason,
	};
}

function mapSkillInfoResponse(wire: SkillInfoResponseWire): UniverseAgentSkillInfoResult {
	return {
		name: wire.name ?? '',
		content: wire.content ?? '',
		source: mapSkillSource(wire.source),
		enabled: wire.enabled === true,
	};
}

interface ListAgentProfilesResponseWire {
	profiles?: Array<{
		id?: string;
		name?: string;
		source?: string;
		summary?: string;
		enabled?: boolean;
		disabled_tools?: string[];
		enabled_tools?: string[];
		whitelist_mode?: boolean;
		description?: string;
		system_prompt?: string;
		permission_mode?: string;
		usage?: string;
		detail_level?: string;
		builtin_default?: boolean;
	}>;
}

function mapAgentProfileSource(source: string | undefined): UniverseAgentAgentProfileSource {
	switch (source?.toLowerCase()) {
		case 'built_in':
		case 'builtin':
			return 'built_in';
		case 'user':
			return 'user';
		case 'project':
			return 'project';
		default:
			return 'unknown';
	}
}

function mapAgentProfileSourceToWire(source: UniverseAgentAgentProfileSource | undefined): string | undefined {
	if (!source) {
		return undefined;
	}
	switch (source) {
		case 'built_in':
			return 'BUILT_IN';
		case 'user':
			return 'USER';
		case 'project':
			return 'PROJECT';
		default:
			return undefined;
	}
}

function mapAgentProfileDetail(wire: NonNullable<ListAgentProfilesResponseWire['profiles']>[number]): UniverseAgentAgentProfileDetail {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		description: wire.description,
		systemPrompt: wire.system_prompt,
		disabledTools: wire.disabled_tools,
		enabledTools: wire.enabled_tools,
		permissionMode: wire.permission_mode,
		summary: wire.summary,
		usage: wire.usage,
		detailLevel: wire.detail_level,
		source: mapAgentProfileSource(wire.source),
		enabled: wire.enabled,
		whitelistMode: wire.whitelist_mode,
		builtinDefault: wire.builtin_default,
	};
}

function mapAgentProfileSummary(wire: NonNullable<ListAgentProfilesResponseWire['profiles']>[number]): UniverseAgentAgentProfileSummary {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		source: mapAgentProfileSource(wire.source),
		summary: wire.summary,
		enabled: wire.enabled,
		disabledTools: wire.disabled_tools,
		enabledTools: wire.enabled_tools,
		whitelistMode: wire.whitelist_mode,
	};
}

function mapAgentProfileDetailToWire(profile: UniverseAgentAgentProfileDetail): Record<string, unknown> {
	const wire: Record<string, unknown> = {
		id: profile.id,
		name: profile.name,
	};
	if (profile.description !== undefined) {
		wire.description = profile.description;
	}
	if (profile.systemPrompt !== undefined) {
		wire.system_prompt = profile.systemPrompt;
	}
	if (profile.disabledTools !== undefined) {
		wire.disabled_tools = [...profile.disabledTools];
	}
	if (profile.enabledTools !== undefined) {
		wire.enabled_tools = [...profile.enabledTools];
	}
	if (profile.permissionMode !== undefined) {
		wire.permission_mode = profile.permissionMode;
	}
	if (profile.summary !== undefined) {
		wire.summary = profile.summary;
	}
	if (profile.usage !== undefined) {
		wire.usage = profile.usage;
	}
	if (profile.detailLevel !== undefined) {
		wire.detail_level = profile.detailLevel;
	}
	const source = mapAgentProfileSourceToWire(profile.source);
	if (source !== undefined) {
		wire.source = source;
	}
	if (profile.enabled !== undefined) {
		wire.enabled = profile.enabled;
	}
	if (profile.whitelistMode !== undefined) {
		wire.whitelist_mode = profile.whitelistMode;
	}
	if (profile.builtinDefault !== undefined) {
		wire.builtin_default = profile.builtinDefault;
	}
	return wire;
}

function mapListAgentProfilesResponse(wire: ListAgentProfilesResponseWire): UniverseAgentListAgentProfilesResult {
	return {
		profiles: (wire.profiles ?? []).map(mapAgentProfileSummary),
	};
}

interface SaveAgentProfileResponseWire {
	profile?: ListAgentProfilesResponseWire['profiles'] extends (infer T)[] | undefined ? T : never;
}

function mapSaveAgentProfileResponse(wire: SaveAgentProfileResponseWire): UniverseAgentSaveAgentProfileResult {
	const profileWire = wire.profile;
	if (!profileWire) {
		return { profile: { id: '', name: '' } };
	}
	return { profile: mapAgentProfileDetail(profileWire) };
}

interface DeleteAgentProfileResponseWire {
	success?: boolean;
}

function mapDeleteAgentProfileResponse(wire: DeleteAgentProfileResponseWire): UniverseAgentDeleteAgentProfileResult {
	return { ok: wire.success === true };
}

interface ResetAgentProfileResponseWire {
	success?: boolean;
	profile?: NonNullable<ListAgentProfilesResponseWire['profiles']>[number];
}

function mapResetAgentProfileResponse(wire: ResetAgentProfileResponseWire): UniverseAgentResetAgentProfileResult {
	return {
		ok: wire.success === true,
		profile: wire.profile ? mapAgentProfileDetail(wire.profile) : undefined,
	};
}

function mapMcpTransportToWire(transport: UniverseAgentMcpTransport): string {
	switch (transport) {
		case 'stdio':
			return 'STDIO';
		case 'sse':
			return 'SSE';
		case 'streamable_http':
			return 'STREAMABLE_HTTP';
		default:
			return 'STDIO';
	}
}

function mapMcpServerConfigToWire(config: UniverseAgentMcpServerConfig): Record<string, unknown> {
	const wire: Record<string, unknown> = {
		name: config.name,
		transport: mapMcpTransportToWire(config.transport),
	};
	if (config.id !== undefined) {
		wire.id = config.id;
	}
	if (config.command !== undefined) {
		wire.command = config.command;
	}
	if (config.args !== undefined) {
		wire.args = [...config.args];
	}
	if (config.env !== undefined) {
		wire.env = { ...config.env };
	}
	if (config.url !== undefined) {
		wire.url = config.url;
	}
	if (config.enabled !== undefined) {
		wire.enabled = config.enabled;
	}
	return wire;
}

function mapMcpServerConfigFromWire(wire: Record<string, unknown> | undefined): UniverseAgentMcpServerConfig | undefined {
	if (!wire) {
		return undefined;
	}
	return {
		id: typeof wire.id === 'string' ? wire.id : undefined,
		name: typeof wire.name === 'string' ? wire.name : '',
		transport: mapMcpTransport(typeof wire.transport === 'string' ? wire.transport : undefined),
		command: typeof wire.command === 'string' ? wire.command : undefined,
		args: Array.isArray(wire.args) ? wire.args.filter((arg): arg is string => typeof arg === 'string') : undefined,
		env: wire.env && typeof wire.env === 'object' ? wire.env as Record<string, string> : undefined,
		url: typeof wire.url === 'string' ? wire.url : undefined,
		enabled: wire.enabled === true,
	};
}

interface AddMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
	assigned_id?: string;
}

function mapAddMcpServerResponse(wire: AddMcpServerResponseWire): UniverseAgentAddMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
		assignedId: wire.assigned_id,
	};
}

interface UpdateMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
	updated_config?: Record<string, unknown>;
}

function mapUpdateMcpServerResponse(wire: UpdateMcpServerResponseWire): UniverseAgentUpdateMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
		config: mapMcpServerConfigFromWire(wire.updated_config),
	};
}

interface RemoveMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
	removed_name?: string;
}

function mapRemoveMcpServerResponse(wire: RemoveMcpServerResponseWire): UniverseAgentRemoveMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
		removedName: wire.removed_name,
	};
}

interface ListMcpServersResponseWire {
	servers?: Array<{
		id?: string;
		name?: string;
		transport?: string;
		origin?: string;
		enabled?: boolean;
		effective_enabled?: boolean;
		has_project_override?: boolean;
	}>;
}

function mapMcpOrigin(origin: string | undefined): UniverseAgentMcpServerOrigin {
	switch (origin?.toLowerCase()) {
		case 'global':
			return 'global';
		case 'project':
			return 'project';
		default:
			return 'unknown';
	}
}

function mapMcpTransport(transport: string | undefined): UniverseAgentMcpTransport {
	switch (transport?.toLowerCase()) {
		case 'stdio':
			return 'stdio';
		case 'sse':
			return 'sse';
		case 'streamable_http':
			return 'streamable_http';
		default:
			return 'unknown';
	}
}

function mapMcpServerSummary(wire: NonNullable<ListMcpServersResponseWire['servers']>[number]): UniverseAgentMcpServerSummary {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		transport: mapMcpTransport(wire.transport),
		origin: mapMcpOrigin(wire.origin),
		enabled: wire.enabled === true,
		effectiveEnabled: wire.effective_enabled,
		hasProjectOverride: wire.has_project_override,
	};
}

function mapListMcpServersResponse(wire: ListMcpServersResponseWire): UniverseAgentListMcpServersResult {
	return {
		servers: (wire.servers ?? []).map(mapMcpServerSummary),
	};
}

function readEpochMs(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		return value;
	}
	if (typeof value === 'string' && value) {
		const parsed = Number(value);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return undefined;
}

function mapMcpRuntimeStatus(status: unknown): UniverseAgentMcpRuntimeStatus {
	if (typeof status === 'number') {
		switch (status) {
			case 1:
				return 'disconnected';
			case 2:
				return 'connecting';
			case 3:
				return 'connected';
			case 4:
				return 'error';
			default:
				return 'failed';
		}
	}
	const normalized = String(status ?? '').toUpperCase();
	if (normalized === 'MCP_STATUS_DISCONNECTED' || normalized === 'DISCONNECTED') {
		return 'disconnected';
	}
	if (normalized === 'MCP_STATUS_CONNECTING' || normalized === 'CONNECTING') {
		return 'connecting';
	}
	if (normalized === 'MCP_STATUS_CONNECTED' || normalized === 'CONNECTED') {
		return 'connected';
	}
	if (normalized === 'MCP_STATUS_ERROR' || normalized === 'ERROR') {
		return 'error';
	}
	return 'failed';
}

interface GetMcpServerStatusesResponseWire {
	statuses?: Array<{
		server_id?: string;
		status?: unknown;
		error_message?: string;
		last_connected_at?: number | string;
	}>;
	checked_at?: number | string;
}

function mapMcpServerStatus(wire: NonNullable<GetMcpServerStatusesResponseWire['statuses']>[number]): UniverseAgentMcpServerStatus {
	return {
		serverId: wire.server_id ?? '',
		status: mapMcpRuntimeStatus(wire.status),
		errorMessage: wire.error_message,
		lastConnectedAt: readEpochMs(wire.last_connected_at),
	};
}

function mapGetMcpServerStatusesResponse(wire: GetMcpServerStatusesResponseWire): UniverseAgentGetMcpServerStatusesResult {
	return {
		statuses: (wire.statuses ?? []).map(mapMcpServerStatus),
		checkedAt: readEpochMs(wire.checked_at),
	};
}

interface GetMcpServerToolsResponseWire {
	tools?: Array<{
		name?: string;
		description?: string;
		input_schema_json?: string;
	}>;
	total?: number;
	cached_at?: number | string;
}

function mapMcpToolDefinition(wire: NonNullable<GetMcpServerToolsResponseWire['tools']>[number]): UniverseAgentMcpToolDefinition {
	return {
		name: wire.name ?? '',
		description: wire.description,
		inputSchemaJson: wire.input_schema_json,
	};
}

function mapGetMcpServerToolsResponse(wire: GetMcpServerToolsResponseWire): UniverseAgentGetMcpServerToolsResult {
	return {
		tools: (wire.tools ?? []).map(mapMcpToolDefinition),
		total: wire.total,
		cachedAt: readEpochMs(wire.cached_at),
	};
}

function mapPluginStatus(status: unknown): UniverseAgentPluginStatus {
	if (typeof status === 'number') {
		switch (status) {
			case 0:
				return 'active';
			case 1:
				return 'disabled';
			case 2:
				return 'error';
			default:
				return 'unknown';
		}
	}
	const normalized = String(status ?? '').toUpperCase();
	if (normalized === 'PLUGIN_ACTIVE' || normalized === 'ACTIVE') {
		return 'active';
	}
	if (normalized === 'PLUGIN_DISABLED' || normalized === 'DISABLED') {
		return 'disabled';
	}
	if (normalized === 'PLUGIN_ERROR' || normalized === 'ERROR') {
		return 'error';
	}
	return 'unknown';
}

interface PluginSummaryWire {
	id?: string;
	display_name?: string;
	version?: string;
	source?: string;
	hook_count?: number;
	status?: unknown;
	loaded_at?: number | string;
}

function mapPluginSummary(wire: PluginSummaryWire | undefined): UniverseAgentPluginSummary {
	return {
		id: wire?.id ?? '',
		displayName: wire?.display_name ?? '',
		version: wire?.version ?? '',
		source: wire?.source ?? '',
		hookCount: wire?.hook_count ?? 0,
		status: mapPluginStatus(wire?.status),
		loadedAt: readEpochMs(wire?.loaded_at),
	};
}

interface ListPluginsResponseWire {
	plugins?: PluginSummaryWire[];
}

function mapListPluginsResponse(wire: ListPluginsResponseWire): UniverseAgentListPluginsResult {
	return {
		plugins: (wire.plugins ?? []).map(mapPluginSummary),
	};
}

interface PluginHookEntryWire {
	hook_type?: string;
	priority?: number;
	class_name?: string;
}

interface PluginInfoResponseWire {
	summary?: PluginSummaryWire;
	hooks?: PluginHookEntryWire[];
	config?: Record<string, string>;
	error_message?: string;
}

function mapPluginHookEntry(wire: PluginHookEntryWire): UniverseAgentPluginHookEntry {
	return {
		hookType: wire.hook_type ?? '',
		priority: wire.priority ?? 0,
		className: wire.class_name ?? '',
	};
}

function mapPluginInfoResponse(wire: PluginInfoResponseWire): UniverseAgentPluginInfoResult {
	return {
		summary: mapPluginSummary(wire.summary),
		hooks: (wire.hooks ?? []).map(mapPluginHookEntry),
		config: wire.config,
		errorMessage: wire.error_message,
	};
}

interface EnablePluginResponseWire {
	plugin?: PluginSummaryWire;
}

interface ReloadPluginResponseWire {
	plugin?: PluginSummaryWire;
}

interface UnloadPluginResponseWire {
	removed_hook_count?: number;
}

interface ScanNewPluginsResponseWire {
	new_plugins?: PluginSummaryWire[];
	skipped_count?: number;
}

interface ToggleMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
}

function mapToggleMcpServerResponse(wire: ToggleMcpServerResponseWire): UniverseAgentToggleMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
	};
}

interface ListToolsResponseWire {
	tools?: Array<{
		name?: string;
		description?: string;
		category?: string;
		destructive?: boolean;
		requires_permission?: boolean;
	}>;
}

function mapToolSummary(wire: NonNullable<ListToolsResponseWire['tools']>[number]): UniverseAgentToolSummary {
	return {
		name: wire.name ?? '',
		description: wire.description,
		category: wire.category,
		destructive: wire.destructive,
		requiresPermission: wire.requires_permission,
	};
}

function mapListToolsResponse(wire: ListToolsResponseWire): UniverseAgentListToolsResult {
	return {
		tools: (wire.tools ?? []).map(mapToolSummary),
	};
}

interface ListModelsResponseWire {
	models?: Array<{
		id?: string;
		type?: string;
		enabled?: boolean;
		level?: number;
		description?: string;
		cost?: string;
		speed?: string;
		provider?: string;
		model_id?: string;
	}>;
}

function mapModelEntry(wire: NonNullable<ListModelsResponseWire['models']>[number]): UniverseAgentModelEntry {
	return {
		id: wire.id ?? '',
		type: wire.type ?? '',
		enabled: wire.enabled === true,
		level: typeof wire.level === 'number' && Number.isFinite(wire.level) ? wire.level : 0,
		description: wire.description,
		cost: wire.cost,
		speed: wire.speed,
		provider: wire.provider ?? '',
		modelId: wire.model_id ?? '',
	};
}

function mapListModelsResponse(wire: ListModelsResponseWire): UniverseAgentListModelsResult {
	return {
		models: (wire.models ?? []).map(mapModelEntry),
	};
}

interface AgentInfoWire {
	agent_id?: string;
	name?: string;
	type?: string;
	status?: string;
	model?: string;
	turn_count?: number;
	created_at?: number;
	children?: AgentInfoWire[];
}

interface AgentTreeResponseWire {
	root?: AgentInfoWire;
}

interface FetchToolDetailResponseWire {
	success?: boolean;
	content?: string;
	truncated?: boolean;
	total_bytes?: number;
	error_message?: string;
}

function mapAgentTreeNode(wire: AgentInfoWire | undefined): UniverseAgentAgentTreeNode | undefined {
	if (!wire) {
		return undefined;
	}
	return {
		agentId: wire.agent_id ?? 'root',
		name: wire.name ?? '',
		type: wire.type ?? 'AGENT_TYPE_UNKNOWN',
		status: wire.status ?? 'AGENT_STATUS_UNKNOWN',
		model: wire.model ?? '',
		turnCount: wire.turn_count ?? 0,
		createdAt: wire.created_at ?? 0,
		children: (wire.children ?? []).map(child => mapAgentTreeNode(child)!).filter(Boolean),
	};
}

interface MemberInfoWire {
	member_name?: string;
	member_agent_id?: string;
	status?: string;
	preset?: string;
	dynamic?: string;
	turn_count?: number;
}

interface MemberStatusResponseWire {
	members?: MemberInfoWire[];
}

interface BlackboardTaskWire {
	task_id?: string;
	owner?: string;
	description?: string;
	status?: string;
	blocked_by?: string;
	last_message?: string;
	subject?: string;
}

interface TaskListResponseWire {
	tasks?: BlackboardTaskWire[];
}

interface TeamInfoResponseWire {
	team_id?: number;
	status?: string;
}

function mapMemberInfo(wire: MemberInfoWire): UniverseAgentTeamMemberInfo {
	return {
		memberName: wire.member_name ?? '',
		memberAgentId: wire.member_agent_id ?? '',
		status: wire.status ?? '',
		preset: wire.preset ?? '',
		dynamic: wire.dynamic ?? '',
		turnCount: wire.turn_count ?? 0,
	};
}

function mapTaskInfo(wire: BlackboardTaskWire): UniverseAgentTeamTaskInfo {
	return {
		taskId: wire.task_id ?? '',
		subject: wire.subject ?? '',
		owner: wire.owner ?? '',
		status: wire.status ?? '',
		blockedBy: wire.blocked_by ?? '',
		lastMessage: wire.last_message ?? '',
		description: wire.description ?? '',
	};
}

export interface GrpcUniverseAgentClientOptions {
	readonly address: string;
	readonly credentials?: grpc.ChannelCredentials;
	readonly channelOptions?: grpc.ChannelOptions;
}

/**
 * Hand-written @grpc/grpc-js client using JSON marshalling for v1 transport primitives.
 */
export class GrpcUniverseAgentClient implements IUniverseAgentGrpcTransport {

	private readonly _channel: grpc.Client;
	private _alive = true;

	constructor(options: GrpcUniverseAgentClientOptions) {
		this._channel = new grpc.Client(
			options.address,
			options.credentials ?? grpc.credentials.createInsecure(),
			options.channelOptions,
		);
	}

	get isChannelAlive(): boolean {
		return this._alive;
	}

	async connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ConnectResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.Connect,
		);
		const wire = await unary({
			client_id: request.clientId,
			protocol_version: request.protocolVersion,
			work_dir: request.workDir,
		});
		return mapConnectResponse(wire);
	}

	async getAuthNonce(request: UniverseAgentAuthNonceRequest): Promise<UniverseAgentAuthNonceResult> {
		const unary = makeUnaryClient<Record<string, unknown>, AuthNonceResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.GetAuthNonce,
		);
		const wire = await unary({
			client_identity_id: request.clientIdentityId,
			client_public_key: bytesToBase64(request.clientPublicKey),
		});
		return mapAuthNonceResponse(wire);
	}

	async connectWithDeviceAuth(request: UniverseAgentDeviceAuthConnectRequest): Promise<UniverseAgentConnectResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ConnectResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.Connect,
		);
		const deviceAuth: DeviceAuthWire = {
			client_identity_id: request.clientIdentityId,
			client_public_key: bytesToBase64(request.clientPublicKey),
			auth_nonce: bytesToBase64(request.authNonce),
			signature: bytesToBase64(request.signature),
		};
		const payload: Record<string, unknown> = {
			protocol_version: request.protocolVersion,
			device_auth: deviceAuth,
		};
		if (request.pairingPhase === 'formal') {
			payload.supported_tools = [];
		}
		const wire = await unary(payload);
		return mapConnectResponse(wire);
	}

	close(): void {
		if (this._alive) {
			this._alive = false;
			this._channel.close();
		}
	}

	async probeRpc(service: string, method: string): Promise<number> {
		return new Promise<number>(resolve => {
			const path = `/${service}/${method}`;
			this._channel.makeUnaryRequest(
				path,
				() => Buffer.from('{}'),
				(buffer: Buffer) => buffer,
				{},
				(error: grpc.ServiceError | null) => resolve(grpcErrorCode(error)),
			);
		});
	}

	async listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListSessionsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.List,
		);
		const wire = await unary({
			limit: request.limit,
			offset: request.offset,
		});
		return mapListSessionsResponse(wire);
	}

	async createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, CreateSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Create,
		);
		const wire = await unary({
			title: request.title,
			model: request.model,
		});
		return { sessionId: wire.session_id ?? '' };
	}

	async deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void> {
		const unary = makeUnaryClient<Record<string, unknown>, Record<string, never>>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Delete,
		);
		await unary({ session_id: request.sessionId });
	}

	async getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetHistoryResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.GetHistory,
		);
		const wire = await unary({
			session_id: request.sessionId,
			cursor_seq: request.cursorSeq,
			limit: request.limit,
		});
		return mapGetHistoryResponse(wire);
	}

	subscribeSessionEventStream(sessionId: string, listener: (event: UniverseAgentSessionEvent) => void): { dispose(): void } {
		const stream = makeServerStreamClient<Record<string, unknown>, UniverseAgentSessionEvent>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.SessionEventStream,
		);
		return stream({ session_id: sessionId }, listener);
	}

	async chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void> {
		const bidi = makeBidiStreamClient<Record<string, unknown>, UniverseAgentChatResponse>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Chat,
		);
		await bidi({ session_id: request.sessionId, payload: request.payload }, onResponse);
	}

	openChatStream(
		sessionId: string,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentChatStream {
		const open = makeResidentBidiStreamClient<UniverseAgentChatResponse>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Chat,
		);
		return open(sessionId, onResponse, onClosed);
	}

	async listSkills(): Promise<UniverseAgentListSkillsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListSkillsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.ListSkills,
		);
		const wire = await unary({});
		return mapListSkillsResponse(wire);
	}

	async setSkillEnabled(request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SetSkillEnabledResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SetSkillEnabled,
		);
		const wire = await unary({
			skill_name: request.skillName,
			enabled: request.enabled,
		});
		return mapSetSkillEnabledResponse(wire);
	}

	async getSkillInfo(request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SkillInfoResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SkillInfo,
		);
		const wire = await unary({ skill_name: request.skillName });
		return mapSkillInfoResponse(wire);
	}

	async saveSkillContent(request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SaveSkillContentResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SaveSkillContent,
		);
		const wire = await unary({
			skill_name: request.skillName,
			content: request.content,
		});
		return mapSaveSkillContentResponse(wire);
	}

	async listAgentProfiles(request: UniverseAgentListAgentProfilesRequest): Promise<UniverseAgentListAgentProfilesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListAgentProfilesResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ListAgentProfiles,
		);
		const payload: Record<string, unknown> = {};
		if (request.projectPath) {
			payload.project_path = request.projectPath;
		}
		const wire = await unary(payload);
		return mapListAgentProfilesResponse(wire);
	}

	async saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest): Promise<UniverseAgentSaveAgentProfileResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SaveAgentProfileResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SaveAgentProfile,
		);
		const wire = await unary({
			profile: mapAgentProfileDetailToWire(request.profile),
		});
		return mapSaveAgentProfileResponse(wire);
	}

	async deleteAgentProfile(request: UniverseAgentDeleteAgentProfileRequest): Promise<UniverseAgentDeleteAgentProfileResult> {
		const unary = makeUnaryClient<Record<string, unknown>, DeleteAgentProfileResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.DeleteAgentProfile,
		);
		const wire = await unary({ id: request.id });
		return mapDeleteAgentProfileResponse(wire);
	}

	async resetAgentProfile(request: UniverseAgentResetAgentProfileRequest): Promise<UniverseAgentResetAgentProfileResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ResetAgentProfileResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ResetAgentProfile,
		);
		const wire = await unary({ id: request.id });
		return mapResetAgentProfileResponse(wire);
	}

	async listMcpServers(request: UniverseAgentListMcpServersRequest): Promise<UniverseAgentListMcpServersResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListMcpServersResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.ListMcpServers,
		);
		const payload: Record<string, unknown> = {};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		if (request.enabledOnly !== undefined) {
			payload.enabled_only = request.enabledOnly;
		}
		const wire = await unary(payload);
		return mapListMcpServersResponse(wire);
	}

	async getMcpServerStatuses(serverIds?: readonly string[]): Promise<UniverseAgentGetMcpServerStatusesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetMcpServerStatusesResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.GetMcpServerStatuses,
		);
		const payload: Record<string, unknown> = {};
		if (serverIds && serverIds.length > 0) {
			payload.server_ids = [...serverIds];
		}
		const wire = await unary(payload);
		return mapGetMcpServerStatusesResponse(wire);
	}

	async getMcpServerTools(serverId: string, forceRefresh?: boolean): Promise<UniverseAgentGetMcpServerToolsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetMcpServerToolsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.GetMcpServerTools,
		);
		const wire = await unary({
			server_id: serverId,
			force_refresh: forceRefresh === true,
		});
		return mapGetMcpServerToolsResponse(wire);
	}

	async listPlugins(): Promise<UniverseAgentListPluginsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListPluginsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.List,
		);
		const wire = await unary({});
		return mapListPluginsResponse(wire);
	}

	async getPluginInfo(id: string): Promise<UniverseAgentPluginInfoResult> {
		const unary = makeUnaryClient<Record<string, unknown>, PluginInfoResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Info,
		);
		const wire = await unary({ plugin_id: id });
		return mapPluginInfoResponse(wire);
	}

	async enablePlugin(id: string, enabled?: boolean): Promise<UniverseAgentEnablePluginResult> {
		const unary = makeUnaryClient<Record<string, unknown>, EnablePluginResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Enable,
		);
		const wire = await unary({
			plugin_id: id,
			enabled: enabled !== false,
		});
		return { plugin: mapPluginSummary(wire.plugin) };
	}

	async reloadPlugin(id: string): Promise<UniverseAgentReloadPluginResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ReloadPluginResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Reload,
		);
		const wire = await unary({ plugin_id: id });
		return { plugin: mapPluginSummary(wire.plugin) };
	}

	async unloadPlugin(id: string): Promise<UniverseAgentUnloadPluginResult> {
		const unary = makeUnaryClient<Record<string, unknown>, UnloadPluginResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Unload,
		);
		const wire = await unary({ plugin_id: id });
		return { removedHookCount: wire.removed_hook_count ?? 0 };
	}

	async scanNewPlugins(): Promise<UniverseAgentScanNewPluginsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ScanNewPluginsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.ScanNew,
		);
		const wire = await unary({});
		return {
			newPlugins: (wire.new_plugins ?? []).map(mapPluginSummary),
			skippedCount: wire.skipped_count ?? 0,
		};
	}

	async toggleMcpServer(request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ToggleMcpServerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.ToggleMcpServer,
		);
		const payload: Record<string, unknown> = {
			server_id: request.id,
			enabled: request.enabled,
			scope: request.scope,
		};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		const wire = await unary(payload);
		return mapToggleMcpServerResponse(wire);
	}

	async addMcpServer(request: UniverseAgentAddMcpServerRequest): Promise<UniverseAgentAddMcpServerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, AddMcpServerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.AddMcpServer,
		);
		const payload: Record<string, unknown> = {
			config: mapMcpServerConfigToWire(request.config),
			test_connection: request.testConnection === true,
			scope: request.scope,
		};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		const wire = await unary(payload);
		return mapAddMcpServerResponse(wire);
	}

	async updateMcpServer(request: UniverseAgentUpdateMcpServerRequest): Promise<UniverseAgentUpdateMcpServerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, UpdateMcpServerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.UpdateMcpServer,
		);
		const payload: Record<string, unknown> = {
			server_id: request.serverId,
			config: mapMcpServerConfigToWire(request.config),
			restart_connection: request.restartConnection === true,
			scope: request.scope,
		};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		const wire = await unary(payload);
		return mapUpdateMcpServerResponse(wire);
	}

	async removeMcpServer(request: UniverseAgentRemoveMcpServerRequest): Promise<UniverseAgentRemoveMcpServerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, RemoveMcpServerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.RemoveMcpServer,
		);
		const payload: Record<string, unknown> = {
			server_id: request.serverId,
			force: request.force === true,
			scope: request.scope,
		};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		const wire = await unary(payload);
		return mapRemoveMcpServerResponse(wire);
	}

	async listTools(): Promise<UniverseAgentListToolsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListToolsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.ListTools,
		);
		const wire = await unary({});
		return mapListToolsResponse(wire);
	}

	async listModels(): Promise<UniverseAgentListModelsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListModelsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.ListModels,
		);
		const wire = await unary({ include_disabled: true });
		return mapListModelsResponse(wire);
	}

	async fetchToolDetail(request: UniverseAgentFetchToolDetailRequest): Promise<UniverseAgentFetchToolDetailWireResult> {
		const unary = makeUnaryClient<Record<string, unknown>, FetchToolDetailResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.FetchToolDetail,
		);
		const wire = await unary({
			session_id: request.sessionId,
			tool_call_id: request.toolCallId,
			detail_kind: request.detailKind,
			ref_id: request.refId,
			subscribe: false,
		});
		return {
			success: wire.success === true,
			content: wire.content ?? '',
			truncated: wire.truncated === true,
			...(typeof wire.total_bytes === 'number' && Number.isFinite(wire.total_bytes)
				? { totalBytes: wire.total_bytes }
				: {}),
			...(wire.error_message ? { errorMessage: wire.error_message } : {}),
		};
	}

	async fetchAgentTree(sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined> {
		const unary = makeUnaryClient<Record<string, unknown>, AgentTreeResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Tree,
		);
		const wire = await unary({ session_id: sessionId });
		return mapAgentTreeNode(wire.root);
	}

	async memberStatus(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamMemberInfo[]> {
		const unary = makeUnaryClient<Record<string, unknown>, MemberStatusResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.MemberStatus,
		);
		const wire = await unary({ session_id: sessionId, agent_id: agentId });
		return (wire.members ?? []).map(mapMemberInfo);
	}

	async taskList(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamTaskInfo[]> {
		const unary = makeUnaryClient<Record<string, unknown>, TaskListResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.TaskList,
		);
		const wire = await unary({ session_id: sessionId, agent_id: agentId });
		return (wire.tasks ?? []).map(mapTaskInfo);
	}

	async teamInfo(sessionId: string, agentId: string, teamId: number): Promise<UniverseAgentTeamInfo | undefined> {
		const unary = makeUnaryClient<Record<string, unknown>, TeamInfoResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.TeamInfo,
		);
		const wire = await unary({ session_id: sessionId, agent_id: agentId, team_id: teamId });
		if (wire.team_id === undefined) {
			return undefined;
		}
		return { teamId: wire.team_id, status: wire.status ?? '' };
	}
}

export function createGrpcUniverseAgentClient(address: string): IUniverseAgentGrpcTransport {
	return new GrpcUniverseAgentClient({ address });
}

export function createPinnedGrpcUniverseAgentClient(target: UniverseAgentPinnedTlsTarget): IUniverseAgentGrpcTransport {
	return new GrpcUniverseAgentClient({
		address: target.address,
		credentials: createPinnedTlsChannelCredentials(target.tls),
		channelOptions: createPinnedChannelOptions(target.sslTargetNameOverride),
	});
}
