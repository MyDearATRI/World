---
type: 知识
status: 已整理
layer: Working
aliases:
  - 网与收敛
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
  - method/convergence
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Nets and General Convergence
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.6, pp.93–99; Examples 2.6.1–2, Theorems 2.6.3–4. PDF 115（来源 PDF，第 115 页；原文件未公开） · PDF 117（来源 PDF，第 117 页；原文件未公开） · PDF 119（来源 PDF，第 119 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

The topology of a space is determined by all neighborhood tests. Sequences inspect those tests through a countable time index and can miss information. Nets keep the eventual-membership idea of convergence while allowing an index set adapted to all the relevant tests.

## C.EX — Convergent sequences can miss a topology

On an uncountable set $X$, let the nonempty open sets be those with countable complement. Every convergent sequence is eventually equal to its limit: if $x_n\to x$, the countable set of its values different from $x$ can be removed to obtain a neighborhood of $x$. Conversely an eventually constant sequence converges. Thus this cocountable topology and the discrete topology have exactly the same convergent sequences, although their open sets differ. The identity into the discrete space is sequentially continuous and not continuous. The cocountable topology is $T_1$ but not Hausdorff, so uniqueness of sequential limits is not enough to characterize Hausdorffness either.

Simon also gives a compact weak-* dual-ball example with no convergent subsequence in a specified sequence (Example 2.6.2). Its compactness uses Banach–Alaoglu from Chapter 5; here it remains a forward reference, not a premise in the proofs below.

## DEF — Directed tests, convergence, and subnets

A nonempty partially ordered set $(I,\preceq)$ is directed if every two indices have a common upper bound. We use a reflexive order; Simon's printed order signs play this same directed-order role. A net is a map $i\mapsto x_i$ from $I$ into $X$. A statement holds eventually if it holds for all $i\succeq i_0$ for some $i_0$, and frequently if for every $i_0$ it holds for some $i\succeq i_0$. A net converges to $x$ if it is eventually in every neighborhood of $x$, while $x$ is a cluster point if it is frequently in every neighborhood.

A subnet has the form $y_j=x_{F(j)}$ for a map $F:J\to I$ such that for every $i_0$, eventually $F(j)\succeq i_0$. This is Simon's eventual-cofinal definition; monotonicity of $F$ is not required. Any subnet of a convergent net converges to the same limit, and a subnet of a subnet is a subnet by composing the eventual-cofinal maps.

## THM — Nets recover closure and continuity

A point $x$ lies in $\overline A$ iff some net in $A$ converges to $x$. For the forward direction, direct the open neighborhoods of $x$ by reverse inclusion and choose $a_U\in A\cap U$. Given $U_0$, every later neighborhood is contained in $U_0$, so $a_U$ is eventually in $U_0$. Conversely, if a net in $A$ converged outside $\overline A$, it would eventually lie in the open complement of $\overline A$, an impossibility.

A map is continuous iff it preserves convergence of all nets. Continuity gives the forward direction by pulling neighborhoods back. For the converse, let $C\subset Y$ be closed and let $x\in\overline{f^{-1}(C)}$. A net in $f^{-1}(C)$ tends to $x$; its image tends to $f(x)$ and stays in $C$, hence $f(x)\in C$. Thus $f^{-1}(C)$ is closed. In particular, spaces on the same underlying set with the same convergent nets have the same closures and the same topology.

A space is Hausdorff iff no net has two distinct limits. Disjoint neighborhoods prove one direction. If distinct $x,y$ have no disjoint neighborhoods, direct pairs $(U,V)$ of their neighborhoods by simultaneous reverse inclusion and choose $z_{U,V}\in U\cap V$. This net converges to both points. These are expanded proofs of Theorem 2.6.3(a)–(c),(e).

## THM — Cluster points, subnets, and compactness

A cluster point $x$ of $(x_i)$ is the limit of a subnet. Direct pairs $(i,U)$, with $U$ a neighborhood of $x$, by increasing $i$ and shrinking $U$. Since $x$ is a cluster point, choose $F(i,U)\succeq i$ with $x_{F(i,U)}\in U$. The map is eventually cofinal and the selected net converges to $x$. Conversely, convergence of a subnet and eventual cofinality force arbitrarily late original terms into each neighborhood, so $x$ is a cluster point.

Now $X$ is compact iff every net has a cluster point, equivalently a convergent subnet. If a net in compact $X$ had no cluster point, each $x$ would have a neighborhood avoided by all sufficiently late terms. A finite subcover and a common upper bound for its finitely many thresholds would force a late term outside $X$.

Conversely, if an open cover has no finite subcover, direct its finite subfamilies $F$ by inclusion and choose $x_F$ outside the union of $F$. A cluster point $x$ belongs to some cover member $U$. Once $F$ contains $U$, every later term avoids $U$, contradicting the cluster-point condition. Thus compactness follows. The empty space is compact and has no nets from a nonempty directed set; the formulation remains valid vacuously.

## One-sided tests and completeness

For an extended-real net, define $\liminf_i a_i=\sup_{i_0}\inf_{i\succeq i_0}a_i$. A function is lsc iff $f(x)\le\liminf_i f(x_i)$ whenever $x_i\to x$. The forward implication uses eventual membership in $\{f>a\}$; the converse constructs a neighborhood net in a nonclosed sublevel set. The source assigns the detailed proof to §2.6, Problem 2.

A metric net is Cauchy when every $\varepsilon>0$ eventually bounds all pairwise distances in its tail. In a complete metric space every Cauchy net converges: choose successively later tail representatives with pairwise tail diameters below $2^{-n}$, use sequence completeness for those representatives, and then compare the whole tail with a sufficiently late representative. This is the mechanism of Problem 3, cited here as a proof strategy. Nets do not change the meaning of metric completeness; they extend the available convergence tests.

[[笔记主体/书籍/Simon实分析/第二章/知识/Products and Compactness|Tychonoff's theorem]] uses these compactness and subnet criteria to enlarge partial limits one coordinate at a time. [[笔记主体/书籍/Simon实分析/第二章/知识/Bases and Countability Conditions|First countability]] explains when the simpler sequential arguments remain sufficient.

## Source trail

§2.6, pp.93–99; Examples 2.6.1–2, Theorems 2.6.3–4. PDF 115（来源 PDF，第 115 页；原文件未公开） · PDF 117（来源 PDF，第 117 页；原文件未公开） · PDF 119（来源 PDF，第 119 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.6 Nets|2.6 Nets]] · p. 93 · PDF 114（来源 PDF，第 114 页；原文件未公开）
