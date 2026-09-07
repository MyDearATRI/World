import type { ReaderConfig } from "./quartz/util/readerCatalog"

const simon = "笔记主体/书籍/Simon实分析"

// Reading structure belongs to the website; exported source notes remain unchanged.
const readerConfig: ReaderConfig = {
  books: [
    {
      id: "simon-analysis",
      title: "Simon · Real Analysis",
      subtitle: "实分析研读 · 连续正文与可复用知识",
      source: "Barry Simon · A Comprehensive Course in Analysis, Part 1 · AMS, 2015",
      root: simon,
      slug: `${simon}/Simon - Real Analysis`,
      contentsSlug: `${simon}/Simon - Real Analysis - Contents`,
      chapters: [
        { id: "simon-1", root: `${simon}/第一章`, slug: `${simon}/第一章/第一章 预备知识` },
        {
          id: "simon-2",
          root: `${simon}/第二章`,
          slug: `${simon}/第二章/第二章 Topological Spaces`,
        },
        {
          id: "simon-3",
          root: `${simon}/第三章`,
          slug: `${simon}/第三章/第三章 Hilbert Spaces and Fourier Series`,
        },
      ],
      // These five mappings supplement the source contents, which omits these existing pages.
      sectionKnowledge: [
        { slug: `${simon}/第二章/知识/Metrization and the Hilbert Cube`, sections: ["2.2", "2.3"] },
        {
          slug: `${simon}/第二章/知识/Semicontinuity, Extrema, and Continuous Partitions`,
          sections: ["2.1", "2.3"],
        },
        { slug: `${simon}/第三章/知识/Dirichlet Kernels and Dini Convergence`, sections: ["3.5"] },
        { slug: `${simon}/第三章/知识/Lacunary Fourier Series and Roughness`, sections: ["3.5"] },
        {
          slug: `${simon}/第三章/知识/Trigonometric Density and L2 Fourier Expansion`,
          sections: ["3.5"],
        },
      ],
    },
  ],
  auxiliaryPaths: [
    "模板示范站",
    "Haru_Math_Physics_Obsidian/Haru_Math_Physics_Obsidian/Examples",
    "Haru_Math_Physics_Obsidian/Haru_Math_Physics_Obsidian/开始阅读",
  ],
  // Exact pages only: future exposition below these similarly named directories
  // must not inherit the navigation page's auxiliary classification.
  auxiliaryFiles: [
    "index",
    "笔记科学与逻辑",
    "笔记主体/笔记主体",
    "知识主干",
    `${simon}/Simon - Real Analysis - Contents`,
  ],
}

export default readerConfig
