/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { X509Certificate } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { homedir as osHomedir } from 'node:os';
import { join, resolve } from 'node:path';
import { deriveEngineLeafFingerprintHex, type PinnedTlsPlanInput } from './deviceGrant/tls-pin.js';
import { createLocalPinnedGrpcClient, createLocalUdsGrpcClient, type GrpcUniverseAgentClient } from './grpc/grpcClient.js';
import { loadGrpcModule } from './universeAgentChannel.js';

/** HealthCheck budget for a candidate that already passed the file anchor. */
export const LOCAL_ENGINE_PROBE_DEADLINE_MS = 800;

const SERVER_SOCK = 'server.sock';
const SERVER_LOCK = 'server.lock';
const ENGINE_TLS_CERT = 'engine-tls.crt';

export type LocalEngineTarget =
	| { readonly kind: 'uds'; readonly path: string }
	| { readonly kind: 'tcp'; readonly address: string; readonly tls: PinnedTlsPlanInput };

export interface LocalEngineFileStat {
	readonly uid: number;
	readonly mode: number;
	readonly isSymbolicLink: boolean;
	readonly isSocket: boolean;
	readonly isDirectory: boolean;
	readonly isFile: boolean;
}

export interface LocalEngineDiscoveryFs {
	lstat(path: string): Promise<LocalEngineFileStat>;
	readFile(path: string): Promise<Uint8Array>;
}

export interface LocalEngineDiscoveryDeps {
	readonly env?: NodeJS.ProcessEnv;
	readonly homedir?: string;
	readonly uid?: number;
	readonly platform?: NodeJS.Platform;
	readonly fs?: LocalEngineDiscoveryFs;
	/** `false` only when `kill(pid, 0)` failed with `ESRCH`. */
	readonly isPidAlive?: (pid: number) => boolean;
	readonly probeHealth?: (target: LocalEngineTarget) => Promise<boolean>;
	readonly deadlineMs?: number;
}

/**
 * `UNIVERSE_AGENT_HOME` when it is non-empty, otherwise `~/.universe-agent`.
 * Relative values become absolute. Only the main process calls this.
 */
export function resolveLocalEngineHome(env: NodeJS.ProcessEnv, homedir: string): string {
	const configured = env.UNIVERSE_AGENT_HOME;
	if (typeof configured === 'string' && configured.length > 0) {
		return resolve(configured);
	}
	return resolve(join(homedir, '.universe-agent'));
}

/** POSIX owner-only: same uid and no group/other permission bits. */
export function checkOwnerOnly(stat: { readonly uid: number; readonly mode: number }, uid: number): boolean {
	return stat.uid === uid && (stat.mode & 0o077) === 0;
}

/** Windows skips the mode check and still requires the owner uid. */
export function localEngineOwnerOk(
	stat: { readonly uid: number; readonly mode: number },
	uid: number,
	platform: NodeJS.Platform,
): boolean {
	if (platform === 'win32') {
		return stat.uid === uid;
	}
	return checkOwnerOnly(stat, uid);
}

/**
 * `kill(pid, 0)` throws `ESRCH` for a stale lock. Any other error does not block.
 */
export function localEnginePidAlive(
	pid: number,
	kill: (pid: number, signal: number) => boolean = process.kill,
): boolean {
	try {
		kill(pid, 0);
		return true;
	} catch (error) {
		const code = error && typeof error === 'object' && 'code' in error
			? (error as { code?: unknown }).code
			: undefined;
		return code !== 'ESRCH';
	}
}

/** First PEM certificate in the file, as DER. Later certificates are ignored. */
export function localEngineCertificateDer(bytes: Uint8Array): Uint8Array | undefined {
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return undefined;
	}
	const match = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/.exec(text);
	if (!match) {
		return undefined;
	}
	try {
		return new Uint8Array(new X509Certificate(match[0]).raw);
	} catch {
		return undefined;
	}
}

