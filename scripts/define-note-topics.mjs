// Website navigation only. Exact reviewed titles resolve to stable public note IDs once.
// This file is a reproducible editorial mapping, never a Vault rewriter or classifier.
import fs from "node:fs/promises"
const index = JSON.parse(await fs.readFile("knowledge/index.json", "utf8"))
const definitions = [
  [
    "foundations",
    "集合、序与实数",
    "#7b5c91",
    [
      "偏序、链与 Zorn 引理",
      "可数性与两种对角线方法",
      "实数构造与上确界性质",
      "等价关系与商构造",
      "1.1 记号与术语",
      "1.3 实数",
      "1.4 序",
      "1.5 选择公理与 Zorn 引理",
      "1.6 可数性",
      "从商构造到完备化与实数",
      "可数递进与极大性存在证明",
      "习题与原书核校",
    ],
  ],
  [
    "linear",
    "线性结构与谱",
    "#3d7592",
    [
      "内积、自伴算子与有限维谱定理",
      "投影、直和与不变子空间",
      "最小多项式与 Jordan 分解",
      "线性基、维数与代数补空间",
      "1.7 线性代数",
      "从代数投影到正交谱分解",
      "习题与原书核校",
      "Hilbert Sums and Tensor Products",
      "From Algebraic Projections to Hilbert Best Approximation",
    ],
  ],
  [
    "topology",
    "度量、拓扑与紧性",
    "#327b6d",
    [
      "Cauchy 序列与度量完备化",
      "度量拓扑与连续性的三种刻画",
      "1.2 度量空间",
      "从商构造到完备化与实数",
      "Bases and Countability Conditions",
      "Compactness and Total Boundedness",
      "Connectedness and Components",
      "Equicontinuity and Compact Families",
      "Local Compactness and Compactification",
      "Metrization and the Hilbert Cube",
      "Nets and General Convergence",
      "Open Sets, Closure, and Continuity",
      "Products and Compactness",
      "Quotient Topologies",
      "Semicontinuity, Extrema, and Continuous Partitions",
      "Separation and Continuous Extension",
      "2.1 Lots of Definitions",
      "2.2 Countability and Separation Properties",
      "2.3 Compact Spaces",
      "2.6 Nets",
      "2.7 Product Topologies and Tychonoff’s Theorem",
      "2.8 Quotient Topologies",
      "第二章 习题与原书核校",
      "From Compactness to Uniform Control",
      "From Metric Sequences to Topological Nets",
      "Weak Topologies and Dual Pairings",
      "From Coordinate Tests to Weak Compactness",
      "3.6 The Weak Topology",
    ],
  ],
  [
    "approximation",
    "微积分与逼近",
    "#a17436",
    [
      "Taylor 余项与误差估计",
      "光滑截断与有限单位分解",
      "1.8 微积分",
      "习题与原书核校",
      "Algebras, Lattices, and Uniform Approximation",
      "Positive Approximation and Bernstein Polynomials",
      "2.4 The Weierstrass Approximation Theorem and Bernstein Polynomials",
      "2.5 The Stone–Weierstrass Theorem",
      "Equicontinuity and Compact Families",
      "Semicontinuity, Extrema, and Continuous Partitions",
      "第二章 习题与原书核校",
      "From Compactness to Uniform Control",
      "From Uniform Approximation to Fourier Expansions",
    ],
  ],
  [
    "hilbert",
    "Hilbert 空间与算子",
    "#826452",
    [
      "Hilbert Completeness and Norm Identities",
      "Hilbert Sums and Tensor Products",
      "Linear Functionals as Vectors",
      "Nearest Points in Convex Sets",
      "Operators, Adjoints, and Operator Topologies",
      "Orthonormal Expansions",
      "Weak Topologies and Dual Pairings",
      "3.1 Basic Inequalities",
      "3.2 Convex Sets, Minima, and Orthogonal Complements",
      "3.3 Dual Spaces and the Riesz Representation Theorem",
      "3.4 Orthonormal Bases, Abstract Fourier Expansions, and Gram–Schmidt",
      "3.6 The Weak Topology",
      "3.7 A First Look at Operators",
      "3.8 Direct Sums and Tensor Products of Hilbert Spaces",
      "第三章 习题与原书核校",
      "From Algebraic Projections to Hilbert Best Approximation",
      "From Coordinate Tests to Weak Compactness",
      "Trigonometric Density and L2 Fourier Expansion",
    ],
  ],
  [
    "fourier",
    "Fourier 展开",
    "#a45f70",
    [
      "Dirichlet Kernels and Dini Convergence",
      "Fourier Series and Summation Kernels",
      "Lacunary Fourier Series and Roughness",
      "Orthonormal Expansions",
      "Pointwise Fourier Convergence and Jumps",
      "Trigonometric Density and L2 Fourier Expansion",
      "3.4 Orthonormal Bases, Abstract Fourier Expansions, and Gram–Schmidt",
      "3.5 Classical Fourier Series",
      "第三章 习题与原书核校",
      "From Uniform Approximation to Fourier Expansions",
    ],
  ],
]
const notes = index.objects.filter((n) => n.kind === "note")
const memberships = {}
for (const [id, , , titles] of definitions)
  for (const title of titles) {
    const matches = notes.filter((n) => n.title === title)
    if (matches.length !== 1) throw new Error(`Ambiguous/missing public note: ${title}`)
    ;(memberships[matches[0].id] ??= []).push(id)
  }
const unmatched = notes.filter((n) => !memberships[n.id])
if (unmatched.length)
  throw new Error(`Review unclassified notes: ${unmatched.map((n) => n.title).join(", ")}`)
const result = {
  version: 1,
  snapshotHash: index.snapshotHash,
  policy:
    "Website editorial navigation based on explicit public titles. Membership is not a prerequisite or mathematical dependency. Atom membership inherits every original occurrence. New unmapped notes remain visible in Other.",
  topics: definitions.map(([id, title, color]) => ({
    id,
    title,
    color,
    description: "已有正文；主题归类只用于导航",
  })),
  memberships,
}
await fs.writeFile("knowledge/topos/note-topics.json", JSON.stringify(result, null, 2) + "\n")
console.log(`${notes.length} complete notes classified by explicit title; no source note changed.`)
