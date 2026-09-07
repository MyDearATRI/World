---
type: 知识
status: 已整理
aliases: []
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/知识
  - 主题/微积分
  - 内容/发现
cssclasses:
  - haru-note
  - haru-type-knowledge
title: Taylor 余项与误差估计
siteKind: body
---
#用途/正式 #类型/知识 #主题/微积分 #内容/发现

来源：Barry Simon，*Real Analysis: A Comprehensive Course in Analysis, Part 1*（2015），§1.8，纸页30–31，定理1.8.1、1.8.2及例1.8.3；习题1–2在纸页33。原书·纸页30（来源 PDF，第 51 页；原文件未公开） · [[笔记主体/书籍/Simon实分析/第一章/研读/1.8 微积分|本节研读]] · [[笔记主体/书籍/Simon实分析/第一章/第一章 预备知识|章节入口]]。

Taylor 公式首先是一条有限阶的精确恒等式：在展开点记录有限多个导数，再用余项表达尚未被这些数据确定的部分。只有进一步控制余项，并证明它随阶数趋向零，才能把这条有限公式变成等于原函数的无穷级数。

## 积分余项保留误差的来源

> [!theorem] 原书定理1.8.1，按展开基点校正
> 设整数 $n\ge1$，$a>0$，$f\in C^n((-a,a))$。对每个 $x\in(-a,a)$，
> $$
> f(x)=\sum_{j=0}^{n-1}\frac{f^{(j)}(0)}{j!}x^j+R_n(x),
> $$
> $$
> R_n(x)=\int_0^x\frac{(x-t)^{n-1}}{(n-1)!}f^{(n)}(t)\,dt.
> $$
> $x<0$ 时积分按通常的有向积分解释。这条积分公式对实值或复值 $f$ 都成立。

> [!warning] 原书核校：系数取值点
> 已核对本地 PDF 的纸页30式(1.8.2)及纸页31式(1.8.6)：有限和内印成 $f^{(j)}(x)$，应为 $f^{(j)}(0)$。原证明在零点匹配导数，且展开使用 $x^j$，都要求系数取在零点。以 $n=1,f(x)=x$ 代入原印式，也会得到错误的 $x=x+x$。本页统一采用校正后的公式。

原书论证展开如下。记上式积分为 $g(x)$。当 $n\ge2$ 时，第一次对积分求导，上限变化产生的边界项为零，因为 $t=x$ 处 $(x-t)^{n-1}=0$。反复求导可得，对 $0\le j\le n-1$，

$$
g^{(j)}(x)=\int_0^x
\frac{(x-t)^{n-1-j}}{(n-1-j)!}f^{(n)}(t)\,dt.
$$

最后一次由微积分基本定理得到 $g^{(n)}(x)=f^{(n)}(x)$。$n=1$ 时直接从基本定理开始，也有同样结论。因此 $h=f-g$ 满足 $h^{(n)}=0$。反复使用“导数恒零的函数是常数”，得到 $h$ 是次数至多 $n-1$ 的多项式。

所有上述积分在 $x=0$ 时均为零，所以 $g^{(j)}(0)=0$（$0\le j<n$），从而 $h^{(j)}(0)=f^{(j)}(0)$。这些初值唯一确定这个多项式，得到 $h(x)=\sum_{j=0}^{n-1}f^{(j)}(0)x^j/j!$，证明完成。这里需要 $f^{(n)}$ 连续，以便反复使用带参数积分的求导和微积分基本定理。

原书习题1提供另一条路线：迭代微积分基本定理得到多重积分，再把有序单纯形上的积分化成上述单积分。两条证明保留同一件事，即最高阶导数经过反复积分后成为误差。习题的独立入口保留在 [[笔记主体/书籍/Simon实分析/第一章/习题与原书核校|习题与原书核校]]。

## Lagrange 余项把加权平均写成一点的取值

> [!theorem] 原书定理1.8.2，明确实值条件
> 在上面的条件下，若 $f$ 为实值函数，则对 $0<x<a$，存在 $\xi\in(0,x)$ 使
> $$
> R_n(x)=\frac{x^n}{n!}f^{(n)}(\xi).
> $$
> 因而 $f(x)=\sum_{j=0}^{n-1}f^{(j)}(0)x^j/j!+f^{(n)}(\xi)x^n/n!$。

令 $w(t)=(x-t)^{n-1}/(n-1)!$。在 $0<t<x$ 上，$w(t)>0$，且 $\int_0^xw(t)\,dt=x^n/n!$。因此 $R_n(x)$ 除以 $x^n/n!$，就是连续实函数 $f^{(n)}$ 的一个带正权平均。这个平均介于其最小值与最大值之间，由介值定理必等于某一点的函数值。

