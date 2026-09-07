---
type: 知识
status: 已整理
layer: Working
aliases:
  - 代数格与逼近
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
  - method/approximation
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: 'Algebras, Lattices, and Uniform Approximation'
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.5, pp.88–93; Theorems 2.5.2–5, 2.5.7. PDF 110（来源 PDF，第 110 页；原文件未公开） · PDF 111（来源 PDF，第 111 页；原文件未公开） · PDF 113（来源 PDF，第 113 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

An explicit approximation formula is not always available. Stone–Weierstrass replaces the formula with structural tests on the admissible functions: they must contain constants, separate points, and be closed under algebraic operations. The proof converts those operations into local patching by maxima and minima.

## DEF — Separation by functions and lattice operations

A real vector space $S\subset C(X,\mathbb R)$ separates points if, for $x\ne y$, some $f\in S$ has $f(x)\ne f(y)$. It strongly separates points if for every pair of distinct points and every $a,b\in\mathbb R$, some $h\in S$ has $h(x)=a,h(y)=b$. A separating vector space containing $1$ strongly separates: affine rescaling of a separating function assigns the two desired values.

A vector lattice is a real vector subspace closed under $f\vee g=\max(f,g)$ and $f\wedge g=\min(f,g)$, taken pointwise. A subalgebra is closed under pointwise multiplication as well as linear combinations. Neither property alone asserts density.

## THM — Real Stone–Weierstrass

Let $X$ be compact Hausdorff and let $S\subset C(X,\mathbb R)$ be a subalgebra containing $1$ and separating points. Then its uniform closure is all of $C(X,\mathbb R)$.

### Proof — From multiplication to absolute values

Let $A=\overline S$ in the uniform norm. It is a closed subalgebra: uniformly convergent sequences are uniformly bounded, so multiplication preserves their limits. For $f\in A$, [[笔记主体/书籍/Simon实分析/第二章/知识/Positive Approximation and Bernstein Polynomials|polynomial approximation]] of $|t|$ on $[-\|f\|_\infty,\|f\|_\infty]$ gives polynomials $p_n$ with $p_n(f)\to|f|$ uniformly. Constants and powers of $f$ lie in $A$, hence $|f|\in A$. Therefore
$$
f\vee g=\tfrac12(f+g+|f-g|),\qquad
f\wedge g=\tfrac12(f+g-|f-g|)
$$
belong to $A$. Thus the algebra closure is a vector lattice that strongly separates points.

### Proof — Two finite patching steps

We prove the Kakutani–Krein density statement for a compact Hausdorff space with at least two points: a strongly separating vector lattice $L$ in $C(X,\mathbb R)$ is dense. Fix $f\in C(X,\mathbb R)$ and $\varepsilon>0$. For each $x,y$, choose $h_{x,y}\in L$ matching $f$ at both points. When $x=y$, use strong separation with any other point to obtain the one required value. The empty and singleton cases of Stone–Weierstrass are immediate from the presence of constants.

For fixed $x$, each $h_{x,y}$ satisfies $h_{x,y}<f+\varepsilon$ on a neighborhood of $y$. Choose finitely many of these neighborhoods covering $X$ and set $g_x=\min_jh_{x,y_j}$. Then $g_x\in L$, $g_x(x)=f(x)$, and $g_x<f+\varepsilon$ everywhere. Now $g_x>f-\varepsilon$ on a neighborhood of $x$. Choose finitely many such neighborhoods covering $X$ and set $g=\max_i g_{x_i}$. Then $f-\varepsilon<g<f+\varepsilon$ everywhere. Applying this to $L=A$ proves the theorem.

This expands the proofs of Theorems 2.5.2–3 on pp.89–91. Compactness is used twice: first to create a global upper estimate while preserving one exact value, then to create a global lower estimate. This is not a series convergence argument. For the stand-alone lattice theorem, include the one-point interpolation condition when $X$ is a singleton; the algebra theorem with constants has no such degeneracy.

## THM — Complex Stone–Weierstrass

Let $S\subset C(X,\mathbb C)$ be a complex subalgebra containing $1$, separating points, and invariant under complex conjugation. Then $\overline S=C(X,\mathbb C)$. The real-valued part $S_{\mathbb R}$ is a real subalgebra containing $1$. If $f(x)\ne f(y)$, one of $\operatorname{Re}f$ and $\operatorname{Im}f$ separates them; conjugation invariance puts both in $S_{\mathbb R}$. The real theorem approximates real and imaginary parts independently, giving the complex conclusion.

Conjugation is indispensable. Polynomials in $z$ on the unit circle contain constants and separate points but cannot approximate $\overline z$, as the integral obstruction in [[笔记主体/书籍/Simon实分析/第二章/知识/Positive Approximation and Bernstein Polynomials|the Bernstein and polynomial page]] proves. Trigonometric polynomials do contain positive and negative powers, hence are closed under conjugation and are uniformly dense. This supplies the density input for Fourier completeness in Chapter 3, without yet asserting convergence of Fourier partial sums in uniform norm.

## Variants and their precise scope

If $a\in X$ and $S$ is a separating subalgebra of $C_a(X)=\{f\in C(X,\mathbb R):f(a)=0\}$, then it is dense in $C_a(X)$. Add constants, apply the real theorem, and subtract each approximant's value at $a$. This subtracts a quantity tending to zero and restores the vanishing condition.

If $X$ is locally compact Hausdorff, a real subalgebra $S\subset C_\infty(X)$ is dense when it separates points and vanishes nowhere jointly: for each $x$ there is $f\in S$ with $f(x)\ne0$. Extend functions by zero to [[笔记主体/书籍/Simon实分析/第二章/知识/Local Compactness and Compactification|the one-point compactification]]. The additional nonvanishing condition separates $x$ from infinity. The preceding vanishing-at-one-point variant proves the result. The complex version additionally requires conjugation invariance.

The proposition says which approximation spaces are dense. It does not choose a rate, coefficients, quadrature rule, or a canonical approximating sequence. Those are additional tasks answered by constructions such as Bernstein or Fejér, and by the separate orthogonal geometry of Hilbert spaces.

## Source trail

§2.5, pp.88–93; Theorems 2.5.2–5, 2.5.7. PDF 110（来源 PDF，第 110 页；原文件未公开） · PDF 111（来源 PDF，第 111 页；原文件未公开） · PDF 113（来源 PDF，第 113 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.5 The Stone–Weierstrass Theorem|2.5 The Stone–Weierstrass Theorem]] · p. 88 · PDF 109（来源 PDF，第 109 页；原文件未公开）
- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#3.5 Classical Fourier Series|3.5 Classical Fourier Series]] · p. 137 · PDF 158（来源 PDF，第 158 页；原文件未公开）
