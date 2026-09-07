---
type: 知识
status: 已整理
layer: Working
aliases:
  - 乘积与紧性
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
  - method/compactness
  - method/products
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Products and Compactness
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.7, pp.99–103; Theorem 2.7.1 and Example 2.7.2. PDF 121（来源 PDF，第 121 页；原文件未公开） · PDF 122（来源 PDF，第 122 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

A point in a product gives one coordinate in each factor. The product topology asks only finitely many questions about those coordinates at a time. This finite nature is what makes coordinatewise convergence compatible with compactness, even when the total number of coordinates is uncountable.

## DEF — Product topology and finite-coordinate neighborhoods

For $X=\prod_{\alpha\in A}X_\alpha$, let $\pi_\alpha:X\to X_\alpha$ be the coordinate projections. The product topology is the weakest topology making every $\pi_\alpha$ continuous. A base consists of finite intersections $\bigcap_{j=1}^m\pi_{\alpha_j}^{-1}(U_j)$ with $U_j$ open. The box topology permits simultaneous restrictions in every coordinate and is generally finer.

A net $x_i$ converges to $x$ in the product topology iff each coordinate converges. One direction follows from continuity of projections; in the other, take a common upper bound for the finitely many eventual thresholds required by a basic neighborhood. Similarly, $f:Y\to X$ is continuous iff every coordinate $\pi_\alpha\circ f$ is continuous. For cluster points, checking each coordinate independently is insufficient: one must check simultaneous finite-coordinate neighborhoods, because frequent occurrences in different coordinates need not occur at the same indices.

For countably many metric factors, a compatible metric is
$$
d(x,y)=\sum_{n=1}^{\infty}\min\{2^{-n},d_n(x_n,y_n)\}.
$$
Finite-coordinate control handles the head of the series and the summable tail handles the remainder. Completeness of all factors implies completeness of this metric by taking coordinate limits; the metric Cauchy condition gives Cauchy behavior in each fixed factor.

## THM — Tychonoff in the compact Hausdorff case

A product of compact Hausdorff spaces is compact Hausdorff. If one factor is empty, the product is empty and the conclusion is immediate. Otherwise choice ensures the product is nonempty. For countably many compact metric factors, successive subsequences followed by the [[笔记主体/书籍/Simon实分析/第一章/知识/可数性与两种对角线方法|diagonal selection]] give coordinatewise convergence, hence convergence in the product metric. General products require the following maximality argument.

### Proof — Enlarge compatible partial cluster points

Let $(x_i)$ be any net in $X$. A partial cluster point is a pair $(J,u)$ with $J\subset A$ and $u\in\prod_{\alpha\in J}X_\alpha$ a cluster point of the projected net. Order such pairs by coordinate extension: $(J,u)\preceq(K,v)$ when $J\subset K$ and $v|_J=u$. The empty-coordinate pair is an initial element.

For a chain of partial cluster points, put $J=\bigcup_\gamma J_\gamma$ and define $u$ coordinatewise by the compatible values. To check that $(J,u)$ is still a partial cluster point, take a basic neighborhood restricting a finite subset $F\subset J$. A single member of the chain contains all of $F$, since finitely many members of a chain have a largest one. The partial cluster property in that member ensures arbitrarily late projected terms lie in this neighborhood. Thus every chain has an upper bound. [[笔记主体/书籍/Simon实分析/第一章/知识/偏序、链与 Zorn 引理|Zorn's lemma]] supplies a maximal partial cluster point $(J,u)$.

If $\alpha_0\notin J$, the cluster-point/subnet theorem gives a subnet whose $J$ coordinates converge to $u$. Compactness of $X_{\alpha_0}$ supplies a further subnet whose $\alpha_0$ coordinate converges to some $v$. Earlier coordinate limits survive taking subnets, so this subnet converges on $J\cup\{\alpha_0\}$, extending the partial cluster point and contradicting maximality. Hence $J=A$, and the original net has a cluster point in $X$. The [[笔记主体/书籍/Simon实分析/第二章/知识/Nets and General Convergence|net characterization of compactness]] proves compactness. Hausdorffness follows by separating two different coordinates in a factor.

This expands Simon's proof on pp.100–101, including the finite-coordinate verification in the chain-upper-bound step. It does not identify a single selected coordinate cluster point in each factor independently; compatibility across finite coordinate sets is maintained throughout.

> [!insight] IDEA — Finite tests are what make the chain union admissible
> In the Tychonoff proof, a basic neighborhood tests finitely many coordinates. A chain member can therefore contain every coordinate in that one test, proving that the union remains a partial cluster point. The analogous finite-support check occurs when a chain union of linearly independent sets is shown to remain independent. This is a shared proof mechanism, not an equivalence between compactness and linear independence.
>
> 中文：Zorn 之前最关键的是验证链并仍合格；这里由邻域只检查有限坐标完成。身份：跨章方法联系；两侧的有限性条件均已明确。

^insight-ch2-finite-tests-zorn

## C.EX — Changing the product topology changes the result

The box topology on $\{0,1\}^{\mathbb N}$ is discrete, since each singleton is a product of open singleton coordinates. The space is infinite, so its singleton cover has no finite subcover. The product topology on the same set is compact. Tychonoff's theorem therefore depends on the actual topology, not just the underlying Cartesian product.

For uncountable $A$, no singleton in $[0,1]^A$ is a $G_\delta$. If $\{x\}=\bigcap_nU_n$, choose basic neighborhoods $x\in V_n\subset U_n$. Their union of restricted coordinates is countable. A coordinate outside this union may be changed without leaving any $V_n$, contradicting the singleton intersection. This compact Hausdorff product is not metrizable, since singletons are closed $G_\delta$ sets in metric spaces. The obstruction is a countable-versus-uncountable testing gap, not failure of compactness.

## Source trail

§2.7, pp.99–103; Theorem 2.7.1 and Example 2.7.2. PDF 121（来源 PDF，第 121 页；原文件未公开） · PDF 122（来源 PDF，第 122 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.7 Product Topologies and Tychonoff’s Theorem|2.7 Product Topologies and Tychonoff’s Theorem]] · p. 99 · PDF 120（来源 PDF，第 120 页；原文件未公开）