还要解释为什么能把点选在开区间。若 $f^{(n)}$ 恒定，任意内部点都可选。若不恒定，连续性和内部权重严格为正，使平均严格介于闭区间上的最小值与最大值之间；介值定理于是给出一个内部取值点。这是对原书一句“积分的介值定理”的展开，并使用了本题中比一般非负权重更强的内部正性。

实值条件在这里承担实际作用。复数没有可用于这一步的最小值、最大值次序，因此不能把复值函数的积分余项普遍压成同一个中间点上的 $f^{(n)}(\xi)$。复值情形仍可直接使用积分公式及绝对值估计。对 $x<0$ 的实值情形，可将函数替换为 $u\mapsto f(-u)$，得到 $\xi\in(x,0)$ 的对应公式；这是笔记补充，原定理1.8.2只陈述 $x>0$。

## 误差估计与展开点平移

若 $|f^{(n)}(t)|\le M$ 对零点与 $x$ 之间的所有 $t$ 成立，则积分余项给出

$$
|R_n(x)|\le\frac{M|x|^n}{n!}.
$$

这条估计不需要知道中间点在哪里，而且对复值函数同样有效。若改在 $b$ 展开，只须对 $u\mapsto f(b+u)$ 应用公式，得到系数 $f^{(j)}(b)$、幂 $(x-b)^j$、积分下限 $b$；所有量必须围绕同一个展开点。

例如在 $|x|\le r$ 上近似 $e^x$，因为所有阶导数仍为 $e^x$，有

$$
\left|e^x-\sum_{j=0}^{n-1}\frac{x^j}{j!}\right|
\le e^r\frac{r^n}{n!}\longrightarrow0.
$$

这不仅写出了形式上的系数，还证明 Taylor 多项式在这个固定区间上一致逼近 $e^x$。一般 $C^\infty$ 函数没有自动共享这个余项界，不能仅凭“所有阶导数都存在”就作出同样结论。

## 二项式展开与光滑函数的边界

原书例1.8.3讨论 $(1+x)^\alpha$。在 $x>-1$ 上直接求导给出

$$
\binom\alpha0=1,\qquad
\binom\alpha n=\frac{\alpha(\alpha-1)\cdots(\alpha-n+1)}{n!},
\qquad
(1+x)^\alpha=\sum_{n=0}^{\infty}\binom\alpha n x^n\quad(|x|<1).
$$

原书以复分析理论保证最后这个级数在 $|x|<1$ 收敛到原函数；本页记录该结论，不把它伪装成仅靠刚才的有限阶求导就已经证明。若 $\alpha=N$ 是非负整数，系数在 $n>N$ 时为零，得到有限二项式公式 $(x+y)^N=\sum_{j=0}^N\binom Njx^jy^{N-j}$。

> [!warning] 原书核校：二项式例的符号与整数范围
> 纸页31例1.8.3开头写 $f(x)=(1-x)^\alpha$，随后的式(1.8.7)却是 $(1+x)^\alpha$ 的展开。本文统一取加号；若取减号，每个 $x^n$ 项应多一个 $(-1)^n$。同页“整数时得到多项式”应限定为非负整数；负整数通常仍给出无穷级数。

[[笔记主体/书籍/Simon实分析/第一章/知识/光滑截断与有限单位分解|光滑截断与有限单位分解]] 将给出一个在零点所有导数都为零、在右侧却不恒为零的光滑函数。它的 Taylor 级数恒为零，说明有限阶 Taylor 恒等式与“函数等于自己的 Taylor 级数”之间确实需要额外论证。

> [!insight] IDEA — Taylor coefficients require a remainder argument to recover the function
> A $C^\infty$ function need not equal its Taylor series near the expansion point. The function $h(t)=e^{-1/t}$ for $t>0$ and $h(t)=0$ for $t\le0$ has $h^{(k)}(0)=0$ for every $k\ge0$, although $h(t)>0$ for $t>0$. To pass from finite Taylor identities to a series representing a function, one must establish that the corresponding remainders tend to zero.
>
> 中文备注：有全部系数还不够；余项趋零才把有限阶恒等式接到函数的级数表示。
>
> Source clarification with an expanded standard example. Simon explicitly mentions a smooth function with zero Taylor series in the historical remarks on p. 32; this note connects that observation to remainder control. Source page（来源 PDF，第 53 页；原文件未公开）.
> [[笔记主体/书籍/Simon实分析/第一章/知识/Taylor 余项与误差估计#二项式展开与光滑函数的边界|Argument and context in this note]]. [[笔记主体/书籍/Simon实分析/第一章/知识/光滑截断与有限单位分解#一个在接合点无限平坦的函数|Counterexample proof]].

^insight-ch1-smooth-not-analytic
