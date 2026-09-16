/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentDeleteMemoryRequest,
	UniverseAgentMemoryHistoryRequest,
	UniverseAgentMemoryListRequest,
	UniverseAgentMemorySearchDeepRequest,
	UniverseAgentMemorySearchRequest,
	UniverseAgentReadMemoryRequest,
	UniverseAgentReflectMemoryRequest,
	UniverseAgentRevertMemoryRequest,
	UniverseAgentSaveMemoryRequest,
} from '../../common/universeAgentTypes.js';
import type {
	MemoryCategoryInfoWire,
	MemoryChangeEntryWire,
	MemoryDeleteResponseWire,
	MemoryFileMetadataWire,
	MemoryFileSummaryWire,
	MemoryHistoryResponseWire,
	MemoryListResponseWire,
	MemoryReadResponseWire,
	MemoryReflectDiagnosisWire,
	MemoryReflectResponseWire,
	MemoryRevertResponseWire,
	MemorySaveResponseWire,
	MemorySearchDeepResponseWire,
	MemorySearchResponseWire,
	MemorySearchResultWire,
} from './grpcClientMappersCatalog.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
	type ProtoField,
} from './grpcProtoCodec.js';

/**
 * MemoryService.Save — `scope`=1 `content`=2 `category`=3.
 * proto3: empty strings omitted.
 */
export function encodeMemorySaveRequest(request: UniverseAgentSaveMemoryRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.content),
		encodeStringField(3, request.category),
	]);
}

/**
 * MemorySaveResponse — `success`=1 `message`=2 `file_path`=3.
 * Unknown fields unread.
 */
export function decodeMemorySaveResponse(bytes: Uint8Array): MemorySaveResponseWire {
	const fields = readProtoFields(bytes);
	return {
		success: lastVarint(fields, 1) === 1n,
		message: lastString(fields, 2),
		file_path: lastString(fields, 3),
	};
}

/**
 * MemoryService.Search — `scope`=1 `query`=2 repeated `keywords`=3 `limit`=4.
 * proto3: empty strings / 0 omitted.
 */
export function encodeMemorySearchRequest(request: UniverseAgentMemorySearchRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.query),
		encodeRepeatedString(3, request.keywords),
		encodeInt32Field(4, request.limit),
	]);
}

/**
 * MemorySearchResponse — repeated `results`=1.
 * MemorySearchResult: `category`=1 `filename`=2 `title`=3 `score`=4 (double,
 * codec has no encode/decode double — unread) `snippet`=5 `forgot`=6 `scope`=7.
 * Unknown fields unread.
 */
export function decodeMemorySearchResponse(bytes: Uint8Array): MemorySearchResponseWire {
	return {
		results: allLengthDelimited(readProtoFields(bytes), 1).map(decodeMemorySearchResult),
	};
}

/**
 * MemoryService.SearchDeep — `scope`=1 `query`=2 repeated `keywords`=3
 * repeated `categories`=4 `limit`=5 `include_content`=6.
 * proto3: empty strings / 0 / false omitted.
 */
export function encodeMemorySearchDeepRequest(request: UniverseAgentMemorySearchDeepRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.query),
		encodeRepeatedString(3, request.keywords),
		encodeRepeatedString(4, request.categories),
		encodeInt32Field(5, request.limit),
		encodeInt32Field(6, request.includeContent === true ? 1 : 0),
	]);
}

/**
 * MemorySearchDeepResponse — repeated `results`=1 repeated `searched_categories`=2.
 * SearchResult score=4 unread (see decodeMemorySearchResult). Unknown fields unread.
 */
export function decodeMemorySearchDeepResponse(bytes: Uint8Array): MemorySearchDeepResponseWire {
	const fields = readProtoFields(bytes);
	return {
		results: allLengthDelimited(fields, 1).map(decodeMemorySearchResult),
		searched_categories: decodeRepeatedUtf8(fields, 2),
	};
}

