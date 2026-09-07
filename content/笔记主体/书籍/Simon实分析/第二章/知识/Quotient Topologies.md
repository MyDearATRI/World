---
type: 知识
status: 已整理
layer: Working
aliases:
  - 商拓扑
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
  - method/quotients
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Quotient Topologies
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.8, pp.103–106; Theorems 2.8.2–3 and Examples 2.8.1, 2.8.4–7. PDF 125（来源 PDF，第 125 页；原文件未公开） · PDF 126（来源 PDF，第 126 页；原文件未公开） · PDF 127（来源 PDF，第 127 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

An equivalence relation first specifies which points are to be identified. A quotient topology then asks which observations remain continuous after this identification. The set-theoretic quotient and the topological quotient therefore solve different parts of the construction.

## DEF — The strongest topology compatible with the quotient map

Let $q:X\to X/{\sim}$ be the class map. A set $U\subset X/{\sim}$ is open exactly when $q^{-1}(U)$ is open in $X$. This is a topology because inverse images preserve unions and finite intersections. It is the strongest topology making $q$ continuous. Closed subsets satisfy the analogous inverse-image criterion. A subset of $X$ is saturated if it is a union of entire equivalence classes; inverse images under $q$ are exactly the saturated subsets.

For every map $g:X/{\sim}\to Y$,
$$
g\text{ continuous}\quad\Longleftrightarrow\quad g\circ q\text{ continuous}.
$$
Indeed, $q^{-1}(g^{-1}(V))=(g\circ q)^{-1}(V)$, and the defining criterion translates openness in both directions. Thus a continuous $f:X\to Y$ constant on equivalence classes descends to a unique continuous $g$ with $g\circ q=f$. The [[笔记主体/书籍/Simon实分析/第一章/知识/等价关系与商构造|set-theoretic factorization]] provides uniqueness and well-definedness; the quotient topology supplies continuity.

## PROP — When a quotient describes a target space

Let $f:X\to Y$ be continuous and onto, and identify $x\sim z$ exactly when $f(x)=f(z)$. The induced $g:X/{\sim}\to Y$ is a continuous bijection. If $f$ is open, then $g$ is a homeomorphism: for open $U$ in the quotient, $q^{-1}(U)$ is open and $g(U)=f(q^{-1}(U))$ is open. This proves Theorem 2.8.3.

Continuous surjectivity alone is insufficient. Take the identity from discrete $\mathbb R$ onto usual $\mathbb R$; its fibers are singletons, so the quotient topology is discrete, while the target topology is not. The induced bijection is continuous but its inverse is not. A surjection whose target topology agrees with its fiber quotient is called a quotient map; an open continuous surjection is a sufficient example.

## Separation can be lost

On $[0,1]$, identify two numbers when their difference is rational. Every equivalence class is dense. A nonempty closed saturated subset must contain one dense class and hence all of $[0,1]$. Consequently the only closed sets of the quotient are the empty and full sets; the quotient is indiscrete and not Hausdorff when it has more than one class. Identifying dense classes erases the open-set distinctions needed for separation.

Let $R=\{(x,y):x\sim y\}\subset X\times X$. If the quotient is Hausdorff, then $R$ is closed: $R$ is the inverse image of the closed diagonal under $q\times q$. Conversely, if $R$ is closed and $q$ is open, the quotient is Hausdorff. For nonequivalent $x,y$, find open $U\ni x,V\ni y$ with $(U\times V)\cap R=\varnothing$. Then $q(U)$ and $q(V)$ are disjoint open neighborhoods. Both the closed-relation and open-map assumptions appear in this sufficient criterion; closedness of the relation alone has not been shown sufficient here. These short arguments expand the criterion of Theorem 2.8.2; the corresponding source task remains indexed as §2.8, Problem 1, not as a reader's completed exercise.

## Group actions and concrete quotients

For a group acting by homeomorphisms on $X$, orbit classes define an open quotient map, since $q^{-1}(q(U))=\bigcup_g gU$ is open whenever $U$ is open. This provides the open-map condition in the separation criterion, while closedness of the orbit relation remains a separate question.

The circle can be realized as $\mathbb R/2\pi\mathbb Z$ through $t\mapsto e^{it}$; its local arcs show this map is open and identify the quotient topology with the usual circle topology. More generally, $\mathbb R^n/\mathbb Z^n$ is the $n$-torus, and sufficiently small neighborhoods project homeomorphically onto their images. Discrete fibers alone do not ensure a local homeomorphism: on $(0,1)$ identify $x$ with $1-x$. The quotient is $[1/2,1)$ under $x\mapsto\max(x,1-x)$, and every neighborhood of $1/2$ contains two identified points, so the quotient map is not locally injective there.

A related but distinct construction starts with a topological group $G$, meaning a Hausdorff group with continuous multiplication and inversion, acting continuously and transitively on a space $X$. Fix $x_0$. The stabilizer $H=\{g:g x_0=x_0\}$ is a subgroup, and the fibers of $G\to X$, $g\mapsto g x_0$, are the left cosets $gH$. If this orbit map is open, the induced continuous bijection $G/H\to X$ is a homeomorphism. If $X$ is $T_1$, the stabilizer is closed as the inverse image of $\{x_0\}$; continuity alone without closedness of that singleton does not justify the assertion. This quotient of $G$ by a stabilizer should not be confused with the space of all orbits of an action on $X$.

An irrational rotation action of $\mathbb Z$ on the circle has dense orbits, and its orbit quotient is indiscrete, like the rational-difference example. Taking orbits can therefore preserve or destroy Hausdorffness depending on the relation.

## Relation to completion and product constructions

The [[笔记主体/书籍/Simon实分析/第一章/联系/从商构造到完备化与实数|completion construction]] first enlarges the objects to Cauchy sequences and then identifies equivalent sequences. A quotient of the original points alone does not add missing limits. A quotient topology need not arise from a metric at all, so it cannot be treated as the zero-distance quotient from Chapter 1 without further verification.

[[笔记主体/书籍/Simon实分析/第二章/知识/Products and Compactness|Products]] use the weakest topology making maps out of the new space continuous; quotients use the strongest topology making a specified map into the new space continuous. The useful comparison is the pair of continuity tests, not a claim that the two constructions preserve the same separation or compactness properties. Quotients of compact spaces are compact as continuous images, but the dense-orbit examples show why Hausdorffness must still be checked.

## Source trail

§2.8, pp.103–106; Theorems 2.8.2–3 and Examples 2.8.1, 2.8.4–7. PDF 125（来源 PDF，第 125 页；原文件未公开） · PDF 126（来源 PDF，第 126 页；原文件未公开） · PDF 127（来源 PDF，第 127 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.8 Quotient Topologies|2.8 Quotient Topologies]] · p. 103 · PDF 124（来源 PDF，第 124 页；原文件未公开）
- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#5.1 Some Preliminaries|5.1 Some Preliminaries]] · p. 357 · PDF 378（来源 PDF，第 378 页；原文件未公开）
