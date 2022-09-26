// Common Imports
const http = require('http');
const express = require('express');
var jwt = require('jsonwebtoken');
var uuid4 = require('uuid4');

// Agora Imports
const { RtcTokenBuilder, RtcRole } = require('agora-access-token')

// Twilio Imports
const AccessToken = require('twilio').jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

// Vonage Imports
const OpenTok = require('opentok');

// Zoom Imports
const KJUR = require('jsrsasign')

const expirationTimeInSeconds = 3600

//Agora Cred 
let agoraAppID = "5368a8c9785e462197a41827cda88d96";
let agoraAppCertificate = "e4c907781536450783184d5f00c12f4f";

// Vonage/TokBox Cred
let vonageAPIKey = "47562661";
let vonageSecret = "5fe5b9cc1a1a341456a659d0b7cce7422b7253c6";

// Twilio Cred
let twilioAccountSID = "ACf2dddd4c5aa931567228e5f837ae1c49";
let twilioSDKSID = "SKde01609b75480614a95ceefb90fe2406";
let twilioSecret = "BqNU0oSHMaznNhFLxo8uEk76OGcie7TR";

//Zoom Cred 
let zoomAPIKey = "RCSaKX53beXEwKzstNVSdqPk9ERbnMg7kAl6";
let zoomSecret = "RCSaKX53beXEwKzstNVSdqPk9ERbnMg7kAl6";

let app = express();
app.disable('x-powered-by');
app.set('port', 8080);
app.use(express.favicon());
app.use(app.router);


// 100MS Cred
var app_access_key = '62ded320c16640065695d3fe';
var app_secret = 'eAk_W9fZh1OTxMIE5qcQ6B-gbPn3T6NGyuxvfRH4-7MEZxoGRvM7D1-g57ip1F2lj3MSWNIBHq_KBv0Im7RQFvBlyJ4UXu7VKKnSa6jWNPAvxZ-ErBh7NVM57NhgEwyQ2JtYdBhmY5AWj8K3hEeAPj8lv6X3iasMLvcLTZrWHDA=';

function setOrigin(req, res) {
    const allowedOrigins = ['https://agora-3d464.web.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    return res
}

app.get('/twillio/token', function (req, res) {
    res = setOrigin(req, res)

    const room = req.query.room;
    const name = req.query.name || 'identity';

    res.setHeader('Content-Type', 'application/json');
    res.send({ "token": tokenGenerator(name, room) });
});

function tokenGenerator(identity, room) {
    const token = new AccessToken(
        twilioAccountSID,
        twilioSDKSID,
        twilioSecret
    );

    // Assign identity to the token
    token.identity = identity;

    // Grant the access token Twilio Video capabilities
    const grant = new VideoGrant();
    grant.room = room;
    token.addGrant(grant);

    // Serialize the token to a JWT string
    return token.toJwt();
}

// OpenTok/ Vonage Routes
var opentok = new OpenTok(vonageAPIKey, vonageSecret);
var roomToSessionIdDictionary = {};
app.get('/vonage/session', function (req, res) {
    res = setOrigin(req, res)
    res.setHeader('Content-Type', 'application/json');
    res.redirect('/vonage/room/session');
});

app.get('/vonage/room', function (req, res) {
    res = setOrigin(req, res)
    var roomName = req.query.name;

    var token;

    if (roomToSessionIdDictionary[roomName]) {
        let sessionId = roomToSessionIdDictionary[roomName];
        // generate token
        token = opentok.generateToken(sessionId);
        res.setHeader('Content-Type', 'application/json');

        res.send({
            apiKey: vonageAPIKey,
            sessionId: sessionId,
            token: token
        });
    } else {
        opentok.createSession({ mediaMode: 'routed' }, function (err, session) {
            if (err) {
                res.status(500).send({ error: 'createSession error:' + err });
                return;
            }

            roomToSessionIdDictionary[roomName] = session.sessionId;

            token = opentok.generateToken(session.sessionId);
            res.setHeader('Content-Type', 'application/json');
            res.send({
                apiKey: vonageAPIKey,
                sessionId: session.sessionId,
                token: token
            });
        });
    }
});

// Agora Routes
app.get('/agoraRtcToken', function (req, res) {
    res = setOrigin(req, res)
    
    var role = req.query.role || RtcRole.PUBLISHER;
    var currentTimestamp = Math.floor(Date.now() / 1000)
    var privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds
    var channelName = req.query.channelName;
    // use 0 if uid is not specified
    var uid = 0
    if (!channelName) {
        return res.status(400).json({ 'error': 'channel name is required' }).send();
    }

    var key = RtcTokenBuilder.buildTokenWithUid(agoraAppID, agoraAppCertificate, channelName, uid, role, privilegeExpiredTs);
    return res.json({ 'key': key }).send();
});


// Zoom Routes
app.get('/zoomsignature/:name', (req, res) => {
    res = setOrigin(req, res)
    const iat = Math.round((new Date().getTime() - 30000) / 1000)
    const exp = iat + 60 * 60 * 2

    const oHeader = { alg: 'HS256', typ: 'JWT' }

    const oPayload = {
        app_key: zoomAPIKey,
        tpc: req.params.name,
        session_key: '',
        iat: iat,
        exp: exp
    }

    const sHeader = JSON.stringify(oHeader)
    const sPayload = JSON.stringify(oPayload)
    const signature = KJUR.jws.JWS.sign('HS256', sHeader, sPayload, zoomSecret)

    res.json({
        signature: signature
    })
})

// 100MS Routes
app.get('/100msAuthToken/managementToken', (req, res) => {
    res = setOrigin(req, res)
    jwt.sign(
        {
            access_key: app_access_key,
            type: 'management',
            version: 2,
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000)
        },
        app_secret,
        {
            algorithm: 'HS256',
            expiresIn: '24h',
            jwtid: uuid4()
        },
        function (err, token) {
            console.log("err", err);
            console.log("createManagementToken", token);
            res.send({
                token: token
            })
        }
    );
});

app.get('/100msAuthToken/authtoken', (req, res) => {
    res = setOrigin(req, res)
    let roomID = req.query.roomID;
    console.log("room ID ", roomID);
    var payload = {
        access_key: app_access_key,
        room_id: roomID,
        user_id: uuid4(),
        role: 'guest',
        type: 'app',
        version: 2,
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000)
    };
    jwt.sign(
        payload,
        app_secret,
        {
            algorithm: 'HS256',
            expiresIn: '24h',
            jwtid: uuid4()
        },
        function (err, token) {
            console.log("Error", err)
            res.send({
                token: token
            })
    })

});

function createRoom(roomName, onCompletion) {
    console.log("Room Name", roomName);
    createManagementToken((token) => {
        console.log("Creating Room", token);
        console.log("Creating roomName", roomName);
    })
}



http.createServer(app).listen(process.env.PORT || app.get('port'), function () {
    console.log('Agora Server starts at ' + app.get('port'));
});
