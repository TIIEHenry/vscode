/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { TestStorageService } from "../../../../test/common/workbenchTestServices.js";
import { PreviewCategoryService } from "../../browser/previewCategoryService.js";
import { PreviewCategory } from "../../common/previewCategoryService.js";

suite("PreviewCategoryService", () => {

	const disposables = new DisposableStore();

	setup(() => { });

	teardown(() => {
		disposables.clear();
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	test("default active category is Code", () => {
		const storage = disposables.add(new TestStorageService());
		const service = disposables.add(new PreviewCategoryService(storage));

		assert.strictEqual(service.activeCategory, PreviewCategory.Code);
	});

	test("setActiveCategory updates and fires onDidChangeCategory", () => {
		const storage = disposables.add(new TestStorageService());
		const service = disposables.add(new PreviewCategoryService(storage));

		let firedEvent: any = undefined;
		disposables.add(service.onDidChangeCategory(e => {
			firedEvent = e;
		}));

		service.setActiveCategory(PreviewCategory.Artifacts);
		assert.strictEqual(service.activeCategory, PreviewCategory.Artifacts);
		assert.deepStrictEqual(firedEvent, {
			category: PreviewCategory.Artifacts,
			previousCategory: PreviewCategory.Code
		});

		// Setting again does not fire
		firedEvent = undefined;
		service.setActiveCategory(PreviewCategory.Artifacts);
		assert.strictEqual(firedEvent, undefined);
	});

	test("getCategoryForInput correctly maps schemes and properties", () => {
		const storage = disposables.add(new TestStorageService());
		const service = disposables.add(new PreviewCategoryService(storage));

		// Standard file -> Code
		assert.strictEqual(service.getCategoryForInput({ resource: URI.file("/path/to/file.ts") } as any), PreviewCategory.Code);
		assert.strictEqual(service.getCategoryForInput(undefined), PreviewCategory.Code);

		// Canvas/Artifact scheme -> Artifacts. visualize:// is not an artifact scheme.
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("canvas://test/doc1") } as any), PreviewCategory.Artifacts);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("artifact://test/a1") } as any), PreviewCategory.Artifacts);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("visualize://test/v1") } as any), PreviewCategory.Code);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("https://example.com") } as any), PreviewCategory.Code);

		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("walkThrough://welcome") } as any), PreviewCategory.Overview);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("vscode-terminal:/1") } as any), PreviewCategory.Terminal);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("vscode-browser:/view") } as any), PreviewCategory.Web);
		assert.strictEqual(service.getCategoryForInput({ typeId: "workbench.editorinputs.browser", resource: URI.file("/page.html") } as any), PreviewCategory.Web);
		assert.strictEqual(service.getCategoryForInput({ previewCategory: PreviewCategory.History, resource: URI.file("/notes.md") } as any), PreviewCategory.History);

		assert.strictEqual(service.getCategoryForInput({ resource: URI.from({ scheme: "git", path: "/a.ts", query: JSON.stringify({ path: "/a.ts", ref: "index" }) }) } as any), PreviewCategory.Code);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.from({ scheme: "git", path: "/a.ts", query: JSON.stringify({ path: "/a.ts", ref: "HEAD" }) }) } as any), PreviewCategory.Code);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.from({ scheme: "git", path: "/a.ts", query: JSON.stringify({ path: "/a.ts", ref: "abc123" }) }) } as any), PreviewCategory.History);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("scm-history-item:/repo/a..b") } as any), PreviewCategory.History);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("vscode-local-history:/file") } as any), PreviewCategory.History);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("scm-multi-diff-source:/changes") } as any), PreviewCategory.Code);

		const workspaceDiff = {
			original: { resource: URI.from({ scheme: "git", path: "/a.ts", query: JSON.stringify({ path: "/a.ts", ref: "abc123" }) }) },
			modified: { resource: URI.file("/a.ts") }
		};
		assert.strictEqual(service.getCategoryForInput(workspaceDiff as any), PreviewCategory.Code);
		const historyDiff = {
			original: { resource: URI.from({ scheme: "git", path: "/a.ts", query: JSON.stringify({ path: "/a.ts", ref: "aaa" }) }) },
			modified: { resource: URI.from({ scheme: "git", path: "/a.ts", query: JSON.stringify({ path: "/a.ts", ref: "bbb" }) }) }
		};
		assert.strictEqual(service.getCategoryForInput(historyDiff as any), PreviewCategory.History);

		// Artifact flag
		assert.strictEqual(service.getCategoryForInput({ isArtifactInput: true, resource: URI.file("/test.png") } as any), PreviewCategory.Artifacts);

		// Planning scheme -> Planning
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("planning://test/p1") } as any), PreviewCategory.Planning);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("todo://test/t1") } as any), PreviewCategory.Planning);
		assert.strictEqual(service.getCategoryForInput({ resource: URI.parse("project-context://test/rules") } as any), PreviewCategory.Planning);

		// Planning flag
		assert.strictEqual(service.getCategoryForInput({ isPlanningInput: true, resource: URI.file("/test.md") } as any), PreviewCategory.Planning);
	});

	test("setCategoryCounts updates counts and fires onDidChangeCategoryCounts", () => {
		const storage = disposables.add(new TestStorageService());
		const service = disposables.add(new PreviewCategoryService(storage));

		let firedCounts: any = undefined;
		disposables.add(service.onDidChangeCategoryCounts(counts => {
			firedCounts = counts;
		}));

		service.setCategoryCounts({
			[PreviewCategory.Code]: 5,
			[PreviewCategory.Artifacts]: 2,
			[PreviewCategory.Planning]: 1
		});

		assert.deepStrictEqual(service.getCategoryCounts(), {
			[PreviewCategory.Code]: 5,
			[PreviewCategory.Artifacts]: 2,
			[PreviewCategory.Planning]: 1
		});
		assert.deepStrictEqual(firedCounts, {
			[PreviewCategory.Code]: 5,
			[PreviewCategory.Artifacts]: 2,
			[PreviewCategory.Planning]: 1
		});
	});
});
