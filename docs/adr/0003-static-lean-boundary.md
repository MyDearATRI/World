# ADR 0003：先静态形式证据，再单独验证实时 Lean

状态：Phase 0 有条件选择；运行兼容性 NOT_RUN。

当前网站是 GitHub Pages 静态站点，没有 Lean 项目、已安装工具链或服务器沙箱。本机 elan 的存在不提供 Lean 可执行环境。官方 lean4web 明确把 Lean 放在服务器上；浏览器编辑库提供的是连接与界面，不是可直接放入 Pages 的独立形式内核。[lean4web 官方说明](https://github.com/leanprover-community/lean4web)

决定在 Phase 2 先以锁定环境离线编译与抽取，生成只读、可验证、可追溯的静态证据；Phase 6 再评估实际在线会话。Lean v4.33.1 的 language server 包含进程、快照和 InfoTree；RPC 会话对象依附打开的文件，不能把会话内引用当永久公开 ID。[服务器源码](https://github.com/leanprover/lean4/tree/v4.33.1/src/Lean/Server)、[RPC 类型](https://github.com/leanprover/lean4/blob/v4.33.1/src/Lean/Server/Rpc/Basic.lean)

Phase 2 候选起点为 Lean 4.33.1 + mathlib v4.33.1。官方同名 mathlib 标签的 toolchain 已核对，但当前没有做 Lake 构建，兼容性仍须实测。其他工具按匹配 Lean 的 release/tag/commit 选择，不以主分支混搭。[mathlib toolchain](https://github.com/leanprover-community/mathlib4/blob/v4.33.1/lean-toolchain)

公开实时 Lean 前，须有实际验证的会话隔离、无宿主凭据、只读依赖、不可写发布源码、受限网络、CPU/内存/时间配额、取消清理和故障恢复。当前 Docker 未发现、WSL 返回未安装；没有选定或部署沙箱。Worker、普通子进程以及持续集成 runner 都不自动满足这些条件。容器或其他隔离方式本轮仅作为后续评估方向，不声称选定版本已经可靠。

替代方案是继续静态阅读和证据查看，将实时编辑留给读者自己的 Lean 环境。它减少部署和隔离成本，但不满足 Phase 6 完整闭环；若采用这一范围收缩，必须由用户明确确认，不能将 Phase 6 标 PASS。
