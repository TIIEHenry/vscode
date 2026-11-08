---
title: "过程折短摘要保持同行"
type: plan
status: implemented
phase: complete
updated: 2026-11-05
summary: "调整摘要的flex-basis，避免宽阅读列中的单工具摘要把chevron挤到独立一行；窄列只在内容或状态超宽时换行。"
---

# 过程折短摘要保持同行
状态：已完成。负责：agent:codex；Sol完成CSS变更与生产组件测量。

覆盖需求：PRD-028。沿用[GPT视觉与密度决定](../../docs/decisions/ui-gpt-visual-replication-2026-11-04.md)，不改分区或产品交互合同。

## 观察与最小改动

a4真实默认编辑器成功截图中，单工具过程折的chevron在上行、`1 step · file_read`在下行，阅读列有充分空间。生产header使用fit-content与flex-wrap:wrap，而summary固定`flex: 1 1 8em`，其basis可能大于短摘要撑出的固有宽度。

Sol用实际组件、完整生产CSS与真实codicon字体在Chromium做12组测量：宽叶单工具原header46px且图标/摘要分行，临时仅将summary basis改auto后为24px且同行；宽叶多工具/长摘要都保持24px；宽叶失败态48→24px且失败状态可见；窄叶失败态保持70px且状态可见。全12组图标16×16、无header溢出。证据 `/tmp/ua-process-fold-layout-20261105-sol-v2-result.json`，Node24退出0。v1缺图标字体导致0×0，原证据保留，不作同行验收。

只将 `src/vs/workbench/contrib/conversation/browser/media/conversationLens.css` 中 `.conversation-process-fold-summary` 的flex改为 `1 1 auto`。保留header换行、min-width、溢出规则、状态、chevron、主题token、hover/键盘与展开行为；窄列仅在内容或状态超宽时换行，普通短摘要允许与chevron同行。不新增尺寸token。不在本切片隐藏或改名root/子代理标签，身份语义另查。

## 验证与次序

1. 规则16独立只读审查后，由Sol实施这一CSS变动。a5工作目录真实运行完成并清理前，source/out保持冻结；不能在运行中换样式。
2. 此为可逆的窄样式修正，不增加镜像实现的源码扫描/单测。复用实际组件测量脚本，修复后从生产CSS读取，不注入basis对照；再次检查上述六种内容/宽度、非零图标、短摘要同行、超宽窄列失败状态与无横向溢出。保留原baseline及临时对照证据，静态源码扫描不作为本切片的长期契约。
3. 走单一构建通道更新实际运行所需CSS产物，并完成定向样式检查；只有出现相关失败才扩测，不为CSS重复owner/Node业务套件。另用默认编辑器的实际截图/盒测量核单工具摘要；组件页面使用Arial13不等于Electron浅深/高对比全部验收，明确记录实际检查主题与尺寸。
4. 稳定布局合同写入[透镜与轨迹](../../docs/systems/conversation/lens-and-trajectory.md)，实际截图与测量记持续优化进度；不提交/暂存无关WIP。

## 审查

独立只读审查已完成：C0/I0；原“窄列保留换行”表述与测量结果不完全一致的I1已按“超宽时换行、短摘要允许同行”修正。Sol 已将生产 CSS 的 `flex: 1 1 8em` 改为 `flex: 1 1 auto`；v3 生产组件测量 6/6 通过，字体与 chevron 非零、无横向溢出，失败窄列仍显示 `2 failed`。随后单一通道 `/tmp/process-fold-build-20261105` 编译 exit 0，src/out 12186/11987 清单与测试后均 unchanged。

返回 [方案索引](INDEX.md) · [持续优化看板](../parallel/active/gpt-visual-sglang-goal.md)。
