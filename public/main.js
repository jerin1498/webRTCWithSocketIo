let divSelectRoom = document.getElementById('selectRoom')
let divConsultingRoom = document.getElementById('consultingRoom')
let inputRoomNumber = document.getElementById('roomNumber')
let btnGoRoom = document.getElementById('goRoom')
let localVideo = document.getElementById('localVideo')
let remoteVideo = document.getElementById('remoteVideo')
let h2CallName = document.getElementById('callName')
let inputCallName = document.getElementById('inputCallName')
let btnSetName = document.getElementById('setName')

let roomNumber, localStream, remoteStream, rtcPeerConnection, isCaller, dataChannel

const iceServers = {
	'iceServers': [
		{'urls': 'stun:stun.services.mozilla.com'},
		{'urls': 'stun:stun.l.google.com:19302'}
	]
}

const socket = io()

const streamConstraints = {
	audio: true,
	video: true
}

btnGoRoom.onclick = () => {
	if(inputRoomNumber.value === ''){
		alert('Please type a room name')
	}else {
		roomNumber = inputRoomNumber.value
		socket.emit('create or join', roomNumber)
		divSelectRoom.style = 'display: none'
		divConsultingRoom.style = 'display: block'
	}
}

btnSetName.onclick = () => {
	if(inputCallName.value === ''){
		alert('Please type a call name')
	}else {
		dataChannel.send(inputCallName.value)
		h2CallName.innerText = inputCallName.value
	}
}

socket.on('created', room => {
	// to access our camera api
	navigator.mediaDevices.getUserMedia(streamConstraints) 
		.then(stream => {
			localStream = stream
			localVideo.srcObject = stream
			isCaller = true
		})
		.catch(err => {
			console.log('an error occoured ', err)
		})
})

socket.on('joined', room => {
	// to access our camera api
	navigator.mediaDevices.getUserMedia(streamConstraints) 
		.then(stream => {
			localStream = stream
			localVideo.srcObject = stream
			socket.emit('ready', roomNumber)
		})
		.catch(err => {
			console.log('an error occoured ', err)
		})
})

socket.on('ready', () => {
	if(isCaller){
		rtcPeerConnection = new RTCPeerConnection(iceServers)
		rtcPeerConnection.onicecandidate = onIceCandidate
		rtcPeerConnection.ontrack = onAddStream
		rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream)
		rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream)
		rtcPeerConnection.createOffer()
			.then(sessionDescription => {
				console.log('sending offer', sessionDescription)
				rtcPeerConnection.setLocalDescription(sessionDescription)
				socket.emit('offer', {
					type: 'offer',
					sdp: sessionDescription,
					room: roomNumber
				})
			})
			.catch(err => {
				console.log(err)
			})
		//  for data channel
		dataChannel = rtcPeerConnection.createDataChannel(roomNumber)
		console.log('data channel from caller', dataChannel)
		dataChannel.onmessage = event => {h2CallName.innerText = event.data}
	}
})

socket.on('offer', event => {
	if(!isCaller){
		rtcPeerConnection = new RTCPeerConnection(iceServers)
		rtcPeerConnection.onicecandidate = onIceCandidate
		rtcPeerConnection.ontrack = onAddStream
		rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream)
		rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream)
		console.log('received offer', event)
		rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event))
		rtcPeerConnection.createAnswer()
			.then(sessionDescription => {
				console.log('sending answer', sessionDescription)
				rtcPeerConnection.setLocalDescription(sessionDescription)
				socket.emit('answer', {
					type: 'answer',
					sdp: sessionDescription,
					room: roomNumber
				})
			})
			.catch(err => {
				console.log(err)
			})
		// for data channel
		rtcPeerConnection.ondatachannel = event => { 
			dataChannel = event.channel  
			console.log('data channel from callee', dataChannel)
			dataChannel.onmessage = event => {h2CallName.innerText = event.data}
		}
	}
})

socket.on('answer', event => {
	console.log('received answer', event)
	rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event))
})

socket.on('candidate', event => {
	const candidate = new RTCIceCandidate({
		sdpMLineIndex: event.label,
		candidate: event.candidate
	})
	console.log('recived candidare', candidate)
	rtcPeerConnection.addIceCandidate(candidate)
})

function onAddStream(event){
	remoteVideo.srcObject = event.streams[0]
	remoteStream = event.streams[0]
}

function onIceCandidate(event) {
	if(event.candidate){
		console.log('sending ice candidate', event.candidate)
		socket.emit('candidate', {
			type: 'candidate',
			label: event.candidate.sdpMLineIndex,
			id: event.candidate.sdpMid,
			candidate: event.candidate.candidate,
			room: roomNumber
		})
	}
}