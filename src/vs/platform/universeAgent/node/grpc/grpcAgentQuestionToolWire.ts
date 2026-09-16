/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentCanvasRef,
	UniverseAgentQuestionAnswer,
	UniverseAgentRespondQuestionRequest,
	UniverseAgentRespondQuestionResult,
	UniverseAgentSendClientToolResponseRequest,
	UniverseAgentSendClientToolResponseResult,
} from '../../common/universeAgentTypes.js';
import {
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * Agent.RespondQuestion — `session_id` = 1, nested `QuestionResponse` = 2.
 * QuestionResponse: `question_id` = 1, map `answers` = 2, `custom_text` = 3.
 * MapEntry: `key` = 1 (string question_item_id), `value` = 2 (QuestionAnswer message, not string).
 * QuestionAnswer: repeated `selected_labels` = 1.
 * proto3: empty / default omitted (empty nested QuestionResponse does not emit field 2).
 */
export function encodeRespondQuestionRequest(request: UniverseAgentRespondQuestionRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeMessageField(2, encodeQuestionResponse(request)),
	]);
}

function encodeQuestionResponse(request: UniverseAgentRespondQuestionRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.questionId),
		encodeQuestionAnswersMap(request.answers),
		encodeStringField(3, request.customText),
	]);
}

function encodeQuestionAnswersMap(answers: Readonly<Record<string, UniverseAgentQuestionAnswer>> | undefined): Buffer {
	if (!answers) {
		return Buffer.alloc(0);
	}
	return Buffer.concat(Object.entries(answers).map(([itemId, answer]) => encodeMessageField(2, Buffer.concat([
		encodeStringField(1, itemId),
		encodeMessageField(2, encodeRepeatedString(1, answer.selectedLabels)),
	]))));
}

/**
 * RespondQuestionResponse — `success` = 1, `error` = 2. Unknown fields unread.
 */
export function decodeRespondQuestionResponse(bytes: Uint8Array): UniverseAgentRespondQuestionResult {
	const fields = readProtoFields(bytes);
	return {
		ok: lastVarint(fields, 1) === 1n,
		message: lastString(fields, 2),
	};
}

/**
 * Agent.SendClientToolResponse — `session_id` = 1, nested `ClientToolResponse` = 2.
 * ClientToolResponse: `call_id` = 1, `is_error` = 2, `content` = 3, `metadata_json` = 4,
 * repeated `CanvasRefData canvas_refs` = 5.
 * CanvasRefData: `canvas_id` = 1, `revision_id` = 2, `title` = 3, optional `source_hash` = 4 (empty omit).
 * proto3: false / empty / 0 omitted (empty nested ClientToolResponse does not emit field 2).
 */
export function encodeSendClientToolResponseRequest(request: UniverseAgentSendClientToolResponseRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeMessageField(2, encodeClientToolResponse(request)),
	]);
}

function encodeClientToolResponse(request: UniverseAgentSendClientToolResponseRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.callId),
		encodeInt32Field(2, request.isError === true ? 1 : 0),
		encodeStringField(3, request.content),
		encodeStringField(4, request.metadataJson),
		encodeCanvasRefs(request.canvasRefs),
	]);
}

function encodeCanvasRefs(refs: readonly UniverseAgentCanvasRef[] | undefined): Buffer {
	if (!refs || refs.length === 0) {
		return Buffer.alloc(0);
	}
	return Buffer.concat(refs.map(ref => encodeMessageField(5, Buffer.concat([
		encodeStringField(1, ref.canvasId),
		encodeStringField(2, ref.revisionId),
		encodeStringField(3, ref.title),
		encodeStringField(4, ref.sourceHash),
	]))));
}

/**
 * SendClientToolResponseResponse — `success` = 1, `error` = 2. Unknown fields unread.
 */
export function decodeSendClientToolResponseResponse(bytes: Uint8Array): UniverseAgentSendClientToolResponseResult {
	const fields = readProtoFields(bytes);
	return {
		ok: lastVarint(fields, 1) === 1n,
		message: lastString(fields, 2),
	};
}

function encodeRepeatedString(field: number, values: readonly string[]): Buffer {
	if (values.length === 0) {
		return Buffer.alloc(0);
	}
	return Buffer.concat(values.map(value => encodeStringField(field, value)));
}
