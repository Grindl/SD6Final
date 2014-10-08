var datagramInterface = require('dgram');
var udpPort = 5000;

var udpServer = datagramInterface.createSocket('udp4');
udpServer.bind(udpPort);

var Map = require("collection").Map;
var clientMap = new Map();
var currentMessage;

var clientsInRoomsMap = [new Map(), new Map(), new Map(), new Map(), new Map(), new Map(), new Map(), new Map(), new Map()];

var nextClientID = 1;

var TYPE_None = 0;
var TYPE_Ack = 1;
var TYPE_Nack = 2;
var TYPE_KeepAlive = 3;
var TYPE_CreateRoom = 4;
var TYPE_JoinRoom = 5;
var TYPE_LobbyUpdate = 6;
var TYPE_GameUpdate = 7;
var TYPE_GameReset = 8;
var TYPE_Respawn = 9;
var TYPE_Hit = 10;
var TYPE_Fire = 11;
var TYPE_ReturnToLobby = 12;

var ERROR_Unknown = 0;
var ERROR_RoomEmpty = 1;
var ERROR_RoomFull = 2;
var ERROR_BadRoomID = 3;

var TankPacket = function()
{

}


//==========================================================================================

var packForSend = function(unpackedObj)
{
    preparedPacket = new Buffer(48);
    preparedPacket.writeUInt8(unpackedObj.packetType, 0);
    preparedPacket.writeUInt8(unpackedObj.clientID, 1);
    //2 and 3 are padded
    preparedPacket.writeUInt32LE(unpackedObj.number, 4);
    preparedPacket.writeDoubleLE(unpackedObj.timestamp, 8);
    //end header; sections begin at offset 16
    if (unpackedObj.packetType == TYPE_Ack)
    {
        preparedPacket.writeUInt8(unpackedObj.AckPacket.packetType, 16);
        //17-19 are padded
        preparedPacket.writeUInt32LE(unpackedObj.AckPacket.number, 20);
    }
    else if(unpackedObj.packetType == TYPE_Nack)
    {
        preparedPacket.writeUInt8(unpackedObj.NackPacket.packetType, 16);
        //17-19 are padded
        preparedPacket.writeUInt32LE(unpackedObj.NackPacket.number, 20);
        preparedPacket.writeUInt8(unpackedObj.NackPacket.errorCode, 24);
    }
    else if(unpackedObj.packetType == TYPE_KeepAlive) //should never be sent
    {
        //intentionally empty
    }
    else if(unpackedObj.packetType == TYPE_CreateRoom) //should never be sent
    {
        preparedPacket.writeUInt8(unpackedObj.CreateRoomPacket.room, 16);
    }
    else if(unpackedObj.packetType == TYPE_JoinRoom) //should never be sent
    {
        preparedPacket.writeUInt8(unpackedObj.JoinRoomPacket.room, 16);
    }
    else if(unpackedObj.packetType == TYPE_LobbyUpdate)
    {
        //write a uint8 array of size 8 in to the buffer
        for(var i = 0; i < unpackedObj.LobbyUpdatePacket.playersInRoomNumber.length; i++)
        {
            preparedPacket.writeUInt8(unpackedObj.LobbyUpdatePacket.playersInRoomNumber[i], 16+i);
        }
    }
    else if(unpackedObj.packetType == TYPE_GameUpdate)
    {
        preparedPacket.writeFloatLE(unpackedObj.GameUpdatePacket.xPosition, 16);
        preparedPacket.writeFloatLE(unpackedObj.GameUpdatePacket.yPosition, 20);
        preparedPacket.writeFloatLE(unpackedObj.GameUpdatePacket.xVelocity, 24);
        preparedPacket.writeFloatLE(unpackedObj.GameUpdatePacket.yVelocity, 28);
        preparedPacket.writeFloatLE(unpackedObj.GameUpdatePacket.xAcceleration, 32);
        preparedPacket.writeFloatLE(unpackedObj.GameUpdatePacket.yAcceleration, 36);
        preparedPacket.writeFloatLE(unpackedObj.GameUpdatePacket.orientationDegrees, 40);
        preparedPacket.writeUInt8(unpackedObj.GameUpdatePacket.health, 44);
        preparedPacket.writeUInt8(unpackedObj.GameUpdatePacket.score, 45);
    }
    else if(unpackedObj.packetType == TYPE_GameReset)
    {
        preparedPacket.writeFloatLE(unpackedObj.GameResetPacket.xPosition, 16);
        preparedPacket.writeFloatLE(unpackedObj.GameResetPacket.yPosition, 20);
        preparedPacket.writeFloatLE(unpackedObj.GameResetPacket.orientationDegrees, 24);
        preparedPacket.writeUInt8(unpackedObj.GameResetPacket.id, 28);
    }
    else if(unpackedObj.packetType == TYPE_Respawn)
    {
        preparedPacket.writeFloatLE(unpackedObj.RespawnPacket.xPosition, 16);
        preparedPacket.writeFloatLE(unpackedObj.RespawnPacket.yPosition, 20);
        preparedPacket.writeFloatLE(unpackedObj.RespawnPacket.orientationDegrees, 24);
    }
    else if(unpackedObj.packetType == TYPE_Hit)
    {
        preparedPacket.writeUInt8(unpackedObj.HitPacket.instigatorID, 16);
        preparedPacket.writeUInt8(unpackedObj.HitPacket.targetID, 17);
        preparedPacket.writeUInt8(unpackedObj.HitPacket.damageDealt, 18);
    }
    else if(unpackedObj.packetType == TYPE_Fire)
    {
        preparedPacket.writeUInt8(unpackedObj.GunfirePacket.instigatorID, 16);
    }
    else if(unpackedObj.packetType == TYPE_ReturnToLobby)
    {
        //intentionally empty
    }
    return preparedPacket;
}

