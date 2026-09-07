import assert from "node:assert/strict"
import matter from "gray-matter"
import sharp from "sharp"
import toml from "toml"

// Exercise the upstream APIs used by Quartz with synthetic, in-memory inputs only.
let checks = 0
async function check(name, run) {
  await run()
  checks += 1
  console.log(`PASS ${name}`)
}

await check("sharp converts an SVG buffer to WebP with Quartz's quality option", async () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" fill="#28588a"/></svg>',
  )
  const output = await sharp(svg).webp({ quality: 40 }).toBuffer()
  const metadata = await sharp(output).metadata()
  assert.equal(metadata.format, "webp")
  assert.equal(metadata.width, 96)
  assert.equal(metadata.height, 64)
  assert.ok(output.length > 0)
})

await check("sharp resizes a PNG buffer to a 48 by 48 PNG favicon", async () => {
  const input = await sharp({
    create: { width: 96, height: 96, channels: 4, background: "#28588a" },
  })
    .png()
    .toBuffer()
  const output = await sharp(input).resize(48, 48).toFormat("png").toBuffer()
  const metadata = await sharp(output).metadata()
  assert.equal(metadata.format, "png")
  assert.equal(metadata.width, 48)
  assert.equal(metadata.height, 48)
})

await check("TOML frontmatter parses through Quartz's gray-matter engine interface", () => {
  const source = Buffer.from(
    [
      "+++",
      'title = "Synthetic mathematics / 合成数学"',
      "publish = true",
      'tags = ["analysis", "synthetic"]',
      "order = 2",
      "+++",
      "Synthetic body only.",
      "",
    ].join("\n"),
  )
  const parsed = matter(source, {
    delimiters: "+++",
    language: "toml",
    engines: { toml: (input) => toml.parse(input) },
  })
  assert.equal(parsed.data.title, "Synthetic mathematics / 合成数学")
  assert.equal(parsed.data.publish, true)
  assert.deepEqual(parsed.data.tags, ["analysis", "synthetic"])
  assert.equal(parsed.data.order, 2)
  assert.equal(parsed.content.trim(), "Synthetic body only.")
})

await check("TOML rejects short input beyond an explicit nesting limit with a parse error", () => {
  const source = `value = ${"[".repeat(12)}1${"]".repeat(12)}`
  assert.throws(
    () => toml.parse(source, { maxDepth: 8 }),
    (error) => {
      assert.ok(error instanceof Error)
      assert.ok(!(error instanceof RangeError), "Nesting guard must precede a stack overflow")
      assert.match(error.message, /nest|depth/i)
      return true
    },
  )
})

console.log(`Verified ${checks} upstream compatibility smoke checks; no files were generated.`)
