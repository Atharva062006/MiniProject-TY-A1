// Team B — Adjacency Matrix Graph
// For comparison experiments vs AdjacencyList

class AdjacencyMatrix {
  constructor(vertexIds = []) {
    this.vertexIndex = new Map(); // id -> index
    this.vertices = [];
    this.matrix = [];
    this.version = 1;
    vertexIds.forEach(id => this.addVertex(id));
  }

  _resize() {
    const n = this.vertices.length;
    this.matrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (this.matrix[i] && this.matrix[i][j]) || 0)
    );
  }

  addVertex(id, data = {}) {
    const idx = this.vertices.length;
    this.vertexIndex.set(id, idx);
    this.vertices.push({ id, data });
    this._resize();
    this.version++;
  }

  addEdge(from, to, weight = 1) {
    const fi = this.vertexIndex.get(from);
    const ti = this.vertexIndex.get(to);
    if (fi === undefined || ti === undefined) throw new Error('Vertex not found');
    this.matrix[fi][ti] = weight;
    this.version++;
  }

  getWeight(from, to) {
    const fi = this.vertexIndex.get(from);
    const ti = this.vertexIndex.get(to);
    if (fi === undefined || ti === undefined) return 0;
    return this.matrix[fi][ti];
  }

  getNeighbors(fromId) {
    const fi = this.vertexIndex.get(fromId);
    if (fi === undefined) return [];
    return this.vertices
      .filter((_, j) => this.matrix[fi][j] > 0)
      .map((v, j) => ({ to: v.id, weight: this.matrix[fi][this.vertexIndex.get(v.id)] }));
  }

  getVersion() { return this.version; }
}

module.exports = AdjacencyMatrix;
