---
type: 知识
status: 已整理
layer: Working
aliases:
  - 局部紧与紧化
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
  - method/compactness
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Local Compactness and Compactification
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.3, pp.72–75; Theorems 2.3.17–18; §2.5, Theorem 2.5.5, p.91. PDF 93（来源 PDF，第 93 页；原文件未公开） · PDF 96（来源 PDF，第 96 页；原文件未公开） · PDF 112（来源 PDF，第 112 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

A noncompact space may still admit compact control near every point. Local compactness isolates this property, and one-point compactification packages escape from all compact subsets into a new point. It does not repair an arbitrary noncompact space without hypotheses.

## DEF — Compact neighborhoods and the extra point

Following Simon, a locally compact space is Hausdorff and every point has a compact neighborhood. This means that for each $x$ there are an open set $U$ and a compact set $K$ with $x\in U\subset K$. In a Hausdorff space compact sets are closed. Shrinking inside a compact neighborhood shows that each point has a base of neighborhoods with compact closure: use normality of the compact neighborhood to shrink around the point while remaining inside its interior.

For locally compact Hausdorff $X$, add a point $\infty$ and define
$$
X^\infty=X\cup\{\infty\},\qquad
\mathcal T^\infty=\mathcal T_X\cup\{X^\infty\setminus K:K\subset X\text{ compact}\}.
$$
Thus neighborhoods of infinity mean being outside a compact subset of $X$. This family is a topology. Finite intersections of neighborhoods of infinity correspond to finite unions of compact sets. A union containing one such neighborhood has complement a closed subset of its compact complement, hence compact; unions avoiding infinity are simply open sets of $X$.

## THM — Compactness and Hausdorffness of the extension

Every open cover of $X^\infty$ contains a member $U_\infty$ that contains infinity. Its complement $K\subset X$ is compact, so finitely many other members cover $K$. Together with $U_\infty$ they cover $X^\infty$.

Two points of $X$ retain their disjoint neighborhoods. To separate $x\in X$ from infinity, take a compact neighborhood $K$ of $x$ with open $V$ satisfying $x\in V\subset K$. Then $V$ and $X^\infty\setminus K$ are disjoint neighborhoods. This is exactly the step requiring local compactness. The induced topology on $X$ is its original topology, and $X$ is open in $X^\infty$.

If $X$ is noncompact, $X$ is dense in $X^\infty$: every neighborhood of infinity meets $X$. If $X$ was already compact, $\{\infty\}$ is open and the added point is isolated. In that case the construction remains compact Hausdorff, but is not a compactification with dense original space under the usual dense-embedding convention.

## Examples and limits

$\mathbb R^n$ is locally compact because closed bounded balls are compact; its one-point compactification is homeomorphic to the sphere $S^n$ by stereographic projection. The source proof here is the compactification theorem, while the explicit stereographic homeomorphism is a standard example rather than a proof reproduced on this page. An infinite discrete space is locally compact, with compact subsets exactly the finite subsets, so infinity has cofinite neighborhoods. The rational numbers are not locally compact in their usual topology: a putative compact neighborhood contains a rational interval, within which a rational sequence tending to an irrational point has no subsequence converging in $\mathbb Q$.

A net tends to infinity exactly when it eventually leaves every compact subset of $X$. This is stronger than leaving one chosen bounded set, and in arbitrary locally compact spaces compact subsets need not coincide with bounded subsets of a chosen metric. It is a topological statement.

## Vanishing at infinity and a metrization criterion

A continuous real function vanishes at infinity when $\{x:|f(x)|\ge\varepsilon\}$ is compact for every $\varepsilon>0$. Simon denotes this space $C_\infty(X)$; many texts write $C_0(X)$. Such functions are exactly the restrictions of continuous functions on $X^\infty$ that vanish at infinity. Indeed, continuity at the added point is precisely the compact-level-set condition.

For locally compact Hausdorff $X$, Theorem 2.3.18 says that $X^\infty$ is metrizable iff $X$ is second countable and $\sigma$-compact, iff $C_\infty(X,\mathbb R)$ is separable in uniform norm. Here $\sigma$-compact ordinarily means a countable union of compact sets; Simon uses a compact exhaustion $K_n\subset K_{n+1}^{\circ}$ with union $X$. In this locally compact Hausdorff setting the formulations agree: finitely many compact neighborhoods cover each compact member of a countable cover, and their finite unions can be enlarged successively to contain each preceding union in their interiors. The proof of the stated equivalence is assigned to §2.3, Problem 5: translate countability and continuous-function separation to the compact space $X^\infty$ and use [[笔记主体/书籍/Simon实分析/第二章/知识/Metrization and the Hilbert Cube|compact metrization criteria]]. The vanishing-at-infinity identification also gives the locally compact version of [[笔记主体/书籍/Simon实分析/第二章/知识/Algebras, Lattices, and Uniform Approximation|Stone–Weierstrass]].

## Source trail

§2.3, pp.72–75; Theorems 2.3.17–18; §2.5, Theorem 2.5.5, p.91. PDF 93（来源 PDF，第 93 页；原文件未公开） · PDF 96（来源 PDF，第 96 页；原文件未公开） · PDF 112（来源 PDF，第 112 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.3 Compact Spaces|2.3 Compact Spaces]] · p. 63 · PDF 84（来源 PDF，第 84 页；原文件未公开）
- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#4.10 Measures on Locally Compact and σ-Compact Spaces|4.10 Measures on Locally Compact and σ-Compact Spaces]] · p. 275 · PDF 296（来源 PDF，第 296 页；原文件未公开）
