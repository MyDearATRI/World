---
type: 知识
status: 已整理
layer: Working
aliases:
  - 紧性与全有界
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
title: Compactness and Total Boundedness
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.3, pp.63–70; Theorems 2.3.1, 2.3.4, 2.3.6, 2.3.8–12; Proposition 2.3.2. PDF 85（来源 PDF，第 85 页；原文件未公开） · PDF 87（来源 PDF，第 87 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

Compactness converts a family of local tests into finitely many sufficient tests. In metric spaces this topological condition has a second description: points cannot escape by remaining uniformly far apart, and Cauchy approximations cannot fail to land in the space. These are total boundedness and completeness, respectively.

## DEF — Compactness and finite intersections

A space $X$ is compact if every open cover has a finite subcover. A family of closed sets has the finite intersection property if every finite subfamily has nonempty intersection. Compactness is equivalent to the assertion that every such family has nonempty total intersection. This follows by taking complements: an empty total intersection becomes an open cover, while an empty finite intersection becomes a finite subcover.

Closed subsets of compact spaces are compact: add their open complement to a cover. Continuous images of compact spaces are compact: pull a cover back. A compact subset $K$ of a Hausdorff space is closed. For $x\notin K$, choose disjoint neighborhoods of $x$ and each $y\in K$; finitely many of the neighborhoods of $y$ cover $K$, and the intersection of the corresponding neighborhoods of $x$ avoids $K$.

Every compact Hausdorff space is normal. First separate each point of a compact closed set $C$ from the disjoint compact closed set $D$ by the preceding finite-neighborhood construction. Finitely many neighborhoods cover $C$; their union is disjoint from the intersection of the corresponding neighborhoods of $D$. Hausdorffness is used before taking finite subcovers. Compactness by itself does not make subsets closed in an ambient space.

## THM — Three equivalent metric compactness criteria

For a metric space $(X,d)$, the following are equivalent:
$$
X\text{ compact}\quad\Longleftrightarrow\quad
\text{every sequence has a convergent subsequence}\quad\Longleftrightarrow\quad
X\text{ complete and totally bounded}.
$$
Total boundedness means that for every $\varepsilon>0$, finitely many open balls of radius $\varepsilon$ cover $X$. Simon uses “weakly sequentially compact” for every sequence having a cluster point; in metric spaces a cluster point gives a convergent subsequence, so the middle criterion agrees with his Theorem 2.3.6.

### Proof — Prevent escape, then use completeness

If a sequence in a compact space had no cluster point, each point would have a neighborhood containing only finitely many terms of the sequence. A finite subcover would imply there were only finitely many indices in total, a contradiction. First countability then extracts a convergent subsequence.

Suppose every sequence has a convergent subsequence. If total boundedness failed for some $\varepsilon>0$, choose $x_{n+1}$ outside $\bigcup_{j\le n}B(x_j,\varepsilon)$. The resulting sequence has pairwise distances at least $\varepsilon$ and cannot have a convergent subsequence. If $(x_n)$ is Cauchy, a convergent subsequence has a limit $x\in X$, and the triangle inequality makes the entire sequence converge to $x$. Thus $X$ is complete.

Conversely, suppose $X$ is complete and totally bounded. From an arbitrary sequence, select infinitely many terms in one ball of radius $1/2$, then infinitely many of those in one ball of radius $1/4$, and continue. Picking indices increasingly from the nested infinite selections gives a Cauchy subsequence: two sufficiently late terms lie in the same ball of arbitrarily small radius. Completeness supplies its limit.

To obtain the open-cover conclusion directly from these facts, let $\mathcal U$ be an open cover. There is a uniform $\delta>0$ such that every ball $B(x,\delta)$ is contained in some member of $\mathcal U$. Otherwise choose $x_n$ for which $B(x_n,1/n)$ is contained in no member. A convergent subsequence tends to $x$; an open member containing $x$ contains a ball $B(x,r)$, and for large subsequence indices $B(x_n,1/n)\subset B(x,r)$, a contradiction. Total boundedness provides a finite $\delta$-ball cover, and choosing its containing members completes the proof. This is an expanded proof of Theorem 2.3.6; the last argument makes explicit where sequential compactness controls an arbitrary cover.

> [!insight] IDEA — Compactness has two independent metric failure modes
> Total boundedness prevents an infinite family of uniformly separated points; completeness ensures that increasingly compatible approximations have a limit inside the space. The interval $(0,1)$ is totally bounded but incomplete. An infinite discrete space with distance $1$ between distinct points is complete but not totally bounded. Both hypotheses are therefore necessary in the metric criterion proved above.
>
> 中文：一个条件阻止点不断逃向彼此分离的位置，另一个条件补上极限的缺口。身份：结构总结；两个反例直接核实。

^insight-ch2-two-obstructions

## Consequences for analysis

A subset of $\mathbb R^n$ is compact exactly when closed and bounded. Bounded subsets admit finite small grids, hence are totally bounded, and closed subsets of the complete space $\mathbb R^n$ are complete. Conversely a compact subset is closed and bounded. The same closed-and-bounded test does not extend to arbitrary complete metric spaces: the infinite discrete example already fails it.

A subset $A$ of a complete metric space has compact closure exactly when it is totally bounded. The closure remains totally bounded, and completeness is inherited by closed subsets. Simon calls compactness of the closure precompactness. A continuous map from compact $X$ to Hausdorff $Y$ that is bijective is a homeomorphism: closed subsets of $X$ have compact, hence closed, images in $Y$. A continuous map from compact metric $X$ into a metric space is uniformly continuous: failure would give $x_n,y_n$ with $d(x_n,y_n)\to0$ but images separated by a fixed positive amount; a convergent subsequence of $x_n$ forces both subsequences to the same limit.

For [[笔记主体/书籍/Simon实分析/第二章/知识/Equicontinuity and Compact Families|families of functions]], total boundedness must control entire graphs with one finite collection of tests. For general topological spaces, replace the sequential criterion by the [[笔记主体/书籍/Simon实分析/第二章/知识/Nets and General Convergence|net compactness criterion]]; the metric theorem does not authorize a sequential definition everywhere.

## Source trail

§2.3, pp.63–70; Theorems 2.3.1, 2.3.4, 2.3.6, 2.3.8–12; Proposition 2.3.2. PDF 85（来源 PDF，第 85 页；原文件未公开） · PDF 87（来源 PDF，第 87 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.3 Compact Spaces|2.3 Compact Spaces]] · p. 63 · PDF 84（来源 PDF，第 84 页；原文件未公开）
