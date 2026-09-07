---
title: Contractions and fixed points
description: Iteration, completeness, and a quantitative route to convergence.
sample: true
---

A small decrease at each step can determine a limit. This note follows that idea through a standard fixed-point theorem, a strategy for its proof, and an exact computation.[^specimen]

<span lang="zh-CN">每一步都把距离缩短，是否就足以保证收敛？关键还在于：可能的极限是否留在我们讨论的空间里。</span>

## Iteration as a question

Suppose that a map $T:X\to X$ describes one step of a repeated procedure. Starting at $x_0\in X$, define $x_{n+1}=T(x_n)$ for every integer $n\geq 0$. A fixed point is a point $p\in X$ with $T(p)=p$: once the procedure reaches $p$, every subsequent step stays there. The question is whether iteration can find such a point, and whether the answer depends on the starting point.

Being able to repeat the procedure is not enough. A sequence may oscillate, escape to infinity, or approach a point missing from its domain. A useful theorem must control both the movement of the iterates and the space in which a limit is allowed to live. Here the movement is controlled by a uniform contraction estimate; the existence of a limit is supplied by completeness. The distinction becomes visible even in elementary examples on the real line.

We assume familiarity with metric spaces and convergence of sequences. The linked note on a [[notes/complete-metric-spaces|complete metric space]] states the precise completeness condition and explains why it belongs in the theorem.

## A uniform decrease

> [!definition] DEF · Contraction
> Let $(X,d)$ be a metric space. A map $T:X\to X$ is a contraction if there exists a real number $q$ with $0\leq q<1$ such that
>
> $$
> d(Tx,Ty)\leq q\,d(x,y)\qquad\text{for all }x,y\in X.
> $$
>
> The same constant $q$ must work for every pair of points. We call any such $q$ a contraction constant for $T$.

The uniformity matters. The condition $d(Tx,Ty)<d(x,y)$ for each distinct pair does not by itself provide a single geometric rate below $1$. A contraction gives a rate that survives repeated application: for each integer $n\geq 1$, the distance between $T^n x$ and $T^n y$ is at most $q^n d(x,y)$. In particular, successive steps along an orbit become small at a controlled rate.

> [!sidenote] RMK · The role of a uniform constant
> <span lang="zh-CN">每对点都变近，还不等于存在一个统一的收缩率。这里反复使用的是同一个常数；它让相邻步长能够组成可求和的几何级数。</span>

There are two useful boundary cases. When $q=0$, all values of $T$ are equal, so any orbit reaches a fixed point after its first step, provided $X$ is nonempty. When $q=1$, the defining estimate would merely say that distances do not increase. That weaker condition permits translations of the real line and therefore does not guarantee a fixed point.

## Existence and an error bound

> [!theorem] THM · Contraction mapping theorem
> Let $(X,d)$ be a nonempty complete metric space, and let $T:X\to X$ be a contraction with constant $0\leq q<1$. Then $T$ has a unique fixed point $p\in X$. For every starting point $x_0\in X$, the iterates $x_{n+1}=T(x_n)$ converge to $p$.
>
> For every integer $n\geq 1$, they satisfy the a priori error estimate
>
> $$
> d(x_n,p)\leq \frac{q^n}{1-q}\,d(x_0,x_1).
> $$

The estimate uses quantities known before the limit has been found. Once a contraction constant and the first step are known, the right-hand side gives a guaranteed upper bound for later errors. A larger valid choice of $q$ still gives a valid bound, but it may predict slower convergence than the orbit actually exhibits.

The calculation behind that estimate begins with a finite tail. For integers $n\geq 1$ and $m\geq 1$, the triangle inequality and the contraction estimate give

$$
d(x_n,x_{n+m})\leq\sum_{j=n}^{n+m-1}d(x_j,x_{j+1})\leq\sum_{j=n}^{n+m-1}q^j d(x_0,x_1)=\frac{q^n(1-q^m)}{1-q}\,d(x_0,x_1)\leq\frac{q^n}{1-q}\,d(x_0,x_1).
$$

The last expression does not depend on $m$. This is the essential feature: all sufficiently late terms are close to one another, including terms separated by many iteration steps. Merely knowing that $d(x_n,x_{n+1})$ tends to zero would not provide that conclusion.

<span lang="zh-CN">这里控制的是整段尾部的距离，不只是相邻两项。长公式保留同一条推导链；在窄屏上，可以只滚动公式本身。</span>

## A strategy for the theorem

> [!proof-strategy] Proof strategy — not a complete proof
> First use the finite-tail estimate to establish the Cauchy condition for the orbit. Completeness then supplies a limit $p$ inside $X$. Next use the Lipschitz estimate for $T$ to pass to the limit in $x_{n+1}=T(x_n)$ and obtain $T(p)=p$.
>
> To address uniqueness, compare two hypothetical fixed points and apply the contraction inequality to their distance. To obtain the error bound, pass to the limit in the finite-tail estimate with $n$ fixed. The full epsilon argument for the Cauchy condition and the limit passages are not expanded here; this block records the strategy, not a completed proof.

This route assigns a distinct job to each hypothesis. Nonemptiness allows the starting point to be chosen. The fact that $T$ maps $X$ into itself makes every iterate legitimate. The strict inequality $q<1$ makes the geometric tail tend to zero and forces two fixed points to coincide. Completeness ensures that the resulting Cauchy sequence has a limit in the stated domain. None of these roles can be supplied by typography or by an informal picture of points moving closer together.

## A model on the real line

> [!example] EX · An affine contraction
> Take $X=\mathbb{R}$ with its usual metric and define $T(x)=(x+1)/3$. For all real $x,y$,
>
> $$
> |T(x)-T(y)|=\frac13|x-y|,
> $$
>
> so $q=1/3$ is a contraction constant. Solving $p=(p+1)/3$ gives the fixed point $p=1/2$.
>
> Subtracting $1/2$ from the recurrence yields $x_{n+1}-1/2=(x_n-1/2)/3$. Repeating this equality gives the exact formula
>
> $$
> x_n=\frac12+3^{-n}\left(x_0-\frac12\right)\qquad(n\geq 0).
> $$

For the starting point $x_0=0$, the first terms are $0,1/3,4/9,13/27$. The exact error is $|x_n-1/2|=1/(2\cdot 3^n)$. Since $|x_1-x_0|=1/3$, the theorem's bound has precisely the same value in this case. The estimate is therefore attained, rather than merely suggesting the right qualitative behavior.

<span lang="zh-CN">这个例子既能直接求解，也能逐项迭代，因此可以拿精确误差核对抽象估计。两种算法在这里提供了同一个答案。</span>

The [[notes/complete-metric-spaces#what-fails-without-completeness|incomplete-domain example]] changes the space while retaining a contraction. It isolates the point at which the general strategy needs an additional hypothesis.

[^specimen]: The prose and examples on these two pages were prepared as synthetic publishing fixtures. They illustrate standard mathematics and do not assert original results, personal authorship, institutional affiliation, or a publication date.
