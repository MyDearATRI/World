---
type: 知识
status: 已整理
layer: Working
aliases:
  - Dirichlet 核与 Dini 收敛
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
title: Dirichlet Kernels and Dini Convergence
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.5 · pp. 138–142 · PDF 159（来源 PDF，第 159 页；原文件未公开）–163（来源 PDF，第 163 页；原文件未公开）.

To determine a Fourier partial sum at one point, rewrite the sum as an integral kernel. The kernel has a singular envelope near the point and cancellation away from it. Dini's condition controls the near part; decay of Fourier coefficients controls the far part.

## The Dirichlet kernel

For $f\in C(\mathbb T)$, interchanging a finite sum and an integral gives
$$
S_Nf(\theta)=\int_{-\pi}^{\pi}D_N(t)f(\theta-t)\,\frac{dt}{2\pi},
\qquad D_N(t)=\sum_{k=-N}^Ne^{ikt}
=\frac{\sin((N+\tfrac12)t)}{\sin(t/2)}.
$$
The quotient is interpreted by continuity at multiples of $2\pi$. Summing the geometric progression proves the formula. Also $D_N$ is real and even and $\int D_N\,dt/(2\pi)=1$, but it changes sign. Thus it is not a positive averaging kernel.

> [!theorem] THM — Local Dini test
> Let $f\in C(\mathbb T)$ and fix $\theta_0$. If for some $\delta_0>0$,
> $$
> \int_{|t|<\delta_0}\frac{|f(\theta_0-t)-f(\theta_0)|}{|t|}\,dt<\infty,
> $$
> then $S_Nf(\theta_0)\to f(\theta_0)$.

This is a local-coordinate form of Theorem 3.5.4. The angle is taken modulo $2\pi$ near $\theta_0$, avoiding any artificial dependence on a cut at $0$ or $2\pi$.

## Proof — Separate the small region from the oscillatory region

Subtract the constant value using the integral of $D_N$. For $0<\delta<\delta_0$, write the error as $a_{N,\delta}+b_{N,\delta}$, integrating respectively over $|t|<\delta$ and its complement. Since $|D_N(t)|\le1/|\sin(t/2)|$,
$$
|a_{N,\delta}|\le\int_{|t|<\delta}
\frac{|f(\theta_0-t)-f(\theta_0)|}{|\sin(t/2)|}\,\frac{dt}{2\pi}.
$$
Because $|\sin(t/2)|$ is comparable to $|t|$ near zero, the Dini assumption makes this bound tend to zero as $\delta\downarrow0$, uniformly in $N$.

For fixed $\delta$, let
$$
h_\delta(t)=\mathbf1_{\{|t|\ge\delta\}}
\frac{f(\theta_0-t)-f(\theta_0)}{\sin(t/2)}.
$$
It is bounded and piecewise continuous on the interval, and therefore represents an $L^2$ vector by [[笔记主体/书籍/Simon实分析/第三章/知识/Trigonometric Density and L2 Fourier Expansion#Piecewise continuous functions and the next questions|continuous interpolation across finitely many jumps]]. Expanding $\sin((N+1/2)t)$ into two exponentials makes $b_{N,\delta}$ a linear combination of Fourier coefficients at frequencies tending to infinity of $e^{it/2}h_\delta$ and $e^{-it/2}h_\delta$. Bessel's inequality implies these coefficients tend to zero: a square-summable sequence has vanishing terms. Thus $b_{N,\delta}\to0$ for every fixed $\delta$.

First let $N\to\infty$ and then $\delta\downarrow0$. The far part disappears at the first limit and the near part at the second. This proves the theorem. This is Simon's near/far proof expanded; the coefficient-decay step only needs Bessel, not an unproved pointwise Fourier expansion.

> [!remark] IDEA — Order of limits
> 中文备注：先固定小邻域，靠振荡消去外部；再缩小邻域，用 Dini 积分压住内部。不能把两个控制步骤混成一个未经证明的极限交换。

## Uniform Dini control

Define the modulus $\omega_f(t)=\sup_{d_{\mathbb T}(\theta,\psi)\le t}|f(\theta)-f(\psi)|$. If
$$
\int_0^1\omega_f(t)\,\frac{dt}{t}<\infty,
$$
then $S_Nf\to f$ uniformly. In particular any global Hölder condition $\omega_f(t)\le Ct^\alpha$, $\alpha>0$, suffices.

The near-part estimate above is now uniform in $\theta_0$. For fixed $\delta$, the family of far-part functions indexed by $\theta_0\in\mathbb T$ is compact in $L^2$: the parameter map is continuous in the $L^2$ norm, because uniform continuity of $f$ controls its translated numerator and the denominator is bounded away from zero. To make coefficient decay uniform on a compact family $K$, cover $K$ by finitely many $L^2$ balls of radius $\varepsilon$. Each coefficient functional has norm one; once the finitely many centers have coefficients smaller than $\varepsilon$, every member of $K$ has coefficients smaller than $2\varepsilon$. This proves uniform decay of the far part, and completes the uniform theorem. It expands the source's sketch of Theorem 3.5.5 and the details assigned in Problems 7–8.

## Localization and regularity boundaries

If a piecewise continuous $g$ vanishes near $\theta_0$, its entire convolution at $\theta_0$ is a far-part integral, hence $S_Ng(\theta_0)\to0$. Consequently changing $f$ away from the point does not change an existing local Fourier limit. This is the concrete version of Riemann localization, Theorem 3.5.8. The source states the general $L^2$ version; its function-based formulation can be used after the measurable-function realization in Chapter 4.

Lipschitz or Hölder continuity at the point implies the local Dini integral is finite, since $\int_0^\delta t^{\alpha-1}\,dt<\infty$. Mere continuity does not supply this integral. Nor should the source's informal remark about differentiability be read as “every differentiable function on a compact set is Lipschitz”: a bounded derivative, for example $C^1$ regularity on a compact interval, is a sufficient condition. Unbounded derivatives can occur even when a function is differentiable everywhere.

For jumps, subtract the two one-sided limits separately. Under the corresponding one-sided Dini integrability, symmetry gives their average as the limit. The precise jump statement and its relation to Gibbs are maintained in [[笔记主体/书籍/Simon实分析/第三章/知识/Pointwise Fourier Convergence and Jumps#The value selected at a jump|the jump page]].
