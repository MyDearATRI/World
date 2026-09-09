# Phase 0 交接

本轮完成仓库与能力审计、原文77节需求映射、M/C/R数量门槛登记、技术候选与运行边界。Phase 0 只做文档和审计脚本，没有安装 Lean、生成前端、改写数学笔记、重新导出 Vault、创建服务或推送。主题侧栏及 Phase 1 数学地图由主任务按用户当前明确要求另行实现，不记作本审计的代码成果。

逐项实际状态以 [acceptance.json](acceptance.json) 为准。Phase 0 的PASS只表示审计合同完成；不表示 Phase 2–10 或任何 Lean 证明/人工审阅已通过。Phase 1 本轮另有明确授权，由它自己的报告负责，不由这份交接自动批准。

## 版本与输入

- 基线提交：`d418ed2fb793b36ea3723bf4614ded8a35f1ad72`，并有未提交的授权改动。最新实际代码、锁、公开数据与构建入口哈希见 [source-file-hashes.json](evidence/source-file-hashes.json)，其集合摘要和精确范围在 [local-audit.json](evidence/local-audit.json)。文档、README与发布白名单属于收尾记录，另行核对；不把本报告自身递归纳入源码摘要。审计脚本可刷新，不能只凭HEAD重放dirty代码。
- npm锁SHA-256：`fc25b75a0a518fa0466a71603561e90b4063821fd97a847c238d69547942d2ef`；Node24.19.0、项目/CI npm10.9.2约定，当前pnpm11.19.0。
- 原始Master：51,992字节、77节，SHA-256 `e3ff6b57f67b198f81cb8234aa835c9e5bf1c12c4c6a5a3763a8c60074141619`；已完整读过2,580行。其来源任务、用户消息和附件标识见 [input-resolution.json](evidence/input-resolution.json)。原文仅在本机已授权附件与 `artifacts/phase-00/private-inputs/master-prompt.txt` 保存，后者被Git忽略。
- 路线图：网站父目录 `PHASE_ROADMAP.md`，SHA-256 `2c058ae2810f628d7157d2a8e5a5a57476305ee9bacf7dbd195cee56316607d6`。
- 数学内容只使用既有批准快照 `a3da43c26a99b9504b28c1bf4d09e6424a9defaa167b722314ee02de2402b2f7`，对象数192，关系605；清单、索引及源文件哈希在审计证据中。此哈希不是新的公开授权。

另一个机器没有本地附件时，应取得用户批准的原Master并核对哈希；不要用本报告的摘要冒充原文。原本检查的3个建议路径确实不存在，但随后已通过明确的原任务附件解决；不要把历史 `ENOENT` 当作当前仍缺Master。

## 怎样启动和复查

从 `website/` 执行，已有依赖时可直接使用Node，不需要npm全局设置：

```powershell
node --check scripts/preview.mjs
node --check quartz/bootstrap-cli.mjs
node scripts/preview.mjs
```

打开 `http://127.0.0.1:8081/World/`，Ctrl+C关闭。本轮审计实际使用随机loopback端口并在结束后关闭，检查了根、`/World/`、原子a-000067及library的HTTP200，原子包含MathML；不是完整视觉或性能验收。

重新审计与验证（仅写Phase0证据，保持原始内容边界）：

```powershell
node --use-env-proxy docs/phases/phase-00/evidence/audit-local.mjs
node docs/phases/phase-00/evidence/master-review.mjs
node docs/phases/phase-00/evidence/register-contract.mjs
node docs/phases/phase-00/evidence/register-quantities.mjs
node docs/phases/phase-00/evidence/catalog-tools.mjs
node docs/phases/phase-00/evidence/finalize-report.mjs
node docs/phases/phase-00/evidence/validate-phase-zero.mjs
```

`master-review.mjs` 只接受本次已核对的原文哈希，原文不同会停止，不会自动把新规格宣布为已审阅。`register-contract.mjs` 有原文审计时保留它的77行，不会退回附录底稿。`finalize-report.mjs` 只更新phase-status中的Phase0，保留其他代理已经写入的阶段状态。审计报告脚本依赖本轮明确来源，不是通用的未来验收自动批准器。

外部调查可独立重跑：

```powershell
node --use-env-proxy docs/phases/phase-00/evidence/audit-official.mjs
```

普通受限shell对公网出现EACCES属于访问渠道限制；本轮通过审批的只读网络访问完成了官方调查。重跑时记录失败，不因为本轮曾成功就伪造新结果。工具调用只查询固定公开包名和仓库，不上传项目文件或笔记。新版本出现时先重新审阅候选，不自动升级依赖。

已有依赖可用时，完整工程检查沿用README。初次安装方式仍是 `pnpm --package=npm@10.9.2 dlx npm ci`，开发 `pnpm --package=npm@10.9.2 dlx npm run dev`。本次审计没有重新运行安装。不要用 `预览博客.cmd` 代替上述静态预览，因为它调用导出流程并读取源库。

## 实际检查与限制

已登记77条原文映射、22项工具记录、40项数量来源、64条未来验收及48行数值源句。Phase0自校验检查结构、范围、全部源码哈希和实际证据文件；它不是人类数学审阅。主任务同轮的类型、230单元、构建、内容、知识和上游检查日志副本见 [baseline-checks.json](evidence/baseline-checks.json)，每条带原文件哈希、时间和退出码来源。正式构建为178篇输入、906项输出。不能把早于某项变更的结果称为它的验证。自校验结果和公共审计文件哈希见 [validation-report.json](evidence/validation-report.json) 与 [evidence-sha256.json](evidence/evidence-sha256.json)；未来若代码、锁或数据改变，先刷新审计再重新核验。

Lean/Lake只有elan启动器、无安装工具链；本轮没跑Lean编译、提取器、sandbox或人类研究。WSL实际返回未安装、Docker未在PATH发现；未选择生产隔离方案。当前使用的GPU驱动读取不可得。浏览器版本存在和静态预览通过不构成新Phase3的FPS、五级形式信息或真实手机证据。

## 恢复、回滚与下一阶段

本轮新增的是公共文档和可复现审计脚本。需要撤销审计时先保存本轮证据，只移除明确的Phase0新增文件；不要硬重置仓库、删除并行Phase1文件或覆盖源库。原提示词备份与其他旧测试证据留在ignored artifacts，不能作为网站资源发布。

Phase1应读：原Master30–34/66、路线图通用契约及完整Phase1、上述原文映射、assumptions、architecture-plan、acceptance-criteria和environment。Phase2只能在后续明确授权、Phase1所需输入和退出条件齐备后执行；届时首先建立锁定Lean项目与真实抽取切片，不把现有知识图当形式数据。

本报告未授予任何研究创新、作者忠实或形式正确性结论。人工审阅字段仍为空；未来需要人员和环境时按相应criterion登记BLOCKED，而不以AI或旧测试替代。
