---
type: 知识
status: 已整理
layer: Working
aliases:
  - 直和与张量积
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/hilbert
  - method/products
  - object/linear-space
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Hilbert Sums and Tensor Products
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

Barry Simon, *Real Analysis*, AMS, 2015 · §3.8 · pp. 176–183 · PDF 197（来源 PDF，第 197 页；原文件未公开）–204（来源 PDF，第 204 页；原文件未公开）.

Two Hilbert spaces can be combined by recording alternatives in separate components or by forming joint pairs of coordinates. The direct sum and tensor product encode these different data. Their abstract Hilbert dimensions do not capture the distinguished embeddings, pairings and operator actions that make the constructions useful.

## Direct sums

For two Hilbert spaces, $H_1\oplus H_2$ is the Cartesian product with componentwise vector operations and
$$
\langle(x_1,x_2),(y_1,y_2)\rangle
=\langle x_1,y_1\rangle+\langle x_2,y_2\rangle.
$$
A sequence of pairs is Cauchy exactly when both component sequences are Cauchy, since its squared difference norm is the sum of the two squared component differences. Completeness follows; products of countable dense sets give separability. If $(e_j)$ and $(f_k)$ are orthonormal bases, $(e_j,0)$ and $(0,f_k)$ together form an orthonormal basis. This proves Theorem 3.8.1.

