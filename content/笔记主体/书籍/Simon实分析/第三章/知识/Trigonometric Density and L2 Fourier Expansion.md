---
type: 知识
status: 已整理
layer: Working
aliases:
  - 三角稠密性与平方范数 Fourier 展开
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Trigonometric Density and L2 Fourier Expansion
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.5 · pp. 137–139 · PDF 158（来源 PDF，第 158 页；原文件未公开）–160（来源 PDF，第 160 页；原文件未公开）.

Orthogonality computes the coefficients of an expansion; density proves that no component has been missed. For the circle these are different tasks. The first is an integral calculation, while the second is where the topology and approximation theory of Chapter 2 enter.

## The Hilbert model and its coefficients

Write $\mathbb T=\partial\mathbb D$ and identify a function on $\mathbb T$ with a $2\pi$-periodic function of $\theta$. The inner product on $C(\mathbb T)$ is
$$
\langle f,g\rangle=\int_{-\pi}^{\pi}\overline{f(\theta)}g(\theta)\,\frac{d\theta}{2\pi}.
$$
Its completion is $L^2(\mathbb T,d\theta/(2\pi))$ in [[笔记主体/书籍/Simon实分析/第三章/知识/Hilbert Completeness and Norm Identities#What L2 means before measure theory|the pre-measure-theory sense]]. Set $e_k(\theta)=e^{ik\theta}$ for $k\in\mathbb Z$. Integrating $e^{i(k-j)\theta}$ gives $\langle e_j,e_k\rangle=\delta_{jk}$. For $f\in C(\mathbb T)$, Simon writes
$$
f_k^\sharp=\langle e_k,f\rangle=\int_{-\pi}^{\pi}e^{-ik\theta}f(\theta)\,\frac{d\theta}{2\pi}.
$$
The same formula as an inner product defines the coefficient of every abstract completion vector. In that generality it need not be interpreted as a Riemann integral of an actual pointwise function.

## Density through an algebra

> [!theorem] THM — Trigonometric polynomials are uniformly dense
> Finite sums $\sum_{|k|\le N}a_ke^{ik\theta}$ are dense in $C(\mathbb T)$ for the supremum norm.

Let $A$ be their union. It contains constants, is an algebra because frequencies add under multiplication, and is closed under complex conjugation because $\overline{e_k}=e_{-k}$. It separates points of the circle since $e_1(z)=z$. The compact circle and these four properties satisfy the complex [[笔记主体/书籍/Simon实分析/第二章/知识/Algebras, Lattices, and Uniform Approximation|Stone–Weierstrass theorem]]. Therefore $\overline A^{\|\cdot\|_\infty}=C(\mathbb T)$. This is the full proof of Theorem 3.5.3 used first in the source; it does not depend on Fourier partial sums already converging.

The presence of both positive and negative frequencies is substantive. Polynomials in $z$ alone form an algebra and separate points, but are not closed under conjugation on the circle. They do not uniformly approximate $\overline z$: for every such polynomial $p$, $\int z p(z)\,d\theta/(2\pi)=0$, whereas $\int z\overline z\,d\theta/(2\pi)=1$. Uniform convergence would preserve these integrals, giving a contradiction. This is a local counterexample explaining the complex theorem's hypothesis.

## From density to norm-convergent Fourier series

Since the normalized circle has total mass one, $\|f-p\|_2\le\|f-p\|_\infty$. Hence trigonometric polynomials are dense in $C(\mathbb T)$ for the $L^2$ norm, and $C(\mathbb T)$ is dense in its completion by construction. More explicitly, given $x$ in the completion, choose $f\in C(\mathbb T)$ with $\|x-f\|_2<\varepsilon/2$, then a polynomial $p$ with $\|f-p\|_\infty<\varepsilon/2$. Thus $\|x-p\|_2<\varepsilon$.

The orthonormal family $(e_k)_{k\in\mathbb Z}$ therefore has dense span. [[笔记主体/书籍/Simon实分析/第三章/知识/Orthonormal Expansions#Expansion and Parseval|The abstract expansion theorem]] gives
$$
S_Nx=\sum_{|k|\le N}x_k^\sharp e_k\longrightarrow x\quad\text{in }L^2,
\qquad \|x\|_2^2=\sum_{k\in\mathbb Z}|x_k^\sharp|^2.
$$
The coefficient map is unitary onto $\ell^2(\mathbb Z)$. This proves Theorems 3.5.1–3.5.2, including the exact convergence sense. For each $N$, $S_Nx$ is the closest point to $x$ among trigonometric polynomials using frequencies $-N,\ldots,N$.

> [!insight] RMK — Density and a prescribed approximation algorithm are different claims
> Uniform density guarantees the existence of suitable trigonometric polynomials. It does not say that the particular Fourier projections $S_Nf$ converge uniformly. Hilbert geometry makes them optimal in $L^2$, while uniform convergence requires extra regularity or a different summation rule such as Fejér averaging.
> 中文备注：存在一串好逼近，与这一串由 Fourier 系数指定的部分和好用，是两个命题；最优性也要先说是哪一种范数。
> Identity: structural comparison of Theorems 3.5.1–3.5.6. Proof status: density and $L^2$ optimality proved here; uniform convergence of Cesàro means is proved in [[笔记主体/书籍/Simon实分析/第三章/知识/Fourier Series and Summation Kernels#Positive approximate identities|the approximate-identity argument]]. Continuous functions with divergent partial sums are the source's §3.5, Problem 4, not asserted as constructed here.

^insight-ch3-density

## Piecewise continuous functions and the next questions

A bounded function with finitely many jump discontinuities can be replaced near those jumps by continuous interpolants. Keep the interpolants uniformly bounded and confine all changes to intervals with total length tending to zero. Their squared error then tends to zero, so they define a completion vector. Cauchy–Schwarz shows the coefficients pass to the limit. This is the mechanism behind §3.5, Problem 1, and permits the step example in [[笔记主体/书籍/Simon实分析/第三章/知识/Pointwise Fourier Convergence and Jumps|the discussion of Gibbs]]. Values at the finitely many jump points do not change the integrals.

The Hilbert theorem settles norm reconstruction. [[笔记主体/书籍/Simon实分析/第三章/知识/Dirichlet Kernels and Dini Convergence|Dini's test]] asks a pointwise question, and [[笔记主体/书籍/Simon实分析/第三章/知识/Fourier Series and Summation Kernels|Fejér's theorem]] asks for a uniform approximation valid for every continuous function. These are additional results, not reinterpretations of the norm limit as a stronger kind of convergence.
