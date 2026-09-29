// Team A — Server-Sent Events (SSE) Hub
// Streams real-time updates for queue activity, rule evaluations, and lock transitions.

class SSEService {
  constructor() {
    this.clients = new Set();
    // Heartbeat to keep connections active
    this.heartbeat = setInterval(() => {
      this.broadcastComment('ping');
    }, 25000);
    if (this.heartbeat && typeof this.heartbeat.unref === 'function') {
      this.heartbeat.unref();
    }
  }

  /**
   * Registers a new SSE client connection.
   * @param {Object} res - Express Response object
   * @param {Object} req - Express Request object
   */
  addClient(res, req) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    res.write('event: connected\ndata: {"status":"connected","service":"team-a-eligibility"}\n\n');
    this.clients.add(res);

    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  /**
   * Broadcasts an SSE event to all connected clients.
   * @param {string} eventName
   * @param {Object} data
   */
  broadcast(eventName, data) {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Sends an SSE comment (e.g. heartbeat ping).
   * @param {string} comment
   */
  broadcastComment(comment) {
    const payload = `: ${comment}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }
}

// Singleton instance
const sseService = new SSEService();
module.exports = sseService;
