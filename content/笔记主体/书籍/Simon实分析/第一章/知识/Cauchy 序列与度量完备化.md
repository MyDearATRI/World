---
type: 知识
status: 已整理
aliases: []
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/度量与实数
  - 内容/发现
cssclasses:
  - haru-note
  - haru-type-knowledge
title: Cauchy 序列与度量完备化
siteKind: body
---
#用途/正式 #类型/知识 #主题/度量与实数 #内容/发现

来源：Barry Simon，*A Comprehensive Course in Analysis, Part 1: Real Analysis*（2015），§1.2，纸页 5–6，定理 1.2.3。见 原书·纸页5（来源 PDF，第 26 页；原文件未公开）。本页属于 [[笔记主体/书籍/Simon实分析/第一章/第一章 预备知识|第一章 预备知识]]。商空间构造沿用原书；稠密性论证在此展开，原书略去的完备性与唯一性证明由笔记补足。

收敛的定义需要先有一个候选极限，Cauchy 条件只检查数列自身。两者的差别使我们能够区分数列没有接近任何位置，与空间没有收进它本应接近的位置。完备化给出一个精确的补充方法：把原空间中的 Cauchy 序列作为候选点，再把距离趋于零的两列认作同一个新点。

> [!definition] Cauchy 与完备
> $(X,d)$ 中的数列 $(x_n)$ 为 Cauchy 数列，是指
> $$
> \forall\varepsilon>0\ \exists N\ \forall n,m>N,\quad d(x_n,x_m)<\varepsilon.
> $$
> 若每个 Cauchy 数列都收敛到 $X$ 中的点，就称 $X$ 完备。

若 $x_n\to x$，选择 $N$ 使尾项都在 $B_{\varepsilon/2}(x)$ 中，三角不等式便给出 Cauchy 条件。逆命题不总成立：在 $X=(0,1)$ 中，$x_n=1/(n+1)$ 是 Cauchy 数列，其实数极限为 $0$，但 $0\notin X$。

下文一般度量空间的构造使用实数的完备性。[[笔记主体/书籍/Simon实分析/第一章/知识/实数构造与上确界性质|实数构造与上确界性质]] 另从有理数列直接构造实数，因而不反过来调用本页定理来证明它依赖的实数完备性。

## 候选点之间的距离

设 $X^\sharp$ 是 $X$ 中所有 Cauchy 数列组成的集合。对 $(x_n),(y_n)\in X^\sharp$，两次应用三角不等式得

$$
|d(x_n,y_n)-d(x_m,y_m)|\le d(x_n,x_m)+d(y_n,y_m).
$$

右侧在 $n,m\to\infty$ 时趋于零，所以实数数列 $d(x_n,y_n)$ 是 Cauchy 数列，具有有限极限。定义

$$
d^\sharp((x_n),(y_n))=\lim_{n\to\infty}d(x_n,y_n).
$$

非负性与对称性继承自 $d$，逐项三角不等式取极限给出 $d^\sharp$ 的三角不等式。两列不同也可能有零距离，例如实数中的常值零列与 $1/n$，故这里只得到半度量。令 $(x_n)\sim(y_n)$ 当且仅当 $d^\sharp((x_n),(y_n))=0$，用 [[笔记主体/书籍/Simon实分析/第一章/知识/等价关系与商构造|等价关系与商构造]] 的结果得到度量空间

$$
\widetilde X=X^\sharp/{\sim},\qquad
\widetilde d([(x_n)],[(y_n)])=\lim_n d(x_n,y_n).
$$

原空间的点 $x$ 对应常值序列，定义 $i(x)=[(x,x,\ldots)]$。立即有 $\widetilde d(i(x),i(y))=d(x,y)$，所以 $i$ 是等距嵌入，尤其是单射。

## 原空间在新空间中稠密

设 $\xi=[(x_n)]\in\widetilde X$。对任意 $\varepsilon>0$，取 $N$ 使 $n,m>N$ 时 $d(x_n,x_m)<\varepsilon/2$。固定 $n>N$ 再令 $m\to\infty$，便得

$$
\widetilde d(i(x_n),\xi)=\lim_{m\to\infty}d(x_n,x_m)\le\varepsilon/2<\varepsilon.
$$

于是 $i(x_n)\to\xi$。每个新点都是原空间中点的极限，故 $i[X]$ 稠密。这也说明同一个等价类中的两列为什么应当代表同一点：它们经嵌入后的距离趋零，不能产生两个不同极限。

## 新空间确实完备

