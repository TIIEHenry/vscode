/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const ts = createRequire(import.meta.url)('typescript') as typeof import('typescript');
type TSNode = import('typescript').Node;
type TSExpression = import('typescript').Expression;
type TSCallExpression = import('typescript').CallExpression;
type TSSourceFile = import('typescript').SourceFile;
type TSBindingName = import('typescript').BindingName;

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_REL = 'src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts';
const REVIEW_REL = 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts';
const CHANGES_REL = 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function findSyntax<T extends TSNode>(root: TSNode, predicate: (node: TSNode) => node is T): T[] {
	const found: T[] = [];
	const visit = (node: TSNode): void => {
		if (predicate(node)) {
			found.push(node);
		}
		ts.forEachChild(node, visit);
	};
	visit(root);
	return found;
}

function unparenthesized(expression: TSExpression): TSExpression {
	while (ts.isParenthesizedExpression(expression)) {
		expression = expression.expression;
	}
	return expression;
}

function isThisCall(call: TSCallExpression, name: string): boolean {
	return ts.isPropertyAccessExpression(call.expression)
		&& call.expression.expression.kind === ts.SyntaxKind.ThisKeyword
		&& call.expression.name.text === name;
}

function assertDoubleCatch(expression: TSExpression): TSCallExpression {
	for (let index = 0; index < 2; index++) {
		assert.ok(ts.isCallExpression(expression), 'the opened Promise needs two catch calls');
		assert.ok(ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === 'catch', 'the opened Promise needs two catch calls');
		assert.strictEqual(expression.arguments.length, 1);
		assert.ok(ts.isIdentifier(expression.arguments[0]) && expression.arguments[0].text === 'onUnexpectedError');
		expression = expression.expression.expression;
	}
	assert.ok(ts.isCallExpression(expression), 'catch must protect the opening call itself');
	return expression;
}

function assertAwaitedCall(root: TSNode, matches: (call: TSCallExpression) => boolean): TSCallExpression {
	const awaited: TSCallExpression[] = [];
	const visit = (node: TSNode): void => {
		if (ts.isFunctionLike(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
			return;
		}
		if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression) && matches(node.expression)) {
			awaited.push(node.expression);
		}
		ts.forEachChild(node, visit);
	};
	visit(root);
	assert.strictEqual(awaited.length, 1, 'the actual delegated opening must be awaited once');
	return awaited[0];
}

