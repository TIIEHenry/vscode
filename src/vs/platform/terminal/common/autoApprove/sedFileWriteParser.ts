/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Long options of GNU sed 4.8. GNU sed accepts any unique prefix of a long option, so `--i` and
 * `--in` mean `--in-place`, and `--expr=...` means `--expression=...`.
 */
const sedLongOptions: readonly string[] = [
	'binary',
	'debug',
	'expression',
	'file',
	'follow-symlinks',
	'help',
	'in-place',
	'line-length',
	'null-data',
	'posix',
	'quiet',
	'regexp-extended',
	'sandbox',
	'separate',
	'silent',
	'unbuffered',
	'version',
	'zero-terminated',
];

/**
 * Parser for detecting file writes from `sed` commands using in-place editing.
 *
 * Handles:
 * - `sed -i 's/foo/bar/' file.txt` (GNU)
 * - `sed -i.bak 's/foo/bar/' file.txt` (GNU with backup suffix)
 * - `sed -i '' 's/foo/bar/' file.txt` (macOS/BSD with empty backup suffix)
 * - `sed --in-place 's/foo/bar/' file.txt` (GNU long form)
 * - `sed --in-place=.bak 's/foo/bar/' file.txt` (GNU long form with backup)
 * - `sed --in 's/foo/bar/' file.txt` (GNU unique abbreviation of `--in-place`)
 * - `sed "--in-place" 's/foo/bar/' file.txt` (quotes, escapes and line continuations that the
 *   shell removes before sed parses its options)
 * - `sed -I 's/foo/bar/' file.txt` (BSD case-insensitive variant)
 */
export class SedFileWriteParser {
	readonly commandName = 'sed';

	canHandle(commandText: string): boolean {
		// Check for -i, -I, or --in-place flag in the text as written first. Splitting arguments
		// can disagree with the shell (for example around `\'` inside `$'...'` or quotes inside
		// `$(...)`), so the argument check below may only add detections, never drop these.
		const inPlaceRegex = /(?:^|\s)(-[a-zA-Z]*[iI][a-zA-Z]*\S*|--in-place(?:=\S*)?|(-i|-I)\s*'[^']*'|(-i|-I)\s*"[^"]*")(?:\s|$)/;
		if (commandText.match(/^sed\s+/) && inPlaceRegex.test(commandText)) {
			return true;
		}

		const text = this._removeLineContinuations(commandText);

		// Check if this is a sed command
		if (!text.match(/^sed\s+/)) {
			return false;
		}

		// Check for -i, -I, --in-place or an abbreviation of it such as --in, as sed sees the
		// arguments after the shell removes quotes and escapes
		return this._tokenizeCommand(text).slice(1).some(token => {
			const option = this._unquoteOption(token);
			if (option.startsWith('--')) {
				return this._resolveLongOption(option) === 'in-place';
			}
			return /^-[a-zA-Z]*[iI]/.test(option);
		});
	}

	extractFileWrites(commandText: string): string[] {
		const tokens = this._tokenizeCommand(this._removeLineContinuations(commandText));
		return this._extractFileTargets(tokens);
	}

	/**
	 * Tokenizes a command into individual arguments, handling quotes and escapes.
	 */
	private _tokenizeCommand(commandText: string): string[] {
		const tokens: string[] = [];
		let current = '';
		let inSingleQuote = false;
		let inDoubleQuote = false;
		let escaped = false;

		for (let i = 0; i < commandText.length; i++) {
			const char = commandText[i];

			if (escaped) {
				current += char;
				escaped = false;
				continue;
			}

			if (char === '\\' && !inSingleQuote) {
				escaped = true;
				current += char;
				continue;
			}

			if (char === '\'' && !inDoubleQuote) {
				inSingleQuote = !inSingleQuote;
				current += char;
				continue;
			}

			if (char === '"' && !inSingleQuote) {
				inDoubleQuote = !inDoubleQuote;
				current += char;
				continue;
			}

			if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
				if (current) {
					tokens.push(current);
					current = '';
				}
				continue;
			}

			current += char;
		}

		if (current) {
			tokens.push(current);
		}

