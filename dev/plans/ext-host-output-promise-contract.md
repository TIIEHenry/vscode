---
title: "Extension Host 输出通道的 PromiseLike 与失败生命周期合同"
type: plan
status: accepted
phase: M7
updated: 2026-10-26
summary: "D1378：在文件系统 Thenable 边界归一原生 Promise，保留两类 mkdir 拒绝边界；公开句柄集中报告初始化失败、消费派生拒绝并正确释放失败缓存；merge 统一编译与运行。"
---

# Extension Host 输出通道的 PromiseLike 与失败生命周期合同

基线 `e2442d8b3ec`，工位 `loop/J`。诊断入口为 [followup-compile-client.log](../progress/ui-visual-review-2026-10-26-evidence/followup-compile-client.log) 的 ExtHostOutput 6 条与相邻 Search 夹具 1 条。模块合同见 [Extension API](../../docs/systems/extension-api/overview.md)；未发现覆盖输出目录失败的新 ADR。规则 13/16：写稿 → 独立只读审查 → 修稿 → 方案独立提交 → 实施。

## 事实与取舍

- `IExtHostConsumerFileSystem.value` 是正式 `vscode.FileSystem`，`createDirectory` 只承诺 Thenable。普通输出目录先调用 `.then` 后直接 `.catch`，合法的只有 `.then` 对象会使创建变成 `TypeError`；编译诊断不是单纯注解问题。
- 普通输出目录失败拒绝通道创建；扩展日志目录除 `FileExists` 外同样拒绝。`fda419a950a` 只增加失败缓存失效，没有改变这条边界。本轮保留拒绝，不把 mkdir 失败包装成成功继续初始化 logger。
- 创建 API 返回同步句柄，内部异步初始化失败已有 `onUnexpectedError` 报告入口，但登记、排队操作的派生链可再次拒绝且未消费；log 级别初始化与基础初始化还会重复报告同一创建失败。
- 日志句柄按文件缓存，缓存删除目前在成功后才登记。创建失败后调用 dispose 不会删除坏句柄，同名创建无法重试。生命周期的所有者应是同步句柄的 DisposableStore，而不是成功结果。
- 按 principled-design 的稳定、诚实与最小路径原则：在已有外部 Thenable 边界使用原生 Promise 归一；保留原始拒绝供内部调用者观察；初始化失败只报告一次，各排队派生链只消费已经报告的创建拒绝，操作自身抛错仍报告；这里不承诺自定义错误报告器本身抛错时仍无拒绝。拒绝边界和同步 API 均不变。

## 实施

1. 普通目录用 `Promise.resolve(createDirectory(...)).then(...)`，缓存声明对齐实际持有的原生 Promise；保留失败时身份匹配失效、进行中共享及成功缓存。扩展日志目录的 async/await 已正确吸收 Thenable，不改其拒绝语义。
2. 创建登记链承担一次初始化错误报告。就近私有调度助手用于生命周期、日志级别和所有公开操作：显式消费已报告的创建拒绝，再以终止 catch 报告操作回调自身错误；不改原始 channelPromise，也不将原始拒绝重写为成功。
3. 日志句柄写入文件缓存时立即登记身份匹配的删除 disposer。成功后的 channels map 清理由现有生命周期继续管理；早 dispose 后晚到 logger/channel 仍归该 store 释放。
4. 测试夹具采用 `mock<T>` 子类、正式 `TestRPCProtocol`、`NullLoggerService`/`NullLogger` 派生体，按 URI 创建 logger，去除不完整强转和错误 logger 重载；Search 只将 ExtHostConfigProvider/WorkspaceConfiguration 夹具迁移为 typed mock，不改搜索生产语义。

## 行为回归与验收

- 仅提供 `.then()` 且链式返回也只有 `.then()` 的文件系统结果：普通目录成功可以注册，失败传出原始 mkdir 错误且下次重试；旧实现会先因 `.catch` 不存在失败。这是行为红绿条件，不能用语法扫描代替。
- 公共普通/日志句柄在创建中排队 append/显示及日志级别操作，拒绝后错误只报告一次、不创建 logger/登记通道；测试等待后续事件循环以使 runner 捕获 detached 未处理拒绝。扩展日志失败 dispose 后同名新句柄能够重试成功。
- 释放先于 mkdir 完成时，晚到 logger、RPC 通道和缓存均释放；成功后输出/日志方法抛错仍进入错误报告，不能靠空 catch 隐藏。
- 现有进行中共享、成功缓存、FileExists 缓存、旧失败不能清掉新尝试的回归全部保留。
- J 仅目标 ESLint、diff、文档健康/生成状态检查；禁止编译、转译、watch、写 out。merge 用旧生产+新测试证明 red，再以新生产证明 green，并统一新编译核对命名诊断；未运行前 D1378 与本方案保持 open/accepted，不宣称行为已通过。

## 只读审查

- [x] Astra / `engine_catalog_contract_repair` 于 2026-10-26 完成规则 16 只读审查（未改 J 文件）：Strengths 为 Thenable 边界归一、原失败边界、同步句柄持有释放与一次初始化报告；Critical / Important 无；Assessment 可独立提交后实施。Minor 已采纳：无未处理拒绝的承诺限于正常错误报告器；自定义错误处理器自身抛错不在本次范围，测试替换 handler 必须 finally 恢复。
- [ ] 独立方案提交。
- [ ] 实施与静态检查，更新 status / D1378。
- [ ] merge 新编译与 red/green 行为验收。
