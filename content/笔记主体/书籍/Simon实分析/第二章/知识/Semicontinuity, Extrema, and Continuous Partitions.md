---
type: 知识
status: 已整理
layer: Working
aliases:
  - 半连续、极值与连续单位分解
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: 'Semicontinuity, Extrema, and Continuous Partitions'
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.1, pp.41–43; §2.3, Theorems 2.3.12–13, 2.3.15–16, pp.70–72. PDF 63（来源 PDF，第 63 页；原文件未公开） · PDF 91（来源 PDF，第 91 页；原文件未公开） · PDF 93（来源 PDF，第 93 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

Many variational arguments need only a lower bound that survives passage to a limit, rather than full continuity. Many approximation arguments need only finitely many local estimates patched by continuous weights, rather than a formula valid everywhere at once. Semicontinuity and partitions of unity provide these two mechanisms.

## DEF — One-sided continuity

A function $f:X\to\mathbb R\cup\{+\infty\}$ is lower semicontinuous (lsc) if $\{x:f(x)>a\}$ is open for every real $a$, equivalently if every sublevel set $\{f\le a\}$ is closed. Upper semicontinuity reverses the inequality and permits $-\infty$. An arbitrary supremum of continuous real functions is lsc, because $\{\sup_i f_i>a\}=\bigcup_i\{f_i>a\}$. For an open set $U$, $\mathbf1_U$ is lsc; for a closed set $F$, $\mathbf1_F$ is usc. Neither need be continuous at the boundary.

If $x_n\to x$, lower semicontinuity implies $f(x)\le\liminf_n f(x_n)$: any $a<f(x)$ defines a neighborhood eventually containing the sequence. In first countable spaces the converse follows by constructing a sequence violating openness of $\{f>a\}$. In arbitrary spaces the equivalence uses nets instead of sequences.

## THM — A lower semicontinuous function attains its minimum

Let $X$ be a nonempty compact space and $f:X\to\mathbb R\cup\{+\infty\}$ lsc. Then $f$ is bounded below and attains its infimum. Simon states the theorem for compact Hausdorff $X$; the following proof shows that this particular conclusion does not use Hausdorffness.

The open sets $\{f>-n\}$ cover $X$ because $f$ never equals $-\infty$. A finite subcover gives a lower bound. If $f\equiv+\infty$, every point is a minimizer. Otherwise $a=\inf_Xf$ is finite. The nonempty closed sets $F_n=\{f\le a+1/n\}$ are nested. Their total intersection is nonempty by compactness, and any point in it has value $a$. For continuous real functions, apply the result to both $f$ and $-f$ to get maxima and minima.

## THM — Continuous finite partitions on a compact target

Let $K$ be a compact subset of a normal space $Y$, and let open sets $(U_\alpha)$ cover $K$. There are finitely many indices $\alpha_1,\ldots,\alpha_m$ and continuous functions $j_i:Y\to[0,\infty)$ such that $\sum_i j_i=1$ on $K$ and $\{j_i>0\}\subset U_{\alpha_i}$. This is Theorem 2.3.16; the proof below is a note supplementary normalization of its Urysohn construction.

For every $x\in K$, choose an open $V_x$ with $x\in V_x\subset\overline V_x\subset U_{\alpha(x)}$. Urysohn's lemma gives $f_x:Y\to[0,1]$ equal to $1$ at $x$ and $0$ outside $V_x$. Thus $\operatorname{supp}f_x\subset\overline V_x\subset U_{\alpha(x)}$. The sets $\{f_x>1/2\}$ cover $K$. Choose finitely many, with functions $f_1,\ldots,f_m$, and put $q=\sum_i f_i$. Then $q>1/2$ on $K$. Define globally
$$
j_i(y)=\frac{f_i(y)}{\max\{q(y),1/2\}}.
$$
The denominator is continuous and never zero. On $K$ it equals $q$, so the weights sum to $1$ there; each weight retains the support restriction. No claim that $q$ is positive on all of $Y$ is needed. If $K=\varnothing$, the empty family suffices.

> [!remark] RMK — 中文条件
> 只要求权重在目标紧集上和为一。目标之外分母可能原本为零，因此用统一正下界延拓归一化。连续版本与第一章的光滑版本有不同的正则性假设。

The [[笔记主体/书籍/Simon实分析/第一章/知识/光滑截断与有限单位分解|smooth partition construction]] requires a smooth ambient setting and smooth cutoff functions. Here normality and compactness suffice for continuous weights. The common mechanism is local separation followed by a finite cover and a safe normalization; the regularity cannot be transferred without checking its source.

## THM — Continuous approximation from below

On a compact metric space, every lsc $f:X\to\mathbb R\cup\{+\infty\}$ is the increasing pointwise limit of continuous real functions. Simon proves this by local infima and partitions on pp.71–72. The following alternative is a note supplementary proof that explicitly handles the value $+\infty$.

Choose a finite lower bound $m$ and set $g=f-m\ge0$. If $g\equiv+\infty$, use $f_n=m+n$. Otherwise choose $y_0$ with $g(y_0)<\infty$ and define
$$
h_n(x)=\inf_{y\in X}\bigl(g(y)+n\,d(x,y)\bigr),\qquad f_n=m+h_n.
$$
Each $h_n$ is finite, nonnegative and $n$-Lipschitz: the triangle inequality gives $h_n(x)\le h_n(z)+n d(x,z)$, and the reverse follows by interchanging $x,z$. Also $h_n\le h_{n+1}\le g$. If $h_n(x)$ had a finite limit $L<g(x)$, choose $y_n$ with $g(y_n)+n d(x,y_n)\le h_n(x)+1/n$. Then $d(x,y_n)\to0$ and $g(y_n)\le L+1/n$, contradicting lower semicontinuity at $x$. This includes $g(x)=+\infty$. Therefore $h_n(x)\uparrow g(x)$ at every point.

> [!insight] IDEA — A one-sided limit inequality is enough for minimization
> To pass an infimum through a compactness argument, the required inequality is $f(x)\le\liminf f(x_n)$, not equality. Lower semicontinuity is therefore tailored to minimizing problems. The closed-sublevel proof above works in any nonempty compact space and also accommodates $+\infty$, with the identically infinite case separated explicitly.
>
> 中文：极小化只需要极限点的函数值不向上跳。身份：条件分析与补证；更弱假设的结论已在本页证明。

^insight-ch2-one-sided-minima

## Source trail

§2.1, pp.41–43; §2.3, Theorems 2.3.12–13, 2.3.15–16, pp.70–72. PDF 63（来源 PDF，第 63 页；原文件未公开） · PDF 91（来源 PDF，第 91 页；原文件未公开） · PDF 93（来源 PDF，第 93 页；原文件未公开）