For bounded $A$ on $H_1$ and $B$ on $H_2$, $(A\oplus B)(x,y)=(Ax,By)$ has norm $\max(\|A\|,\|B\|)$. The upper bound follows by adding the two estimates; the reverse follows by testing $(x,0)$ and $(0,y)$. This external direct sum has distinguished coordinate embeddings, unlike an unspecified [[笔记主体/书籍/Simon实分析/第一章/知识/投影、直和与不变子空间#投影与两部分直和一一对应|choice of complementary subspaces]] in a preexisting vector space.

## Algebraic tensors as actual forms

Following Simon, realize a simple tensor $x\otimes y$ as the function on $H_1\times H_2$
$$
(x\otimes y)(u,v)=\langle u,x\rangle\langle v,y\rangle.
$$
It is antilinear in both input variables and linear in each tensor factor. The algebraic tensor space $H_1\widehat\otimes H_2$ is the finite span of these forms. Using actual forms already imposes the bilinear relations and makes equality meaningful before any inner product is defined.

We want the inner product of simple tensors to be the product of inner products. For $\eta=\sum_jx_j\otimes y_j$ and $\kappa=\sum_k u_k\otimes v_k$, the only possible sesquilinear extension is
$$
\langle\eta,\kappa\rangle
=\sum_{j,k}\langle x_j,u_k\rangle\langle y_j,v_k\rangle.
$$
It must be checked that this expression does not depend on a chosen finite representation.

## Proof — Well-definedness and positivity

For fixed representation of $\eta$, the proposed value is $\sum_j\kappa(x_j,y_j)$. It vanishes whenever $\kappa$ is the zero form. Thus different representations of $\kappa$ give the same value. Conjugate symmetry of the proposed expression then gives independence of the representation of $\eta$. The formula is consequently well-defined and sesquilinear.

The finitely many factors in a representation of $\eta$ span finite-dimensional subspaces $E\subset H_1$ and $F\subset H_2$. Choose orthonormal bases $(e_r)$ and $(f_s)$ there and rewrite
$$
\eta=\sum_{r,s}c_{rs}e_r\otimes f_s.
$$
Evaluation at $(e_r,f_s)$ recovers $c_{rs}$, so a nonzero form has a nonzero coefficient. The proposed inner product gives $\|\eta\|^2=\sum_{r,s}|c_{rs}|^2>0$. This proves strict positivity and completes Proposition 3.8.2. The finite-dimensional reduction is the substantive step; a sum-of-products formula alone does not prove that an inner product exists.

## Completion, coordinate basis, and represented forms

Define $H_1\otimes H_2$ as the metric completion of this inner product space, using [[笔记主体/书籍/Simon实分析/第三章/知识/Hilbert Completeness and Norm Identities#Completion preserves the inner product|the verified inner-product extension]]. Every completion vector $w$ determines an antibilinear form
$$
B_w(u,v)=\langle u\otimes v,w\rangle,
\qquad |B_w(u,v)|\le\|w\|\|u\|\|v\|.
$$
It agrees with the original form on algebraic tensors. If $B_w=0$, then $w$ is orthogonal to every simple tensor and hence to their dense span; therefore $w=0$. This realizes the completion injectively as a space of forms, but does not say every bounded antibilinear form is a tensor vector.

The family $(e_j\otimes f_k)$ is orthonormal. To prove density, approximate each factor of a simple tensor by finite basis expansions and use
$$
\|x\otimes y-x'\otimes y'\|
\le\|x-x'\|\|y\|+\|x'\|\|y-y'\|.
$$
Finite sums of simple tensors are dense by construction, so the product family has dense span. It is an orthonormal basis, giving separability and the natural coordinate model $\ell^2(I)\otimes\ell^2(J)\cong\ell^2(I\times J)$. This is the full content of Theorem 3.8.3. In finite dimensions, direct-sum dimensions add and tensor dimensions multiply.

> [!insight] RMK — Abstract unitary equivalence does not retain a chosen factorization
> Separable infinite-dimensional Hilbert spaces are abstractly unitarily equivalent, but a specified tensor product retains distinguished simple tensors and separate actions $A\otimes I$ and $I\otimes B$. An arbitrary unitary to $\ell^2$ need not preserve that factorization. The construction remains informative even when its abstract Hilbert dimension is unchanged.
> 中文备注：等距同构把空间分类完了，不等于把它携带的分解、坐标含义和独立作用也抹掉了。
> Identity: structural explanation of the opening of §3.8. Proof status: unitary classification and the tensor construction are proved in these notes; preservation of additional structure is not included in the definition of an arbitrary unitary.

^insight-ch3-factorization

## Tensor products of operators

On algebraic tensors define $(A\otimes B)(x\otimes y)=Ax\otimes By$. Well-definedness also follows by precomposing the represented forms with $(A^*,B^*)$. To prove boundedness of $I\otimes B$, write an algebraic vector as $\sum_r e_r\otimes y_r$ with finitely many orthonormal $e_r$. Its squared norm is $\sum_r\|y_r\|^2$, and that of its image is $\sum_r\|By_r\|^2\le\|B\|^2\sum_r\|y_r\|^2$. The same argument in the other factor bounds $A\otimes I$. Since $A\otimes B=(A\otimes I)(I\otimes B)$, it has norm at most $\|A\|\|B\|$ and extends uniquely to the completion.

Test unit simple tensors $x\otimes y$ with $\|Ax\|$ and $\|By\|$ arbitrarily close to their respective suprema to obtain the reverse inequality. Thus $\|A\otimes B\|=\|A\|\|B\|$. Checking on the dense simple tensors yields $(A\otimes B)(C\otimes D)=AC\otimes BD$ and $(A\otimes B)^*=A^*\otimes B^*$. This expands the bounded extension behind (3.8.16)–(3.8.19) and Problem 5.

## Symmetric and antisymmetric tensors

On $H^{\otimes n}$, use the permutation action $U_\pi(x_1\otimes\cdots\otimes x_n)=x_{\pi^{-1}(1)}\otimes\cdots\otimes x_{\pi^{-1}(n)}$. This convention gives $U_\pi U_\tau=U_{\pi\tau}$ and $U_\pi^*=U_{\pi^{-1}}$. Permutations preserve the product inner product on simple tensors and therefore extend to unitaries. Averaging gives
$$
P_{\mathrm{sym}}=\frac1{n!}\sum_{\pi\in S_n}U_\pi,
\qquad P_{\mathrm{alt}}=\frac1{n!}\sum_{\pi\in S_n}\operatorname{sgn}(\pi)U_\pi.
$$
Reindexing the double sums proves idempotence; replacing each permutation by its inverse proves self-adjointness. Reindexing after multiplication by $U_\tau$ shows their ranges are exactly the invariant tensors and the tensors transforming by $\operatorname{sgn}(\tau)$. They are orthogonal projections. Because $A^{\otimes n}$ commutes with every permutation action, both ranges are invariant under it. These arguments expand Proposition 3.8.4. The inverse convention is stated to avoid relying on ambiguous permutation-order notation.

Define $x_1\wedge\cdots\wedge x_n=\sqrt{n!}\,P_{\mathrm{alt}}(x_1\otimes\cdots\otimes x_n)$. Expanding the inner product and reindexing one of the two permutation sums gives
$$
\langle x_1\wedge\cdots\wedge x_n,y_1\wedge\cdots\wedge y_n\rangle
=\det(\langle x_i,y_j\rangle)_{i,j=1}^n.
$$
Indeed each relative permutation occurs $n!$ times, cancelling the normalization, and the remaining signed product sum is the determinant. For an orthonormal basis $(e_j)$, increasing-index wedges $e_{j_1}\wedge\cdots\wedge e_{j_n}$ form an orthonormal basis of the alternating subspace: repeated indices give zero; distinct indices reorder with a sign; applying the bounded projection to the dense product span proves density. If $\dim H=d<\infty$, the top exterior power is one-dimensional and the induced action is multiplication by $\det A$. Functorial multiplication then gives $\det(AB)=\det A\det B$, recovering the algebraic determinant identity through this Hilbert construction. Symmetric dimension counting and the wedge norm inequality remain at [[笔记主体/书籍/Simon实分析/第三章/第三章 习题与原书核校#3.8 Direct Sums and Tensor Products|Problems 8–9]].