const defaultFs: LocalEngineDiscoveryFs = {
	async lstat(path: string): Promise<LocalEngineFileStat> {
		const stat = await lstat(path);
		return {
			uid: stat.uid,
			mode: stat.mode,
			isSymbolicLink: stat.isSymbolicLink(),
			isSocket: stat.isSocket(),
			isDirectory: stat.isDirectory(),
			isFile: stat.isFile(),
		};
	},
	async readFile(path: string): Promise<Uint8Array> {
		const noFollow = fsConstants.O_NOFOLLOW ?? 0;
		const handle = await open(path, fsConstants.O_RDONLY | noFollow);
		try {
			const data = await handle.readFile();
			return Uint8Array.from(data);
		} finally {
			await handle.close();
		}
	},
};

function currentUid(): number {
	return typeof process.getuid === 'function' ? process.getuid() : 0;
}

/**
 * UDS in an owner-only home directory, otherwise a loopback `server.lock` plus
 * the pinned `engine-tls.crt`. Missing, permissive, or unreadable anchors are
 * a miss. `server.lock`'s `token` is not a credential.
 */
export async function findLocalEngine(deps: LocalEngineDiscoveryDeps = {}): Promise<LocalEngineTarget | undefined> {
	const env = deps.env ?? process.env;
	const home = resolveLocalEngineHome(env, deps.homedir ?? osHomedir());
	const uid = deps.uid ?? currentUid();
	const platform = deps.platform ?? process.platform;
	const fileSystem = deps.fs ?? defaultFs;
	const pidAlive = deps.isPidAlive ?? localEnginePidAlive;
	const deadlineMs = deps.deadlineMs ?? LOCAL_ENGINE_PROBE_DEADLINE_MS;
	const probeHealth = deps.probeHealth ?? ((target: LocalEngineTarget) => probeLocalEngineHealth(target, deadlineMs));

	const homeStat = await readStat(fileSystem, home);
	if (!homeStat || homeStat.isSymbolicLink || !homeStat.isDirectory) {
		return undefined;
	}

	if (platform !== 'win32') {
		const uds = await readUdsTarget(fileSystem, home, homeStat, uid, platform);
		if (uds && await acceptsHealth(probeHealth, uds)) {
			return uds;
		}
	}

	const tcp = await readTcpTarget(fileSystem, home, uid, platform, pidAlive);
	if (!tcp || !await acceptsHealth(probeHealth, tcp)) {
		return undefined;
	}
	return tcp;
}

/** Long-lived transport for a target `findLocalEngine` already accepted. No relay. */
export function createDiscoveredLocalEngineClient(target: LocalEngineTarget, unaryDeadlineMs?: number): GrpcUniverseAgentClient {
	if (target.kind === 'uds') {
		return createLocalUdsGrpcClient(target.path, unaryDeadlineMs);
	}
	return createLocalPinnedGrpcClient(target.address, target.tls, unaryDeadlineMs);
}

async function probeLocalEngineHealth(target: LocalEngineTarget, timeoutMs: number): Promise<boolean> {
	await loadGrpcModule();
	const client = createDiscoveredLocalEngineClient(target, timeoutMs);
	try {
		await client.healthCheck();
		return true;
	} catch {
		return false;
	} finally {
		client.close();
	}
}

async function acceptsHealth(
	probe: (target: LocalEngineTarget) => Promise<boolean>,
	target: LocalEngineTarget,
): Promise<boolean> {
	try {
		return await probe(target) === true;
	} catch {
		return false;
	}
}

async function readStat(fileSystem: LocalEngineDiscoveryFs, path: string): Promise<LocalEngineFileStat | undefined> {
	try {
		return await fileSystem.lstat(path);
	} catch {
		return undefined;
	}
}

