/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

pub const COMMIT_HASH_LEN: usize = 40;

/// Returns whether the string looks like a commit hash (40 ASCII hex digits).
pub fn is_commit_hash(s: &str) -> bool {
	s.len() == COMMIT_HASH_LEN && s.chars().all(|c| c.is_ascii_hexdigit())
}
