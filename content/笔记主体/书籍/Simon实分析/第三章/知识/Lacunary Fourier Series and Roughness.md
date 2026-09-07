---
type: 知识
status: 已整理
layer: Working
aliases:
  - 稀疏 Fourier 级数与粗糙函数
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
title: Lacunary Fourier Series and Roughness
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.5 · pp. 145–147 · PDF 166（来源 PDF，第 166 页；原文件未公开）–168（来源 PDF，第 168 页；原文件未公开）.

A uniformly convergent trigonometric series can define a continuous function with no derivative anywhere. To prove this one must do more than formally differentiate a divergent series. Gaps in the frequency support let a localized averaging kernel isolate a single coefficient, turning hypothetical pointwise regularity into an impossible quantitative bound.

## A family with separated frequencies

For an integer $b\ge2$, let
$$
f_{a,b,\gamma}(x)=\sum_{n=1}^{\infty}a^n n^\gamma\cos(b^nx),
$$
where $0<a<1$ and $\gamma\in\mathbb R$, or $a=1$ and $\gamma<-1$. In both cases $\sum a^nn^\gamma<\infty$, so the series converges uniformly and defines a continuous periodic function. Its only nonzero Fourier coefficients occur at $\pm b^n$, with coefficient $a^nn^\gamma/2$. Termwise integration is justified by uniform convergence.

For $0<\alpha\le1$, $|\cos u-\cos v|\le 2^{1-\alpha}|u-v|^\alpha$. Consequently
$$
|f(x)-f(y)|\le2^{1-\alpha}|x-y|^\alpha
\sum_{n\ge1}(ab^\alpha)^n n^\gamma.
$$
The sum converges if $ab^\alpha<1$, or if $ab^\alpha=1$ and $\gamma<-1$. This proves Hölder regularity in those cases. For $\alpha=1$ the derivative series also converges uniformly, which justifies differentiating and gives $C^1$ regularity. This is Theorem 3.5.15(a), with the admissible parameter range recorded explicitly.

## A localized coefficient bound

For the [[笔记主体/书籍/Simon实分析/第三章/知识/Fourier Series and Summation Kernels#Cesàro means and the Fejér kernel|Fejér kernel]], the two bounds
$$
F_N(t)\le N,\qquad F_N(t)\le\frac{\pi^2}{Nt^2}\quad(0<|t|\le\pi)
$$
follow from its finite sum and $|\sin(t/2)|\ge|t|/\pi$. For $N\ge2$, split the integral at $1/N$. Integrating $N|t|^\alpha$ inside and $\pi^2|t|^{\alpha-2}/N$ outside gives
$$
\int_{-\pi}^{\pi}|t|^\alpha F_N(t)\,\frac{dt}{2\pi}
\le\begin{cases}C_\alpha N^{-\alpha},&0<\alpha<1,\\
C_1N^{-1}\log N,&\alpha=1.
\end{cases}
$$
This is Lemma 3.5.13 with the split made explicit.

Suppose $f$ is Hölder of order $\alpha$ at $x_0$ and that $f_j^\sharp=0$ whenever $0<|j-k|\le N-1$, with $1<N<|k|$. Translate $x_0$ to zero and subtract $f(0)$; the magnitude of the nonzero coefficient does not change. The Fourier support of $F_N$ lies in $[-N+1,N-1]$ and its constant coefficient is one, so the gap condition gives
$$
f_k^\sharp=\int e^{-ikt}F_N(t)\,[f(t)-f(0)]\,\frac{dt}{2\pi}.
$$
A local Hölder bound extends to $|f(t)-f(0)|\le C'|t|^\alpha$ on $[-\pi,\pi]$ for continuous periodic $f$, by enlarging the constant away from zero. Positivity of $F_N$ and the moment estimate imply $|f_k^\sharp|\le C''N^{-\alpha}$ for $\alpha<1$, and $|f_k^\sharp|\le C''\log N/N$ for $\alpha=1$. This expands Proposition 3.5.14 in the continuous case used here.

## Roughness follows from the gaps

For $k=b^n$, choose $N=b^n-b^{n-1}$. For all sufficiently large $n$ this satisfies the hypotheses and isolates $k$ from the other frequencies. If $f_{a,b,\gamma}$ were Hölder of order $0<\alpha<1$ at any point, the coefficient bound would imply
$$
(ab^\alpha)^n n^\gamma\le C.
$$
This is impossible if $ab^\alpha>1$, or if $ab^\alpha=1$ and $\gamma>0$. If it were Lipschitz at a point, the endpoint moment estimate instead implies
$$
(ab)^n n^{\gamma-1}\le C,
$$
which is impossible if $ab>1$, or if $ab=1$ and $\gamma>1$. Differentiability at a point gives a local Lipschitz bound relative to that point, so the latter cases are nowhere differentiable. These are Theorem 3.5.15(b); the $\alpha<1$ argument expands the step assigned in Problem 16.

For instance $a=1/2$, $b=2$, $\gamma=2$ gives a function Hölder of every order below one and nowhere differentiable. Taking $a=1$, $b=2$, $\gamma=-2$ gives a continuous function that is nowhere Hölder of any positive order. The borderline case $ab=1$, $\gamma=0$ requires the sharper Jackson-kernel method of [[笔记主体/书籍/Simon实分析/第三章/第三章 习题与原书核校#3.5 Classical Fourier Series|Problem 17]]; the Fejér logarithmic estimate here does not decide it.

> [!remark] IDEA — What proves nondifferentiability
> 中文备注：不是“导数级数发散，所以原函数不可导”。实际论证是：假定某一点有足够正则性，局部核就限制远处孤立频率的系数；显式系数违反该限制。

The Takagi and McCarthy constructions in Problems 18–19 use piecewise linear functions rather than Fourier coefficient isolation. They provide alternative proof mechanisms and remain exercise entrances; no fictitious personal attempt or completed solution is attached to them.
