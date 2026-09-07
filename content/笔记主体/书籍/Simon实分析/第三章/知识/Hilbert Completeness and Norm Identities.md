---
type: 知识
status: 已整理
layer: Working
aliases:
  - 希尔伯特范数
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/hilbert
  - method/completeness
  - method/orthogonality
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Hilbert Completeness and Norm Identities
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.1 · pp. 109–119 · PDF 130（来源 PDF，第 130 页；原文件未公开）–140（来源 PDF，第 140 页；原文件未公开）.

An inner product gives more than a length: it measures how much of one vector lies along another. The basic inequalities follow from an exact orthogonal decomposition. Completeness enters later, when finite decompositions become infinite expansions.

> [!definition] DEF — Inner product and Hilbert space
> On a complex vector space, $\langle x,y\rangle$ is antilinear in $x$, linear in $y$, conjugate symmetric, and strictly positive on nonzero vectors. Write $\|x\|=\sqrt{\langle x,x\rangle}$. A Hilbert space is complete for $d(x,y)=\|x-y\|$. In Simon's convention it is also separable; when separability is dropped, this will be stated explicitly.

> [!remark] RMK — Convention
> 中文备注：本章内积第二变量线性。Simon 还把可分性写进 Hilbert 空间的定义；完备性与可分性承担不同工作，证明中分别指出。

## The geometric identities

Expanding the inner product gives
$$
\|x+y\|^2+\|x-y\|^2=2\|x\|^2+2\|y\|^2.
$$
For an orthonormal family $e_1,\ldots,e_m$, put $p=\sum_{j=1}^m\langle e_j,x\rangle e_j$. Direct calculation gives $\langle e_j,x-p\rangle=0$ and hence
$$
\|x\|^2=\sum_{j=1}^m|\langle e_j,x\rangle|^2+\|x-p\|^2.
$$
This is the finite Pythagorean identity. Dropping the last, nonnegative term gives Bessel's inequality. Taking the one-element family $e=y/\|y\|$ for $y\ne0$ yields $|\langle y,x\rangle|\le\|y\|\|x\|$. Equality holds precisely when $x$ lies in the span of $y$; the case $y=0$ is automatic. Finally,
$$
\|x+y\|^2=\|x\|^2+\|y\|^2+2\operatorname{Re}\langle x,y\rangle
\le(\|x\|+\|y\|)^2,
$$
so the associated length is a norm. These arguments expand Simon's Theorems 3.1.1–3.1.5 and use neither completeness nor separability.

A normed linear space is a vector space with a nonnegative, definite, absolutely homogeneous function satisfying the triangle inequality; absolute homogeneity means $\|ax\|=|a|\|x\|$. If definiteness is dropped, the function is a seminorm. A Banach space is a normed linear space complete in its induced metric. Thus every Hilbert space is Banach, but the converse need not hold.

