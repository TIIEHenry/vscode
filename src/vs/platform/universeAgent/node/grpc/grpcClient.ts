/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as grpc from '@grpc/grpc-js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import type {
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
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
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentSkillSource,
	UniverseAgentSkillSummary,
	UniverseAgentListAgentProfilesRequest,
	UniverseAgentListAgentProfilesResult,
	UniverseAgentAgentProfileSource,
	UniverseAgentAgentProfileSummary,
	UniverseAgentListMcpServersRequest,
	UniverseAgentListMcpServersResult,
	UniverseAgentMcpServerOrigin,
	UniverseAgentMcpTransport,
	UniverseAgentMcpServerSummary,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentToggleMcpServerResult,
	UniverseAgentListToolsResult,
	UniverseAgentToolSummary,
	UniverseAgentAgentTreeNode,
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
			payload: envelope.payload,
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

function mapAgentProfileSummary(wire: NonNullable<ListAgentProfilesResponseWire['profiles']>[number]): UniverseAgentAgentProfileSummary {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		source: mapAgentProfileSource(wire.source),
		summary: wire.summary,
		enabled: wire.enabled,
	};
}

function mapListAgentProfilesResponse(wire: ListAgentProfilesResponseWire): UniverseAgentListAgentProfilesResult {
	return {
		profiles: (wire.profiles ?? []).map(mapAgentProfileSummary),
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

interface ToggleMcpServerResponseWire {
	ok?: boolean;
	reason?: string;
}

function mapToggleMcpServerResponse(wire: ToggleMcpServerResponseWire): UniverseAgentToggleMcpServerResult {
	return {
		ok: wire.ok === true,
		reason: wire.reason,
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

	async toggleMcpServer(request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ToggleMcpServerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.ToggleMcpServer,
		);
		const payload: Record<string, unknown> = {
			id: request.id,
			enabled: request.enabled,
			scope: request.scope,
		};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		const wire = await unary(payload);
		return mapToggleMcpServerResponse(wire);
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
