---
type: 知识
status: 已整理
layer: Working
aliases:
  - 凸集最佳逼近
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/hilbert
  - method/convexity
  - method/approximation
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Nearest Points in Convex Sets
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.2 · pp. 119–122 · PDF 140（来源 PDF，第 140 页；原文件未公开）–143（来源 PDF，第 143 页；原文件未公开）.

To obtain a complementary subspace in infinite dimensions, algebraic existence is insufficient: the decomposition must interact with convergence. A minimization problem produces a complement and a bounded projection at the same time.

> [!theorem] THM — Nearest point in a closed convex set
> Let $H$ be a complete inner product space and let $C\subset H$ be nonempty, closed, and convex. For every $x\in H$, there exists a unique $p\in C$ such that $\|x-p\|=\inf_{z\in C}\|x-z\|$. Separability is unnecessary.

## Proof — Near minimizers must approach one another

The goal is existence without assuming that closed bounded sets are compact. Set $d=\inf_{z\in C}\|x-z\|$ and choose $y_n\in C$ with $\|x-y_n\|^2\le d^2+1/n$. Convexity places the midpoint $(y_n+y_m)/2$ in $C$. Applying the parallelogram identity to $x-y_n$ and $x-y_m$ gives
$$
\left\|x-\frac{y_n+y_m}{2}\right\|^2+
\frac14\|y_n-y_m\|^2
=\frac12\bigl(\|x-y_n\|^2+\|x-y_m\|^2\bigr).
$$
The first term is at least $d^2$. Hence $\|y_n-y_m\|^2\le2/n+2/m$. Completeness gives a limit $p\in H$, closedness puts $p$ in $C$, and continuity of the norm gives $\|x-p\|=d$. If $p,q$ are both minimizers, the same identity forces $\|p-q\|=0$. This expands Theorem 3.2.1. Nonemptiness, implicit in the book's choice of a minimizing sequence, is included in the local statement.

> [!insight] IDEA — Existence through a Cauchy estimate
> In a complete inner product space, convexity and the parallelogram law force a minimizing sequence for distance to be Cauchy. The existence proof therefore needs closedness and completeness, but no compactness of bounded sets. This route remains available in infinite-dimensional Hilbert spaces, whose unit balls are not norm compact.
> 中文备注：困难在于先证明近极小点彼此靠近；不是先从有界列中抽一个收敛子列。
> Identity: structural reading of Theorem 3.2.1. Proof status: fully expanded above; noncompactness is checked in [[笔记主体/书籍/Simon实分析/第三章/知识/Weak Topologies and Dual Pairings#Weak compactness of a ball|the orthonormal-sequence example]].

^insight-ch3-minimization

## The variational condition

For a general closed convex $C$, the minimizer is characterized by
$$
\operatorname{Re}\langle x-p,z-p\rangle\le0\qquad(z\in C).
$$
Indeed $p+t(z-p)\in C$ for $0\le t\le1$. Expand the squared distance, subtract $\|x-p\|^2$, divide by $t>0$ and let $t\downarrow0$. Conversely, the displayed inequality in the same expansion shows that every $z\in C$ has distance at least that of $p$. This is a supplementary formulation of the book's minimization argument.

If $C=M$ is a linear subspace, all real and imaginary multiples of every $z\in M$ are allowed. The inequality becomes $\langle x-p,z\rangle=0$ for every $z\in M$. For a general convex set only the one-sided inequality is justified; nearest-point maps need not be linear. For example projection onto $[0,\infty)\subset\mathbb R$ is $x\mapsto\max(x,0)$.

## Orthogonal decomposition and its projection

For a closed subspace $M$, write $P_Mx=p$ and $x-p\in M^\perp$. The decomposition
$$
H=M\oplus M^\perp
$$
is unique because $M\cap M^\perp=\{0\}$. Adding decompositions and multiplying them by scalars proves that $P_M$ is linear. It is idempotent, has range $M$, kernel $M^\perp$, and satisfies
$$
\|x\|^2=\|P_Mx\|^2+\|(I-P_M)x\|^2.
$$
Thus $\|P_M\|\le1$, with equality unless $M=\{0\}$. This is a geometric instance of the [[笔记主体/书籍/Simon实分析/第一章/知识/投影、直和与不变子空间#投影与两部分直和一一对应|algebraic projection–direct sum correspondence]], with orthogonality fixing the complement and forcing boundedness. Conversely a linear idempotent whose range is orthogonal to the range of $I-P$ obeys this identity and is bounded. Its range is closed, since $y_n=Py_n\to y$ implies $Py=y$.

For any subspace $T$, $T^\perp$ is closed as an intersection of kernels of continuous functionals, and $T^\perp=(\overline T)^\perp$. Apply the decomposition to $\overline T$. If $x\in T^{\perp\perp}$, write $x=y+z$ with $y\in\overline T$ and $z\in T^\perp$. Then $0=\langle x,z\rangle=\|z\|^2$, so $x=y$. Consequently $T^{\perp\perp}=\overline T$. This is a supplementary proof of Corollary 3.2.6, whose proof the source assigns to Problem 1.

## Conditions that cannot be omitted

The open interval $(0,1)$ has no closest point to $2$, so closedness matters. The set $\{-1,1\}\subset\mathbb R$ has two nearest points to $0$, so convexity matters for uniqueness. In $\ell^2$, the finite-support subspace is dense and proper; its orthogonal complement is zero, and a vector with infinitely many nonzero coordinates has distance zero from it without attaining that distance. Thus an algebraic subspace cannot be substituted for a closed one in the decomposition theorem. These are boundary examples, not additional assumptions on the finite-dimensional statement.