var unpackPacket = function(inPacket)
{
    var unpackedObj = new TankPacket();

    unpackedObj.packetType = inPacket.readUInt8(0);
    unpackedObj.clientID = inPacket.readUInt8(1);
    //2 and 3 are padded
    unpackedObj.number = inPacket.readUInt32LE(4);
    unpackedObj.timestamp = inPacket.readDoubleLE(8);
    //end header; sections begin at offset 16
    if (unpackedObj.packetType == TYPE_Ack)
    {
        unpackedObj.AckPacket = {};
        unpackedObj.AckPacket.packetType = inPacket.readUInt8(16);
        //17-19 are padded
        unpackedObj.AckPacket.number = inPacket.readUInt32LE(20);
    }
    else if(unpackedObj.packetType == TYPE_Nack)
    {
        unpackedObj.NackPacket = {};
        unpackedObj.NackPacket.packetType = inPacket.readUInt8(16);
        //17-19 are padded
        unpackedObj.NackPacket.number = inPacket.readUInt32LE(20);
        unpackedObj.NackPacket.errorCode = inPacket.readUInt8(24);
    }
    else if(unpackedObj.packetType == TYPE_KeepAlive)
    {
        //intentionally empty
    }
    else if(unpackedObj.packetType == TYPE_CreateRoom)
    {
        unpackedObj.CreateRoomPacket = {};
        unpackedObj.CreateRoomPacket.room = inPacket.readUInt8(16);
    }
    else if(unpackedObj.packetType == TYPE_JoinRoom)
    {
        unpackedObj.JoinRoomPacket = {};
        unpackedObj.JoinRoomPacket.room = inPacket.readUInt8(16);
    }
    else if(unpackedObj.packetType == TYPE_LobbyUpdate) //should never be received
    {
        unpackedObj.LobbyUpdatePacket = {};
        //read a uint8 array of size 8 in to the buffer
        for(var i = 0; i < unpackedObj.LobbyUpdatePacket.playersInRoomNumber.length; i++)
        {
            unpackedObj.LobbyUpdatePacket.playersInRoomNumber[i] = preparedPacket.readUInt8(16+i);
        }
    }
    else if(unpackedObj.packetType == TYPE_GameUpdate)
    {
        unpackedObj.GameUpdatePacket = {};
        unpackedObj.GameUpdatePacket.xPosition = inPacket.readFloatLE(16);
        unpackedObj.GameUpdatePacket.yPosition = inPacket.readFloatLE(20);
        unpackedObj.GameUpdatePacket.xVelocity = inPacket.readFloatLE(24);
        unpackedObj.GameUpdatePacket.yVelocity = inPacket.readFloatLE(28);
        unpackedObj.GameUpdatePacket.xAcceleration = inPacket.readFloatLE(32);
        unpackedObj.GameUpdatePacket.yAcceleration = inPacket.readFloatLE(36);
        unpackedObj.GameUpdatePacket.orientationDegrees = inPacket.readFloatLE(40);
        unpackedObj.GameUpdatePacket.health = inPacket.readUInt8(44);
        unpackedObj.GameUpdatePacket.score = inPacket.readUInt8(45);
    }
    else if(unpackedObj.packetType == TYPE_GameReset) //should never be received
    {
        unpackedObj.GameResetPacket = {};
        unpackedObj.GameResetPacket.xPosition = inPacket.readFloatLE(16);
        unpackedObj.GameResetPacket.yPosition = inPacket.readFloatLE(20);
        unpackedObj.GameResetPacket.orientationDegrees = inPacket.readFloatLE(24);
        unpackedObj.GameResetPacket.id = inPacket.readUInt8(28);
    }
    else if(unpackedObj.packetType == TYPE_Respawn) //should never be received
    {
        unpackedObj.RespawnPacket = {};
        unpackedObj.RespawnPacket.xPosition = inPacket.readFloatLE(16);
        unpackedObj.RespawnPacket.yPosition = inPacket.readFloatLE(20);
        unpackedObj.RespawnPacket.orientationDegrees = inPacket.readFloatLE(24);
    }
    else if(unpackedObj.packetType == TYPE_Hit) //should never be received
    {
        unpackedObj.HitPacket = {};
        unpackedObj.HitPacket.instigatorID = inPacket.readUInt8(16);
        unpackedObj.HitPacket.targetID = inPacket.readUInt8(17);
        unpackedObj.HitPacket.damageDealt = inPacket.readUInt8(18);
    }
    else if(unpackedObj.packetType == TYPE_Fire)
    {
        unpackedObj.GunfirePacket = {};
        unpackedObj.GunfirePacket.instigatorID = inPacket.readUInt8(16);
    }
    else if(unpackedObj.packetType == TYPE_ReturnToLobby) //should never be received
    {
        //intentionally empty
    }
    return unpackedObj;
}

