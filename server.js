// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var app = express();
var server = http.Server(app);
var io = socketIO(server);

var rooms = 0;

// DB settings
// https://mongoosejs.com/docs/api.html
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/spyGame');
var Schema = mongoose.Schema;

var gameScheme = new Schema({
    roomID: {
        type: String,
    },
    p1score: {
        type: Number,
    },
    p2score: {
        type: Number,
    },
    hidingSpy: {
        type: Number,
    }
})
var GameDB = mongoose.model('GameDB', gameScheme);
//mongoose.deleteModel('GameDB');

app.set('port', 5000);
app.use(express.static('.'));

// Routing
app.get('/', function (request, response) {
    response.sendFile(path.join(__dirname, 'index.html'));
});
// Starts the server.
server.listen(5000, function () {
    console.log('Starting server on port 5000');
});

//rand spy
function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}


/* ################### Socket #################### */

io.on('connection', function (socket) {
    //console.log('A user connected!'); // Keegi ühines

    //new game
    socket.on('createGame', function (data) {
        socket.join('R' + ++rooms);
        socket.emit('newGame', { name: data.name, room: 'R' + rooms, hidingSpy: data.hidingSpy });
        //console.log("Spy hiding in R" + rooms + " under tile #" + data.hidingSpy);
        // Database fun to insert new row
        try {
            GameDB.create({ roomID: "R" + rooms, p1score: 0, p2score: 0, hidingSpy: data.hidingSpy });
        } catch (e) {
            console.log(e);
        };

    });

    // Connect Player 2
    socket.on('joinGame', function (data) {
        var room = io.nsps['/'].adapter.rooms[data.room];
        if (room && room.length == 1) {
            socket.join(data.room);
            socket.broadcast.to(data.room).emit('player1', {});
            //DB fun
            GameDB.findOne({ roomID: data.room }, null, { "sort": { "_id": -1 } }, function (err, roomData) {
                socket.emit('player2', { name: data.name, room: data.room, hidingSpy: roomData.hidingSpy })
            });
        }
        else {
            socket.emit('err', { message: 'Sorry, The room is full or it doesn\'t exist!' });
        }
    });

    //play turned
    socket.on('playTurn', function (data) {
        socket.broadcast.to(data.room).emit('turnPlayed', {
            field: data.field,
            room: data.room
        });
    });

    // update winnings
    socket.on('gameGetInfo', function (data) {
        GameDB.findOne({ roomID: data.room }, null, { "sort": { "_id": -1 } }, function (err, roomData) {
            socket.broadcast.to(data.room).emit('gameInfo', {
                P1Wins: roomData.p1score,
                P2Wins: roomData.p2score
            });
        });
    });

    //looser will get info.
    socket.on('gameEnded', function (data) {
        socket.broadcast.to(data.room).emit('gameEnd', data);
        console.log("Winner: " + data.winner);
        if (data.winner == 'X') {
            GameDB.findOneAndUpdate({ roomID: data.room }, { $set: { hidingSpy: data.hidingSpy }, $inc: { p1score: 1 } }, (err, doc) => {
                if (err) { console.log("Something wrong when updating data!"); }
                //console.log(doc);
            });
        } else {
            GameDB.findOneAndUpdate({ roomID: data.room }, { $set: { hidingSpy: data.hidingSpy }, $inc: { p2score: 1 } }, (err, doc) => {
                if (err) { console.log("Something wrong when updating data!"); }
                //console.log(doc);
            });
        }
    });

    // if player disconnects
    socket.on('disconnecting', function () {
        Object.keys(socket.rooms).forEach(function (roomName) {
            //for testing purpose deletemany, for live deleteone
            GameDB.deleteMany({ roomID: roomName }, (err, delGame) => {
                if (err) { console.log("Something wrong when updating data!"); }
                console.log(delGame);
            });
            socket.broadcast.to(roomName).emit('resetGame', {
                message: 'Opponent left the game! Page is resetted.'
            });
        });
    });
});