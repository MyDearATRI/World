---
type: 知识
status: 已整理
layer: Working
aliases:
  - 逐点收敛与跳跃
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/fourier
  - method/convergence
  - method/expansion
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Pointwise Fourier Convergence and Jumps
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.5 · pp. 148–166 · PDF 169（来源 PDF，第 169 页；原文件未公开）–187（来源 PDF，第 187 页；原文件未公开）.

At a discontinuity there are two questions: which value do partial sums approach at the jump, and how do the partial sums behave at points approaching the jump as the cutoff grows? The first is a fixed-point limit. Gibbs concerns the second, which resolves a shrinking transition region.

## The value selected at a jump

Let $f$ be bounded and piecewise continuous, with one-sided limits $f_-,f_+$ at $\theta_0$. If the one-sided differences satisfy
$$
\int_0^\delta\frac{|f(\theta_0+t)-f_+|+|f(\theta_0-t)-f_-|}{t}\,dt<\infty,
$$
then $S_Nf(\theta_0)\to(f_++f_-)/2$. To see the mechanism, subtract the local step with values $f_\pm$ and subtract their average separately. The odd part of the step integrates to zero against the even Dirichlet kernel, the constant part is reproduced, and the remaining function satisfies the local [[笔记主体/书籍/Simon实分析/第三章/知识/Dirichlet Kernels and Dini Convergence#Proof — Separate the small region from the oscillatory region|Dini estimate]]. Changes away from the point disappear by localization. This expands the concrete piecewise-continuous case of §3.5, Problem 5; the source's general measurable $L^2$ form belongs after Chapter 4.

The actual value assigned to $f(\theta_0)$ affects no Riemann integral and therefore no coefficient. The Fourier limit at a jump is not required to equal that assigned value.

## The step and the Gibbs scale

Take $f(\theta)=1$ on $(0,\pi)$, $f(\theta)=-1$ on $(-\pi,0)$, and set its endpoint values to zero. Direct integration gives $f_k^\sharp=0$ for even $k$, and $f_k^\sharp=2/(i\pi k)$ for odd $k$. Pairing positive and negative frequencies gives
$$
S_{2m}f(x)=S_{2m-1}f(x)
=\frac4\pi\sum_{j=0}^{m-1}\frac{\sin((2j+1)x)}{2j+1}
=\frac2\pi\int_0^x\frac{\sin(2mt)}{\sin t}\,dt.
$$
The last equality follows by differentiating the finite sum and summing a geometric progression, then using its value zero at $x=0$. Since $1/\sin t-1/t=O(t)$ near zero, uniformly in $m$,
$$
S_{2m}f(x)=G(2mx)+O(x^2),\qquad
G(y)=\frac2\pi\int_0^y\frac{\sin s}{s}\,ds.
$$
Thus for fixed $y$, $S_{2m}f(y/(2m))\to G(y)$. The positive first maximum occurs at $x=\pi/(2m)$, since the derivative is proportional to $\sin(2mx)/\sin x$. On $(0,\pi/2)$ successive signed lobes of this derivative have decreasing magnitudes because $\sin x$ increases; pair adjacent lobes to see later maxima cannot exceed the first. Reflection about $\pi/2$ and odd symmetry cover the other intervals. Equivalently, the limiting profile has decreasing alternating lobe integrals because $1/s$ decreases. Therefore
$$
\lim_{N\to\infty}\|S_Nf\|_\infty
=G(\pi)=\frac2\pi\int_0^\pi\frac{\sin s}{s}\,ds
\approx1.178979744.
$$
This expands the mechanism and maximum selection in Theorem 3.5.17. For the cutoff $N$, nearest extrema lie at distance $\pi/N+O(N^{-2})$ from a jump. The width tends to zero while the excess amplitude tends to a nonzero limit.

> [!insight] RMK — A shrinking error region can retain a fixed amplitude
> For the step with jump size two, Fourier partial sums have a limiting excess of about $0.17898$ above the upper level, or $8.949\%$ of the jump size, at points whose distance from the jump is of order $N^{-1}$. This is compatible with $L^2$ convergence and convergence at every fixed continuity point: neither limit controls a supremum on a moving transition region.
> 中文备注：误差区域变窄不代表峰值变小；要同时看幅度、宽度与正在使用的收敛方式。
> Identity: structural explanation of the Gibbs theorem. Proof status: scaling and maximum argument above; $L^2$ convergence follows from [[笔记主体/书籍/Simon实分析/第三章/知识/Trigonometric Density and L2 Fourier Expansion#From density to norm-convergent Fourier series|the orthonormal basis theorem]].

^insight-ch3-gibbs

## Positive means and the impossibility of uniform convergence to a jump

[[笔记主体/书籍/Simon实分析/第三章/知识/Fourier Series and Summation Kernels#^insight-ch3-positive-kernels|Positivity of Fejér kernels]] implies $-1\le C_Nf\le1$ for this step, so these means have no overshoot beyond the levels. Nevertheless they cannot converge uniformly to the discontinuous step, because uniform limits of continuous functions are continuous. At a continuity point they converge to the pointwise value, and at the jump the even kernel gives the average. Removing overshoot changes the transition profile; it does not remove the discontinuity of the target.

## Jordan's theorem and its deferred dependency

Theorem 3.5.18 states that if a periodic function has bounded variation, its Fourier partial sums converge at every angle to the average of its one-sided limits. Bounded variation means finite total variation over one period, and does not require differentiability. This is a cited theorem here: the source directs its proof to Problem 3, using decomposition into monotone functions and the second mean value theorem from §4.15. The complete BV proof is deferred to that dependency rather than made to appear established by the Hilbert argument.

The local formulation uses every angle on the circle; the unrelated interval in the printed last phrase of Theorem 3.5.18 is recorded in [[笔记主体/书籍/Simon实分析/第三章/第三章 习题与原书核校#Source corrections and open checks|the source check]]. General jump asymptotics under one-sided Hölder control are the subject of Problem 24. No unqualified claim is made here for arbitrary discontinuous functions or arbitrary representatives of abstract $L^2$ vectors.