//==========================================================================================


var getNumInRoom = function(roomToCount)
{
    var numInRoom = 0;
    clientMap.each(function(currClient)
    {
        //console.log("I am in room num "+currClient.value().roomIn);
        if(currClient.value().roomIn == roomToCount)
        {
            numInRoom++;
        }
    });
    //console.log("In room "+roomToCount+" there are "+numInRoom+" people");
    return numInRoom;
}


//==========================================================================================

var ackResponse = function(inPacket, currentClient)
{
    //@TODO loop through pending packets in the client's guaranteed delivery queue, and remove the corresponding ones
}

var nackResponse = function(inPacket, currentClient)
{
    //@TODO loop through pending packets in the client's guaranteed delivery queue, and remove the corresponding ones
}

var keepaliveResponse = function(inPacket, currentClient)
{
    var outObj = new TankPacket();

    outObj.packetType = TYPE_LobbyUpdate;
    outObj.clientID = currentClient.clientID;
    currentClient.number++;
    outObj.number = currentClient.number;
    outObj.timestamp = Date.now();

    outObj.LobbyUpdatePacket = {};
    outObj.LobbyUpdatePacket.playersInRoomNumber = [0, 0, 0, 0, 0, 0, 0, 0];
    for(var i = 1; i < clientsInRoomsMap.length; i++)
    {
        //outObj.LobbyUpdatePacket.playersInRoomNumber[i] = clientsInRoomsMap[i].length;
        outObj.LobbyUpdatePacket.playersInRoomNumber[i-1] = getNumInRoom(i);
    }

    var outPacket = packForSend(outObj);
    console.log("Sending Lobby update for keepalive "+currentClient.address+':'+currentClient.port+" of length "+outPacket.length);
    udpServer.send(outPacket, 0, outPacket.length, currentClient.port, currentClient.address);
}

