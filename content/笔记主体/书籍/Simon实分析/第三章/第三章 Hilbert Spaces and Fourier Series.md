---
type: 路线
status: 已整理
layer: Working
aliases:
  - Chapter 3 · Hilbert Spaces and Fourier Series
created: '2026-09-07'
tags:
  - 用途/正式
  - 类型/路线
  - 主题/实分析
  - 来源/Simon-Part1
cssclasses:
  - haru-note
  - haru-outline
  - haru-type-route
title: 第三章 Hilbert Spaces and Fourier Series
siteKind: navigation
---
#用途/正式 #类型/路线 #主题/实分析

[[笔记主体/发现归档|Insights and additions · 发现归档]] · [[maps/前三章关系图-6db33b5d|Chapters 1–3 map]]

Barry Simon, *Real Analysis*, AMS, 2015 · §3 · pp. 107–183 · PDF 128（来源 PDF，第 128 页；原文件未公开）–204（来源 PDF，第 204 页；原文件未公开）.

This chapter studies how completeness turns inner-product geometry into a theory of approximation, representation, and convergence. Its principal objects are Hilbert vectors and periodic functions; its proofs repeatedly turn finite information into an infinite limit while keeping the norm or topology explicit. The prose and proofs below form a working chapter of a personal analysis text. Their organized status records the state of the documents, not a claim of personal mastery.

## The chapter architecture

The first route is geometric. Exact norm identities control minimizing sequences, the nearest-point theorem constructs orthogonal complements, and those complements represent continuous linear functionals. Orthonormal bases then reconstruct every vector by its coefficients. These steps require completeness at different points; separability supplies a countable basis but is unnecessary for the projection and Riesz theorems themselves.

The second route is Fourier analysis. Trigonometric density, proved using Chapter 2, supplies a concrete orthonormal basis. Its norm expansion leads to separate questions about pointwise convergence, uniform approximation, rough functions and jump behavior. The third route returns to topology: countable coordinate extraction and boundedness give weak compactness, while the global weak topology remains nonmetrizable in infinite dimensions. Operator and tensor constructions show which additional structures survive beyond abstract Hilbert-space classification.

Open [[maps/第三章关系图-c6306643|the chapter map]] for the spatial dependencies. The prose below and on the linked pages supplies the actual statements behind the arrows.

## Read in source order

| Section | What the section establishes | Main proof destination |
|---|---|---|
| [[笔记主体/书籍/Simon实分析/第三章/研读/3.1 Basic Inequalities|3.1 Basic Inequalities]] | Inner-product geometry, completeness, the chapter's L² model | [[笔记主体/书籍/Simon实分析/第三章/知识/Hilbert Completeness and Norm Identities|Hilbert Completeness and Norm Identities]] |
| [[笔记主体/书籍/Simon实分析/第三章/研读/3.2 Convex Sets, Minima, and Orthogonal Complements|3.2 Convex Sets, Minima, and Orthogonal Complements]] | Closest points and orthogonal decomposition | [[笔记主体/书籍/Simon实分析/第三章/知识/Nearest Points in Convex Sets|Nearest Points in Convex Sets]] |
| [[笔记主体/书籍/Simon实分析/第三章/研读/3.3 Dual Spaces and the Riesz Representation Theorem|3.3 Dual Spaces and the Riesz Representation Theorem]] | Bounded maps and representation of scalar functionals | [[笔记主体/书籍/Simon实分析/第三章/知识/Linear Functionals as Vectors|Linear Functionals as Vectors]] |
| [[笔记主体/书籍/Simon实分析/第三章/研读/3.4 Orthonormal Bases, Abstract Fourier Expansions, and Gram–Schmidt|3.4 Orthonormal Bases, Abstract Fourier Expansions, and Gram–Schmidt]] | Basis construction, expansion and Parseval | [[笔记主体/书籍/Simon实分析/第三章/知识/Orthonormal Expansions|Orthonormal Expansions]] |
| [[笔记主体/书籍/Simon实分析/第三章/研读/3.5 Classical Fourier Series|3.5 Classical Fourier Series]] | Density, convergence, roughness and jumps | The five Fourier pages below |
| [[笔记主体/书籍/Simon实分析/第三章/研读/3.6 The Weak Topology|3.6 The Weak Topology]] | Weak convergence, bounded-ball metrizability and compactness | [[笔记主体/书籍/Simon实分析/第三章/知识/Weak Topologies and Dual Pairings|Weak Topologies and Dual Pairings]] |
| [[笔记主体/书籍/Simon实分析/第三章/研读/3.7 A First Look at Operators|3.7 A First Look at Operators]] | Adjoints and operator classes | [[笔记主体/书籍/Simon实分析/第三章/知识/Operators, Adjoints, and Operator Topologies|Operators, Adjoints, and Operator Topologies]] |
| [[笔记主体/书籍/Simon实分析/第三章/研读/3.8 Direct Sums and Tensor Products of Hilbert Spaces|3.8 Direct Sums and Tensor Products of Hilbert Spaces]] | Tensor inner product, completion, permutations and wedges | [[笔记主体/书籍/Simon实分析/第三章/知识/Hilbert Sums and Tensor Products|Hilbert Sums and Tensor Products]] |

