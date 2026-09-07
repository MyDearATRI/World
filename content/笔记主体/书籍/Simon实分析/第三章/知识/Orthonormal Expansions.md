---
type: 知识
status: 已整理
layer: Working
aliases:
  - 正交展开
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/hilbert
  - method/orthogonality
  - method/expansion
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Orthonormal Expansions
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.4 · pp. 131–136 · PDF 152（来源 PDF，第 152 页；原文件未公开）–157（来源 PDF，第 157 页；原文件未公开）.

An infinite-dimensional orthonormal basis is useful because it reconstructs vectors by norm-convergent sums. This changes the meaning of “basis” from [[笔记主体/书籍/Simon实分析/第一章/知识/线性基、维数与代数补空间#从极大线性无关集得到基|the algebraic basis of Chapter 1]], where every expansion must be finite.

## Expansion and Parseval

> [!theorem] THM — Four equivalent forms of completeness of an orthonormal family
> For an orthonormal family $(e_j)$ in a Hilbert space, the following are equivalent: it is maximal among orthonormal families; its finite linear span is dense; every $x$ equals $\sum_j\langle e_j,x\rangle e_j$ in norm; every $x$ satisfies $\|x\|^2=\sum_j|\langle e_j,x\rangle|^2$.

The sum exists by [[笔记主体/书籍/Simon实分析/第三章/知识/Hilbert Completeness and Norm Identities#Infinite orthogonal sums|the square-summable orthogonal-series theorem]]. Its residual $r=x-\sum_j\langle e_j,x\rangle e_j$ is orthogonal to every $e_j$, by continuity of the inner product. If the family is maximal, $r\ne0$ would allow adjoining $r/\|r\|$, a contradiction. Thus $r=0$. The general Pythagorean identity now gives Parseval. Conversely Parseval makes the residual norm zero. The expansion implies density of the finite span; density implies that a vector orthogonal to the family is zero, which gives maximality. The equivalences are a note organization of Theorem 3.4.1 and its proof.

Writing $\widehat x_j=\langle e_j,x\rangle$, the coefficient map $x\mapsto(\widehat x_j)$ is linear and isometric. Every square-summable sequence $(a_j)$ produces $x=\sum_j a_je_j$ with those coefficients. Polarization gives
$$
\langle x,y\rangle=\sum_j\overline{\widehat x_j}\widehat y_j.
$$
This proves the coefficient map is unitary onto the corresponding sequence space. A nonzero separable Hilbert space is consequently unitarily equivalent to $\mathbb C^n$ or $\ell^2(\mathbb N)$; the zero space supplies the omitted $n=0$ case in the source's list.

## Constructing a basis with Gram–Schmidt

Start with a countable dense sequence and discard zero vectors and any vector in the finite span of its predecessors. If the process terminates, the retained finite-dimensional span is closed and dense, hence equals $H$. Otherwise obtain an independent sequence $(y_j)$ with dense finite span. Set
$$
w_j=y_j-\sum_{k<j}\langle e_k,y_j\rangle e_k,
\qquad e_j=w_j/\|w_j\|.
$$
Independence guarantees $w_j\ne0$; the coefficient choice gives orthogonality. Inductively the first $j$ vectors in the old and new families have the same span. Therefore the new orthonormal family has dense span and is a basis by the previous theorem. These steps expand Proposition 3.4.2 and Theorem 3.4.3. Separability supplies the dense sequence, while completeness was used earlier for infinite sums. If separability is dropped, [[笔记主体/书籍/Simon实分析/第一章/知识/偏序、链与 Zorn 引理#怎样检查链条件|Zorn's chain argument]] constructs a maximal orthonormal family as in Problem 1.

In a separable metric space, an orthonormal family is at most countable: its vectors are pairwise $\sqrt2$ apart, so disjoint balls of radius less than $\sqrt2/2$ must contain distinct points of a countable dense set. This explains why countable expansion suffices in Simon's default setting.

## Triangular algebra and approximation

Gram–Schmidt preserves each finite span, so each new vector is a combination of its predecessors and the current input. This gives triangular change-of-coordinate matrices. The direction of the triangular array depends on whether vectors are assembled as rows or columns; it must be checked from the displayed sums. The positive-diagonal normalization removes the phase ambiguity. Cholesky factorization of a positive definite Gram matrix is the corresponding finite-dimensional factorization, explored in Problems 2–4 rather than proved again here.

Let $P_Nx=\sum_{j\le N}\widehat x_je_j$. Orthogonality shows for $z$ in the first $N$-dimensional span that
$$
\|x-z\|^2=\|x-P_Nx\|^2+\|P_Nx-z\|^2.
$$
Thus $P_Nx$ is the unique best approximation from that span, and $\|x-P_Nx\|^2=\sum_{j>N}|\widehat x_j|^2$. The abstract Fourier coefficients are selected by minimization, not merely by a formal expansion. This connects the basis theorem directly to [[笔记主体/书籍/Simon实分析/第三章/知识/Nearest Points in Convex Sets#Orthogonal decomposition and its projection|orthogonal projection]].

## An orthonormal basis is not a Hamel basis

In $\ell^2$, the standard vectors $(e_n)$ form an orthonormal basis, but $(1/n)_{n\ge1}$ is not a finite linear combination of them. More generally an infinite-dimensional complete inner product space cannot be the finite span of a countable family: discard dependent vectors and orthonormalize; if infinitely many remain, $\sum_n e_n/n$ lies in the completion but outside the finite span; if finitely many remain, their span cannot equal the infinite-dimensional space. This is Lemma 3.6.4, used later to show [[笔记主体/书籍/Simon实分析/第三章/知识/Weak Topologies and Dual Pairings#Why the whole weak space is not metrizable|nonmetrizability of the global weak topology]]. Countable Hilbert dimension and uncountable algebraic dimension therefore coexist without contradiction.
