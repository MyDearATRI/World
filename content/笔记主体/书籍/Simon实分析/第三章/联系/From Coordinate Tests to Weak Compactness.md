---
type: 联系
status: 已整理
layer: Working
aliases:
  - 从坐标检验到弱紧性
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/联系
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/hilbert
  - method/convergence
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-relation
title: From Coordinate Tests to Weak Compactness
siteKind: body
---
#用途/正式 #类型/联系 #主题/实分析

> 从坐标检验到弱紧性

Source: Simon, *Real Analysis*, AMS 2015, §§1.5, 2.7, 3.6; pp. 99–102（来源 PDF，第 120 页；原文件未公开） and pp. 168–173（来源 PDF，第 189 页；原文件未公开）. The bounded-tail mechanism is expanded as a cross-chapter comparison.

## Coordinate convergence is the product test

In a product topology, a basic neighbourhood restricts only finitely many coordinates. A net converges exactly when each coordinate converges. [[笔记主体/书籍/Simon实分析/第二章/知识/Products and Compactness|Products and Compactness]] explains both the finite-test rule and the countable-product diagonal argument inherited from [[笔记主体/书籍/Simon实分析/第一章/知识/可数性与两种对角线方法|可数性与两种对角线方法]].

Now let $H$ be a separable Hilbert space with orthonormal basis $(e_j)_{j\ge1}$. A vector has coordinates $\langle e_j,x\rangle$. The weak topology tests $\langle y,x\rangle$ for every $y\in H$, so basis coordinates are only a subset of its tests. Expanding $y$ uses an infinite sum, and coordinate convergence does not automatically justify passing a limit through that sum.

## A norm bound controls the untested tail

Suppose $x_\alpha,x$ all lie in the norm ball $B_R$ and $\langle e_j,x_\alpha\rangle\to\langle e_j,x\rangle$ for each $j$. For an arbitrary $y\in H$, choose a finite expansion $y_m$ with $\|y-y_m\|$ small. Then

$$
|\langle y,x_\alpha-x\rangle|
\le |\langle y_m,x_\alpha-x\rangle|+2R\|y-y_m\|.
$$

The first term tends to zero because it contains finitely many coordinates. The second is small independently of $\alpha$. Choosing $m$ first and then the net threshold proves weak convergence. This is the essential step of Simon's Theorem 3.6.3, maintained with the weak-ball metric in [[笔记主体/书籍/Simon实分析/第三章/知识/Weak Topologies and Dual Pairings|Weak Topologies and Dual Pairings]].

> 中文备注：可数坐标并没有凭空变成全部测试；球上的统一范数界控制了任意测试向量的展开尾项。

Without the bound the conclusion fails. In $\ell^2$, set $x_n=ne_n$. Every fixed coordinate tends to zero. But $y=(1/j)_{j\ge1}$ belongs to $\ell^2$, and $\langle y,x_n\rangle=1$ for every $n$. Thus the sequence is not weakly convergent to zero. This supplementary counterexample pinpoints the estimate that breaks.

## A diagonal limit remains inside the ball

Given a sequence in $B_R$, each coordinate lies in a compact scalar disk. Successive subsequences followed by diagonal extraction give limits $a_j$ for all coordinates. For every finite $m$,

$$
\sum_{j=1}^m|a_j|^2=\lim_k\sum_{j=1}^m|\langle e_j,x_{n_k}\rangle|^2\le R^2.
$$

Taking the supremum over $m$ shows $(a_j)\in\ell^2$ and determines $x\in B_R$. The bounded-tail argument then gives $x_{n_k}\rightharpoonup x$. Coordinate extraction alone would not have established that the proposed limit belonged to the original Hilbert ball; the finite-sum inequality supplies that missing membership check.

The weak topology on $B_R$ is metrizable under the separability assumption, so the metric equivalence of sequential compactness and compactness from [[笔记主体/书籍/Simon实分析/第二章/知识/Compactness and Total Boundedness|Compactness and Total Boundedness]] now applies. This final step is why the proof may use a sequence argument here without contradicting the warning in [[笔记主体/书籍/Simon实分析/第二章/联系/From Metric Sequences to Topological Nets|From Metric Sequences to Topological Nets]].

## Changing topology changes the existence tool

In an infinite-dimensional Hilbert space, the orthonormal vectors satisfy $\|e_j-e_k\|=\sqrt2$ for $j\ne k$, so the closed unit ball is not compact in norm. The same sequence converges weakly to zero. Weak compactness therefore supplies convergent behaviour that norm compactness cannot provide; it preserves values of bounded linear functionals rather than distances.

There is a useful recovery criterion. If $x_\alpha\rightharpoonup x$ and $\|x_\alpha\|\to\|x\|$, then

$$
\|x_\alpha-x\|^2=\|x_\alpha\|^2+\|x\|^2-2\operatorname{Re}\langle x,x_\alpha\rangle\longrightarrow0.
$$

This is Simon's Theorem 3.6.2, not a new result claimed by the notes. Its structural interpretation is that weak convergence leaves room for norm to escape into changing coordinates, while convergence of norms removes that room. The orthonormal sequence above shows what fails when the norm condition is absent.

The current coordinate proof uses a countable orthonormal basis, consistent with Simon's default separable convention. Weak compactness extends beyond that convention, but the weak ball need not then be metrizable; that extension requires a different argument and is not silently inferred from this diagonal proof.

[[笔记主体/发现归档|Insights and additions]] · [[maps/前三章关系图-6db33b5d|Chapters 1–3 map]] · [[笔记主体/书籍/Simon实分析/Simon - Real Analysis|Book entrance]]
