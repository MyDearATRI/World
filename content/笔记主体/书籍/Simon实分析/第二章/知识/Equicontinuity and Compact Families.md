---
type: 知识
status: 已整理
layer: Working
aliases:
  - 等度连续族
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/实分析
  - 来源/Simon-Part1
  - domain/topology
  - method/compactness
  - method/approximation
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-knowledge
title: Equicontinuity and Compact Families
siteKind: body
---
#用途/正式 #类型/知识 #主题/实分析

> [!note] SOURCE — Barry Simon, *Real Analysis*, AMS, 2015
> §2.3, Theorem 2.3.14, pp.70–71; Problems 1–2, pp.75–76. PDF 91（来源 PDF，第 91 页；原文件未公开） · PDF 96（来源 PDF，第 96 页；原文件未公开）
> English mathematical text; Chinese reading remarks. This is maintained working material, not a record of personal mastery.

Pointwise compactness gives a convergent subsequence at one input. It does not by itself select the same subsequence for all inputs. Equicontinuity supplies a common control that spreads convergence from a countable dense set to the entire domain, and compactness of the domain turns that control into uniform convergence.

## DEF — One modulus for a family

A family $\mathcal F$ of maps between metric spaces is uniformly equicontinuous if for every $\varepsilon>0$ there is $\delta>0$ such that
$$
d_X(x,y)<\delta\ \Longrightarrow\ d_Y(f(x),f(y))<\varepsilon
\quad\text{for every }f\in\mathcal F.
$$
The order of quantifiers requires one $\delta$ for all functions and all points. Individual uniform continuity is weaker: $f_n(x)=x^n$ on $[0,1]$ are individually uniformly continuous but fail this shared control near $1$.

## THM — Arzelà–Ascoli in the form used here

Let $X$ be a separable metric space, $Y$ a complete metric space, and $C\subset Y$ compact. Suppose $\mathcal F$ is uniformly equicontinuous and $f[X]\subset C$ for every $f\in\mathcal F$. Every sequence in $\mathcal F$ has a subsequence converging at every point of $X$. If $X$ is compact, $\mathcal F$ has compact closure in the uniform metric.

### Proof — Diagonal selection followed by spatial control

This is a note supplementary proof of Theorem 2.3.14, whose proof Simon assigns to §2.3, Problem 1. Let $D=\{x_1,x_2,\ldots\}$ be dense. Compactness of $C$ gives a subsequence converging at $x_1$, a further subsequence converging at $x_2$, and so on. The diagonal subsequence $(g_n)$ converges at every $x_j$, by the [[笔记主体/书籍/Simon实分析/第一章/知识/可数性与两种对角线方法|nested subsequence mechanism]].

Fix $x\in X$ and $\varepsilon>0$. Choose the common equicontinuity radius for $\varepsilon/3$ and then $x_j$ within this radius of $x$. For sufficiently large $m,n$,
$$
d_Y(g_n(x),g_m(x))\le d_Y(g_n(x),g_n(x_j))
+d_Y(g_n(x_j),g_m(x_j))+d_Y(g_m(x_j),g_m(x))<\varepsilon.
$$
Completeness supplies the pointwise limit $g(x)$. Given $\varepsilon>0$, choose a common $\delta>0$ such that $d_X(x,y)<\delta$ implies $d_Y(g_n(x),g_n(y))<\varepsilon/2$ for every $n$. Passing to the pointwise limit gives $d_Y(g(x),g(y))\leq\varepsilon/2<\varepsilon$, so $g$ is uniformly continuous. The margin before taking limits preserves the strict inequality required in the definition.

If $X$ is compact, choose finitely many points of $D$ whose balls of the chosen radius cover $X$. Convergence at these finitely many points supplies a single index $N$. The same three-term estimate now holds simultaneously for every $x$, so $g_n\to g$ uniformly. To conclude compactness of the closure, a sequence $(h_n)$ in $\overline{\mathcal F}$ can be approximated by $f_n\in\mathcal F$ with $d_\infty(h_n,f_n)<1/n$. The just-proved subsequence result transfers to $(h_n)$; metric sequential compactness is compactness. No closedness assumption on the original family is needed for precompactness, while compactness of the family itself also requires it to be closed.

> [!insight] IDEA — Diagonal selection and uniformization perform different jobs
> A diagonal subsequence gives convergence on a countable dense set. Equicontinuity extends it to every point, and compactness of the domain reduces the remaining infinitely many point tests to finitely many. The proof above separates these three operations; diagonal selection alone proves no uniform convergence assertion.
>
> 中文：先选同一子列，再用空间控制传播收敛，最后用有限覆盖统一指标。身份：证明结构总结；本页补证已展开。

^insight-ch2-diagonal-uniformization

## Examples and boundary conditions

On a compact metric space, a family of real functions with $|f|\le M$ and a common Hölder bound $|f(x)-f(y)|\le Ld(x,y)^\alpha$, $\alpha>0$, satisfies the theorem. Bounds on derivatives give such a common modulus on an interval by the mean value theorem. Uniform bounds on derivatives without a common bound on function values do not prevent addition of arbitrary constants.

The noncompact-domain conclusion need not be uniform. On $\mathbb R$, translates $f_n(x)=\max(1-|x-n|,0)$ have values in $[0,1]$ and a common Lipschitz constant, and converge pointwise to $0$. But $\|f_n\|_\infty=1$ for all $n$. They do converge uniformly on each compact subset. This shows why domain compactness is a separate step, rather than a cosmetic hypothesis.

The proof combines [[笔记主体/书籍/Simon实分析/第二章/知识/Bases and Countability Conditions|separability]], [[笔记主体/书籍/Simon实分析/第二章/知识/Compactness and Total Boundedness|compactness of finite-radius tests]], and [[笔记主体/书籍/Simon实分析/第二章/知识/Open Sets, Closure, and Continuity|completeness of uniform function spaces]]. Later weak compactness in a separable Hilbert space uses a related diagonal selection, but its extension from a dense testing set relies on a norm bound rather than equicontinuity of functions on a compact domain.

## Source trail

§2.3, Theorem 2.3.14, pp.70–71; Problems 1–2, pp.75–76. PDF 91（来源 PDF，第 91 页；原文件未公开） · PDF 96（来源 PDF，第 96 页；原文件未公开）

Earlier planning references are retained below. References to later chapters identify future extensions, not content already covered here.

- [[笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents#2.3 Compact Spaces|2.3 Compact Spaces]] · p. 63 · PDF 84（来源 PDF，第 84 页；原文件未公开）
