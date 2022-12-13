import React, {useEffect, useState, useCallback, useRef} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text, Modal} from 'react-native-paper';
import {Button} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {TextInput} from 'react-native-paper';

import {useFocusEffect} from '@react-navigation/native';

import InCallManager from 'react-native-incall-manager';
import WebSocket from '../utils/socket';

import { io } from "socket.io-client";

// const SOCKET_URL = 'ws://localhost:4000'
const SOCKET_URL = 'https://49a5-103-76-82-153.ngrok.io';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals,
} from 'react-native-webrtc';
// import {acc} from 'react-native-reanimated';

const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302'
];



// const SOCKET_URL = 'wss://127.0.0.1:8000';

export default function CallScreen({navigation, ...props}) {
  const [userId, setUserId] = useState('');
  const [userSocketId, setUserSocketId] = useState('');
  const [socketActive, setSocketActive] = useState(false);
  const [calling, setCalling] = useState(false);
  const [localStream, setLocalStream] = useState({toURL: () => null});
  const [remoteStream, setRemoteStream] = useState({toURL: () => null});
  const [callActive, setCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [otherId, setOtherId] = useState('');
  const [receiverSocketId, setReceiverSocketId] = useState('');
  const [callToUsername, setCallToUsername] = useState('');

  const connectedUser = useRef(null);
  const offerRef = useRef(null);
  const SocketConnection = useRef(WebSocket());
  const localConnection = useRef(
    new RTCPeerConnection({
      iceServers: STUN_SERVERS.map((server) => ({
        urls: server,
      })),
    }),
  );

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('userId').then((id) => {
        console.log('Logged in user id = ', id);
        if (id) {
          setUserId(id);
        } else {
          setUserId('');
          navigation.push('Login');
        }
      });
    }, [userId]),
  );

  useEffect(() => {
    navigation.setOptions({
      title: 'Welcome ' + userId,
      headerRight: () => (
        <Button mode="text" onPress={onLogout} style={{paddingRight: 10}}>
          Logout
        </Button>
      ),
    });
  }, [userId]);


  useEffect(() => {
    /**
     *
     * Sockets Signalling
     */
    console.log('init socket server start ', SocketConnection)
    SocketConnection.current.on('connect', () => {
      console.log('Connected to the signaling server: ');
    })

    SocketConnection.current.on("me", (id) => {
      console.log('Got my socket id from server: ', id);
      setUserSocketId(id)
    });

    SocketConnection.current.on("data", (msg) => {
      console.log('Data --------------------->', msg);
      const data = JSON.parse(msg);
      console.log('parsed Data --------------------->', data);
      switch (data.type) {
        case 'login':
          console.log('Login');
          break;
        //when somebody wants to call us
        case 'offer':
          console.log('Offer received ', data);
          handleOffer(data.offer, data.name, data.sid);
          break;
        case 'answer':
          console.log('Answer received ', data);
          handleAnswer(data.answer, data.sid);
          break;
        //when a remote peer sends an ice candidate to us
        case 'candidate':
          console.log('Candidate received ', data);
          handleCandidate(data.candidate, data.sid);
          break;
        case 'leave':
          handleLeave();
          console.log('Leave');
          break;
        default:
          break;
      }
    });
   
    SocketConnection.current.on("connect_error", (err) => {
      console.log('Connect Error from socket server: ', err); // undefined
    });
    SocketConnection.current.on("error", (err) => {
      console.log('On Error from socket server: ', err); // undefined
    });
    SocketConnection.current.on("disconnect", () => {
      console.log('Disconnected from socket server: '); // undefined
    });
    console.log('init socket server done')
    initLocalVideo();
    registerPeerEvents();
  }, []);

  /**
   * Calling Stuff
   */

  useEffect(() => {
    if (userSocketId && userId.length > 0) {
      send({
        type: 'login',
        name: userId,
      });
      setSocketActive(true);
    }
  }, [userSocketId, userId]);

  useEffect(() => {
    if (!callActive) {
      // InCallManager.stop();
    } else {
      // InCallManager.setSpeakerphoneOn(true);
    }
  }, [callActive]);

  const registerPeerEvents = () => {
    localConnection.current.onaddstream = (event) => {
      console.log('On Add Remote Stream');
      setRemoteStream(event.stream);
    };

    // Setup ice handling
    localConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        send({
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };
  };

  const initLocalVideo = () => {
    // let isFront = false;
    // mediaDevices.enumerateDevices().then(sourceInfos => {
    //   let videoSourceId;
    //   for (let i = 0; i < sourceInfos.length; i++) {
    //     const sourceInfo = sourceInfos[i];
    //     if (
    //       sourceInfo.kind == 'videoinput' &&
    //       sourceInfo.facing == (isFront ? 'front' : 'environment')
    //     ) {
    //       videoSourceId = sourceInfo.deviceId;
    //     }
    //   }
    mediaDevices
      .getUserMedia({
        audio: true,
        video: {
          mandatory: {
            minWidth: 500, // Provide your own width, height and frame rate here
            minHeight: 300,
            minFrameRate: 30,
          },
          facingMode: 'user',
          // optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
        },
      })
      .then((stream) => {
        // Got stream!
        setLocalStream(stream);

        // setup stream listening
        localConnection.current.addStream(stream);
      })
      .catch((error) => {
        // Log error
      });
    // });
  };

  const send = (message) => {
    //attach the other peer username to our messages
    if (connectedUser.current) {
      message.name = connectedUser.current;
      // console.log('Connected iser in end----------', message);
    }
    message.sid = userSocketId
    console.log('Message', message);
    SocketConnection.current.emit('data', JSON.stringify(message));
  };

  const onCall = () => {
    sendCall(callToUsername);
    // setTimeout(() => {
    //   sendCall(callToUsername);
    // }, 1000);
  };

  const sendCall = (receiverId) => {
    setCalling(true);
    const otherUser = receiverId;
    connectedUser.current = otherUser;
    console.log('Caling to', otherUser);
    // create an offer
    localConnection.current.createOffer().then((offer) => {
      localConnection.current.setLocalDescription(offer).then(() => {
        console.log('Sending Ofer');
        // console.log(offer);
        send({
          type: 'offer',
          offer: offer,
        });
        // Send pc.localDescription to peer
      });
    });
  };

  //when somebody sends us an offer
  const handleOffer = async (offer, name, senderSocketId) => {
    console.log(name + ' is calling you.');
    connectedUser.current = name;
    offerRef.current = {name, offer};
    setIncomingCall(true);
    setOtherId(name);
    // acceptCall();
    if (callActive) acceptCall();
  };

  const acceptCall = async () => {
    const name = offerRef.current.name;
    const offer = offerRef.current.offer;
    setIncomingCall(false);
    setCallActive(true);
    console.log('Accepting CALL', name, offer);
    localConnection.current
      .setRemoteDescription(offer)
      .then(function () {
        console.log('accept call done setting offer ', offer)
        connectedUser.current = name;
        return localConnection.current.createAnswer();
      })
      .then(function (answer) {
        console.log('accept call created answer ', answer)
        localConnection.current.setLocalDescription(answer);
        // Send the answer to the remote peer using the signaling server
        send({
          type: 'answer',
          answer: answer,
        });
      })
      .catch((err) => {
        console.log('Error acessing camera', err);
      });

    // try {
    //   await yourConn.setRemoteDescription(new RTCSessionDescription(offer));

    //   const answer = await yourConn.createAnswer();

    //   await yourConn.setLocalDescription(answer);
    //   send({
    //     type: 'answer',
    //     answer: answer,
    //   });
    // } catch (err) {
    //   console.log('Offerr Error', err);
    // }
  };

  //when we got an answer from a remote user
  const handleAnswer = (answer, senderSocketId) => {
    setCalling(false);
    setCallActive(true);
    const rsd = new RTCSessionDescription(answer)
    console.log('Answer before set = ', rsd)
    localConnection.current.setRemoteDescription(rsd);
    console.log('Answer after set = ', rsd)
    // if (!localConnection.current.remoteDescription) {
    //   localConnection.current.setRemoteDescription(rsd);
    // }
  };

  //when we got an ice candidate from a remote user
  const handleCandidate = (candidate, senderSocketId) => {
    setCalling(false);
    // console.log('Candidate ----------------->', candidate);
    localConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
  };

  //hang up
  // const hangUp = () => {
  //   send({
  //     type: 'leave',
  //   });

  //   handleLeave();
  // };

  // const handleLeave = () => {
  //   connectedUser.current = null;
  //   setRemoteStream({toURL: () => null});

  //   // yourConn.close();
  //   // yourConn.onicecandidate = null;
  //   // yourConn.onaddstream = null;
  // };

  const onLogout = () => {
    // hangUp();

    handleLeave();

    AsyncStorage.removeItem('userId').then((res) => {
      navigation.push('Login');
    });
  };

  const rejectCall = async () => {
    send({
      type: 'leave',
    });
    // ``;
    // setOffer(null);

    // handleLeave();
  };

  const handleLeave = () => {
    send({
      name: userId,
      otherName: otherId,
      type: 'leave',
    });

    setCalling(false);
    setIncomingCall(false);
    setCallActive(false);
    offerRef.current = null;
    connectedUser.current = null;
    // localStream.getAudioTracks()[0].stop();
    // localStream.getVideoTracks()[0].stop();
    setRemoteStream(null);
    setLocalStream(null);
    localConnection.current.onicecandidate = null;
    localConnection.current.ontrack = null;

    resetPeer();
    // initLocalVideo();
    // console.log("Onleave");
  };

  const resetPeer = () => {
    localConnection.current = new RTCPeerConnection({
      iceServers: STUN_SERVERS.map((server) => ({
        urls: server,
      })),
    });

    registerPeerEvents();
  };

  /**
   * Calling Stuff Ends
   */

  return (
    <View style={styles.root}>
      <Text selectable>Your Caller Id: {userSocketId || 'N.A'}</Text>
      <View style={styles.inputField}>
        <TextInput
          label="Enter Friends Id"
          mode="outlined"
          style={{marginBottom: 7}}
          onChangeText={(text) => setCallToUsername(text)}
        />
        <Text>
          SOCKET ACTIVE:{socketActive ? 'TRUE' : 'FASLE'}, FRIEND ID:
          {callToUsername || otherId}
        </Text>
        <Button
          mode="contained"
          onPress={onCall}
          loading={calling}
          //   style={styles.btn}
          contentStyle={styles.btnContent}
          disabled={!socketActive || callToUsername === '' || callActive}>
          Call
        </Button>
        <Button
          mode="contained"
          onPress={handleLeave}
          contentStyle={styles.btnContent}
          disabled={!callActive}>
          End Call
        </Button>
      </View>

      <View style={styles.videoContainer}>
        <View style={[styles.videos, styles.localVideos]}>
          <Text>Your Video</Text>
          <RTCView
            streamURL={localStream ? localStream.toURL() : ''}
            style={styles.localVideo}
          />
        </View>
        <View style={[styles.videos, styles.remoteVideos]}>
          <Text>Friends Video</Text>
          <RTCView
            streamURL={remoteStream ? remoteStream.toURL() : ''}
            style={styles.remoteVideo}
          />
        </View>
      </View>

      <Modal visible={incomingCall && !callActive} onDismiss={handleLeave}>
        <View
          style={{
            backgroundColor: 'white',
            padding: 22,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 4,
            borderColor: 'rgba(0, 0, 0, 0.1)',
          }}>
          <Text>{otherId + ' is calling you'}</Text>

          <Button onPress={acceptCall}>Accept Call</Button>
          <Button title="Reject Call" onPress={handleLeave}>
            Reject Call
          </Button>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  root: {
    backgroundColor: '#fff',
    flex: 1,
    padding: 20,
  },
  inputField: {
    marginBottom: 10,
    flexDirection: 'column',
  },
  videoContainer: {
    flex: 1,
    minHeight: 450,
  },
  videos: {
    width: '100%',
    flex: 1,
    position: 'relative',
    overflow: 'hidden',

    borderRadius: 6,
  },
  localVideos: {
    height: 100,
    marginBottom: 10,
  },
  remoteVideos: {
    height: 400,
  },
  localVideo: {
    backgroundColor: '#f2f2f2',
    height: '100%',
    width: '100%',
  },
  remoteVideo: {
    backgroundColor: '#f2f2f2',
    height: '100%',
    width: '100%',
  },
});