		return tokens;
	}

	/**
	 * Removes line continuations (a backslash before a newline) outside single quotes, as the
	 * shell does before it splits the arguments.
	 */
	private _removeLineContinuations(commandText: string): string {
		let result = '';
		let inSingleQuote = false;
		let inDoubleQuote = false;

		for (let i = 0; i < commandText.length; i++) {
			const char = commandText[i];

			if (inSingleQuote) {
				if (char === '\'') {
					inSingleQuote = false;
				}
				result += char;
				continue;
			}

			if (char === '\\') {
				if (commandText[i + 1] === '\n') {
					i++;
					continue;
				}
				if (commandText[i + 1] === '\r' && commandText[i + 2] === '\n') {
					i += 2;
					continue;
				}
				// Keep an escaped character together with its backslash
				result += commandText.slice(i, i + 2);
				i++;
				continue;
			}

			if (char === '"') {
				inDoubleQuote = !inDoubleQuote;
			} else if (char === '\'' && !inDoubleQuote) {
				inSingleQuote = true;
			}
			result += char;
		}

		return result;
	}

	/**
	 * Returns an argument as sed sees it when parsing options: the shell removes quotes, a `$`
	 * before a quote, and backslashes.
	 */
	private _unquoteOption(token: string): string {
		return token.replace(/\$(?=['"])/g, '').replace(/['"\\]/g, '');
	}

	/**
	 * Resolves a long option such as `--in` or `--expr=...` to its full name. Returns `undefined`
	 * when the name is empty, unknown or ambiguous, all of which sed rejects.
	 */
	private _resolveLongOption(option: string): string | undefined {
		const name = option.slice(2).split('=', 1)[0];
		if (!name) {
			return undefined;
		}
		if (sedLongOptions.includes(name)) {
			return name;
		}
		const candidates = sedLongOptions.filter(longOption => longOption.startsWith(name));
		return candidates.length === 1 ? candidates[0] : undefined;
	}

	/**
	 * Extracts file targets from tokenized sed command arguments.
	 * Files are generally the last non-option, non-script arguments.
	 */
	private _extractFileTargets(tokens: string[]): string[] {
		if (tokens.length === 0 || tokens[0] !== 'sed') {
			return [];
		}

		const files: string[] = [];
		let i = 1; // Skip 'sed'
		let foundScript = false;

		while (i < tokens.length) {
			const token = tokens[i];
			const option = this._unquoteOption(token);

			// Long options, including abbreviations such as --in or --expr=...
			if (option.startsWith('--')) {
				const name = this._resolveLongOption(option);
				if (name === 'in-place') {
					// In-place flag (already verified we have one)
					i++;
					continue;
				}
				if (name === 'expression' || name === 'file') {
					// Skip the option and its argument, unless the argument is attached with `=`
					i += option.includes('=') ? 1 : 2;
					foundScript = true;
					continue;
				}
				// Other long options like --sandbox, --debug, etc.
				i++;
				continue;
			}

			// Short options
			if (option.startsWith('-') && option.length > 1 && option[1] !== '-') {
				// Could be combined flags like -ni or -i.bak
				const flags = option.slice(1);

				// Check if this is -i with backup suffix attached (e.g., -i.bak)
				const iIndex = flags.indexOf('i');
				const IIndex = flags.indexOf('I');
				const inPlaceIndex = iIndex >= 0 ? iIndex : IIndex;

				if (inPlaceIndex >= 0 && inPlaceIndex < flags.length - 1) {
					// -i.bak style - backup suffix is attached
					i++;
					continue;
				}

				// Check if -i or -I is the last flag and next token could be backup suffix
				if ((flags.endsWith('i') || flags.endsWith('I')) && i + 1 < tokens.length) {
					// Use the raw token: an empty suffix is only visible as `''` or `""` before the
					// shell removes the quotes
					const nextToken = tokens[i + 1];
					// macOS/BSD style: -i '' or -i "" (empty string backup suffix)
					// Only treat it as a backup suffix if it's empty or looks like a backup
					// extension (starts with '.' and is short). Don't match sed scripts like 's/foo/bar/'.
					if (nextToken === '\'\'' || nextToken === '""') {
						i += 2;
						continue;
					}
					// Check for quoted backup suffixes like '.bak' or ".backup"
					if ((nextToken.startsWith('\'') && nextToken.endsWith('\'')) || (nextToken.startsWith('"') && nextToken.endsWith('"'))) {
						const unquoted = nextToken.slice(1, -1);
						// Backup suffixes typically start with '.' and are short extensions
						if (unquoted.startsWith('.') && unquoted.length <= 10 && !unquoted.includes('/')) {
							i += 2;
							continue;
						}
					}
				}

				// Check for -e or -f which take arguments
				if (flags.includes('e') || flags.includes('f')) {
					const eIndex = flags.indexOf('e');
					const fIndex = flags.indexOf('f');
					const optIndex = eIndex >= 0 ? eIndex : fIndex;

					// If -e or -f is not the last character, the rest of the token is the argument
					if (optIndex < flags.length - 1) {
						foundScript = true;
						i++;
						continue;
					}

					// Otherwise, the next token is the argument
					foundScript = true;
					i += 2;
					continue;
				}

				i++;
				continue;
			}

			// Non-option argument
			if (!foundScript) {
				// First non-option is the script (unless -e/-f was used)
				foundScript = true;
				i++;
				continue;
			}

			// Subsequent non-option arguments are files
			// Strip surrounding quotes from file path
			let file = token;
			if ((file.startsWith('\'') && file.endsWith('\'')) || (file.startsWith('"') && file.endsWith('"'))) {
				file = file.slice(1, -1);
			}
			files.push(file);
			i++;
		}

		return files;
	}
}
