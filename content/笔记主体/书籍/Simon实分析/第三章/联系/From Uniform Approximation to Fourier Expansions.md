---
type: 联系
status: 已整理
layer: Working
aliases:
  - 从一致逼近到 Fourier 展开
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/联系
  - 主题/实分析
  - 来源/Simon-Part1
  - 内容/发现
  - domain/fourier
  - method/approximation
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-relation
title: From Uniform Approximation to Fourier Expansions
siteKind: body
---
#用途/正式 #类型/联系 #主题/实分析

> 从一致逼近到 Fourier 展开

Source: Simon, *Real Analysis*, AMS 2015, §§2.5, 3.4–3.5; pp. 88–93（来源 PDF，第 109 页；原文件未公开） and pp. 131–149（来源 PDF，第 152 页；原文件未公开）. This page compares existence of approximants with the behaviour of specified approximation operators.

## Density is an existence statement

Let $\mathbb T=\{z\in\mathbb C:|z|=1\}$. The trigonometric polynomials $\mathcal A=\operatorname{span}\{z^k:k\in\mathbb Z\}$ form a unital algebra on $\mathbb T$, separate points, and are closed under conjugation. The complex [[笔记主体/书籍/Simon实分析/第二章/知识/Algebras, Lattices, and Uniform Approximation|Stone–Weierstrass theorem]] therefore gives

$$
\overline{\mathcal A}^{\|\cdot\|_\infty}=C(\mathbb T).
$$

For each continuous $f$ and each positive error tolerance, some trigonometric polynomial approximates $f$. The assertion neither names that polynomial nor requires its coefficients to be the first Fourier coefficients of $f$.

## Transfer density into the Hilbert completion

Use normalized integration $d\theta/(2\pi)$ and the norm

$$
\|f\|_2^2=\int_0^{2\pi}|f(e^{i\theta})|^2\,\frac{d\theta}{2\pi}.
$$

Then $\|f\|_2\le\|f\|_\infty$. In this chapter $L^2(\mathbb T)$ is the abstract completion of $C(\mathbb T)$ in this norm; identifying its elements with almost-everywhere equivalence classes belongs to later measure theory. The completion construction is the one studied in [[笔记主体/书籍/Simon实分析/第一章/知识/Cauchy 序列与度量完备化|Cauchy 序列与度量完备化]].

Uniform density gives norm density in $C(\mathbb T)$, which is already dense in its completion. Therefore the trigonometric system has dense span in $L^2$. Its orthonormality follows by integrating $e^{i(k-j)\theta}$. These two facts make it an orthonormal basis. [[笔记主体/书籍/Simon实分析/第三章/知识/Trigonometric Density and L2 Fourier Expansion|Trigonometric Density and L2 Fourier Expansion]] records the full transfer and [[笔记主体/书籍/Simon实分析/第三章/知识/Orthonormal Expansions|Orthonormal Expansions]] supplies the abstract basis theorem.

## Orthogonal partial sums minimize a particular error

For $e_k(z)=z^k$ and $\widehat f(k)=\langle e_k,f\rangle$, define

$$
S_Nf=\sum_{|k|\le N}\widehat f(k)e_k.
$$

This is the orthogonal projection onto $V_N=\operatorname{span}\{e_k:|k|\le N\}$. If $p\in V_N$, the best-approximation property gives $\|f-S_Nf\|_2\le\|f-p\|_2$. Density then implies $S_Nf\to f$ in $L^2$.

The minimization is for the Hilbert norm. It does not minimize the supremum norm, and the inequality $\|g\|_2\le\|g\|_\infty$ only transfers convergence from the stronger norm to the weaker one. Reading it backwards would erase the distinction that the proof relies on.

## A test that exposes the missing conclusion

On $[0,1]$, let $g_n(x)=\max(1-nx,0)$. Then $\|g_n\|_\infty=1$, $g_n(0)=1$, and

$$
\|g_n\|_2^2=\int_0^{1/n}(1-nx)^2\,dx=\frac1{3n}\longrightarrow0.
$$

This supplementary example shows that convergence in the square norm does not imply uniform convergence or convergence at every fixed point. It is not itself a counterexample made from Fourier partial sums; a theorem about those specific sums needs their additional kernel structure.

> 中文备注：一致逼近的“存在某个多项式”、Fourier 部分和的“指定系数”、均方意义的“最优逼近”，是三个需要分别检查的断言。

## Positive means answer a different question

The Dirichlet kernel represents $S_N$, while the Fejér kernel represents averages of partial sums. Fejér kernels are nonnegative, normalized, and concentrate near the origin. Consequently their operators converge uniformly on continuous functions by a near/far error estimate. [[笔记主体/书籍/Simon实分析/第三章/知识/Fourier Series and Summation Kernels|Fourier Series and Summation Kernels]] maintains that argument; [[笔记主体/书籍/Simon实分析/第三章/知识/Dirichlet Kernels and Dini Convergence|Dirichlet Kernels and Dini Convergence]] states the extra local regularity conditions used for ordinary partial sums.

This is the bridge back to [[笔记主体/书籍/Simon实分析/第二章/知识/Positive Approximation and Bernstein Polynomials|Positive Approximation and Bernstein Polynomials]]: positive averaging provides a uniform-norm approximation mechanism, while orthogonal projection provides Hilbert-norm optimality. Their conclusions can coexist without being interchangeable. [[笔记主体/书籍/Simon实分析/第三章/知识/Pointwise Fourier Convergence and Jumps|Pointwise Fourier Convergence and Jumps]] makes the distinction visible at a discontinuity, where a jump profile and a nonvanishing overshoot must be treated locally.

> [!insight] IDEA — Existence, prescribed coefficients, and optimality are different claims
> Stone–Weierstrass guarantees the existence of uniformly approximating trigonometric polynomials for continuous functions on the circle. Fourier partial sums use prescribed coefficients and minimize the $L^2$ error within a finite frequency space. Fejér means supply a separate positive-averaging mechanism for uniform convergence. An existence theorem for approximants cannot by itself certify the convergence mode of a specified approximation operator.
>
> 中文备注：先问“存在某个逼近”，还是“这套指定系数会逼近”，再问误差在哪个范数中最小。
>
> Structural observation · source-based comparison, justified by [[笔记主体/书籍/Simon实分析/第三章/联系/From Uniform Approximation to Fourier Expansions#Density is an existence statement|uniform density]], [[笔记主体/书籍/Simon实分析/第三章/联系/From Uniform Approximation to Fourier Expansions#Orthogonal partial sums minimize a particular error|Hilbert optimality]], and [[笔记主体/书籍/Simon实分析/第三章/联系/From Uniform Approximation to Fourier Expansions#Positive means answer a different question|positive means]]; no new theorem or originality claim.

^insight-ch3-approximation-claims

[[笔记主体/发现归档|Insights and additions]] · [[maps/前三章关系图-6db33b5d|Chapters 1–3 map]] · [[笔记主体/书籍/Simon实分析/Simon - Real Analysis|Book entrance]]
