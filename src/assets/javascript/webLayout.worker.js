// The whole-library layout, off the main thread.
//
// 3,600 nodes and 7,500 threads take d3-force ~25ms a tick and ~130 ticks to
// settle: several seconds on a phone, which on the main thread is several
// seconds of a frozen screen. Here it runs at full speed while the screen
// stays live, posting positions every few ticks so the web is seen weaving
// itself. The layout is remembered afterwards (WebScreen.vue), so this runs
// once per change to the library, not once per visit.
//
// Message in:  { nodes: [{ id, x, y, fx, fy }], links: [{ source, target }], dial }
// Messages out: { type: 'tick', alpha, positions: Float32Array }  (x0,y0,x1,y1,…)
//               { type: 'done', positions: Float32Array }
import { forceSimulation, forceLink, forceManyBody, forceX, forceY, forceCollide } from 'd3-force';

const POST_EVERY_TICKS = 3;

function positionsOf (nodes) {
  const out = new Float32Array(nodes.length * 2);
  nodes.forEach((node, i) => { out[i * 2] = node.x; out[i * 2 + 1] = node.y; });
  return out;
}

self.onmessage = (event) => {
  const { nodes, links, dial } = event.data;
  const link = forceLink(links).id((d) => d.id).distance(dial.linkDistance);
  if (dial.linkStrength != null) link.strength(dial.linkStrength);
  const simulation = forceSimulation(nodes)
    .force('link', link)
    .force('charge', forceManyBody().strength(dial.charge).distanceMax(dial.chargeMax).theta(dial.theta))
    .force('x', forceX(0).strength(dial.gravity))
    .force('y', forceY(0).strength(dial.gravity))
    .alphaDecay(dial.alphaDecay)
    .stop();
  if (dial.collide) simulation.force('collide', forceCollide((d) => d.r * dial.collide).iterations(1));

  let ticks = 0;
  while (simulation.alpha() > simulation.alphaMin()) {
    simulation.tick();
    ticks += 1;
    if (ticks % POST_EVERY_TICKS === 0) {
      const positions = positionsOf(nodes);
      self.postMessage({ type: 'tick', alpha: simulation.alpha(), positions }, [positions.buffer]);
    }
  }
  const positions = positionsOf(nodes);
  self.postMessage({ type: 'done', positions }, [positions.buffer]);
};
