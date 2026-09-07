---
type: 知识
status: 已整理
layer: Working
aliases:
  - 傅里叶求和核
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/fourier
  - method/expansion
  - method/approximation
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Fourier Series and Summation Kernels
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.5 · pp. 138–145 · PDF 159（来源 PDF，第 159 页；原文件未公开）–166（来源 PDF，第 166 页；原文件未公开）.

Fourier partial sums use a sharp cutoff in frequency. Averaging the first several cutoffs replaces their sign-changing kernels by one positive kernel. Positivity and concentration give uniform approximation without requiring extra smoothness of the target function.

## Cesàro means and the Fejér kernel

Retain Simon's indexing:
$$
C_Nf=\frac1N\sum_{n=0}^{N-1}S_nf\qquad(N\ge1).
$$
A frequency $k$ appears in exactly $N-|k|$ summands when $|k|<N$. Therefore
$$
C_Nf=\sum_{|k|<N}\left(1-\frac{|k|}{N}\right)f_k^\sharp e^{ik\theta},
\qquad C_Nf=F_N*f,
$$
where
$$
F_N(t)=\frac1N\left|\sum_{j=0}^{N-1}e^{ijt}\right|^2
=\frac1N\left(\frac{\sin(Nt/2)}{\sin(t/2)}\right)^2.
$$
The first equality follows by counting pairs with a given difference in the squared geometric sum; it gives the same Fourier coefficients as the averaged Dirichlet kernels. The geometric-series formula gives the second equality. This expands Theorem 3.5.9 while fixing the $N$ versus $N+1$ convention throughout this page.

## Positive approximate identities

> [!definition] DEF — Approximate identity on the circle
> A sequence of continuous functions $g_N$ is a positive approximate identity if $g_N\ge0$, $\int_{-\pi}^{\pi}g_N(t)\,dt/(2\pi)=1$, and for every $\delta>0$, $\int_{\delta\le|t|\le\pi}g_N(t)\,dt/(2\pi)\to0$.

For Fejér's kernels positivity follows from the square, total mass from the constant Fourier coefficient, and concentration from
$$
F_N(t)\le\frac1{N\sin^2(\delta/2)}\quad(\delta\le|t|\le\pi).
$$
Let $f\in C(\mathbb T)$. Subtract $f(\theta)$ inside the convolution and split at $\delta$:
$$
\|g_N*f-f\|_\infty\le\omega_f(\delta)
+2\|f\|_\infty\int_{\delta\le|t|\le\pi}g_N(t)\,\frac{dt}{2\pi}.
$$
Positivity permits estimating the integral by the integral of the absolute difference; mass one bounds the near part by its supremum. For fixed $\delta$ the far part vanishes. Compactness of the circle makes $f$ uniformly continuous, so $\omega_f(\delta)\to0$. This proves Theorem 3.5.11 and, with $g_N=F_N$, Fejér's theorem $C_Nf\to f$ uniformly (Theorem 3.5.6). It also gives a constructive proof of trigonometric density.

> [!insight] PROP — Positivity supplies stability as well as convergence
> Every positive kernel of total mass one satisfies $\|g*f\|_\infty\le\|f\|_\infty$. For real-valued bounded integrable $f$ with $m\le f\le M$, it also satisfies $m\le g*f\le M$. Concentration then turns this stable averaging into uniform approximation on continuous functions.
> 中文备注：Fejér 核的正性同时给出误差控制与不越界；集中性负责逼近。三项条件承担不同工作。
> Identity: supplementary structural organization of Proposition 3.5.10, Theorem 3.5.11, and Problem 20. Proof status: the inequalities follow directly by integrating $|f|\le\|f\|_\infty$ and $m\le f\le M$ against a nonnegative mass-one kernel.

^insight-ch3-positive-kernels

## The same proof on Euclidean space

On $\mathbb R^d$, replace the circular distance by $|x|$ and use nonnegative kernels of integral one whose mass outside each ball about zero tends to zero. If $f$ is bounded and uniformly continuous, the same split proves $\|g_N*f-f\|_\infty\to0$. Both qualifications matter on a noncompact domain: continuity alone does not imply uniform continuity or boundedness.

If instead all kernels are supported in one fixed compact set and $f$ is merely continuous, then on each compact target set $K$ only values of $f$ in a fixed compact set $K-\operatorname{supp}g_N$ are sampled. Boundedness and uniform continuity there give convergence uniformly on $K$. This proves the local version of Theorem 3.5.12. At the present chapter stage the integrals are taken in the classical setting where they exist; the $L^1$ formulation belongs to later measure theory.

## Other kernels and what they change

The [[笔记主体/书籍/Simon实分析/第三章/第三章 习题与原书核校#3.5 Classical Fourier Series|exercise sequence]] develops Poisson kernels for Abel means, de la Vallée Poussin kernels with an unchanged central band of Fourier coefficients, Landau kernels for algebraic polynomial approximation, and Jackson kernels with sharper moment estimates. These are further constructions, not alternative names for $F_N$. In particular the Jackson kernel is the normalized square of $F_N$, and its role in the borderline nowhere-differentiability argument is left at Problem 17.

The comparison with [[笔记主体/书籍/Simon实分析/第三章/知识/Dirichlet Kernels and Dini Convergence#The Dirichlet kernel|Dirichlet's kernel]] is structural: both reproduce constants, but Dirichlet's kernel changes sign. Its cancellation enables localization, while its lack of positivity prevents the immediate supremum bound above. [[笔记主体/书籍/Simon实分析/第三章/知识/Pointwise Fourier Convergence and Jumps|Gibbs overshoot]] makes that difference visible at a jump. A positive mean of a step remains between its two levels, though no continuous approximant can converge uniformly to a discontinuous step.
