---
type: 联系
status: 已整理
layer: Working
aliases:
  - 从度量序列到拓扑 nets
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/联系
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
  - method/convergence
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-relation
title: From Metric Sequences to Topological Nets
siteKind: body
---
#用途/正式 #类型/联系 #主题/实分析

> 从度量序列到拓扑 nets

Source: Simon, *Real Analysis*, AMS 2015, §§1.2, 2.2, 2.6; pp. 4–6（来源 PDF，第 25 页；原文件未公开） and pp. 93–98（来源 PDF，第 114 页；原文件未公开）. This is a source-based comparison; the role of countable local tests is made explicit.

## The resource hidden inside a sequence argument

In a metric space, a point $x$ belongs to $\overline A$ exactly when some sequence in $A$ converges to $x$. The constructive direction chooses

$$
a_n\in A\cap B_{1/n}(x).
$$

Every neighbourhood of $x$ contains one of these balls, so this single countable list eventually tests every neighbourhood. The [[笔记主体/书籍/Simon实分析/第一章/知识/度量拓扑与连续性的三种刻画#开球、闭包与收敛|chapter-one argument]] therefore uses more than the existence of open sets: it uses a countable local base.

The same argument works at any first-countable point. Given a countable neighbourhood base $V_1,V_2,\ldots$, replace it by $U_n=V_1\cap\cdots\cap V_n$. Choosing $a_n\in A\cap U_n$ then gives convergence. No distance function is needed once this decreasing base is available. The appropriate transfer is from metric neighbourhoods to countable local tests; [[笔记主体/书籍/Simon实分析/第二章/知识/Bases and Countability Conditions|Bases and Countability Conditions]] separates that property from a countable base for the whole space.

> 中文备注：这里能推广的是“可数局部基”，不是把所有拓扑空间都当成有开球的空间。

## A topology that sequences cannot recover

Give $X=[0,1]$ the cocountable topology: a nonempty open set is the complement of a countable set. If $x_n\to x$, the set $E=\{x_n:x_n\ne x\}$ is countable, and $X\setminus E$ is a neighbourhood of $x$. Eventually $x_n\notin E$, hence eventually $x_n=x$.

Now $A=X\setminus\{0\}$ is dense: every nonempty open set meets it. Nevertheless, no sequence in $A$ converges to $0$. Thus closure has information that all convergent sequences together fail to detect. This is the mechanism of Simon's Example 2.6.1, pp. 94–95（来源 PDF，第 115 页；原文件未公开）.

The same source example also gives a continuity test. The identity from this space to the same set with the discrete topology preserves convergent sequences, since these are eventually constant. It is not continuous: the preimage of a singleton is not open in the cocountable topology. This example exhibits the gap between sequential continuity and continuity, rather than merely warning that the two definitions differ.

## Index the approximation by the actual tests

A net replaces the particular directed set $\mathbb N$ by a directed set adapted to the problem. If $x\in\overline A$, order its neighbourhoods by reverse inclusion: $U\preceq V$ means $V\subseteq U$. This is a directed partial order because $U\cap V$ is a common refinement. Choose $a_U\in A\cap U$ for each neighbourhood $U$. Once an index refines a given neighbourhood $V$, all subsequent values lie in $V$. Hence $a_U\to x$.

This construction makes the same representative choices as the source proof; it uses the choice principles available in Chapter 1. Its convergence argument depends on refinement, not on a countable enumeration. [[笔记主体/书籍/Simon实分析/第二章/知识/Nets and General Convergence|Nets and General Convergence]] gives the corresponding closure and continuity theorems and the precise subnet definition.

This comparison also explains why a convergent subnet must satisfy an eventual cofinality requirement. Merely taking arbitrarily large isolated indices can lose the meaning of “eventually”; the new indexing must eventually lie beyond each original threshold.

## What remains useful about sequences

Sequences remain effective in metric spaces and on the metrizable weak balls encountered in [[笔记主体/书籍/Simon实分析/第三章/知识/Weak Topologies and Dual Pairings|Weak Topologies and Dual Pairings]]. They are not an inferior notation to be abandoned. They work when countable tests capture the local topology. Nets provide the general statement when that reduction is unavailable.

The two chapters therefore connect through a conditional upgrade: preserve the sequence proof where its local-base hypothesis is present, and replace its indexing when the topology requires more tests. Compactness must undergo the same check. The metric theorem “every sequence has a convergent subsequence” does not serve as the definition of compactness in an arbitrary topological space.

[[笔记主体/发现归档|Insights and additions]] · [[maps/前三章关系图-6db33b5d|Chapters 1–3 map]] · [[笔记主体/书籍/Simon实分析/Simon - Real Analysis|Book entrance]]