## Read by mathematical question

For “how can an infinite-dimensional minimization problem have a solution?”, begin with [[笔记主体/书籍/Simon实分析/第三章/知识/Nearest Points in Convex Sets#Proof — Near minimizers must approach one another|the Cauchy estimate]], then read [[笔记主体/书籍/Simon实分析/第三章/知识/Linear Functionals as Vectors#Riesz representation|the kernel proof of Riesz]] and [[笔记主体/书籍/Simon实分析/第三章/知识/Orthonormal Expansions#Expansion and Parseval|the residual argument for Parseval]]. This is a continuous path from geometric identity to representation.

For “what does a Fourier series actually reconstruct?”, read [[笔记主体/书籍/Simon实分析/第三章/知识/Trigonometric Density and L2 Fourier Expansion|Trigonometric Density and L2 Fourier Expansion]], then [[笔记主体/书籍/Simon实分析/第三章/知识/Dirichlet Kernels and Dini Convergence|Dirichlet Kernels and Dini Convergence]] and [[笔记主体/书籍/Simon实分析/第三章/知识/Fourier Series and Summation Kernels|Fourier Series and Summation Kernels]]. Continue with [[笔记主体/书籍/Simon实分析/第三章/知识/Lacunary Fourier Series and Roughness|Lacunary Fourier Series and Roughness]] to see what coefficient gaps prohibit, and [[笔记主体/书籍/Simon实分析/第三章/知识/Pointwise Fourier Convergence and Jumps|Pointwise Fourier Convergence and Jumps]] to distinguish fixed-point convergence from a shrinking transition region. The five pages share coefficients and kernel notation while maintaining their long proofs once each.

For “which topology makes bounded families manageable?”, read [[笔记主体/书籍/Simon实分析/第三章/知识/Weak Topologies and Dual Pairings#Coordinate convergence on a bounded ball|bounded coordinate testing]], then its weak compactness proof and the operator-topology examples. This route uses [[笔记主体/书籍/Simon实分析/第一章/知识/可数性与两种对角线方法#对角线抽取：保持每个固定坐标的收敛|Chapter 1's diagonal extraction]] and [[笔记主体/书籍/Simon实分析/第二章/知识/Compactness and Total Boundedness|Chapter 2's metric compactness equivalences]] without repeating either proof.

## Conventions and proof status

The inner product is antilinear in the first variable and linear in the second. Simon's default Hilbert spaces are separable; the notes identify statements that need only completeness and statements where infinite-dimensionality is necessary. The notation L² initially denotes the completion of continuous functions in the integral square norm. Measurable-function representatives and almost-everywhere equivalence enter Chapter 4, so they are not assumed silently here.

Core proofs are expanded on the knowledge pages; supplementary examples and source-exercise expansions are labeled locally. Later operator spectral theory, polar decomposition and the BV proof of Jordan's theorem are precise cited dependencies. [[笔记主体/书籍/Simon实分析/第三章/第三章 习题与原书核校|The 70-exercise entrance]] gives actual locations and confirmed source corrections. [[笔记主体/发现归档|Insights and Additions]] gathers the chapter's reusable observations by embedding their original paragraphs.

> [!remark] RMK — How this chapter connects across chapters
> 中文备注：第一章的完备化、代数投影和对角线抽取在这里获得新的条件；第二章的紧性与一致逼近进入真实证明。先沿主体把论证读完整，发现归档再集中展示可复用的观察。

[[笔记主体/书籍/Simon实分析/第三章/联系/From Algebraic Projections to Hilbert Best Approximation|From Algebraic Projections to Hilbert Best Approximation]]

[[笔记主体/书籍/Simon实分析/第三章/联系/From Uniform Approximation to Fourier Expansions|From Uniform Approximation to Fourier Expansions]]

[[笔记主体/书籍/Simon实分析/第三章/联系/From Coordinate Tests to Weak Compactness|From Coordinate Tests to Weak Compactness]]
