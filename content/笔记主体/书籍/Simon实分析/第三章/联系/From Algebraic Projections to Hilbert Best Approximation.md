---
type: 联系
status: 已整理
layer: Working
aliases:
  - 从代数投影到 Hilbert 最佳逼近
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/联系
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/hilbert
  - method/projection
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-relation
title: From Algebraic Projections to Hilbert Best Approximation
siteKind: body
---
#用途/正式 #类型/联系 #主题/实分析

> 从代数投影到 Hilbert 最佳逼近

Source: Simon, *Real Analysis*, AMS 2015, §1.7 and §§3.1–3.3; pp. 20–21（来源 PDF，第 41 页；原文件未公开） and pp. 119–125（来源 PDF，第 140 页；原文件未公开）. The comparison identifies exactly what inner product, closedness, and completeness add.

## An idempotent remembers a chosen complement

For a linear map $P:V\to V$, the equation $P^2=P$ gives

$$
V=\operatorname{Ran}P\oplus\ker P,\qquad v=Pv+(v-Pv).
$$

The [[笔记主体/书籍/Simon实分析/第一章/知识/投影、直和与不变子空间|algebraic proof]] uses neither a norm nor a limiting argument. Prescribing the range does not specify the kernel. In $\mathbb R^2$, the matrices $P_a=\begin{pmatrix}1&a\\0&0\end{pmatrix}$ all have the same range, but their kernels differ. Thus “projection onto a subspace” still contains a choice unless more structure fixes the complement.

An inner product gives a candidate complement $M^\perp$. The new question is whether every vector splits as a vector of $M$ plus one of $M^\perp$. In an infinite-dimensional space this is an existence theorem, not a consequence of the notation.

## Completeness supplies the minimizer

Let $M$ be a closed subspace of a Hilbert space $H$ and fix $x\in H$. The nearest-point theorem finds $m\in M$ minimizing $\|x-m\|$. Its crucial estimate comes from the parallelogram identity, applied to two points of a minimizing sequence. Their midpoint remains in $M$, so the sequence is Cauchy. Completeness provides a limit in $H$, and closedness puts that limit back in $M$.

The full argument is maintained in [[笔记主体/书籍/Simon实分析/第三章/知识/Nearest Points in Convex Sets|Nearest Points in Convex Sets]]. It also applies to nonempty closed convex sets, where the nearest-point map need not be linear. The linear subspace hypothesis is used later, when varying the minimizer in both directions forces the residual to be orthogonal to every vector in $M$.

> 中文备注：存在性靠极小化列变成 Cauchy 列，再用完备性和闭性；这里没有使用无限维闭球的范数紧性。

## Orthogonality fixes the algebraic choice

For a closed linear subspace, write $x=m+r$ with $r\in M^\perp$. Then for any $z\in M$,

$$
\|x-z\|^2=\|r\|^2+\|m-z\|^2.
$$

Consequently $m$ is the unique nearest point. Uniqueness also makes the assignment $x\mapsto m=P_Mx$ linear: adding two orthogonal decompositions gives the orthogonal decomposition of their sum, and scalar multiplication behaves similarly. Thus $P_M^2=P_M$ and $\|P_Mx\|\le\|x\|$.

With the second-variable-linear convention used throughout these notes, the decompositions of $x$ and $y$ give

$$
\langle x,P_My\rangle=\langle P_Mx,P_My\rangle=\langle P_Mx,y\rangle.
$$

Hence $P_M=P_M^*$. Conversely, a bounded idempotent satisfying $P=P^*$ has orthogonal range and kernel: if $u=Pa$ and $Pv=0$, then $\langle u,v\rangle=\langle a,Pv\rangle=0$. Its range is closed because it is $\ker(I-P)$. These are the analytic conditions that select the orthogonal member of the algebraic family.

## The boundary is a missing limit

In $\ell^2$, let $M=c_{00}$, the finitely supported sequences. It is dense but not closed. For $x=(1/n)_{n\ge1}$, finite truncations show that $\inf_{m\in M}\|x-m\|=0$, while no $m\in M$ attains that distance. Also $M^\perp=\{0\}$, so $M\oplus M^\perp=M\ne\ell^2$.

This supplementary example checks the closedness requirement directly. Algebraic complements of $M$ can exist using a basis extension, but they do not solve the nearest-point problem. The [[笔记主体/书籍/Simon实分析/第一章/联系/从代数投影到正交谱分解|chapter-one comparison]] therefore extends only after the analytic hypotheses have been supplied.

## From a closed kernel to a representing vector

A nonzero bounded linear functional $\ell$ has a closed kernel. Orthogonal decomposition relative to that kernel isolates a one-dimensional perpendicular direction, and scaling a vector in that direction produces the unique $z$ such that $\ell(x)=\langle z,x\rangle$. [[笔记主体/书籍/Simon实分析/第三章/知识/Linear Functionals as Vectors|Linear Functionals as Vectors]] maintains that proof, including its conjugation convention and norm identity.

The route is thus concrete: an algebraic decomposition explains what a projection encodes; Hilbert geometry constructs the canonical orthogonal decomposition; a closed kernel then converts a linear functional into a vector. The argument does not assert that every operator has an orthonormal eigenbasis. The finite-dimensional spectral theorem has additional scope restrictions, addressed in [[笔记主体/书籍/Simon实分析/第三章/知识/Operators, Adjoints, and Operator Topologies|Operators, Adjoints, and Operator Topologies]].

[[笔记主体/发现归档|Insights and additions]] · [[maps/前三章关系图-6db33b5d|Chapters 1–3 map]] · [[笔记主体/书籍/Simon实分析/Simon - Real Analysis|Book entrance]]
