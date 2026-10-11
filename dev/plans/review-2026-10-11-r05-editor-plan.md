---
title: "方案 r05：editor"
type: plan
status: draft
phase: N/A
updated: 2026-10-11
summary: "hold 4，drop 0，weaken 0。四处行为仍在原行号，按发现稿修。"
---

hold 4，drop 0，weaken 0。

## r05-1（hold，高）

### 问题类
计算返回后把未平移的 diff 标成最新，回退按旧行号改修改稿。

### 不变量
一次 diff 计算在 await 之后，只有仍是当前代际，且等待期间没有未能平移的编辑时，才写入 `_diff` / `_lastDiff` 并把 `_isDiffUpToDate` 设为 true。有未平移编辑或代际已过时，标志保持 false，不发布这批映射。

### 要动的符号或文件
`DiffEditorViewModel` 上的 diff 计算 autorun（`src/vs/editor/browser/widget/diffEditor/diffEditorViewModel.ts`，现写入点在 307–318 行）。

在 `DiffEditorViewModel` 上增加代际计数。每次进入该 autorun 时加一，await 前记下本次的值。`computeDiff` 返回后先比对代际：不符则返回，不改 `_diff`、`_lastDiff`、`_isDiffUpToDate`。代际仍有效时，若 `originalTextEditInfos` 或 `modifiedTextEditInfos` 非空，且对应的 `applyOriginalEdits` / `applyModifiedEdits` 返回 undefined，在调用 `normalizeDocumentDiff` 之前返回，同样不发布。两边编辑列表都为空时，维持现在的 `?? result`，照常标为最新。

### 明确不改
不恢复 `applyOriginalEdits` / `applyModifiedEdits` 里注释掉的平移实现，这两个函数继续返回 undefined。不改 `DiffEditorWidget.revert`（`diffEditorWidget.ts` 589–599 行）的标志判断和 `executeEdits` 形状。不改内容变更监听里把 `_isDiffUpToDate` 设为 false 的那两处。

### 本地验证
现无对应测试。应新增断言：`computeDiff` 挂起期间修改 modified，`applyModifiedEdits` 仍返回 undefined，恢复后 `isDiffUpToDate` 为 false，且已发布的 diff 映射不被这次结果替换；等待期间删掉映射所在行时，这次完成路径不抛。

## r05-2（hold，高）

### 问题类
双击 inlay 后，解析返回的 textEdits 写进当时的编辑器模型。

### 不变量
只有双击时的模型仍是编辑器当前模型，且 `getVersionId()` 未变、模型未销毁，才对 `hint.textEdits` 执行 `executeEdits`。否则丢掉这批编辑。

### 要动的符号或文件
`InlayHintsController._installDblClickGesture`（`src/vs/editor/contrib/inlayHints/browser/inlayHintsController.ts`，现 388–404 行）。

在 `await part.item.resolve` 之前记下 `this._editor.getModel()` 和 `getVersionId()`。返回后若模型缺失、已销毁、不再是当前模型，或版本已变，直接 return，不调用 `executeEdits`，也不调用 `updateInlayHints`。

### 明确不改
不改 `InlayHintItem.resolve`。不改悬停和链接手势里已有的 CancellationToken。`resolve` 仍可使用 `CancellationToken.None`；拦截放在应用编辑之前。

### 本地验证
现无对应测试。应新增断言：`resolve` 返回后模型已换或 `versionId` 已变时，不调用 `executeEdits`；模型与版本都未变时，仍用 `hint.textEdits` 的范围执行替换。

## r05-3（hold，中）

### 问题类
折行后水平括号引导线的起点仍是模型可见列，和已换算的竖线错位。

### 不变量
多行括号的水平引导线与同一条竖线共用 `bracketGuideModelVisibleColumnToRenderVisibleColumn` 的绘制列。折行使该列不同于模型可见列时，水平线的 `visibleColumn` 用绘制列。

### 要动的符号或文件
`GuidesTextModelPart.getLinesBracketGuides`（`src/vs/editor/common/model/guidesTextModelPart.ts`，现 444–451 行与 457–464 行）：两处水平 `IndentGuide` 补上已算好的 `guideVisibleColumnSourceLine`。

`ViewModelLinesFromProjectedModel.getViewLinesBracketGuides`（`src/vs/editor/common/viewModel/viewModelLines.ts`，现 677–684 行）：`g.horizontalLine` 且 `g.visibleColumn !== -1` 时，用来源行投影调用 `bracketGuideModelVisibleColumnToRenderVisibleColumn`，把结果作为新 `IndentGuide` 的 `visibleColumn`。`endColumn` 继续用已经换成视图列的 `viewPosition.column`。

### 明确不改
不改 `bracketGuideModelVisibleColumnToRenderVisibleColumn` 的换算。不改竖线分支（643–660 行）。不改单行括号那条 `visibleColumn === -1`、靠 `column` 定位的水平线。不改 `indentGuides.ts` 里 `(visibleColumn - 1) * spaceWidth` 的绘制。

### 本地验证
已有 `getViewLinesBracketGuides uses shared render column across wrapped view lines`（`src/vs/editor/test/browser/viewModel/modelLineProjection.test.ts`）。该测试把 `horizontalGuides` 设为 `Disabled`，只断言竖线。应在同一文件新增断言：`HorizontalGuidesState.Enabled` 且引导列落在折行后段时，水平引导线的 `visibleColumn` 等于同一次竖线的绘制列，且不等于模型可见列。

## r05-4（hold，低）

### 问题类
解析已经得到树，让出后版本变了，树被丢掉且不释放。

### 不变量
`_parseAndYield` 不把树交出去时，必须先 `delete()`。版本仍是 `inProgressVersion` 时把树交回调用方，由 `_parseAndUpdateTree` 在代际变化或安装替换时释放。

### 要动的符号或文件
`TreeSitterTree._parseAndYield`（`src/vs/editor/common/model/tokens/treeSitter/treeSitterTree.ts`，现返回在 359 行）。

`newTree` 为真且 `inProgressVersion !== this.textModel.getVersionId()` 时，先 `newTree.delete()`，再返回 undefined。版本仍相符时返回 `newTree`，此处不 `delete`。

### 明确不改
不改 `_parseAndUpdateTree` 里代际或已销毁时的 `tree?.delete()`（311–313 行）。不改 `dispose` 对 `_parseGeneration`、`_tree`、`_lastFullyParsed` 和 `_parser` 的释放。不改循环条件里还没有树且版本仍相符才继续的判断。

### 本地验证
已有 `src/vs/editor/test/common/model/tokens/treeSitter/treeSitterEditNewEndPosition.test.ts`，只覆盖 `computeTreeSitterEditNewEndPosition`。应新增断言：`parse` 得到树且让出后 `versionId` 变化时返回 undefined，且该树 `delete` 被调用一次；版本未变时树被返回，且 `_parseAndYield` 不调用 `delete`。

## 审查备注

2026-10-11 Sonnet 第 2 路：四条可按稿实施。`applyModifiedEdits` 是模块私有函数，`src/vs/editor` 下没有现成的 `DiffEditorViewModel` 或 `TreeSitterTree` 单测夹具，新增断言要先写 fake provider 或 parser。r05-1「在 `normalizeDocumentDiff` 之前返回」和 `apply*` 接收已归一化 diff 的顺序，两个函数目前都是桩，写测试时分开说。
