(function init() {
    const P1 = 'X';
    const P2 = 'O';
    const Spy = '?';
    let player;
    let game;

    const socket = io();

    class Player {
        constructor(name, type) {
            this.name = name;
            this.type = type;
            this.currentTurn = true;
        }

        // Set the currentTurn and update UI
        setCurrentTurn(turn) {
            this.currentTurn = turn;
            const message = turn ? 'Your turn' : 'Waiting for Opponent';
            $('#turn').text(message);
        }

        getPlayerName() {
            return this.name;
        }

        getPlayerType() {
            return this.type;
        }

        getCurrentTurn() {
            return this.currentTurn;
        }
    }

    // roomId Id of the room
    class Game {
        constructor(roomId, hidingSpy) {
            this.roomId = roomId;
            this.hidingSpy = hidingSpy;
        }

        // Create the Game board by attaching event listeners to the buttons.
        createGameBoard() {

            function tileClickHandler() {
                const field = parseInt(this.id.split('B')[1], 10);
                if (!player.getCurrentTurn() || !game) {
                    alert('Its not your turn!');
                    return;
                }
                if ($(this).prop('disabled')) {
                    alert('This tile has already been played on!');
                    return;
                }

                // Update board after your turn
                game.playTurn(this);
                game.updateBoard(player.getPlayerType(), field);

                player.setCurrentTurn(false);

                game.checkWinner(field);
            }

            // Add gameboard and click
            document.getElementById('gameField').innerHTML = "";
            var sel = document.getElementById('gameField');
            var frag = document.createDocumentFragment();
            for (let i = 0; i < 25; i++) {
                //Generate gamefield
                var opt = document.createElement('button');
                opt.type = "button";
                opt.id = "B" + i;
                opt.className = "btn btn-secondary btn-lg";
                opt.innerHTML = Spy;
                opt.onclick = tileClickHandler;
                frag.appendChild(opt);
                (i + 1) % 5 === 0 && frag.appendChild(document.createElement('br'));
            }
            sel.appendChild(frag);


        }
        // Remove the menu from DOM, display the gameboard and greet the player.
        displayBoard(message) {
            $('#newGame').css('display', 'none');
            $('#gameInfo').css('display', 'block');
            $('#userHello').html(message);
            this.createGameBoard();
            $('#gameRoom').html(this.roomId);
        }

        displayStatus(data){
            console.log("[gameInfo] P1:" + data.P1Wins + " P2 " + data.P2Wins);
            $('#gameP1Wins').html(data.P1Wins);
            $('#gameP2Wins').html(data.P2Wins);
        }

        refreshSpy(hidingSpy){
            this.hidingSpy = hidingSpy;
            //console.log("[refreshSpy] New spy at: "+ hidingSpy);
        }
        
        // Update game board UI
        updateBoard(type, field) {
            $(`#B${field}`).text(type).prop('disabled', true);
        }

        getRoomId() {
            return this.roomId;
        }

        // Send an update to the opponent
        playTurn(field) {

            const clickedField = $(field).attr('id');
            // Emit an event to update other player that you've played your turn.
            socket.emit('playTurn', {
                field: clickedField,
                room: this.getRoomId(),
            });
        }

        checkWinner(field) {
            console.log("[checkWinner] Clicked: "+field+" &  Spy: "+this.hidingSpy);
            if (field == this.hidingSpy) {
                game.announceWinner();
            }
        }

        // Announce the winner if the current client has won. 
        // Broadcast this on the room to let the opponent know.
        announceWinner() {
            const message = `${player.getPlayerName()} wins!`;
            const newHidingSpy = getRandomInt(25);
            socket.emit('gameEnded', {
                room: this.getRoomId(),
                hidingSpy: newHidingSpy,
                winner: player.getPlayerType(),
                message,
            });
            alert(message);
            this.createGameBoard();
            this.hidingSpy = newHidingSpy;
            //console.log("[announceWinner] New spy at: "+newHidingSpy);
            socket.emit('gameGetInfo', {room: this.getRoomId()});
        }

        // End the game if the other player won.
        endGame(message) {
            alert(message);
            this.createGameBoard();
            socket.emit('gameGetInfo', {room: this.getRoomId()});
        }

        resetGame(message) {
            alert(message);
            location.reload();
        }
    }

    function getRandomInt(max) {
        return Math.floor(Math.random() * Math.floor(max));
    }

    // Create a new game. Emit newGame event.
    $('#new').on('click', () => {
        const name = $('#nameNew').val();
        if (!name) {
            alert('Please enter your name.');
            return;
        }
        socket.emit('createGame', { name, hidingSpy: getRandomInt(25) });
        player = new Player(name, P1);
    });

    // Join an existing game on the entered roomId. Emit the joinGame event.
    $('#join').on('click', () => {
        const name = $('#nameJoin').val();
        const roomID = $('#room').val();
        if (!name || !roomID) {
            alert('Please enter your name and game ID.');
            return;
        }
        socket.emit('joinGame', { name, room: roomID });
        player = new Player(name, P2);
    });

    // New Game created by current client. Update the UI and create new Game var.
    socket.on('newGame', (data) => {
        const message =
            `Hello, ${data.name}. Please ask your friend to enter Game ID:  ${data.room}. 
            <br><br>Waiting for player 2...`;

        // Create game for player 1
        game = new Game(data.room, data.hidingSpy);
        //console.log(game)
        game.displayBoard(message);
    });

    //If player creates the game (P1)
    socket.on('player1', (data) => {
        const message = `Hello, ${player.getPlayerName()}`;
        $('#userHello').html(message);
        player.setCurrentTurn(true);
    });

    //Joined the game, so player is P2
    socket.on('player2', (data) => {
        const message = `Hello, ${data.name}`;

        // Create game for player 2
        game = new Game(data.room, data.hidingSpy);
        //console.log(data.hidingSpy);
        game.displayBoard(message);
        player.setCurrentTurn(false);
    });

    //Opponent played his turn. Update UI.
    socket.on('turnPlayed', (data) => {
        const field = data.field.split('B')[1];
        const opponentType = player.getPlayerType() === P1 ? P2 : P1;

        game.updateBoard(opponentType, field);
        player.setCurrentTurn(true);
    });

    // update winnings
    socket.on('gameInfo', (data) => {
        game.displayStatus(data);
    });

    //If the other player wins, this event is received. Notify user game has ended.
    socket.on('gameEnd', (data) => {
        game.endGame(data.message);
        game.refreshSpy(data.hidingSpy);
    });

    // End the game when opp left
    socket.on('resetGame', (data) => {
        game.resetGame(data.message);
    });

    // End the game on err event. 
    socket.on('err', (data) => {
        alert(data.message);
    });
}());