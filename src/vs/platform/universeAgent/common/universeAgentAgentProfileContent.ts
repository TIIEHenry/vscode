/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../nls.js';
import type { UniverseAgentAgentProfileDetail } from './universeAgentTypes.js';

const AGENT_PROFILE_INSTRUCTIONS_REQUIRED = localize('universeAgent.profileInstructionsRequired', "Instructions are required.");

/** Kotlin Char.isWhitespace: JVM whitespace or space characters, excluding the JS-only BOM. */
function isProfileWhitespace(code: number): boolean {
	return (code >= 0x09 && code <= 0x0d)
		|| (code >= 0x1c && code <= 0x20)
		|| code === 0xa0 || code === 0x1680
		|| (code >= 0x2000 && code <= 0x200a)
		|| code === 0x2028 || code === 0x2029 || code === 0x202f
		|| code === 0x205f || code === 0x3000;
}

/** Check the raw Instructions in PIN loader order without normalizing or parsing the body. */
export function getAgentProfileContentIssue(profile: Pick<UniverseAgentAgentProfileDetail, 'systemPrompt'>): string | undefined {
	const body = profile.systemPrompt;
	if (typeof body !== 'string') {
		return AGENT_PROFILE_INSTRUCTIONS_REQUIRED;
	}
	let end = body.length;
	// PIN first removes trailing characters <= U+0020. Doing this after the
	// Unicode blank check would accept a body consisting solely of NUL.
	while (end > 0 && body.charCodeAt(end - 1) <= 0x20) {
		end--;
	}
	for (let index = 0; index < end; index++) {
		if (!isProfileWhitespace(body.charCodeAt(index))) {
			return undefined;
		}
	}
	return AGENT_PROFILE_INSTRUCTIONS_REQUIRED;
}