/**
 * MemoryService.Read — `scope`=1 `category`=2 `filename`=3 `section`=4
 * `mode`=5 `forgot`=6. proto3: empty strings / false omitted.
 */
export function encodeMemoryReadRequest(request: UniverseAgentReadMemoryRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.category),
		encodeStringField(3, request.filename),
		encodeStringField(4, request.section),
		encodeStringField(5, request.mode),
		encodeInt32Field(6, request.forgot === true ? 1 : 0),
	]);
}

/**
 * MemoryReadResponse — `content`=1 `metadata`=2.
 * MemoryFileMetadata: `category`=1 `filename`=2 `title`=3 repeated `tags`=4
 * `created_at`=5 `updated_at`=6 `version`=7. Unknown fields unread.
 */
export function decodeMemoryReadResponse(bytes: Uint8Array): MemoryReadResponseWire {
	const fields = readProtoFields(bytes);
	const metadata = lastBytes(fields, 2);
	return {
		content: lastString(fields, 1),
		metadata: metadata ? decodeMemoryFileMetadata(metadata) : undefined,
	};
}

/**
 * MemoryService.List — `scope`=1 `category`=2.
 * proto3: empty strings omitted.
 */
export function encodeMemoryListRequest(request: UniverseAgentMemoryListRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.category),
	]);
}

/**
 * MemoryListResponse — repeated `categories`=1.
 * MemoryCategoryInfo: `category`=1 repeated `files`=2 `file_count`=3.
 * MemoryFileSummary: `filename`=1 `title`=2 `updated_at`=3.
 * Unknown fields unread.
 */
export function decodeMemoryListResponse(bytes: Uint8Array): MemoryListResponseWire {
	return {
		categories: allLengthDelimited(readProtoFields(bytes), 1).map(decodeMemoryCategoryInfo),
	};
}

/**
 * MemoryService.Delete — `scope`=1 `category`=2 `filename`=3.
 * proto3: empty strings omitted.
 */
export function encodeMemoryDeleteRequest(request: UniverseAgentDeleteMemoryRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.category),
		encodeStringField(3, request.filename),
	]);
}

/**
 * MemoryDeleteResponse — `success`=1 `message`=2. Unknown fields unread.
 */
export function decodeMemoryDeleteResponse(bytes: Uint8Array): MemoryDeleteResponseWire {
	const fields = readProtoFields(bytes);
	return {
		success: lastVarint(fields, 1) === 1n,
		message: lastString(fields, 2),
	};
}

/**
 * MemoryService.Reflect — `scope`=1 repeated `categories`=2.
 * proto3: empty strings omitted.
 */
export function encodeMemoryReflectRequest(request: UniverseAgentReflectMemoryRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeRepeatedString(2, request.categories),
	]);
}

/**
 * MemoryReflectResponse — repeated `diagnoses`=1 `summary`=2.
 * ReflectDiagnosis: `type`=1 `category`=2 `filename`=3 `description`=4 `suggestion`=5.
 * Unknown fields unread.
 */
export function decodeMemoryReflectResponse(bytes: Uint8Array): MemoryReflectResponseWire {
	const fields = readProtoFields(bytes);
	return {
		diagnoses: allLengthDelimited(fields, 1).map(decodeMemoryReflectDiagnosis),
		summary: lastString(fields, 2),
	};
}

/**
 * MemoryService.Revert — `scope`=1 `category`=2 `filename`=3 `target_version`=4.
 * proto3: empty strings / 0 omitted.
 */
export function encodeMemoryRevertRequest(request: UniverseAgentRevertMemoryRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.category),
		encodeStringField(3, request.filename),
		encodeInt32Field(4, request.targetVersion),
	]);
}

/**
 * MemoryRevertResponse — `success`=1 `message`=2 `reverted_to_version`=3.
 * Unknown fields unread.
 */
