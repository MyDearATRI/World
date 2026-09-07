---
type: 知识
status: 已整理
layer: Working
aliases:
  - 算子与伴随
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/hilbert
  - object/operator
  - method/duality
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: 'Operators, Adjoints, and Operator Topologies'
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.6–3.7 · pp. 173–176 · PDF 194（来源 PDF，第 194 页；原文件未公开）–197（来源 PDF，第 197 页；原文件未公开）.

Once vectors can represent continuous functionals, an operator can be moved from one slot of an inner product to the other. This defines its adjoint. The resulting identities organize projections, unitaries and positivity, while operator topologies describe different meanings of approximation by operators.

## The adjoint from Riesz representation

Let $A\in\mathcal L(H)$ be bounded and linear. For fixed $x$, the functional $y\mapsto\langle x,Ay\rangle$ is bounded with norm at most $\|x\|\|A\|$. [[笔记主体/书籍/Simon实分析/第三章/知识/Linear Functionals as Vectors#Riesz representation|Riesz representation]] gives a unique vector $A^*x$ such that
$$
\boxed{\langle x,Ay\rangle=\langle A^*x,y\rangle.}
$$
This is the defining identity throughout the notes. Uniqueness and sesquilinearity imply $A^*(ax+bz)=aA^*x+bA^*z$. The norm characterization of a representing vector gives $\|A^*x\|\le\|A\|\|x\|$, so $A^*$ is bounded. Taking conjugates shows $(A^*)^*=A$, and hence $\|A^*\|=\|A\|$. Also
$$
\|Ax\|^2=\langle x,A^*Ax\rangle\le\|A^*A\|\|x\|^2,
$$
while submultiplicativity gives $\|A^*A\|\le\|A^*\|\|A\|$. Therefore $\|A^*A\|=\|A\|^2$. These are the identities stated in §3.7 and assigned for verification in Problem 1; the core adjoint proof is expanded here. The printed (3.7.2) exchanges its variables incorrectly; see [[笔记主体/书籍/Simon实分析/第三章/第三章 习题与原书核校#Source corrections and open checks|the page-image check]].

## Isometries, unitaries, and projections

A linear isometry satisfies $\|Ux\|=\|x\|$ for every $x$. Polarization makes this equivalent to preservation of the inner product, or $U^*U=I$. A unitary is a surjective isometry; equivalently $U^*U=UU^*=I$. Surjectivity is additional in infinite dimensions: the unilateral shift $U(x_1,x_2,\ldots)=(0,x_1,x_2,\ldots)$ on $\ell^2$ is isometric and has closed proper range.

An orthogonal projection satisfies $P^2=P=P^*$. Indeed self-adjointness makes its range orthogonal to its kernel; conversely the [[笔记主体/书籍/Simon实分析/第三章/知识/Nearest Points in Convex Sets#Orthogonal decomposition and its projection|orthogonal decomposition]] makes $\langle x,Py\rangle=\langle Px,y\rangle$. An algebraic projection need not be self-adjoint, as the oblique example in [[笔记主体/书籍/Simon实分析/第一章/知识/投影、直和与不变子空间|Chapter 1's projection page]] shows.

A partial isometry acts isometrically on a closed initial subspace $H_I$ and vanishes on $H_I^\perp$. Its range $H_F$ is closed: a Cauchy sequence of images has a Cauchy sequence of preimages in $H_I$, and completeness supplies the limit. Consequently $U^*U=P_{H_I}$ and $UU^*=P_{H_F}$. On $H_F$, $U^*$ is the inverse of the restricted unitary $U:H_I\to H_F$. These describe the initial and final projections in (3.7.9).

## Self-adjoint, positive, normal, compact

An operator is self-adjoint if $A=A^*$, normal if $AA^*=A^*A$, and positive if $\langle x,Ax\rangle\ge0$ for every $x$; the last comparison includes the requirement that the number be real. Positivity implies self-adjointness by polarization of the quadratic form. Self-adjoint and unitary operators are normal. These definitions apply only to bounded operators in this page; unbounded operators require explicit domain conditions later.

A bounded operator is compact if the image of its unit ball has compact closure in the norm topology. Finite-rank operators are compact by finite-dimensional compactness; the identity in infinite dimensions is not, since its image contains an orthonormal sequence. The compact self-adjoint spectral theorem gives an orthonormal eigenbasis; this is a cited result from Part 4, not proved in §3.7. Likewise the polar decomposition $A=U|A|$, $|A|=(A^*A)^{1/2}$, with initial space $\ker(A)^\perp$, is a preview whose existence requires the later theory of positive square roots.

The bounded multiplication operator $Mf(x)=xf(x)$ on $L^2([0,1])$ is first defined on continuous functions. Its bound $\|Mf\|_2\le\|f\|_2$ extends it to the completion, and the inner product identity extends to prove it is self-adjoint and positive. It has no nonzero eigenvectors. The source's verification of that last statement is Problem 4 and explicitly uses the measurable-function realization of $L^2$ from Chapter 4; it remains a cited counterexample here. Thus [[笔记主体/书籍/Simon实分析/第一章/知识/内积、自伴算子与有限维谱定理|the finite-dimensional spectral theorem]] cannot be transferred to arbitrary bounded self-adjoint operators as an assertion of an eigenbasis.

## Three topologies on operators

For nets $A_\alpha\in\mathcal L(H)$, operator-norm convergence requires $\|A_\alpha-A\|\to0$; strong operator convergence requires $\|(A_\alpha-A)x\|\to0$ for every fixed $x$; weak operator convergence requires $\langle y,(A_\alpha-A)x\rangle\to0$ for every fixed $x,y$. The norm bound and Schwarz show
$$
\text{operator norm}\ \Longrightarrow\ \text{strong operator}\ \Longrightarrow\ \text{weak operator}.
$$
For projections $P_n$ onto the first $n$ standard coordinates in $\ell^2$, $P_nx\to x$ for every $x$, but $\|I-P_n\|=1$. Thus strong convergence need not imply norm convergence. Powers $U^n$ of the unilateral shift converge weakly as operators to zero: for finite-support $y$, $\langle y,U^nx\rangle=0$ for large $n$, and approximation of arbitrary $y$ in norm extends the limit. They do not converge strongly to zero because $\|U^nx\|=\|x\|$. These supplementary examples make both strict implications concrete.

The whole operator space has nonmetrizable strong and weak operator topologies when $H$ is infinite-dimensional, whereas norm-bounded operator balls are metrizable for separable $H$. This is the scope of [[笔记主体/书籍/Simon实分析/第三章/第三章 习题与原书核校#3.6 The Weak Topology|§3.6, Problem 1]], left as an exercise. In finite dimensions all three operator topologies coincide; the infinite-dimensional qualification is essential.
