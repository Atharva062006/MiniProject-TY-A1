// Team B — Adjacency List Graph for skill-to-drive mapping
// Vertices: student skill nodes + drive requirement nodes
// Edges:    weighted match edges

class AdjacencyList {
  constructor() {
    this.vertices = new Map(); // vertexId -> { data }
    this.edges = new Map();    // vertexId -> [ { to, weight } ]
    this.version = 1;
  }

  addVertex(id, data = {}) {
    this.vertices.set(id, data);
    if (!this.edges.has(id)) this.edges.set(id, []);
    this.version++;
  }

  addEdge(from, to, weight = 1) {
    if (!this.edges.has(from)) this.edges.set(from, []);
    this.edges.get(from).push({ to, weight });
    this.version++;
  }

  getNeighbors(vertexId) {
    return this.edges.get(vertexId) || [];
  }

  removeVertex(id) {
    this.vertices.delete(id);
    this.edges.delete(id);
    for (const [, adj] of this.edges) {
      const idx = adj.findIndex(e => e.to === id);
      if (idx !== -1) adj.splice(idx, 1);
    }
    this.version++;
  }

  getVersion() { return this.version; }

  toJSON() {
    return {
      version: this.version,
      vertices: Object.fromEntries(this.vertices),
      edges: Object.fromEntries(
        [...this.edges.entries()].map(([k, v]) => [k, v])
      ),
    };
  }
}

module.exports = AdjacencyList;
