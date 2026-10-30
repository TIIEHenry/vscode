---
title: "MCP 定义：Add / Update 先有表单"
type: plan
status: implemented
phase: M7
updated: 2026-10-16
summary: "工具栏 Add 只展开表单，无配置不发 addMcpServer。工具栏 Update 在无改动时不写回。表单只收集已有配置字段里的必填项。已于 05a17c38879 落地。不升 PRD。"
---

# MCP 定义：Add / Update 先有表单
状态：已完成。
覆盖需求：PRD-025。


> **触发：** [功能缺口审查 2026-10-16](review-2026-10-16-feature-gaps.md) G3、D1。
> **不推翻：** [engine-catalog](../../docs/systems/workbench/engine-catalog.md) 的 List / Toggle / Remove 与 Runtime tab。不改 `UniverseAgentMcpServerConfig` 的字段。不升 PRD-025。
> **落地：** `status: implemented`。已于 `05a17c38879`（Slot B）落地合入。
>
> **2026-10-19：** 设置页新建已改成 `IDialogService.input`，不在列表下展开内联表单。§2 的内联表单没有按原文实施。点击 Add / Update 打开输入对话框，字段顺序是 name、transport、command、url。判定、无改动不写回、`addServer(config)` 和无参 `updateSelectedServer()` 仍供测试调用，这些与 §2 相同。方案仍 `draft`。

## 1. 现状

工具栏 **Add** 的点击直接 `addServer()`，不传配置（`engineMcpSection.ts:271-273`）。`addServer` 在 `isCompleteMcpAddConfig` 失败时返回 false，不调用 `addMcpServer`（`:407-409`）。完整配置的判定已经写明：`name` 去空白后非空；`stdio` 还要非空 `command`；`sse` 与 `streamable_http` 还要非空 `url`；其它 transport（含 `unknown`）为不完整（`:46-56`）。

**Update** 在有选中项时把选中项原字段填进 `UniverseAgentMcpServerConfig` 再 `updateMcpServer`（`:433-461`）。没有编辑表单，点击等于原样写回。

[engine-catalog](../../docs/systems/workbench/engine-catalog.md) MCP 行把写工具栏写成 Add / Update / Remove，备注是「定义 CRUD」（约第 75 行）。Add 无配置即失败，Update 无编辑，这句与代码不符。

`UniverseAgentMcpServerConfig`（`universeAgentTypes.ts:1955-1964`）字段是 `id?`、`name`、`transport`、`command?`、`args?`、`env?`、`url?`、`enabled?`。`transport` 为 `'stdio' | 'sse' | 'streamable_http' | 'unknown'`（`:1918`）。Add 的 scope 今天写死 `'global'`（`engineMcpSection.ts:413`）。

## 2. 本切片

在定义页写工具栏下加一块内联表单，控件用现有 `InputBox` / `SelectBox`，不新开模态，不走 Quick Pick。

**Add。** 点击 Add 只展开空表单，不调用 `addMcpServer`。提交时组出配置再调用现有 `addServer(config)`：

- `name`：用户输入，提交前 `trim`，空则不提交。
- `transport`：只可选 `stdio`、`sse`、`streamable_http`。不提供 `unknown`。
- `stdio` 显示 `command`，另两种显示 `url`。对应字段 `trim` 后为空则不提交。
- 不收集 `args`、`env`、`enabled`、`id`。不把 `enabled` 默认写成 true。
- scope 仍是 `'global'`。`workDir` 仍走现有 `sessionWorkDir(this.sessionContext)`。不在本切片改成 `getWorkRoot`。

