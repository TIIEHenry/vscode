---
title: "Engine 设置参考图视觉验证"
type: progress
status: completed
phase: N/A
updated: 2026-11-02
summary: "生产组件受控目录渲染；48项定向Electron测试、五种主题/尺寸与键盘/保存/详情检查。不是完整默认窗口或真实引擎验收。"
---

# Engine 设置参考图视觉验证

方案：[Engine 设置参考图视觉适配](../../plans/engine-tools-settings-usability.md)。仅复刻用户所附 ChatGPT 设置截图的视觉层次，不新增搜索、筛选或改变保存 RPC。修改均在工作区，未提交、未推送。

## 本地方法与结果

更新输出使用仓库 `build/next/transpile.ts` 的 `transpileFile` / `copyFile`：仅刷新 `enginePreferencesPane.ts`、`engineToolsSection.ts`、两份对应测试与两份相关样式到 `out/`。这是定向转译，不等于全量 compile 或类型检查。

```bash
VSCODE_SKIP_PRELAUNCH=1 scripts/test.sh \
  --run src/vs/workbench/contrib/conversation/test/browser/engineToolsSection.test.ts \
  --run src/vs/workbench/contrib/conversation/test/browser/enginePreferencesPane.test.ts
npx eslint src/vs/workbench/contrib/conversation/browser/enginePreferencesPane.ts \
  src/vs/workbench/contrib/conversation/browser/engineToolsSection.ts \
  src/vs/workbench/contrib/conversation/test/browser/engineToolsSection.test.ts \
  src/vs/workbench/contrib/conversation/test/browser/enginePreferencesPane.test.ts
python3 scripts/check-docs-health.py
python3 scripts/wiki/wiki.py check --root .
```

- 最终定向 Electron：[原始测试输出](electron-tests.log)为48 passing / 0 failing，包含宽窄真实 DOM、长描述/Profile、短窗口可达、开关空格键切换与焦点保持、原有断连/写门回归。
- ESLint：0 errors；原四处 DOM 查询警告保留。未做全仓 ESLint 或全量 compile。
- docs-health 与 wiki：0 errors，既有警告保留；`git diff --check` 通过。
- 首轮发现旧固定高度列表 `rerender()` 不重画：使用修改前 HEAD 的 Tools 模块独立复现同一 stale-enable 测试失败，再以稳定 id 的 splice 修复；未修改此测试的行为期望。刷新 ready 状态在绘制行之前发布，避免首屏开关保留 loading 禁用外观。
- 中途一次测试因 `out/` 模块暂不可读未载入，没有计入通过；重新生成/载入后按上述最终完整结果计。新增键盘检查曾发现首屏禁用问题，修正后完整通过。

## 渲染与交互证据

使用现有浏览器单测加载器和真实 `EnginePreferencesPane` / `EngineToolsSection`，注入174条受控工具目录与一个用户Profile。样式来自本轮源码输出；尺寸取 size registry，颜色从产品浅/深色主题与高对比主题解析，并补齐 color registry 默认值。使用 Playwright 的实际盒子与 computed style 检查，不是静态设计稿。

| 场景 | 尺寸 | 结果 |
|------|------|------|
| [浅色宽窗口](light-wide.png) | 1440×1000 | 内容760宽；外层不滚动；工具列表独立滚动 |
| [深色宽窗口](dark-wide.png) | 1440×1000 | 同布局，按主题显示边界和开关 |
| [浅色高对比](high-contrast.png) | 1440×1000 | 控件、卡片、导航边界可辨 |
| [浅色窄窗口](light-narrow.png) | 440×760 | 返回入口保留；长Profile省略，Save不越界 |
| [浅色短窗口](light-short.png) | 1024×380 | 列表160高，外层允许滚动以保留控件可达 |

[原始盒子指标](metrics.json)：五种场景均无横向溢出；说明在名称下方，开关在文字右侧，开关实测32×20。正常高度外层 scrollHeight 等于 clientHeight。

浏览器真实键盘操作：聚焦 `task_update` 开关，空格后值由true变false且焦点仍归属该工具；点击 Save 后勾选仍false；点击名称显示[只读详情](detail.png)，外层没有新增重复滚动。这些保存/详情请求由受控连接响应，只证明组件行为。

未进行真实引擎请求、完整默认编辑器窗口、安装或打包验收。PRD-025/028不升档。
