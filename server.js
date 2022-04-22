const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
} = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

dotenv.config({
  path: 'config.env'
})

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const botName = '👶 Chotu';

// Run when client connects
io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Welcome current user
    socket.emit('message', formatMessage(botName, 'Welcome to the Chotu chat room!'));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });

  // Listen for chatMessage
  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);

    var request = require('request');
    var options = {
      'method': 'POST',
      'url': 'https://api.tisane.ai/parse',
      'headers': {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': process.env.API_KEY
      },
      body: JSON.stringify({
        "language": "en",
        "content": msg,
        "settings": {
            "snippets": true
        }
      })

    };
    request(options, function (error, response) {
      if (error) throw new Error(error);
      if (!(JSON.parse(response.body).abuse)) {
        io.to(user.room).emit('message', formatMessage(user.username, msg));
      }
    });

  });

  // Runs when client disconnects
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port http://127.0.0.1:${PORT}`));
