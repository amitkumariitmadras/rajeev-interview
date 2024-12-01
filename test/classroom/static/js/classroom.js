// Global variables
let localStream;
let peerConnections = {};
let roomName = 'myClassroom';  // This should be dynamically set based on the room
let socket = new WebSocket('ws://' + window.location.host + '/ws/classroom/' + roomName + '/');

// Get user media (camera)
async function getUserMedia() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream = stream;
        document.getElementById('localVideo').srcObject = stream;

        // After getting the local media, send the offer to the server
        socket.send(JSON.stringify({ 'type': 'offer', 'sdp': await createOffer() }));
    } catch (err) {
        console.error('Error accessing media devices.', err);
    }
}

// Create an SDP offer
async function createOffer() {
    const peerConnection = new RTCPeerConnection();
    peerConnections[peerConnection] = peerConnection;

    // Add local stream to the peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.send(JSON.stringify({
                'type': 'candidate',
                'candidate': event.candidate
            }));
        }
    };

    peerConnection.ontrack = event => {
        const remoteVideo = document.createElement('video');
        remoteVideo.srcObject = event.streams[0];
        remoteVideo.autoplay = true;
        remoteVideo.id = 'remoteVideo' + Object.keys(peerConnections).length;
        document.getElementById('remoteVideos').appendChild(remoteVideo);
    };

    // Create offer and set local description
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    return offer;
}

// Handle WebSocket messages from the server
socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    const { type, sdp, candidate } = data;

    switch (type) {
        case 'offer':
            // If received an offer, create an answer
            await handleOffer(sdp);
            break;
        case 'answer':
            // If received an answer, set the remote description
            await handleAnswer(sdp);
            break;
        case 'candidate':
            // If received ICE candidate, add it to the peer connection
            await handleCandidate(candidate);
            break;
    }
};

// Handle incoming offer
async function handleOffer(sdp) {
    const peerConnection = new RTCPeerConnection();
    peerConnections[peerConnection] = peerConnection;

    // Add tracks to the peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.send(JSON.stringify({
                'type': 'candidate',
                'candidate': event.candidate
            }));
        }
    };

    peerConnection.ontrack = event => {
        const remoteVideo = document.createElement('video');
        remoteVideo.srcObject = event.streams[0];
        remoteVideo.autoplay = true;
        remoteVideo.id = 'remoteVideo' + Object.keys(peerConnections).length;
        document.getElementById('remoteVideos').appendChild(remoteVideo);
    };

    // Set remote description from the offer
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

    // Create and send an answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify({
        'type': 'answer',
        'sdp': answer
    }));
}

// Handle incoming answer
async function handleAnswer(sdp) {
    const peerConnection = Object.values(peerConnections).find(pc => pc.remoteDescription === null);
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
}

// Handle incoming ICE candidate
async function handleCandidate(candidate) {
    const peerConnection = Object.values(peerConnections).find(pc => pc.remoteDescription !== null);
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
}

// Initialize
getUserMedia();