var createRoomResponse = function(inPacket, currentClient)
{
    var roomNum = inPacket.CreateRoomPacket.room;
    var wasSuccessful = false;
    //if room is empty
    if(roomNum <= 8 && roomNum > 0)
    {
        if(getNumInRoom(roomNum) == 0)
        {
            //remove them from the lobby
            clientsInRoomsMap[0].remove(currentClient.address+':'+currentClient.port);
            //@TODO make the room
            //put them in it
            clientsInRoomsMap[roomNum].set(currentClient.address+':'+currentClient.port, currentClient);
            currentClient.roomIn = roomNum;
            //@TODO and init them
            //@TODO also send them a game reset
            wasSuccessful = true;
        }
    }

    if(wasSuccessful)
    {
        //and send back an ack
        var outObj = new TankPacket();
        outObj.packetType = TYPE_Ack;
        outObj.clientID = currentClient.clientID;
        currentClient.number++;
        outObj.number = currentClient.number;
        outObj.timestamp = Date.now();

        outObj.AckPacket = {};
        outObj.AckPacket.packetType = inPacket.packetType;
        outObj.AckPacket.number = inPacket.number;
        
        var outPacket = packForSend(outObj);
        console.log("Sending Ack for create room "+currentClient.address+':'+currentClient.port+" of length "+outPacket.length);
        udpServer.send(outPacket, 0, outPacket.length, currentClient.port, currentClient.address);
    }
    else
    {
        //else send back a nack
        var outObj = new TankPacket();
        outObj.packetType = TYPE_Nack;
        outObj.clientID = currentClient.clientID;
        currentClient.number++;
        outObj.number = currentClient.number;
        outObj.timestamp = Date.now();

        outObj.NackPacket = {};
        outObj.NackPacket.packetType = inPacket.packetType;
        outObj.NackPacket.number = inPacket.number;
        outObj.NackPacket.errorCode = ERROR_Unknown; //@TODO send down the error code 

        var outPacket = packForSend(outObj);
        console.log("Sending Nack for create room "+currentClient.address+':'+currentClient.port+" of length "+outPacket.length);
        udpServer.send(outPacket, 0, outPacket.length, currentClient.port, currentClient.address);
    }
    
}

