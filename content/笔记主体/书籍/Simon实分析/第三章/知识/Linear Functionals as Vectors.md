---
type: 知识
status: 已整理
layer: Working
aliases:
  - 泛函的向量表示
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/hilbert
  - method/duality
  - method/representation
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Linear Functionals as Vectors
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.3 · pp. 122–130 · PDF 143（来源 PDF，第 143 页；原文件未公开）–151（来源 PDF，第 151 页；原文件未公开）.

A continuous linear functional records one scalar measurement of a vector. In a Hilbert space every such functional is an inner product with one fixed vector. The proof is geometric: the kernel is a closed hyperplane, and its orthogonal direction carries all the information left by the functional.

## Boundedness and continuous extension

For normed spaces $X,Y$, a linear map $T:X\to Y$ is continuous exactly when there is $C<\infty$ with $\|Tx\|\le C\|x\|$. A bound implies continuity by applying it to $x-y$. Conversely continuity at zero gives $r>0$ such that $\|z\|<r$ implies $\|Tz\|<1$. For $x\ne0$, apply this to $z=rx/(2\|x\|)$ and get $\|Tx\|<2\|x\|/r$. Linearity converts a local continuity statement into a global estimate. Define
$$
\|T\|=\sup_{\|x\|\le1}\|Tx\|.
$$
The continuous dual $X^*$ consists of bounded linear maps $X\to\mathbb C$. More generally, a topological vector space has a Hausdorff topology for which addition and scalar multiplication are jointly continuous, and its dual consists of continuous linear functionals. Normed spaces with their norm topology are examples.

If $Y$ is complete, a bounded linear map on a dense subspace $D\subset X$ has a unique bounded linear extension to $\overline D$: for $d_n\to x$ define $Tx=\lim Td_n$. The estimate makes the limit exist and independent of the approximating sequence; taking limits preserves linearity and the bound. Completeness of the target is essential. These are Theorem 3.3.1 and an expanded form of Problem 2 with the necessary target-completeness condition stated.

The space of bounded operators $X\to Y$ is complete when $Y$ is: an operator-norm Cauchy sequence converges at each vector, and a uniform tail estimate passes to the pointwise limit to give operator-norm convergence. In particular $X^*$ is Banach, whether or not $X$ is complete. This expands the fact assigned in Problem 1.

## Riesz representation

> [!theorem] THM — A bounded functional has a unique representing vector
> For every $L\in H^*$ there is a unique $v\in H$ with $L(x)=\langle v,x\rangle$ for all $x\in H$, and $\|L\|=\|v\|$. Here the inner product is linear in its second variable.

Every $v$ defines a bounded functional by Schwarz. If $\langle v,x\rangle=\langle w,x\rangle$ for all $x$, choose $x=v-w$ to prove uniqueness. The substantive step is surjectivity.

If $L=0$, take $v=0$. Otherwise $M=\ker L$ is a proper closed subspace. By [[笔记主体/书籍/Simon实分析/第三章/知识/Nearest Points in Convex Sets#Orthogonal decomposition and its projection|orthogonal decomposition]], choose $0\ne\eta\in M^\perp$. Necessarily $L(\eta)\ne0$, since $M\cap M^\perp=\{0\}$. Set
$$
v=\frac{\overline{L(\eta)}}{\|\eta\|^2}\eta.
$$
Then $\langle v,\eta\rangle=L(\eta)$ and both $L$ and $\langle v,\cdot\rangle$ vanish on $M$. For arbitrary $x$,
$$
x=\left(x-\frac{L(x)}{L(\eta)}\eta\right)
+\frac{L(x)}{L(\eta)}\eta,
$$
where the parenthesized vector belongs to $M$. The two functionals therefore agree on every vector. Finally Schwarz gives $\|L\|\le\|v\|$, and testing at $v/\|v\|$ when $v\ne0$ gives equality. This is the full argument of Theorem 3.3.3 with the conjugation made explicit.

> [!insight] RMK — The identification with the dual is antilinear
> With the second variable linear, the map $J:H\to H^*$, $J(v)=\langle v,\cdot\rangle$, satisfies $J(av)=\overline aJ(v)$. It is an isometric antilinear bijection, not a complex-linear identification. In particular the representing vector of $aL$ is $\overline a$ times the representing vector of $L$.
> 中文备注：向量与泛函可以一一对应，但复数乘法方向变了；伴随公式和核函数中的共轭位置都由此决定。
> Identity: structural explanation of Theorem 3.3.4. Proof status: proved by sesquilinearity and the representation theorem above.

^insight-ch3-riesz

## Kernels and discontinuous functionals

Theorem 3.3.2 states for a nonzero linear functional on a Hausdorff topological vector space that its kernel is closed exactly when it is continuous; otherwise its kernel is dense. Simon proves the general result using nets, pp. 123–124. The general-topology proof is cited here. In a normed space the discontinuous case has a short supplementary proof: unboundedness provides $z_n$ with $|Lz_n|>n\|z_n\|$. Then $w_n=z_n/Lz_n$ has $Lw_n=1$ and $w_n\to0$. For every $x$, $x-L(x)w_n\in\ker L$ tends to $x$, proving density. This also explains why closedness of the kernel is the useful input in the Hilbert proof.

## Evaluation functionals and the RKHS boundary

For a Hilbert space of actual functions on a set $E$, if evaluation at $t$ satisfies $|f(t)|\le C_t\|f\|$, Riesz provides $k_t$ with $f(t)=\langle k_t,f\rangle$. Such evaluation vectors lead to reproducing kernels. No topology on $E$ is needed for this assertion. It is a direct application of the theorem, developed further in [[笔记主体/书籍/Simon实分析/第三章/第三章 习题与原书核校#3.3 Dual Spaces and the Riesz Representation Theorem|Problems 4–11]].

Point evaluation is not bounded in the ordinary $L^2$ norm, as [[笔记主体/书籍/Simon实分析/第三章/知识/Hilbert Completeness and Norm Identities#^insight-ch3-evaluation|the shrinking-tent example]] shows. A Hilbert norm alone therefore does not make an arbitrary function space a reproducing-kernel space. Kernel-conjugation conventions and the source's auxiliary RKHS hypotheses need separate checking before importing those exercises as established results.
