---
title: Complete metric spaces
description: Cauchy sequences and the space in which a limit is allowed to live.
sample: true
---

This synthetic companion note supplies the completeness hypothesis used in [[index|Contractions and fixed points]]. It describes a property of a metric space, not a guarantee that an arbitrary iteration converges.

<span lang="zh-CN">合成示例 · 完备性负责把已经得到的柯西序列留在空间内部；序列为何是柯西列，需要另行证明。</span>

## The definition

> [!definition] DEF · Cauchy sequence and completeness
> A sequence $(x_n)_{n\geq 0}$ in a metric space $(X,d)$ is Cauchy if, for every $\varepsilon>0$, there exists an integer $N\geq 0$ such that
>
> $$
> d(x_n,x_m)<\varepsilon\qquad\text{whenever }n,m\geq N.
> $$
>
> The metric space is complete if every Cauchy sequence in $X$ converges to a point of $X$.

The Cauchy condition compares terms of a sequence with one another. It does not require a candidate limit to have been identified. Completeness turns this internal control into convergence within the space. Every convergent sequence in a metric space is Cauchy: if $x_n\to p$, choose a stage after which each term is within $\varepsilon/2$ of $p$, and apply the triangle inequality to two such terms. The converse is the additional assertion made by completeness.

## What fails without completeness

> [!example] EX · A missing endpoint
> Equip $X=(0,1)$ with the usual distance inherited from $\mathbb{R}$. The sequence $x_n=1/(n+2)$, for integers $n\geq 0$, is Cauchy because it converges to $0$ in $\mathbb{R}$. It has no limit in $X$, since uniqueness of limits in $\mathbb{R}$ would force that limit to equal $0$. Thus $X$ is not complete.

The map $T:X\to X$ defined by $T(x)=x/2$ has contraction constant $q=1/2$, but its only possible fixed point is $0$, which does not belong to $X$. Starting from any $x_0\in X$, its iterates are $x_n=2^{-n}x_0$. They are Cauchy and approach the omitted endpoint. The failure occurs when a limit inside the domain is needed, not in the contraction estimate.

<span lang="zh-CN">收缩条件仍然成立，迭代也确实越来越接近；问题出在极限不属于所选的定义域。</span>

## A useful sufficient condition

A closed subset of a complete metric space is complete in the inherited metric. Indeed, a Cauchy sequence in the subset is Cauchy in the ambient space, hence has an ambient limit. Closedness places that limit back in the subset. Both hypotheses matter in this statement: closedness alone does not repair an incomplete ambient space.

For example, $\mathbb{R}$ is complete in its usual metric, and so is a closed interval $[a,b]$ with $a\leq b$. When applying a fixed-point theorem on such an interval, one must still check that the proposed map sends the entire interval into itself. Completeness does not establish that separate requirement.

Return to the [[index#a-strategy-for-the-theorem|fixed-point proof strategy]] to see precisely where completeness enters after the finite-tail estimate.
