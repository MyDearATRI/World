---
type: 知识
status: 已整理
layer: Working
aliases:
  - 可度量化与 Hilbert 立方体
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Metrization and the Hilbert Cube
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.2, Theorem 2.2.1 and Example 2.2.11, pp.51, 59–60; §2.3, Theorem 2.3.7, pp.67–68. PDF 80（来源 PDF，第 80 页；原文件未公开） · PDF 88（来源 PDF，第 88 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

A topology can be represented by numerical coordinates when a countable family of continuous functions records all its open-set tests. The desired representation must be a topological embedding, not merely an injective continuous map.

## DEF — A countable coordinate space

The Hilbert cube is $Q=[0,1]^{\mathbb N}$ with
$$
\rho(u,v)=\sup_{n\ge1}2^{-n}|u_n-v_n|.
$$
The supremum is a maximum unless all coordinate differences vanish; in either case it defines a metric. Coordinate convergence is equivalent to convergence in this metric. Indeed, a small metric controls any specified coordinate, while to control the metric one first makes the tail $2^{-n}$ small and then controls the finitely many remaining coordinates. Consequently $F:Y\to Q$ is continuous exactly when each coordinate function $F_n$ is continuous. This is the countable product topology, as explained in [[笔记主体/书籍/Simon实分析/第二章/知识/Products and Compactness|products and compactness]].

A basic open neighborhood restricts finitely many coordinates; an arbitrary open set is a union of such neighborhoods. It need not itself be a single finite-coordinate cylinder.

## THM — Urysohn metrization in Simon's formulation

A second countable normal space is metrizable. Here normal includes $T_1$, as specified in [[笔记主体/书籍/Simon实分析/第二章/知识/Separation and Continuous Extension|the separation conventions]].

### Proof — Produce coordinates that recognize the base

Let $(U_n)$ be a countable base. Every closed set $C$ is a $G_\delta$. To prove this, work in $X\setminus C$, which is second countable and hence Lindelöf. For each $x\notin C$, regularity supplies an open $V_x$ containing $x$ with $\overline V_x\cap C=\varnothing$. Select a countable subcover $(V_j)$ of $X\setminus C$. Then $C=\bigcap_j(X\setminus\overline V_j)$.

The zero-set construction from Urysohn's lemma now gives $f_n:X\to[0,1]$ continuous with $f_n^{-1}(0)=X\setminus U_n$. Define $F(x)=(f_n(x))_n$. It is continuous by the coordinate criterion. If $x\ne y$, the $T_1$ property and the base give some $U_n$ containing $x$ and avoiding $y$; hence $f_n(x)>0=f_n(y)$. Thus $F$ is injective.

The inverse map from $F[X]$ to $X$ is continuous because
$$
F[U_n]=F[X]\cap\{u\in Q:u_n>0\}.
$$
The right-hand side is relatively open. Since the $U_n$ form a base, this checks all open sets of $X$. Finally, $d(x,y)=\rho(F(x),F(y))$ is a metric inducing the original topology. This expands the original proof on pp.59–60. Second countability supplies only countably many coordinates; exact zero sets make those coordinates recognize the topology.

> [!insight] PROP — Injective coordinates must also recover open sets
> A continuous injective coordinate map becomes an embedding when inverse images are not the only controlled direction: the basic open sets of the domain must be relatively open in the image. The identities $F[U_n]=F[X]\cap\{u_n>0\}$ verify this here. A continuous injection alone does not suffice, as the identity from discrete $\mathbb R$ into usual $\mathbb R$ shows.
>
> 中文：坐标能区分点，还不代表坐标保留了原来的邻域信息。身份：原书论证的结构总结；反例与验证均已展开。

^insight-ch2-coordinate-recovery

## Consequences and boundaries

For a compact Hausdorff space $X$, the following are equivalent: metrizability, second countability, and separability of $C(X,\mathbb R)$ in the uniform norm (Theorem 2.3.7). Compact metric spaces are totally bounded and hence separable; countable dense points with rational radii then produce a countable base. In the reverse direction, compact Hausdorff spaces are normal, so the theorem above applies.

For the function-space equivalence, a compact metric space has finite partitions subordinate to small balls; rational linear combinations of a countable choice of these partitions form a dense family in $C(X,\mathbb R)$. Conversely, take a countable uniformly dense family of continuous real functions and rescale each to $[0,1]$. The family separates points, since Urysohn supplies a separating function and uniform approximation preserves a strict gap. Its coordinate map into $Q$ is continuous and injective, and a continuous bijection from compact to Hausdorff is a homeomorphism onto its image. This gives a proof strategy with all dependencies stated; the complete source proof is on pp.67–68.

The compactness shortcut cannot replace the inverse-open-set argument in the general metrization theorem, where $X$ need not be compact. Nonmetrizable compact products in §2.7 show why compactness alone does not supply a countable coordinate system. Their individual coordinates are perfectly continuous, but no countable selection necessarily detects every open-set test.

## Source trail

§2.2, Theorem 2.2.1 and Example 2.2.11, pp.51, 59–60; §2.3, Theorem 2.3.7, pp.67–68. PDF 80（来源 PDF，第 80 页；原文件未公开） · PDF 88（来源 PDF，第 88 页；原文件未公开）
