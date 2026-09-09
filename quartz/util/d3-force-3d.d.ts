/** The package has no published declarations; this surface mirrors its installed 3.0.6 API. */
declare module "d3-force-3d" {
  import type { Force, Simulation, SimulationNodeDatum as Node2d } from "d3-force"
  export { forceCollide, forceManyBody, forceLink, forceX, forceY } from "d3-force"
  export interface SimulationNodeDatum extends Node2d {
    z?: number
    vz?: number
    fz?: number | null
  }
  export interface Simulation3d<N extends SimulationNodeDatum> extends Simulation<N, undefined> {
    numDimensions(): number
    numDimensions(dimensions: 1 | 2 | 3): this
  }
  export function forceSimulation<N extends SimulationNodeDatum>(
    nodes?: N[],
    dimensions?: 1 | 2 | 3,
  ): Simulation3d<N>
  export interface ForceZ<N extends SimulationNodeDatum> extends Force<N, undefined> {
    strength(): (node: N, index: number, nodes: N[]) => number
    strength(value: number | ((node: N, index: number, nodes: N[]) => number)): this
    z(): (node: N, index: number, nodes: N[]) => number
    z(value: number | ((node: N, index: number, nodes: N[]) => number)): this
  }
  export function forceZ<N extends SimulationNodeDatum>(
    z?: number | ((node: N) => number),
  ): ForceZ<N>
}
