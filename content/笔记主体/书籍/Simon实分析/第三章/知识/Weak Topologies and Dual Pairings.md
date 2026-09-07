---
type: 知识
status: 已整理
layer: Working
aliases:
  - 弱拓扑与配对
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/function-spaces
  - method/duality
  - method/convergence
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Weak Topologies and Dual Pairings
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.6 · pp. 168–174 · PDF 189（来源 PDF，第 189 页；原文件未公开）–195（来源 PDF，第 195 页；原文件未公开）.

The norm asks that a vector error itself become small. The weak topology asks that every fixed continuous linear measurement of that error become small. This loses norm compactness obstructions while retaining enough information to identify a vector. Countable coordinate tests recover the weak topology on each bounded set, but need not recover it on the whole space.

## Definitions and the first separation of convergence modes

By [[笔记主体/书籍/Simon实分析/第三章/知识/Linear Functionals as Vectors#Riesz representation|Riesz representation]], the weak topology is the coarsest topology making all maps $x\mapsto\langle y,x\rangle$, $y\in H$, continuous. A neighborhood of $x$ contains a set
$$
\{z:|\langle y_j,z-x\rangle|<\varepsilon_j,\ 1\le j\le m\}.
$$
A net $x_\alpha$ converges weakly to $x$ exactly when each of these scalar pairings converges. Norm convergence implies weak convergence by Schwarz. In an infinite-dimensional Hilbert space an orthonormal sequence satisfies $e_n\rightharpoonup0$ because $(\langle y,e_n\rangle)$ is square-summable for each $y$, while $\|e_n\|=1$. Thus the implication cannot be reversed.

There is a useful exact repair: weak convergence together with $\|x_\alpha\|\to\|x\|$ implies norm convergence, since
$$
\|x_\alpha-x\|^2=\|x_\alpha\|^2+\|x\|^2-2\operatorname{Re}\langle x,x_\alpha\rangle\longrightarrow0.
$$
This proves Theorem 3.6.2 for nets as well as sequences.

## Coordinate convergence on a bounded ball

Let $(e_j)_{j\ge1}$ be a countable orthonormal basis and $B_R=\{x:\|x\|\le R\}$. Set
$$
\rho(x,z)=\sum_{j=1}^\infty\min\bigl(2^{-j},|\langle e_j,x-z\rangle|\bigr).
$$
The scalar inequality $\min(c,a+b)\le\min(c,a)+\min(c,b)$ gives the triangle inequality; separation follows from completeness of the basis. The summable cutoffs make $\rho$-convergence equivalent to convergence in every fixed coordinate: control finitely many terms and then the uniformly bounded tail. This works for nets, since only finitely many eventual conditions are combined at a time.

Suppose $x_\alpha,x\in B_R$ and all coordinates converge. Given $y\in H$, approximate it in norm by $y^{(m)}=\sum_{j\le m}\langle e_j,y\rangle e_j$. Then
$$
|\langle y,x_\alpha-x\rangle|
\le |\langle y^{(m)},x_\alpha-x\rangle|+2R\|y-y^{(m)}\|.
$$
The finite-coordinate term tends to zero for fixed $m$, and the tail is uniformly small for large $m$. Thus coordinate convergence implies weak convergence on $B_R$. The reverse follows directly from the definition. This proves Theorem 3.6.3, including metrizability of the restricted weak topology.

> [!insight] PROP — Boundedness converts basis tests into all tests
> Coordinatewise convergence relative to an orthonormal basis implies weak convergence for a net contained in one norm-bounded ball. The factor $2R$ in the tail estimate is essential. On all of $\ell^2$, $x_n=ne_n$ has every fixed coordinate tending to zero, but for $y=(1/n)_{n\ge1}\in\ell^2$ one has $\langle y,x_n\rangle=1$, so $x_n$ does not converge weakly to zero.
> 中文备注：知道每个坐标的极限，还要用统一范数界控制任意测试向量的尾部。球上的度量不能直接代表整个空间的弱拓扑。
> Identity: supplementary counterexample exposing the boundedness step in Theorem 3.6.3. Proof status: complete estimate and explicit counterexample above.

^insight-ch3-bounded-coordinates

## Weak compactness of a ball

Take a sequence $(x_n)$ in $B_R$. Each coordinate lies in the compact disk $|z|\le R$. The [[笔记主体/书籍/Simon实分析/第一章/知识/可数性与两种对角线方法#对角线抽取：保持每个固定坐标的收敛|countable diagonal extraction]] provides a subsequence $(x_{n_k})$ whose $j$th coordinate converges to $a_j$ for every fixed $j$. For every finite $m$,
$$
\sum_{j=1}^m|a_j|^2=\lim_{k\to\infty}\sum_{j=1}^m|\langle e_j,x_{n_k}\rangle|^2\le R^2.
$$
Taking the supremum over $m$ gives $(a_j)\in\ell^2$ and $x=\sum_j a_je_j\in B_R$. The bounded-coordinate theorem proves $x_{n_k}\rightharpoonup x$. Hence the ball is weakly sequentially compact. Because the restricted weak topology is metrizable, the [[笔记主体/书籍/Simon实分析/第二章/知识/Compactness and Total Boundedness|metric equivalence between sequential compactness and compactness]] makes $B_R$ weakly compact. This completes Theorem 3.6.11 without assuming a general Banach-space compactness theorem.

The norm unit ball is not compact in infinite dimensions: the orthonormal sequence has pairwise distance $\sqrt2$, so no subsequence can converge. There is no conflict, since compactness refers to a specified topology. In finite dimensions the weak and norm topologies coincide, and closed bounded sets are compact in either topology.

## Why the whole weak space is not metrizable

We prove the infinite-dimensional qualification of Theorem 3.6.8. First, no countable set has finite linear span equal to $H$, as shown in [[笔记主体/书籍/Simon实分析/第三章/知识/Orthonormal Expansions#An orthonormal basis is not a Hamel basis|the algebraic-dimension argument]]. Suppose $(U_n)$ were a countable weak neighborhood base at zero. Inside each $U_n$ choose a basic neighborhood using a finite collection $E_n$ of test vectors. Their union is countable; choose $y$ outside its finite linear span. The weak neighborhood $V=\{x:|\langle y,x\rangle|<1\}$ must contain some $U_n$.

Let $F=\operatorname{span}E_n$ and let $z=y-P_Fy$. Finite-dimensional $F$ is closed, so $z\ne0$ and $z\perp F$. Every scalar multiple $tz$ therefore belongs to the basic neighborhood inside $U_n$, but $\langle y,tz\rangle=t\|z\|^2$ is unbounded as $t$ varies. This contradicts $U_n\subset V$. There is no countable base at zero, so the topology is not metrizable. This is a Hilbert-specific expansion of the source's proof through finite families of functionals.

## Nets and operator topologies

In an infinite-dimensional Hilbert space, even a weakly convergent net need not be eventually norm bounded. Direct the finite subsets $F\subset H$ by inclusion, and choose $x_F\perp\operatorname{span}F$ with $\|x_F\|=|F|$. For each fixed $y$, all indices containing $y$ give $\langle y,x_F\rangle=0$, so $x_F\rightharpoonup0$, while $\|x_F\|\to\infty$. This is Example 3.6.9. The theorem that weakly convergent sequences are bounded is proved later using uniform boundedness; it should not be transferred to all nets.

The same distinction between whole objects and scalar tests yields the strong and weak operator topologies, maintained in [[笔记主体/书籍/Simon实分析/第三章/知识/Operators, Adjoints, and Operator Topologies#Three topologies on operators|the operator page]]. General Banach dual-pair topology is a later extension in [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#5.7 Weak Topologies and Locally Convex Spaces|§5.7 of the book plan]]; this page currently establishes the Hilbert case, and that future source section is not marked as written.
