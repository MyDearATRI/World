---
type: 知识
status: 已整理
layer: Working
aliases:
  - 连通与分支
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
title: Connectedness and Components
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.1, pp.44–47; Theorems 2.1.13, 2.1.16, Corollary 2.1.17; Problems 5–8, p.51. PDF 65（来源 PDF，第 65 页；原文件未公开） · PDF 72（来源 PDF，第 72 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

Continuity preserves an inability to split a space into two separated open pieces. This is weaker than the existence of a path joining any two points. Both notions describe a whole space, not a distance between individual points.

## DEF — Connectedness and paths

A separation of $X$ is a representation $X=U\cup V$ with $U,V$ disjoint, nonempty, open subsets of $X$. A space is connected if it has no separation. Equivalently, its only clopen subsets are $\varnothing$ and $X$. A curve from $x$ to $y$ is a continuous map $\gamma:[0,1]\to X$ with endpoints $x,y$; Simon calls a space arcwise connected when every two points can be joined this way. Here this terminology refers to paths and does not impose injectivity on the curve.

The connected component of $x$ is the largest connected subset containing $x$. To construct it, take the union of all connected subsets containing $x$. This union is connected: if it were separated, the piece containing $x$ would have to contain every member of the union. Components are therefore disjoint or equal, and partition $X$. They are closed because the closure of a connected set is connected. A totally disconnected space has only singleton components; it need not be discrete, as $\mathbb Q$ with its usual topology shows. Two rationals can be separated inside $\mathbb Q$ by an irrational cut, so every connected subset contains at most one point.

## THM — Connectedness survives closure, images, and overlapping unions

If $A$ is connected, so is $\overline A$. Indeed, a separation of $\overline A$ would induce a separation of $A$ unless $A$ lay in just one side; but the other side, being nonempty and relatively open, would then contradict density of $A$ in $\overline A$. If $f:X\to Y$ is continuous and $X$ is connected, $f[X]$ is connected because inverse images of a proposed separation would separate $X$.

A union of connected subsets with a common point is connected by the same argument. More generally, Simon's pairwise-intersection hypothesis is sufficient: a separation would force each connected member entirely into one side, and intersecting members cannot choose different sides. A path has connected image since $[0,1]$ is connected, and the union of paths from a fixed point proves that path connectedness implies connectedness.

An interval in $\mathbb R$ is connected: a separation and a point in each side would produce a boundary point between them by the supremum property, contradicting relative openness. Conversely, a connected subset of $\mathbb R$ must contain every point between any two of its points, since a missing intermediate point separates it by two half-lines. The [[笔记主体/书籍/Simon实分析/第一章/知识/实数构造与上确界性质|supremum property]] thus enters the elementary model on which the path argument depends.

## C.EX — Connected does not imply path connected

Let
$$
T=\{(x,\sin(1/x)):0<x\le1\}\cup\bigl(\{0\}\times[-1,1]\bigr).
$$
The first set is a continuous image of $(0,1]$, and $T$ is its closure, so $T$ is connected. No path joins the vertical segment to the oscillating graph. A proof works by considering the last zero of the path's first coordinate before a point with positive first coordinate. Immediately afterward that coordinate takes arbitrarily small positive values, forcing the second coordinate through both $1$ and $-1$ arbitrarily near the departure time, contrary to continuity. This is a proof strategy; Simon's §2.1, Problem 6 supplies the detailed oscillation task.

## THM — Local paths turn connectedness into a global path

A space is locally path connected when each point has a neighborhood base of path connected sets. Every path component is then open: any point in a path component has a path connected neighborhood wholly in that component. Its complement, a union of other path components, is also open. A nonempty connected, locally path connected space therefore has a single path component.

Open subsets of $\mathbb R^n$ are locally path connected, since sufficiently small balls remain inside the open set and are convex. Hence an open connected subset of $\mathbb R^n$ is path connected. The local hypothesis does real work: it rules out the obstruction at the vertical segment of $T$. For later [[笔记主体/书籍/Simon实分析/第二章/知识/Quotient Topologies|quotient constructions]], continuous images preserve connectedness, but separation properties such as Hausdorffness require an independent check.

## Source trail

§2.1, pp.44–47; Theorems 2.1.13, 2.1.16, Corollary 2.1.17; Problems 5–8, p.51. PDF 65（来源 PDF，第 65 页；原文件未公开） · PDF 72（来源 PDF，第 72 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.1 Lots of Definitions|2.1 Lots of Definitions]] · p. 37 · PDF 58（来源 PDF，第 58 页；原文件未公开）