function assertKnownImport(file: TSSourceFile, localName: string, moduleName: string): void {
	const imports = file.statements.filter(ts.isImportDeclaration).flatMap(declaration => {
		const bindings = declaration.importClause?.namedBindings;
		if (declaration.importClause?.isTypeOnly || !bindings || !ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements.filter(specifier => !specifier.isTypeOnly && specifier.name.text === localName)
			.map(specifier => ({ declaration, specifier }));
	});
	assert.strictEqual(imports.length, 1, `the known callee needs its one actual import: ${localName}`);
	const { declaration, specifier } = imports[0];
	assert.ok(ts.isStringLiteral(declaration.moduleSpecifier));
	assert.strictEqual(declaration.moduleSpecifier.text, moduleName, `the known callee import source must match: ${localName}`);
	assert.strictEqual(specifier.propertyName?.text ?? specifier.name.text, localName, `the known callee import binding must match: ${localName}`);
}

/** Rejects bindings of the few checked imports in this execution scope, without resolving arbitrary aliases. */
function assertNoCalleeShadows(root: TSNode, callees: ReadonlySet<string>): void {
	const checkBinding = (name: TSBindingName): void => {
		if (ts.isIdentifier(name)) {
			assert.ok(!callees.has(name.text), `the known callee must not be shadowed: ${name.text}`);
		} else {
			for (const element of name.elements) {
				if (ts.isBindingElement(element)) {
					checkBinding(element.name);
				}
			}
		}
	};
	const visit = (node: TSNode): void => {
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
			checkBinding(node.name);
		} else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
			checkBinding(node.name);
		}
		if (node !== root && (ts.isFunctionLike(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node))) {
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(root);
}

/** Checks only the registered open listener and its named helper, never unrelated catches. */
function assertListOpenContract(source: string, kind: 'changes' | 'review'): void {
	const file = ts.createSourceFile('sources-open.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	assertKnownImport(file, 'onUnexpectedError', '../../../../base/common/errors.js');
	assertKnownImport(file, 'openSourcesChangeEntry', kind === 'changes' ? './sourcesChangeEntryOpen.js' : './sourcesChangesList.js');
	const callees = new Set(['onUnexpectedError', 'openSourcesChangeEntry']);
	if (kind === 'review') {
		assertKnownImport(file, 'markReviewedAfterSuccessfulOpen', '../common/sourcesReviewListModel.js');
		callees.add('markReviewedAfterSuccessfulOpen');
	}
	assertNoCalleeShadows(file, callees);
	const registrations = findSyntax(file, ts.isCallExpression).filter(call => {
		const expression = call.expression;
		return ts.isPropertyAccessExpression(expression) && expression.name.text === 'onDidOpen'
			&& ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === 'list'
			&& expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword;
	});
	assert.strictEqual(registrations.length, 1, 'check the real list.onDidOpen registration');
	const registration = registrations[0];
	assert.ok(ts.isCallExpression(registration.parent) && isThisCall(registration.parent, '_register'));
	assert.strictEqual(registration.parent.arguments[0], registration);
	for (let ancestor: TSNode | undefined = registration.parent; ancestor && ancestor !== file; ancestor = ancestor.parent) {
		if (ts.isFunctionLike(ancestor)) {
			assertNoCalleeShadows(ancestor, callees);
		}
	}
	let owner: TSNode | undefined = registration.parent;
	while (owner && !ts.isClassDeclaration(owner) && !ts.isClassExpression(owner)) {
		owner = owner.parent;
	}
	assert.ok(owner && (ts.isClassDeclaration(owner) || ts.isClassExpression(owner)), 'the listener must belong to its actual list class');
	const listener = registration.arguments[0];
	assert.ok(listener && ts.isArrowFunction(listener) && ts.isBlock(listener.body));
	assert.ok(!listener.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword), 'the event listener must not discard an async return');
	assertNoCalleeShadows(listener, callees);
	const voidStatements = listener.body.statements.filter(ts.isExpressionStatement)
		.map(statement => statement.expression).filter(ts.isVoidExpression);
	assert.strictEqual(voidStatements.length, 1, 'the listener must protect its one fire-and-forget opening');
	const opening = assertDoubleCatch(voidStatements[0].expression);
	const helperName = kind === 'changes' ? 'openChangeEntry' : 'openReviewEntryMarkingReviewed';
	if (kind === 'changes') {
		const iife = unparenthesized(opening.expression);
		assert.ok(ts.isArrowFunction(iife) && iife.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword));
		assertNoCalleeShadows(iife, callees);
		assertAwaitedCall(iife.body, call => isThisCall(call, helperName));
	} else {
		assert.ok(isThisCall(opening, helperName), 'Review must catch the actual delegated opening');
	}
	const helpers = owner.members.filter(ts.isMethodDeclaration).filter(method => ts.isIdentifier(method.name) && method.name.text === helperName);
	assert.strictEqual(helpers.length, 1, 'the delegated helper must exist');
	assert.ok(helpers[0].body);
	assertNoCalleeShadows(helpers[0], callees);
	if (kind === 'review') {
		const markReviewed = assertAwaitedCall(helpers[0].body, call => ts.isIdentifier(call.expression) && call.expression.text === 'markReviewedAfterSuccessfulOpen');
		assert.ok(markReviewed.arguments[0], 'Review must pass its actual opening callback');
		const openCallback = unparenthesized(markReviewed.arguments[0]);
		assert.ok(ts.isArrowFunction(openCallback) && openCallback.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword), 'Review opening callback must be async');
		assertNoCalleeShadows(openCallback, callees);
		assertAwaitedCall(openCallback.body, call => ts.isIdentifier(call.expression) && call.expression.text === 'openSourcesChangeEntry');
	} else {
		assertAwaitedCall(helpers[0].body, call => ts.isIdentifier(call.expression) && call.expression.text === 'openSourcesChangeEntry');
	}
}

