/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { compareFileNamesDefault } from '../../../../base/common/comparers.js';
import { Schemas } from '../../../../base/common/network.js';
import { basename, isEqual, normalizePath, removeTrailingPathSeparator } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import type { ITextModel } from '../../../../editor/common/model.js';
import type { IModelService } from '../../../../editor/common/services/model.js';
import type { ITextEditorOptions, ITextResourceEditorInput } from '../../../../platform/editor/common/editor.js';
import type { UniverseAgentFileEntry, UniverseAgentListFilesRequest, UniverseAgentListFilesResult, UniverseAgentReadFileRequest } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import type { ISourcesEngineFileOrigin, ISourcesFileEntry, ISourcesFilesCollectOutcome } from './sourcesFilesModel.js';

/** In-memory text for an engine file. Not a local `file:` resource. */
export const SOURCES_ENGINE_FILE_SCHEME = 'sources-engine-file';

export interface ISourcesFilesEngineListSource {
	readonly kind: 'engine';
	readonly sessionId: string;
	readonly path: string;
}

export type ISourcesFilesListSource =
	| { readonly kind: 'workspace' }
	| ISourcesFilesEngineListSource;

const engineFileTextByPath = new Map<string, string>();

/**
 * `fileSearch` when workDir is missing, `listFiles` is missing, or workDir
 * normalizes equal to a local file workspace root. Otherwise list that workDir
 * on the engine, including when the window has no workspace folder.
 */
export function resolveSourcesFilesListSource(input: {
	readonly workspaceFolders: readonly URI[];
	readonly sessionId: string;
	readonly workDir: string | undefined;
	readonly hasListFiles: boolean;
}): ISourcesFilesListSource {
	const path = input.workDir?.trim();
	if (!path || !input.hasListFiles || sourcesFilesWorkDirIsWorkspaceRoot(path, input.workspaceFolders)) {
		return { kind: 'workspace' };
	}
	return { kind: 'engine', sessionId: input.sessionId, path };
}

/** Trailing slash is the same directory. A subdirectory of a root is not that root. */
export function sourcesFilesWorkDirIsWorkspaceRoot(workDir: string, workspaceFolders: readonly URI[]): boolean {
	const trimmed = workDir.trim();
	if (!trimmed) {
		return false;
	}
	const wanted = sourcesFilesNormalizedRoot(URI.file(trimmed));
	return workspaceFolders.some(folder => folder.scheme === Schemas.file && isEqual(wanted, sourcesFilesNormalizedRoot(folder)));
}

/**
 * Flat file catalog. `recursive` walks the workDir; directory entries are not rows.
 * `pattern` stays empty — local exclude globs are not forwarded.
 */
export function buildSourcesEngineListFilesRequest(sessionId: string, path: string, maxResults: number): UniverseAgentListFilesRequest {
	return {
		path,
		sessionId,
		recursive: true,
		pattern: '',
		maxResults,
	};
}

/** Whole file. Proto `start_line` / `end_line` / `max_bytes` 0 are sent as-is. */
export function buildSourcesEngineReadFileRequest(sessionId: string, path: string): UniverseAgentReadFileRequest {
	return {
		path,
		sessionId,
		startLine: 0,
		endLine: 0,
		maxBytes: 0,
	};
}

export function sourcesEngineFileText(content: Uint8Array): string {
	return VSBuffer.wrap(content).toString();
}

export function sourcesEngineFileResource(enginePath: string): URI {
	const slash = enginePath.replace(/\\/g, '/');
	const path = slash.startsWith('/') ? slash : `/${slash}`;
	return URI.from({ scheme: SOURCES_ENGINE_FILE_SCHEME, path });
}

/**
 * Text editor input for engine bytes. Refuses any resource that is not
 * {@link SOURCES_ENGINE_FILE_SCHEME}, so a missing local file is not opened.
 * Resolution goes through `TextResourceEditorModel`, which is readonly.
 */
export function sourcesEngineReadonlyTextInput(
	resource: URI,
	text: string,
	label: string,
	options: ITextEditorOptions,
): ITextResourceEditorInput | undefined {
	if (resource.scheme !== SOURCES_ENGINE_FILE_SCHEME) {
		return undefined;
	}
	return {
		resource,
		contents: text,
		label,
		options,
	};
}

export function putSourcesEngineFileText(resource: URI, text: string): void {
	engineFileTextByPath.set(resource.path, text);
}

/** Test isolation. Production only moves text forward for a path. */
export function resetSourcesEngineFileTextForTests(): void {
	engineFileTextByPath.clear();
}

export function provideSourcesEngineFileText(resource: URI, modelService: IModelService): ITextModel | null {
	if (resource.scheme !== SOURCES_ENGINE_FILE_SCHEME) {
		return null;
	}
	const text = engineFileTextByPath.get(resource.path);
	if (text === undefined) {
		return null;
	}
	const existing = modelService.getModel(resource);
	if (existing && !existing.isDisposed()) {
		if (existing.getValue() !== text) {
			modelService.updateModel(existing, text);
		}
		return existing;
	}
	return modelService.createModel(text, null, resource);
}

export function projectSourcesEngineFileEntries(
	source: ISourcesFilesEngineListSource,
	result: UniverseAgentListFilesResult,
	maxResults: number,
): ISourcesFilesCollectOutcome {
	const seen = new Set<string>();
	const entries: ISourcesFileEntry[] = [];
	for (const file of result.entries) {
		const projected = projectSourcesEngineFileEntry(source, file);
		if (!projected) {
			continue;
		}
		const key = projected.resource.toString();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		entries.push(projected);
	}
	entries.sort((a, b) => compareFileNamesDefault(a.description, b.description) || compareFileNamesDefault(a.name, b.name));
	let truncated = result.total > result.entries.length;
	if (maxResults > 0 && entries.length > maxResults) {
		entries.length = maxResults;
		truncated = true;
	}
	return {
		entries,
		limitHit: truncated,
		truncated,
		failedFolders: [],
		firstFolderFailure: undefined,
	};
}

function projectSourcesEngineFileEntry(source: ISourcesFilesEngineListSource, file: UniverseAgentFileEntry): ISourcesFileEntry | undefined {
	if (file.isDirectory) {
		return undefined;
	}
	const enginePath = file.path || file.name;
	if (!enginePath) {
		return undefined;
	}
	const resource = sourcesEngineFileResource(enginePath);
	const name = file.name || basename(resource);
	const origin: ISourcesEngineFileOrigin = { sessionId: source.sessionId, path: enginePath };
	return {
		resource,
		name,
		description: sourcesEngineFileDescription(source.path, enginePath, name),
		engine: origin,
	};
}

function sourcesEngineFileDescription(workDir: string, enginePath: string, name: string): string {
	const root = normalizeEnginePath(workDir);
	const full = normalizeEnginePath(enginePath);
	if (!full || full === root) {
		return name;
	}
	const prefix = `${root}/`;
	if (root && full.startsWith(prefix)) {
		return full.slice(prefix.length);
	}
	return full.replace(/^\/+/, '') || name;
}

function normalizeEnginePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

function sourcesFilesNormalizedRoot(uri: URI): URI {
	return removeTrailingPathSeparator(normalizePath(uri));
}