async function readUdsTarget(
	fileSystem: LocalEngineDiscoveryFs,
	home: string,
	homeStat: LocalEngineFileStat,
	uid: number,
	platform: NodeJS.Platform,
): Promise<LocalEngineTarget | undefined> {
	if (!localEngineOwnerOk(homeStat, uid, platform)) {
		return undefined;
	}
	const sockPath = join(home, SERVER_SOCK);
	const sockStat = await readStat(fileSystem, sockPath);
	if (!sockStat || sockStat.isSymbolicLink || !sockStat.isSocket) {
		return undefined;
	}
	return { kind: 'uds', path: sockPath };
}

async function readTcpTarget(
	fileSystem: LocalEngineDiscoveryFs,
	home: string,
	uid: number,
	platform: NodeJS.Platform,
	pidAlive: (pid: number) => boolean,
): Promise<LocalEngineTarget | undefined> {
	const lockBytes = await readOwnedFile(fileSystem, join(home, SERVER_LOCK), uid, platform);
	if (!lockBytes) {
		return undefined;
	}
	const lock = parseServerLock(lockBytes);
	if (!lock) {
		return undefined;
	}
	if (lock.pid !== undefined && !pidStillAlive(pidAlive, lock.pid)) {
		return undefined;
	}
	const certBytes = await readOwnedFile(fileSystem, join(home, ENGINE_TLS_CERT), uid, platform);
	if (!certBytes) {
		return undefined;
	}
	const der = localEngineCertificateDer(certBytes);
	if (!der || der.byteLength === 0) {
		return undefined;
	}
	const expectedLeafSha256Hex = deriveEngineLeafFingerprintHex(der);
	return {
		kind: 'tcp',
		address: lock.bind === '::1' ? `[::1]:${lock.port}` : `127.0.0.1:${lock.port}`,
		tls: {
			trustAnchorLeafDer: der,
			expectedLeafSha256Hex,
			hostnameVerification: 'replaced-by-pin',
		},
	};
}

function pidStillAlive(pidAlive: (pid: number) => boolean, pid: number): boolean {
	try {
		return pidAlive(pid) !== false;
	} catch {
		return true;
	}
}

async function readOwnedFile(
	fileSystem: LocalEngineDiscoveryFs,
	path: string,
	uid: number,
	platform: NodeJS.Platform,
): Promise<Uint8Array | undefined> {
	const stat = await readStat(fileSystem, path);
	if (!stat || stat.isSymbolicLink || !stat.isFile || !localEngineOwnerOk(stat, uid, platform)) {
		return undefined;
	}
	try {
		return await fileSystem.readFile(path);
	} catch {
		return undefined;
	}
}

interface ParsedServerLock {
	readonly port: number;
	readonly bind: string;
	readonly pid: number | undefined;
}

function parseServerLock(bytes: Uint8Array): ParsedServerLock | undefined {
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return undefined;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return undefined;
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return undefined;
	}
	const record = parsed as Record<string, unknown>;
	const port = loopbackPort(record.port);
	const bind = record.bind;
	if (port === undefined || typeof bind !== 'string' || !isLoopbackBind(bind)) {
		return undefined;
	}
	return { port, bind, pid: positivePid(record.pid) };
}

function loopbackPort(value: unknown): number | undefined {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65535) {
		return undefined;
	}
	return value;
}

function positivePid(value: unknown): number | undefined {
	if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
		return undefined;
	}
	return value;
}

/** `127.0.0.0/8` or the literal `::1`. Hostnames, wildcards, and bracket forms are not loopback. */
function isLoopbackBind(bind: string): boolean {
	if (bind === '::1') {
		return true;
	}
	const parts = bind.split('.');
	if (parts.length !== 4) {
		return false;
	}
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (!/^(0|[1-9]\d{0,2})$/.test(part)) {
			return false;
		}
		const octet = Number(part);
		if (octet > 255) {
			return false;
		}
		if (i === 0 && octet !== 127) {
			return false;
		}
	}
	return true;
}