这一部分补足原书的简略说明。设 $(\xi_k)$ 是 $\widetilde X$ 中的 Cauchy 数列。利用刚证明的稠密性，对每个 $k$ 选 $a_k\in X$ 使

$$
\widetilde d(i(a_k),\xi_k)<2^{-k}.
$$

则

$$
d(a_k,a_\ell)\le2^{-k}+\widetilde d(\xi_k,\xi_\ell)+2^{-\ell},
$$

所以 $(a_k)$ 是 $X$ 中的 Cauchy 数列，能定义新点 $\eta=[(a_k)]$。上一节已经证明 $i(a_k)\to\eta$，再用

$$
\widetilde d(\xi_k,\eta)\le\widetilde d(\xi_k,i(a_k))+\widetilde d(i(a_k),\eta)
$$

得到 $\xi_k\to\eta$。因此 $\widetilde X$ 完备。这个证明只从稠密性中选择逐次足够好的近似点，不需要把“数列的数列”逐项同时配对；选择完近似点后，三角不等式承担了全部收敛控制。

> [!theorem] 完备化存在且相容地唯一
> 每个度量空间 $(X,d)$ 都有一个完备度量空间 $(\widetilde X,\widetilde d)$ 及等距嵌入 $i:X\to\widetilde X$，使 $i[X]$ 稠密。若 $(Y,\rho)$ 也完备，$j:X\to Y$ 也是像稠密的等距嵌入，则存在唯一满射等距映射 $g:\widetilde X\to Y$ 满足 $g\circ i=j$。

## 唯一性为何必须保留嵌入

给定第二个完备空间 $(Y,\rho)$，对 $\xi=[(x_n)]$ 定义

$$
g(\xi)=\lim_{n\to\infty}j(x_n).
$$

等距性使 $(j(x_n))$ 为 Cauchy 数列，$Y$ 完备保证极限存在。若 $(x_n)\sim(y_n)$，则 $\rho(j(x_n),j(y_n))=d(x_n,y_n)\to0$，所以两列极限相同，$g$ 良定义。距离函数对两端点连续，具体估计为

$$
|\rho(u_n,v_n)-\rho(u,v)|\le\rho(u_n,u)+\rho(v_n,v),
$$

由此得到 $\rho(g(\xi),g(\eta))=\widetilde d(\xi,\eta)$。因而 $g$ 等距且单射，并从常值列看出 $g\circ i=j$。若 $y\in Y$，由 $j[X]$ 稠密选取 $x_n\in X$ 使 $\rho(j(x_n),y)<1/n$；该数列在 $X$ 中为 Cauchy，且 $g([(x_n)])=y$，所以 $g$ 满射。

最后，若 $h$ 也是满足相容条件的等距映射，则 $i(x_n)\to[(x_n)]$ 蕴含

$$
h([(x_n)])=\lim_n h(i(x_n))=\lim_n j(x_n)=g([(x_n)]).
$$

故 $h=g$。唯一性说的是保持原空间嵌入的那个等距映射唯一；如果省略 $g\circ i=j$，空间自身可能有许多等距自同构，并不能说两空间之间只有一个等距映射。

> [!insight] IDEA — Uniqueness belongs to the completion together with its embedding
> Let $i:X\to\widetilde X$ and $j:X\to Y$ be isometric embeddings with dense images into complete metric spaces. There is a unique surjective isometry $g:\widetilde X\to Y$ satisfying $g\circ i=j$: its values are forced by $g(\lim i(x_n))=\lim j(x_n)$. The compatibility condition is essential; without it, isometries between the completed spaces need not be unique.
>
> 中文备注：唯一的是保持原空间位置的映射，不能把相容条件从唯一性中删掉。
>
> Source clarification with supplementary proof. Simon already states the compatibility condition in Theorem 1.2.3, p. 6, but leaves uniqueness to the reader; this note supplies the argument. Source page（来源 PDF，第 27 页；原文件未公开）.
> [[笔记主体/书籍/Simon实分析/第一章/知识/Cauchy 序列与度量完备化#唯一性为何必须保留嵌入|Argument and context in this note]].

^insight-ch1-compatible-uniqueness

若 $X$ 本身已经完备，每个类 $[(x_n)]$ 都对应其原空间极限 $x$，所以 $i$ 也是满射。一般情况下，抽象完备化的等价类可以很复杂，但实际应用通常会寻找更透明的表示，例如有理数的完备化由实数表示。此时应验证新表示保持距离且原空间稠密，再用上述唯一性识别两个构造。