var joinRoomResponse = function(inPacket, currentClient)
{
    var roomNum = inPacket.JoinRoomPacket.room;
    var wasSuccessful = false;
    //if room is not empty
    if(roomNum == 0)
    {
         //remove them from the lobby
        clientsInRoomsMap[currentClient.roomIn].remove(currentClient.address+':'+currentClient.port);
        //put them in it
        clientsInRoomsMap[roomNum].set(currentClient.address+':'+currentClient.port, currentClient);
        currentClient.roomIn = roomNum;
        wasSuccessful = true;

        //send a first lobby for JD
        var lobbyOutObj = new TankPacket();

        lobbyOutObj.packetType = TYPE_LobbyUpdate;
        lobbyOutObj.clientID = currentClient.clientID;
        currentClient.number++;
        lobbyOutObj.number = currentClient.number;
        lobbyOutObj.timestamp = Date.now();

        lobbyOutObj.LobbyUpdatePacket = {};
        lobbyOutObj.LobbyUpdatePacket.playersInRoomNumber = [0, 0, 0, 0, 0, 0, 0, 0];
        for(var i = 1; i < clientsInRoomsMap.length; i++)
        {
            //lobbyOutObj.LobbyUpdatePacket.playersInRoomNumber[i] = clientsInRoomsMap[i].length;
            lobbyOutObj.LobbyUpdatePacket.playersInRoomNumber[i-1] = getNumInRoom(i);
        }

        var outLobbyPacket = packForSend(lobbyOutObj);
        console.log("Sending Lobby update for keepalive "+currentClient.address+':'+currentClient.port+" of length "+outLobbyPacket.length);
        udpServer.send(outLobbyPacket, 0, outLobbyPacket.length, currentClient.port, currentClient.address);
    }
    else if(roomNum <= 8 && roomNum > 0)
    {
        if(getNumInRoom(roomNum) != 0)
        {
            //remove them from the lobby
            clientsInRoomsMap[0].remove(currentClient.address+':'+currentClient.port);
            //put them in it
            clientsInRoomsMap[roomNum].set(currentClient.address+':'+currentClient.port, currentClient);
            currentClient.roomIn = roomNum;
            //@TODO and init them
            //@TODO also send them a game reset
            wasSuccessful = true;
        }
    }

    if(wasSuccessful)
    {
        //and send back an ack
        var outObj = new TankPacket();
        outObj.packetType = TYPE_Ack;
        outObj.clientID = currentClient.clientID;
        currentClient.number++;
        outObj.number = currentClient.number;
        outObj.timestamp = Date.now();

        outObj.AckPacket = {};
        outObj.AckPacket.packetType = inPacket.packetType;
        outObj.AckPacket.number = inPacket.number;

        var outPacket = packForSend(outObj);
        console.log("Sending Ack for join room "+currentClient.address+':'+currentClient.port+" of length "+outPacket.length);
        udpServer.send(outPacket, 0, outPacket.length, currentClient.port, currentClient.address);


    }
    else
    {
        //else send back a nack
        var outObj = new TankPacket();
        outObj.packetType = TYPE_Nack;
        outObj.clientID = currentClient.clientID;
        currentClient.number++;
        outObj.number = currentClient.number;
        outObj.timestamp = Date.now();

        outObj.NackPacket = {};
        outObj.NackPacket.packetType = inPacket.packetType;
        outObj.NackPacket.number = inPacket.number;
        outObj.NackPacket.errorCode = ERROR_Unknown; //@TODO send down the error code 

        var outPacket = packForSend(outObj);
        console.log("Sending Nack for join room "+currentClient.address+':'+currentClient.port+" of length "+outPacket.length);
        udpServer.send(outPacket, 0, outPacket.length, currentClient.port, currentClient.address);
    }
}

//No lobby update response

var gameUpdateResponse = function(inPacket, currentClient)
{
    //@TODO only update if it's the most recent update packet
    //update client's position in the room
    currentClient.unit = inPacket.GameUpdatePacket;
    //@TODO possibly ignore updates shortly after a reset/respawn
}

//no game reset response

//no respawn response

//no hit response

var fireResponse = function(inPacket, currentClient)
{
    //@TODO guaranteed echo to all in room
    //@TODO check for impact
    //@TODO if impact, guaranteed hit to all in room
}

//no return to lobby response

