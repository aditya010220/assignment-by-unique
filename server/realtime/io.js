const { Server } = require('socket.io');

let io = null;

/**
 * Attaches Socket.IO to an existing HTTP server.
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    // Client connected
    socket.on('disconnect', () => {
      // Client disconnected
    });
  });

  return io;
}

/**
 * Returns active Socket.IO server instance.
 */
function getIO() {
  return io;
}

/**
 * Pushes new lead event to all connected clients.
 * @param {Object} lead
 */
function emitNewLead(lead) {
  if (io) {
    io.emit('new-lead', lead);
  }
}

/**
 * Returns number of currently connected socket clients.
 */
function getConnectedClientsCount() {
  if (!io) return 0;
  return io.engine ? io.engine.clientsCount : 0;
}

/**
 * Closes Socket.IO server.
 */
function closeSocket() {
  if (io) {
    io.close();
    io = null;
  }
}

module.exports = {
  initSocket,
  getIO,
  emitNewLead,
  getConnectedClientsCount,
  closeSocket,
};
