import { io } from "socket.io-client";

// const SOCKET_URL = 'ws://localhost:4000'
const SOCKET_URL = 'ws://77d8-103-76-82-153.ngrok.io';

const WebSocket = () => io.connect(SOCKET_URL, {
    transports: ['websocket']
 });

export default WebSocket;