var packetResponse = function(inPacket, currentClient)
{
    //unpack the packet and have it handled by the appropriate function
    var parsedPacket = unpackPacket(inPacket);
    if(parsedPacket.packetType == TYPE_Ack)
    {
        ackResponse(parsedPacket, currentClient);
    }
    else if(parsedPacket.packetType == TYPE_Nack)
    {
        nackResponse(parsedPacket, currentClient);
    }
    else if(parsedPacket.packetType == TYPE_KeepAlive)
    {
        keepaliveResponse(parsedPacket, currentClient);
    }
    else if(parsedPacket.packetType == TYPE_CreateRoom)
    {
        createRoomResponse(parsedPacket, currentClient);
    }
    else if(parsedPacket.packetType == TYPE_JoinRoom)
    {
        joinRoomResponse(parsedPacket, currentClient);
    }
    else if(parsedPacket.packetType == TYPE_GameUpdate)
    {
        gameUpdateResponse(parsedPacket, currentClient);
    }
    else if(parsedPacket.packetType == TYPE_Fire)
    {
        fireResponse(parsedPacket, currentClient);
    }
    else
    {
        //@TODO send them a nack; bad packet ID
    }
    
    if(currentClient.lastSentUpdateTime < Date.now() - 50)
    {
        //@TODO if enough time has passed, and they are in a room, give them a game update
        //foreach person in their room
        //pack up their unit, and send it to this person
        currentClient.lastSentUpdateTime = Date.now();
    }

    //update the current time for the user
    currentClient.lastMessageTime = Date.now();
}

//==========================================================================================

var parsePacket = function(inPacket, inSender)
{
    var unpackedPacket = unpackPacket(inPacket);
    var packetType = inPacket.readUInt8(0);
    if (packetType === 5) 
    {
        //is a join room
        var roomNum = inPacket.readUInt8(16);//start of packet meat
        if (roomNum === 0) 
        {
            console.log("Joined Lobby\n");
            //TODO send ack
            var outPacket = new Buffer(48);
            outPacket[0] = 1;
            outPacket[16] = 5;
            udpServer.send(outPacket, 0, outPacket.length, inSender.port, inSender.address);
            var lobbyOutPacket = new Buffer(48);
            lobbyOutPacket[0] = 6;
            udpServer.send(lobbyOutPacket, 0, lobbyOutPacket.length, inSender.port, inSender.address);
        }
        else
        {
            //TODO check the room exitsts, but for now, send a nack
            var outPacket = new Buffer(48);
            outPacket[0] = 2;
            outPacket[16] = 5;
            udpServer.send(outPacket, 0, outPacket.length, inSender.port, inSender.address);
        }
    }
    else if(packetType === 3)
    {
        console.log("Got keepalive\n");
        //send them the lobby
        var outPacket = new Buffer(48);
        outPacket[0] = 6;
        udpServer.send(outPacket, 0, outPacket.length, inSender.port, inSender.address);
    }

}


var sendToRoom = function(roomMap, outPacket)
{

}


var sendToAll = function (currentClient) 
{
    if (currentClient.value().LastMessageTime < Date.now() - 5000) 
    {
        console.log('Removing  IP: ' + currentClient.value().address + ':' + currentClient.value().port + '\n');
        clientMap.remove(currentClient);
    }
    else
    {
        udpServer.send(currentMessage, 0, currentMessage.length, currentClient.value().port, currentClient.value().address);
    }
}

udpServer.on('message', function (msg, sender) {
    //udpServer.send(msg, 0, msg.length, sender.port, sender.address);
    currentMessage = msg;
    //parsePacket(msg, sender);
    if (!clientMap.has(sender.address + ':' + sender.port)) {
        sender.clientID = nextClientID;
        nextClientID++;
        sender.roomIn = 0;
        sender.number = 0;
        sender.lastSentUpdateTime = Date.now();
        console.log("New client at time " + Date.now() + " : " + sender.address + ':' + sender.port + ' ID: ' + sender.clientID + '\n');
        clientsInRoomsMap[0].set(sender.address + ':' + sender.port, sender);
        clientMap.set(sender.address + ':' + sender.port, sender);
    }
    //console.log('From IP: ' + sender.address + ':' + sender.port + '\n' + msg);
    sender.lastMessageTime = Date.now();
    
    var foundSender = clientMap.get(sender.address + ':' + sender.port);
    //clientMap.each(sendToAll);
    //parsePacket(msg, sender);
    packetResponse(msg, foundSender);
});