**Update。** 工具栏在无选中服务器时不展开表单，也不调用 `updateMcpServer`。有选中项时表单预填 `name`、`transport`、`command`、`url`。比较和完整性都看合并后的完整配置，不看只含改动字段的 partial。合并与今天 `updateSelectedServer` 相同：表单给出的 `name`、`transport`，以及当前 transport 要的 `command` 或 `url`，用 `trim` 后的值覆盖；表单没收集的 `args`、`env`、`enabled`、`id` 留 `undefined`，由 `??` 保留选中项。当前 transport 不显示的字段（`stdio` 的 `url`，另两种的 `command`）不写入 `''`，同样留 `undefined`。`trim` 之后若 `name`、`transport`、`command`、`url` 都与选中项相同，提交不调用 `updateSelectedServer`，不显示 “Updated.”。有差异时，对这份合并结果跑现有 `isCompleteMcpAddConfig`。它只判断，不改写字段。通过才调用 `updateSelectedServer(partial)`，partial 只带有差异的可见字段。这个相等判断放在表单提交，不放进 `updateSelectedServer`。该方法仍接受无参调用并把选中项原样写回，供现有测试使用。工具栏不再走无参路径。选中项 `transport === 'unknown'` 时不把 `'unknown'` 加进选项。`SelectBox` 打开时可以显示第一项，表单记住的 transport 仍是 `'unknown'`，直到用户改选。改成三种已知 transport 之一且合并结果通过判定才提交。

`EngineMcpSection` 构造函数补上与 `engineToolsSection.ts:251` 相同的 `IContextViewService`，供现有 `InputBox` / `SelectBox` 使用。

**Remove** 与行上的启用 checkbox 不动。

成功、失败文案仍用现有 `ENGINE_MCP_ADD_SUCCESS_COPY`、`ENGINE_MCP_UPDATE_SUCCESS_COPY` 与 `showWriteFailed`。列出成功后才保留成功文案，这条现有闸不动。

## 3. 文档

同一实施切片改 [engine-catalog](../../docs/systems/workbench/engine-catalog.md) 第 75 行备注。保留「list + toggle @ `4833c008`」。后半改为：Add 与 Update 要先提交本表单，无配置不发 `AddMcpServer`，无改动不发 `UpdateMcpServer`。删掉「定义 CRUD @ `7f10e65c` / `f49615a1`」。不改第 17 行、第 114 行，不改 Runtime 行。

## 4. 明确不改

- 不新增 proto 字段，不改 `isCompleteMcpAddConfig` 的判定。
- 不改 MCP Runtime、`mcpRuntime` 能力键、Toggle、Remove。
- 不改 Add 的 scope，不加 project/global 选择。
- 不改会话工作根（G5 仍归 [session-work-root-and-workbench-scope](session-work-root-and-workbench-scope.md)）。
- 不升 PRD-025，不改 Engine Overview。

## 5. 本地验证

`engineMcpSection.test.ts` 保留：传入 `{ name: 'added', transport: 'stdio', command: 'echo' }` 的 `addServer` 仍成功（约第 158 行）；`updateSelectedServer({ name: 'Srv 2' })` 仍成功（约第 155 行）；`workDir` 仍由约第 77–160 行锁在 `sessionWorkDir`。

同文件新增：点击工具栏 Add 不调用 `addMcpServer`，只展开空表单。表单提交 stdio 且 command 为空时不调用 `addMcpServer`。提交 name 与 command 齐全时调用一次，请求里的 `config.transport` 为 `stdio`，`scope` 为 `global`。有选中项且 `trim` 后与选中项相同，不调用 `updateMcpServer`。只改 name、合并后仍完整时调用一次，请求里的 `command`、`args`、`env`、`url`、`enabled` 仍来自选中项。无选中项时工具栏 Update 不调用。

`engineCatalogSections.test.ts` 的现有断言保持：`:5118` 无完整配置的 `addServer` 不发 RPC；`:4995` 无参 `updateSelectedServer()` 仍发一次，并带上列出的 `command`、`args`、`env`、`url`、`enabled`，`scope` 为 `global`；`:5151` 与 `:5201` 在 Add 或 Update 成功后，后续 `listMcpServers` 失败则不保留成功文案。不在 `engineMcpSection.test.ts` 再写一条无参 `addServer()`。
