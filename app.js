var http = require('http');
const KJUR = require('jsrsasign')
var express = require('express');

var OpenTok = require('opentok');
var { RtcTokenBuilder, RtcRole } = require('agora-access-token')

const AccessToken = require('twilio').jwt.AccessToken;

// Vonage/TokBox Cred
var vonageAPIKey = "47546991";
var vonageSecret = "59203ea5e094de7fff67cb229a9a5d0753d873c5";

//Agora Cred 
var agoraAppID = "3b8f398e00dc4602b06c60416a3a16b2";
var agoraAppCertificate = "ce24a9cb5e04407abb93fa79a251c119";
var expirationTimeInSeconds = 3600

//Zoom Cred 
var ZOOM_API_KEY = "RCSaKX53beXEwKzstNVSdqPk9ERbnMg7kAl6";

var app = express();
app.disable('x-powered-by');
app.set('port', 8080);
app.use(express.favicon());
app.use(app.router);

app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

const VideoGrant = AccessToken.VideoGrant;

function tokenGenerator(identity, room) {
  // Create an access token which we will sign and return to the client,
  // containing the grant we just created
  const token = new AccessToken(
    'ACf2dddd4c5aa931567228e5f837ae1c49',
    'SKeb70b556ae033532f8937be742a80264',
    'q6YeGIiM71l2fQcbOsCJgx5Fln981aLk'
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

app.get('/twillio/token', function(request, response) {
    const identity = request.query.identity || 'identity';
    const room = request.query.room;

    res.setHeader('Content-Type', 'application/json');
    res.header("Access-Control-Allow-Origin", "*")
    response.send({"token": tokenGenerator(identity, room)});
});


// OpenTok/ Vonage Routes
var opentok = new OpenTok(vonageAPIKey, vonageSecret);
var roomToSessionIdDictionary = {};

app.get('/vonage/session', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Origin", "localhost:3000")
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
        res.header("Access-Control-Allow-Origin", "*")

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

            // now that the room name has a session associated wit it, store it in memory
            // IMPORTANT: Because this is stored in memory, restarting your server will reset these values
            // if you want to store a room-to-session association in your production application
            // you should use a more persistent storage for them
            roomToSessionIdDictionary[roomName] = session.sessionId;

            // generate token
            token = opentok.generateToken(session.sessionId);
            res.setHeader('Content-Type', 'application/json');
            res.header("Access-Control-Allow-Origin", "*")

            res.send({
                apiKey: vonageAPIKey,
                sessionId: session.sessionId,
                token: token
            });
        });
    }
});

// Agora Routes
app.get('/agoraRtcToken', function(req, resp) {
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

    resp.header("Access-Control-Allow-Origin", "*")
    return resp.json({ 'key': key }).send();
});


// Zoom Routes
app.get('/zoomsignature/:name', (req, res) => {

    const iat = Math.round((new Date().getTime() - 30000) / 1000)
    const exp = iat + 60 * 60 * 2

    const oHeader = { alg: 'HS256', typ: 'JWT' }

    const oPayload = {
      app_key: ZOOM_API_KEY,
      tpc:  req.params.name,
      session_key: '',
      iat: iat,
      exp: exp
    }
  
    const sHeader = JSON.stringify(oHeader)
    const sPayload = JSON.stringify(oPayload)
    const signature = KJUR.jws.JWS.sign('HS256', sHeader, sPayload, 'RCSaKX53beXEwKzstNVSdqPk9ERbnMg7kAl6')
    res.header("Access-Control-Allow-Origin", "*")

    res.json({
      signature: signature
    })
  })


http.createServer(app).listen(process.env.PORT || app.get('port'), function() {
    console.log('Agora Server starts at ' + app.get('port'));
});
