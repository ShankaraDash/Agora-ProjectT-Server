// Common Imports
const http = require('http');
const express = require('express');

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
let vonageAPIKey = "47546991";
let vonageSecret = "59203ea5e094de7fff67cb229a9a5d0753d873c5";

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

// Twilio Routes
app.get('/twillio/token', function (request, response) {
    const name = request.query.name || 'identity';
    const room = request.query.room;

    response.setHeader('Content-Type', 'application/json');
    response.setHeader("Access-Control-Allow-Origin", " https://agora-3d464.web.app")
    response.setHeader("Access-Control-Allow-Origin", "http://localhost:3000")
    response.send({ "token": tokenGenerator(name, room) });
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
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", " https://agora-3d464.web.app")
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000")

    res.redirect('/vonage/room/session');
});

app.get('/vonage/room/:name', function (req, res) {
    var roomName = req.params.name;
    var token;

    if (roomToSessionIdDictionary[roomName]) {
        let sessionId = roomToSessionIdDictionary[roomName];
        // generate token
        token = opentok.generateToken(sessionId);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader("Access-Control-Allow-Origin", " https://agora-3d464.web.app")
        res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000")

        res.send({
            apiKey: vonageAPIKey,
            sessionId: sessionId,
            token: token
        });
    }
    else {
        opentok.createSession({ mediaMode: 'routed' }, function (err, session) {
            if (err) {
                console.log(err);
                res.status(500).send({ error: 'createSession error:' + err });
                return;
            }

            roomToSessionIdDictionary[roomName] = session.sessionId;

            token = opentok.generateToken(session.sessionId);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader("Access-Control-Allow-Origin", " https://agora-3d464.web.app")
            res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000")

            res.send({
                apiKey: vonageAPIKey,
                sessionId: session.sessionId,
                token: token
            });
        });
    }
});

// Agora Routes
app.get('/agoraRtcToken', function (req, resp) {
    var role = req.query.role || RtcRole.PUBLISHER;

    var currentTimestamp = Math.floor(Date.now() / 1000)
    var privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds
    var channelName = req.query.channelName;
    // use 0 if uid is not specified
    var uid = 0
    if (!channelName) {
        return resp.status(400).json({ 'error': 'channel name is required' }).send();
    }

    var key = RtcTokenBuilder.buildTokenWithUid(agoraAppID, agoraAppCertificate, channelName, uid, role, privilegeExpiredTs);

    resp.setHeader("Access-Control-Allow-Origin", "https://agora-3d464.web.app")
    resp.setHeader("Access-Control-Allow-Origin", "http://localhost:3000")
    return resp.json({ 'key': key }).send();
});


// Zoom Routes
app.get('/zoomsignature/:name', (req, res) => {

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
    res.setHeader("Access-Control-Allow-Origin", "https://agora-3d464.web.app")
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000")

    res.json({
        signature: signature
    })
})


http.createServer(app).listen(process.env.PORT || app.get('port'), function () {
    console.log('Agora Server starts at ' + app.get('port'));
});
