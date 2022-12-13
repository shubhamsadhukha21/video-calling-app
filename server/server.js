const express = require("express");
const app = express();
const PORT = 4000;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
//👇🏻 New imports
const http = require("http").Server(app);
const cors = require("cors");

app.use(cors());

const socketIO = require('socket.io')(http, {
    cors: {
        origin: "<http://localhost:3000>"
    }
});

socketIO.on('connection', (socket) => {
    console.log(`⚡: ${socket.id} user just connected!`);
    socket.emit('me', socket.id)
    socket.on('data', (data) => {
      console.log('Got data: ', data);
      // Send it back to the clients
    //   socket.emit(data)
        const parsedData = JSON.parse(data)
        console.log('Parsed Data: ', parsedData)
        if ( parsedData.to ) {
            socketIO.to(parsedData.to).emit('data', data)
        }
    });
    socket.on('type', (type) => {
      console.log('Got type: ', type);
    });
    socket.on('offer', (offer) => {
      console.log('Got offer = ', offer);
    });
    socket.on('disconnect', () => {
      socket.disconnect()
      console.log('🔥: A user disconnected');
    });
});

app.get("/", (req, res) => {
    res.json({
        message: "Video Chat App Socket Server",
    });
});

http.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
});