const changesOpenFixture = `
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { openSourcesChangeEntry } from './sourcesChangeEntryOpen.js';
class Changes {
	private async openChangeEntry() { await openSourcesChangeEntry(); }
	private ensureList() {
		this._register(this.list.onDidOpen(e => {
			void (async () => { await this.openChangeEntry(); })().catch(onUnexpectedError).catch(onUnexpectedError);
		}));
	}
}`;

const reviewOpenFixture = `
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { openSourcesChangeEntry } from './sourcesChangesList.js';
import { markReviewedAfterSuccessfulOpen } from '../common/sourcesReviewListModel.js';
class Review {
	private async openReviewEntryMarkingReviewed() {
		await markReviewedAfterSuccessfulOpen(async () => { await openSourcesChangeEntry(); });
	}
	private ensureList() {
		this._register(this.list.onDidOpen(e => {
			void this.openReviewEntryMarkingReviewed().catch(onUnexpectedError).catch(onUnexpectedError);
		}));
	}
}`;

suite('Sources leftover fire-and-forget catch scan (D677)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('progress invalidateResource leftover voids are deduplicated single-chain', () => {
		const source = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const call = 'void this.invalidateResource(resource)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async invalidateResource(resource: URI): Promise<void> {'));
		assert.strictEqual((source.match(/void this\.invalidateResource\(resource\)/g) ?? []).length, 2);
		assert.ok(source.includes(`${call}${singleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}${singleCatch}${singleCatch};`));
		assert.ok(!/^\t+this\.invalidateResource\(resource\);/m.test(source));
	});

	test('Review and Changes onDidOpen leftover Promises are double-chain; async e gone', () => {
		const review = fs.readFileSync(resolveSource(REVIEW_REL), 'utf8');
		const changes = fs.readFileSync(resolveSource(CHANGES_REL), 'utf8');
		assertListOpenContract(review, 'review');
		assertListOpenContract(changes, 'changes');
	});

	test('open contract accepts delegated calls and ignores comment decoys', () => {
		assertListOpenContract(`${changesOpenFixture}\n// async e =>; openSourcesChangeEntry; .catch(onUnexpectedError);`, 'changes');
		assertListOpenContract(reviewOpenFixture, 'review');
	});

	test('open contract ignores dormant nested awaits when the actual call is awaited', () => {
		assertListOpenContract(changesOpenFixture.replace('await this.openChangeEntry();', 'const dormant = async () => { await this.openChangeEntry(); }; await this.openChangeEntry();'), 'changes');
	});

	test('open contract ignores shadows inside an unrelated dormant function', () => {
		assertListOpenContract(changesOpenFixture.replace('await this.openChangeEntry();', 'const dormant = async (onUnexpectedError: unknown) => { const openSourcesChangeEntry = async () => {}; }; await this.openChangeEntry();'), 'changes');
	});

	test('Review open contract rejects a local mark function that never invokes its callback', () => {
		const shadow = reviewOpenFixture.replace('await markReviewedAfterSuccessfulOpen(', 'const markReviewedAfterSuccessfulOpen = async (_open: unknown) => {}; await markReviewedAfterSuccessfulOpen(');
		assert.throws(() => assertListOpenContract(shadow, 'review'), /the known callee must not be shadowed/);
	});

	test('Changes open contract rejects an opener parameter shadow', () => {
		const shadow = changesOpenFixture.replace('private async openChangeEntry()', 'private async openChangeEntry(openSourcesChangeEntry: unknown)');
		assert.throws(() => assertListOpenContract(shadow, 'changes'), /the known callee must not be shadowed/);
	});

	test('Changes open contract rejects an error-handler parameter shadow', () => {
		const shadow = changesOpenFixture.replace('onDidOpen(e =>', 'onDidOpen(onUnexpectedError =>');
		assert.throws(() => assertListOpenContract(shadow, 'changes'), /the known callee must not be shadowed/);
	});

	test('Review open contract rejects the wrong mark import source', () => {
		const wrongImport = reviewOpenFixture.replace('from \'../common/sourcesReviewListModel.js\'', 'from \'./unrelated.js\'');
		assert.throws(() => assertListOpenContract(wrongImport, 'review'), /the known callee import source must match/);
	});

	test('Review open contract rejects an unrelated export aliased to the mark name', () => {
		const wrongImport = reviewOpenFixture.replace('import { markReviewedAfterSuccessfulOpen }', 'import { unrelated as markReviewedAfterSuccessfulOpen }');
		assert.throws(() => assertListOpenContract(wrongImport, 'review'), /the known callee import binding must match/);
	});

	for (const [name, before, after] of [
		['missing delegated await', 'await this.openChangeEntry()', 'this.openChangeEntry()'],
		['missing helper await', 'await openSourcesChangeEntry()', 'openSourcesChangeEntry()'],
		['dormant listener await decoy', 'await this.openChangeEntry();', 'const dormant = async () => { await this.openChangeEntry(); }; this.openChangeEntry();'],
		['dormant helper await decoy', 'await openSourcesChangeEntry();', 'const dormant = async () => { await openSourcesChangeEntry(); }; openSourcesChangeEntry();'],
		['nested class helper await decoy', 'await openSourcesChangeEntry();', 'class Dormant { async open() { await openSourcesChangeEntry(); } } openSourcesChangeEntry();'],
		['single catch', '})().catch(onUnexpectedError).catch(onUnexpectedError)', '})().catch(onUnexpectedError)'],
		['broken delegated name', 'await this.openChangeEntry()', 'await this.openAnotherEntry()'],
		['async event listener', 'onDidOpen(e =>', 'onDidOpen(async e =>'],
	] as const) {
		test(`Changes open contract rejects ${name} even with unrelated protection`, () => {
			assert.ok(changesOpenFixture.includes(before));
			const decoy = '\nasync function unrelated() { await openSourcesChangeEntry(); void Promise.resolve().catch(onUnexpectedError).catch(onUnexpectedError); }';
			assert.throws(() => assertListOpenContract(changesOpenFixture.replace(before, after) + decoy, 'changes'), assert.AssertionError);
		});
	}

	test('Changes open contract rejects a helper supplied only by another class', () => {
		const withoutOwnHelper = changesOpenFixture.replace('private async openChangeEntry() { await openSourcesChangeEntry(); }', '');
		const otherClass = '\nclass Other { private async openChangeEntry() { await openSourcesChangeEntry(); } }';
		assert.throws(() => assertListOpenContract(withoutOwnHelper + otherClass, 'changes'), /the delegated helper must exist/);
	});

	for (const [name, before, after] of [
		['missing opening await', 'await openSourcesChangeEntry()', 'openSourcesChangeEntry()'],
		['missing reviewed await', 'await markReviewedAfterSuccessfulOpen(', 'markReviewedAfterSuccessfulOpen('],
		['single catch', '.catch(onUnexpectedError).catch(onUnexpectedError)', '.catch(onUnexpectedError)'],
		['broken delegated name', 'void this.openReviewEntryMarkingReviewed()', 'void this.openAnotherEntry()'],
		['opening awaited only by the wrong callback', 'await markReviewedAfterSuccessfulOpen(async () => { await openSourcesChangeEntry(); });', 'await markReviewedAfterSuccessfulOpen(async () => { openSourcesChangeEntry(); }, async () => { await openSourcesChangeEntry(); });'],
	] as const) {
		test(`Review open contract rejects ${name}`, () => {
			assert.ok(reviewOpenFixture.includes(before));
			assert.throws(() => assertListOpenContract(reviewOpenFixture.replace(before, after), 'review'), assert.AssertionError);
		});
	}
});