The complex polarization formula, with the present convention, is
$$
\langle x,y\rangle=\frac{\|x+y\|^2-\|x-y\|^2}{4}
+\frac{\|x+iy\|^2-\|x-iy\|^2}{4i}.
$$
Thus the norm determines the inner product. The converse characterization is the Jordan–von Neumann theorem: a complex norm comes from an inner product exactly when it satisfies the parallelogram law. The converse proof is assigned in [[笔记主体/书籍/Simon实分析/第三章/第三章 习题与原书核校#3.1 Basic Inequalities|§3.1, Problem 4]]; it is a cited result here, not a completed local proof. For example the $\ell^1$ norm on $\mathbb C^2$ fails the law on $(1,0),(0,1)$, so no inner product induces that norm.

## Completion preserves the inner product

The [[笔记主体/书籍/Simon实分析/第一章/知识/Cauchy 序列与度量完备化#候选点之间的距离|metric completion construction]] supplies points represented by Cauchy sequences. Vector operations are defined termwise. For Cauchy sequences $(x_n),(y_n)$ in an inner product space, boundedness and Schwarz give
$$
|\langle x_n,y_n\rangle-\langle x_m,y_m\rangle|
\le\|x_n-x_m\|\|y_n\|+\|x_m\|\|y_n-y_m\|.
$$
Consequently $\langle[x_n],[y_n]\rangle=\lim_n\langle x_n,y_n\rangle$ exists. The same estimate shows independence of representatives. Sesquilinearity and conjugate symmetry pass to limits. Moreover $\langle[x_n],[x_n]\rangle=\lim\|x_n\|^2$ vanishes exactly when the completion point is zero. This proves that the metric completion is again an inner product space, now complete. A countable dense set remains dense in the completion, so separability is preserved. This is a note expansion of the construction in Example 3.1.9, using the already proved metric completion rather than asserting an extension without checking it.

For $\ell^2$, finite-dimensional Schwarz makes $\sum\overline{x_j}y_j$ absolutely convergent. To see completeness, let $x^{(n)}$ be Cauchy. Each coordinate converges to $x_j$. A uniform bound on $\|x^{(n)}\|$ bounds every finite sum $\sum_{j\le m}|x_j|^2$, hence $x\in\ell^2$. Given $\varepsilon>0$, choose $N$ so $\|x^{(n)}-x^{(r)}\|\le\varepsilon$ for $n,r\ge N$. Pass $r\to\infty$ in each finite coordinate sum and then take its supremum to get $\|x^{(n)}-x\|\le\varepsilon$. Finite sequences with rational real and imaginary coordinates give separability. This supplies the completion verification requested in Problem 5.

## What L2 means before measure theory

On $C([0,1])$ use $\langle f,g\rangle=\int_0^1\overline f g\,dx$. Continuous transitions across an interval of shrinking length approximate a step in this norm; their limit is not a continuous function. The completion is denoted $L^2([0,1],dx)$. Its points are currently equivalence classes of Cauchy sequences, not yet measurable functions modulo almost-everywhere equality. The circle version uses $d\theta/(2\pi)$. Uniform approximation implies $L^2$ approximation on these finite intervals, but the converse fails.

> [!insight] PROP — Point evaluation does not survive L2 completion
> In $C(\partial\mathbb D)$ with normalized $L^2$ norm, evaluation at a fixed point is not continuous and therefore has no continuous extension to the completion. For the periodic tent $f_n(\theta)=\max(1-n|\theta|,0)$ on $[-\pi,\pi]$, $f_n(0)=1$ while $\|f_n\|_2^2=1/(3\pi n)\to0$.
> 中文备注：平方误差控制不了单点。不能仅凭抽象 $L^2$ 向量就讨论它在某一点的值。
> Identity: supplementary counterexample. Proof status: proved by the displayed integral; this observation does not assert research originality.

^insight-ch3-evaluation

## Infinite orthogonal sums

Suppose $(e_\alpha)_{\alpha\in I}$ is orthonormal and $\sum_\alpha|c_\alpha|^2<\infty$, where an arbitrary nonnegative sum means the supremum over finite subsets. For each $k$, only finitely many coefficients have magnitude at least $1/k$, so the support is countable. Finite partial sums form a Cauchy net: once a finite set captures all but $\varepsilon$ of the squared mass, any two larger partial sums differ in squared norm by at most $\varepsilon$. Completeness supplies the limit, independently of enumeration. Passing the finite Pythagorean identity to the limit gives
$$
\|x\|^2=\sum_\alpha|\langle e_\alpha,x\rangle|^2+
\left\|x-\sum_\alpha\langle e_\alpha,x\rangle e_\alpha\right\|^2.
$$
This is Simon's Theorems 3.1.11–3.1.12 with the tail argument expanded. Maximality will make the residual vanish in [[笔记主体/书籍/Simon实分析/第三章/知识/Orthonormal Expansions#Expansion and Parseval|the basis theorem]]. The norm on the right of the book's (3.1.38) should refer to the vector being expanded; see [[笔记主体/书籍/Simon实分析/第三章/第三章 习题与原书核校#Source corrections and open checks|the local source check]].
