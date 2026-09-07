---
type: 知识
status: 已整理
layer: Working
aliases:
  - 正性逼近
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
  - method/approximation
  - method/positivity
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Positive Approximation and Bernstein Polynomials
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.4, pp.76–88; Theorems 2.4.1–2, 2.4.5, 2.4.7; Proposition 2.4.4. PDF 98（来源 PDF，第 98 页；原文件未公开） · PDF 99（来源 PDF，第 99 页；原文件未公开） · PDF 104（来源 PDF，第 104 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

The Weierstrass approximation theorem asserts that every continuous function on a compact interval can be approximated uniformly by polynomials. Bernstein's construction does more: it gives an explicit polynomial whose error is controlled by the modulus of continuity and the concentration of nonnegative weights.

## THM — An explicit polynomial approximation

For $f\in C([0,1])$ and an integer $n\ge1$, define
$$
B_n f(x)=\sum_{j=0}^n f(j/n)\binom nj x^j(1-x)^{n-j}.
$$
The weights $w_{n,j}(x)$ are nonnegative and sum to $1$, including at $x=0,1$ where many weights vanish. The binomial identity and its first two derivatives give
$$
\sum_j(j/n)w_{n,j}=x,\qquad
\sum_j(j/n-x)^2w_{n,j}=\frac{x(1-x)}n\le\frac1{4n}.
$$
For $\delta>0$ and $\omega_f(\delta)=\sup_{|x-y|\le\delta}|f(x)-f(y)|$,
$$
\|B_nf-f\|_\infty\le\omega_f(\delta)+\frac{\|f\|_\infty}{2n\delta^2}.
$$

### Proof — Separate nearby samples from the tail

Write $B_nf(x)-f(x)=\sum_j(f(j/n)-f(x))w_{n,j}(x)$. Terms with $|j/n-x|\le\delta$ contribute at most $\omega_f(\delta)$ because their weights sum to at most one. On the remaining terms, the difference is at most $2\|f\|_\infty$, while
$$
\sum_{|j/n-x|>\delta}w_{n,j}(x)
\le\delta^{-2}\sum_j(j/n-x)^2w_{n,j}(x)
\le\frac1{4n\delta^2}.
$$
Combining the bounds proves the estimate. First choose $\delta$ so that uniform continuity makes the first term small, then choose $n$ large. Thus $B_nf\to f$ uniformly. An affine change of variable treats a compact interval $[a,b]$ with $a<b$; a singleton interval $a=b$ is handled by a constant polynomial. This is the argument of Theorem 2.4.5 with its moment calculation expanded; no probabilistic limit theorem is assumed.

The formula also gives $B_n1=1$, $B_nx=x$, and $B_n(x^2)=x^2+x(1-x)/n$. Positivity and preservation of constants imply $\|B_nf\|_\infty\le\|f\|_\infty$: convex averaging cannot create a value outside the range bounds. The probability notation in the source is useful shorthand for finite sums, not a dependence on the later probability chapters.

> [!insight] IDEA — Positive mass concentration is the reusable part of Bernstein approximation
> The proof uses nonnegative weights of total mass one, small mass away from the target point, and uniform continuity of the target function. The polynomial formula supplies one realization of those conditions. Replacing its weights by a positive approximate-identity kernel yields the same near/far error decomposition; that later application must verify normalization and concentration anew.
>
> 中文：真正能迁移的是误差控制的三个条件；仅仅“看起来像平均”不足以推出收敛。身份：方法联系；当前有限权重情形已证明。

^insight-ch2-positive-concentration

## PROP — Approximation in the complex variable needs both directions

Trigonometric polynomials, finite linear combinations of $e^{ik\theta}$ for $k\in\mathbb Z$, are uniformly dense in continuous functions on the circle. This is Weierstrass' second theorem; a full proof will use [[笔记主体/书籍/Simon实分析/第二章/知识/Algebras, Lattices, and Uniform Approximation|complex Stone–Weierstrass]]. Polynomials in $z=e^{i\theta}$ alone are not dense. If $P_m(z)\to f$ uniformly on the circle, then for every integer $n\ge1$,
$$
\int_0^{2\pi}f(e^{i\theta})e^{in\theta}\frac{d\theta}{2\pi}=0,
$$
because this integral vanishes for each $P_m$ and integration is continuous in the uniform norm. For $f(z)=\overline z$, the integral with $n=1$ equals one. This proves the obstruction without invoking complex analysis or measure theory.

## THM — Korovkin's testing principle

Let $X$ be compact Hausdorff with at least two points. A finite family $f_1,\ldots,f_m\in C(X,\mathbb R)$ is a Korovkin set in Simon's formulation if there are continuous $a_j(t)$ for which $P(x,t)=\sum_ja_j(t)f_j(x)\ge0$ and $P(x,t)=0$ exactly when $x=t$. If positive linear operators $T_n:C(X)\to C(X)$ satisfy $\|T_nf_j-f_j\|_\infty\to0$ for all these tests, then $\|T_nf-f\|_\infty\to0$ for every $f\in C(X)$. The at-least-two-points qualification makes explicit the condition used in the source exercise's operator-bound argument; on a singleton one must include a nonzero test, for example $1$.

The canonical tests on $[0,1]$ are $1,x,x^2$, since $(x-t)^2=x^2-2tx+t^2$ vanishes only at the target. Positivity translates upper and lower comparison inequalities into operator estimates; the testing functions control the mass away from $t$. This is a quoted result with a proof strategy; the complete proof is assigned to §2.4, Problem 5, pp.85–86. Linearity and positivity are part of the hypothesis, not inferred from an arbitrary approximation formula.

The other exercises study rates, multivariable versions, finite differences and restricted polynomial systems. They are indexed in [[笔记主体/书籍/Simon实分析/第二章/第二章 习题与原书核校|the exercise entrance]] and are not treated as already solved. In particular, density guarantees existence of approximants, not convergence of every chosen interpolation scheme or Fourier partial-sum procedure.

## Source trail

§2.4, pp.76–88; Theorems 2.4.1–2, 2.4.5, 2.4.7; Proposition 2.4.4. PDF 98（来源 PDF，第 98 页；原文件未公开） · PDF 99（来源 PDF，第 99 页；原文件未公开） · PDF 104（来源 PDF，第 104 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.4 The Weierstrass Approximation Theorem and Bernstein Polynomials|2.4 The Weierstrass Approximation Theorem and Bernstein Polynomials]] · p. 76 · PDF 97（来源 PDF，第 97 页；原文件未公开）

## Connections

- [[笔记主体/书籍/Simon实分析/写作规划/Topics/Compact Moment Sequences|Compact Moment Sequences]] — [[笔记主体/书籍/Simon实分析/写作规划/Simon - Writing Plan#R12 Positive Polynomial Models|Positive Polynomial Models]] · Application context
