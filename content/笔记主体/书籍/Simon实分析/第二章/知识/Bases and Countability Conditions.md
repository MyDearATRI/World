---
type: 知识
status: 已整理
layer: Working
aliases:
  - 拓扑可数性
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
  - object/topological-space
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Bases and Countability Conditions
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.2, pp.51–54; Proposition 2.2.2; Problems 1–3, p.62. PDF 72（来源 PDF，第 72 页；原文件未公开） · PDF 83（来源 PDF，第 83 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

Countability is not a single property of a space. A countable supply of points, a countable supply of open sets, and a countable supply of neighborhoods at each point answer different questions. Keeping them separate explains precisely when the sequential arguments from metric spaces remain valid.

## DEF — Four countability properties

A space is first countable if every point has a countable neighborhood base, and second countable if its topology has a countable base. It is separable if it contains a countable dense subset, and Lindelöf if every open cover has a countable subcover. A neighborhood base at $x$ is a family of neighborhoods of $x$ such that every neighborhood of $x$ contains one of its members.

Every metric space is first countable: the balls $B(x,1/n)$ suffice. Every second countable space is first countable, separable, and Lindelöf. To see separability, choose one point in each nonempty basic open set. To prove Lindelöf, take an open cover; for each basic set that is contained in a member of the cover choose one such member. These countably many chosen members still cover the space, because every point has a basic neighborhood inside an original cover member.

## THM — Metric equivalence, with proof

In a metric space,
$$
\text{second countable}\iff\text{separable}\iff\text{Lindelöf}.
$$
Only two implications remain. If $D$ is countable and dense, balls with centers in $D$ and positive rational radii form a countable base. Given $x\in U$, choose $r>0$ with $B(x,3r)\subset U$, then a point $d\in D\cap B(x,r)$ and a rational $q$ with $r<q<2r$. This gives $x\in B(d,q)\subset B(x,3r)\subset U$. If the space is Lindelöf, cover it for each $n$ by all balls of radius $1/n$, and choose a countable subcover. The union over $n$ of the selected centers is countable and dense.

Subspaces of second countable spaces are second countable, by intersecting the base with the subspace. Consequently every subspace of a separable metric space is separable. The metric hypothesis in this consequence is essential to the argument: separability alone does not supply a countable base in a general topology. An uncountable discrete space is first countable but neither separable, second countable nor Lindelöf.

## PROP — The exact role of a countable neighborhood base

Suppose $X$ is first countable. For each $x$, replace a countable neighborhood base $(U_n)$ by the nested base $V_n=U_1\cap\cdots\cap U_n$. If $x\in\overline A$, choose $a_n\in A\cap V_n$. Every neighborhood contains some $V_N$, and therefore contains all $a_n$ with $n\ge N$. Thus $a_n\to x$. Conversely, a limit of points of $A$ lies in $\overline A$ in every topological space.

If $x$ is a cluster point of a sequence $(x_n)$, choose recursively $n_k>n_{k-1}$ with $x_{n_k}\in V_k$; cluster-point membership supplies arbitrarily late indices. The selected subsequence converges to $x$. These arguments expand the mechanisms of §2.2, Problems 2–3; they are note supplementary proofs used here as structural foundations, not a record of a solved exercise by the reader.

For a map with first countable domain, preservation of sequences implies continuity: if $f$ is discontinuous at $x$, there is an open neighborhood $W$ of $f(x)$ such that each $V_n$ contains a point $a_n$ with $f(a_n)\notin W$. Then $a_n\to x$ contradicts preservation of limits. No countability assumption on the codomain is required.

> [!insight] IDEA — How a countable neighborhood base makes sequences sufficient
> First countability lets one arrange all necessary neighborhood tests into a nested list. It therefore turns closure and continuity into sequential tests. This is a sufficient mechanism, not a claim that first countability is necessary for every sequential characterization. The construction immediately above proves the assertions under the stated hypothesis.
>
> 中文：序列够不够用，取决于它能否逐步覆盖所有需要检查的邻域条件。身份：结构总结与补证；非原创性声明。

^insight-ch2-local-tests

## Connections and limits

[[笔记主体/书籍/Simon实分析/第二章/知识/Nets and General Convergence|Nets]] replace the countable list with the full directed family of neighborhood tests. [[笔记主体/书籍/Simon实分析/第二章/知识/Products and Compactness|Countable products]] of metric spaces admit a compatible metric; if the factors are compact, diagonal subsequence arguments prove compactness, while arbitrary products need finite-coordinate neighborhoods and a more general compactness argument. Later, a separable Hilbert space has metrizable weak topology on a bounded ball; the bound controls the tail of the countable coordinate tests, and does not make the weak topology on the whole infinite-dimensional space metrizable.

## Source trail

§2.2, pp.51–54; Proposition 2.2.2; Problems 1–3, p.62. PDF 72（来源 PDF，第 72 页；原文件未公开） · PDF 83（来源 PDF，第 83 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.1 Lots of Definitions|2.1 Lots of Definitions]] · p. 37 · PDF 58（来源 PDF，第 58 页；原文件未公开）
- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.2 Countability and Separation Properties|2.2 Countability and Separation Properties]] · p. 51 · PDF 72（来源 PDF，第 72 页；原文件未公开）