export function decodeMemoryRevertResponse(bytes: Uint8Array): MemoryRevertResponseWire {
	const fields = readProtoFields(bytes);
	return {
		success: lastVarint(fields, 1) === 1n,
		message: lastString(fields, 2),
		reverted_to_version: numberOrUndefined(lastVarint(fields, 3)),
	};
}

/**
 * MemoryService.History — `scope`=1 `category`=2 `filename`=3 `limit`=4.
 * proto3: empty strings / 0 omitted.
 */
export function encodeMemoryHistoryRequest(request: UniverseAgentMemoryHistoryRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.category),
		encodeStringField(3, request.filename),
		encodeInt32Field(4, request.limit),
	]);
}

/**
 * MemoryHistoryResponse — repeated `changes`=1.
 * MemoryChangeEntry: `version`=1 `change_type`=2 `summary`=3 `timestamp`=4 `author`=5.
 * Unknown fields unread.
 */
export function decodeMemoryHistoryResponse(bytes: Uint8Array): MemoryHistoryResponseWire {
	return {
		changes: allLengthDelimited(readProtoFields(bytes), 1).map(decodeMemoryChangeEntry),
	};
}

function decodeMemorySearchResult(bytes: Uint8Array): MemorySearchResultWire {
	const fields = readProtoFields(bytes);
	return {
		category: lastString(fields, 1),
		filename: lastString(fields, 2),
		title: lastString(fields, 3),
		snippet: lastString(fields, 5),
		forgot: lastVarint(fields, 6) === 1n,
		scope: lastString(fields, 7),
	};
}

function decodeMemoryFileMetadata(bytes: Uint8Array): MemoryFileMetadataWire {
	const fields = readProtoFields(bytes);
	return {
		category: lastString(fields, 1),
		filename: lastString(fields, 2),
		title: lastString(fields, 3),
		tags: decodeRepeatedUtf8(fields, 4),
		created_at: numberOrUndefined(lastVarint(fields, 5)),
		updated_at: numberOrUndefined(lastVarint(fields, 6)),
		version: numberOrUndefined(lastVarint(fields, 7)),
	};
}

function decodeMemoryCategoryInfo(bytes: Uint8Array): MemoryCategoryInfoWire {
	const fields = readProtoFields(bytes);
	return {
		category: lastString(fields, 1),
		files: allLengthDelimited(fields, 2).map(decodeMemoryFileSummary),
		file_count: numberOrUndefined(lastVarint(fields, 3)),
	};
}

function decodeMemoryFileSummary(bytes: Uint8Array): MemoryFileSummaryWire {
	const fields = readProtoFields(bytes);
	return {
		filename: lastString(fields, 1),
		title: lastString(fields, 2),
		updated_at: numberOrUndefined(lastVarint(fields, 3)),
	};
}

function decodeMemoryReflectDiagnosis(bytes: Uint8Array): MemoryReflectDiagnosisWire {
	const fields = readProtoFields(bytes);
	return {
		type: lastString(fields, 1),
		category: lastString(fields, 2),
		filename: lastString(fields, 3),
		description: lastString(fields, 4),
		suggestion: lastString(fields, 5),
	};
}

function decodeMemoryChangeEntry(bytes: Uint8Array): MemoryChangeEntryWire {
	const fields = readProtoFields(bytes);
	return {
		version: numberOrUndefined(lastVarint(fields, 1)),
		change_type: lastString(fields, 2),
		summary: lastString(fields, 3),
		timestamp: numberOrUndefined(lastVarint(fields, 4)),
		author: lastString(fields, 5),
	};
}

function decodeRepeatedUtf8(fields: readonly ProtoField[], field: number): string[] {
	return allLengthDelimited(fields, field).map(value => Buffer.from(value).toString('utf8'));
}

function encodeRepeatedString(field: number, values: readonly string[]): Buffer {
	if (values.length === 0) {
		return Buffer.alloc(0);
	}
	return Buffer.concat(values.map(value => encodeStringField(field, value)));
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
