---
type: 知识
status: 已整理
layer: Working
aliases:
  - 分离与延拓
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
  - method/extension
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Separation and Continuous Extension
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.2, pp.53–59; Theorems 2.2.4–5, 2.2.9–10. PDF 74（来源 PDF，第 74 页；原文件未公开） · PDF 76（来源 PDF，第 76 页；原文件未公开） · PDF 79（来源 PDF，第 79 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

Open sets separate points in different strengths. For analysis, the decisive step is often to turn a separation by neighborhoods into a separation by a continuous real function. Urysohn's lemma supplies that step; extension and metrization then become possible.

## DEF — Separation hypotheses, including Simon's convention

A $T_1$ space has closed singletons. A Hausdorff ($T_2$) space separates distinct points by disjoint open neighborhoods. Simon's $T_3$ means $T_1$ together with separation of a point and a disjoint closed set by open sets; his normal or $T_4$ means $T_1$ together with separation of two disjoint closed sets by open sets. Thus the normal spaces in this chapter are Hausdorff. Some texts omit $T_1$ from the word normal, so the convention must accompany quotations.

Every metric space is normal. For nonempty disjoint closed sets $C,D$, the distance functions $d(x,C)$ and $d(x,D)$ are continuous, since they are $1$-Lipschitz. Their sum is positive at every point, and
$$
f(x)=\frac{d(x,C)}{d(x,C)+d(x,D)}
$$
is continuous, equals $0$ on $C$ and $1$ on $D$. Inverse images of $[0,1/2)$ and $(1/2,1]$ separate the sets. Empty sets cause no difficulty and may be handled by constant functions. Closedness is used to make zero distance imply membership; disjoint closed sets need not have a positive distance from each other globally.

## THM — Urysohn's lemma

If $C,D$ are disjoint closed subsets of a normal space $X$, there is $f:X\to[0,1]$ continuous with $f|_C=0$ and $f|_D=1$.

### Proof — Build ordered neighborhoods, then recover a function

Normality first gives the shrinking rule: if $F\subset U$ with $F$ closed and $U$ open, there is an open $V$ such that $F\subset V\subset\overline V\subset U$. Separate $F$ and $X\setminus U$ by disjoint open sets; the closure of the open set around $F$ avoids the other one.

Put $U_1=X\setminus D$ and choose $U_0$ with $C\subset U_0\subset\overline U_0\subset U_1$. Insert open sets at successive dyadic midpoints using the shrinking rule. The resulting family, indexed by dyadic $r\in[0,1]$, satisfies
$$
r<s\quad\Longrightarrow\quad\overline U_r\subset U_s.
$$
Define $f(x)=\inf\{r:x\in U_r\}$, setting the infimum to $1$ if this set is empty. Points of $C$ belong to $U_0$, while points of $D$ belong to none of these sets, so the required endpoint values hold.

For $0<t\le1$, $\{f<t\}=\bigcup_{r<t}U_r$ is open. For $0\le t<1$,
$$
\{f>t\}=\bigcup_{r>t}\bigl(X\setminus\overline U_r\bigr).
$$
For the nontrivial inclusion, if $f(x)>t$, choose dyadics $t<r<s<f(x)$; then $x\notin U_s$, hence $x\notin\overline U_r$. Conversely, if $x\notin\overline U_r$ for some $r>t$, no $U_q$ with $q<r$ contains $x$, so $f(x)\ge r>t$. These two open inverse-image identities prove continuity. This expands the argument of Theorem 2.2.4, pp.55–57.

> [!remark] RMK — 中文策略
> 关键不是简单地给每个点赋一个数，而是先安排闭包仍然嵌套的邻域。闭包的余量保证所得函数两侧的逆像都开。

## THM — Tietze extension and zero sets

If $E$ is closed in a normal space $X$ and $f:E\to\mathbb R$ is bounded and continuous, it extends to a bounded continuous $F:X\to\mathbb R$, with the same permitted bound $|F|\le M$ when $|f|\le M$. The proof strategy repeatedly uses Urysohn to extend an approximation that reduces the residual bound by a factor $2/3$; the resulting geometric series converges uniformly. This is a quoted theorem with proof assigned to §2.2, Problem 4, pp.62–63; the full exercise solution is not filled in here.

A closed set need not be the exact zero set of the function in Urysohn's lemma. Exact zero sets require an additional countable condition. A $G_\delta$ is a countable intersection of open sets; an $F_\sigma$ is a countable union of closed sets. In metric spaces every nonempty closed $C$ equals $\bigcap_{n\ge1}\{x:d(x,C)<1/n\}$. The empty set is a $G_\delta$ by taking every open set in the intersection to be empty; no distance to an empty set is needed. More generally, in a normal space any closed $G_\delta$ set $C$ is the zero set of a continuous $g:X\to[0,1]$. Write $X\setminus C=\bigcup_nF_n$ with $F_n$ closed. Choose $g_n\in C(X,[0,1])$ equal to $0$ on $C$ and $1$ on $F_n$. Then $g=\sum_n2^{-n}g_n$ converges uniformly, vanishes on $C$, and is positive at every point outside $C$.

For disjoint closed $G_\delta$ sets $C,D$, one can obtain exact fibers $f^{-1}(0)=C$ and $f^{-1}(1)=D$; this is Theorem 2.2.9, with proof in Problem 5. The distinction between assigned values and exact fibers matters in [[笔记主体/书籍/Simon实分析/第二章/知识/Metrization and the Hilbert Cube|metrization]], where a function must detect membership in a prescribed basic open set. [[笔记主体/书籍/Simon实分析/第二章/知识/Semicontinuity, Extrema, and Continuous Partitions|Continuous partitions]] use the same shrinking and separation tools to patch local information.

## Source trail

§2.2, pp.53–59; Theorems 2.2.4–5, 2.2.9–10. PDF 74（来源 PDF，第 74 页；原文件未公开） · PDF 76（来源 PDF，第 76 页；原文件未公开） · PDF 79（来源 PDF，第 79 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.2 Countability and Separation Properties|2.2 Countability and Separation Properties]] · p. 51 · PDF 72（来源 PDF，第 72 页；原文件未公开）
