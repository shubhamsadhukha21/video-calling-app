import {StyleSheet, View} from 'react-native';
import React, {useState, useEffect, useRef} from 'react';
import WebSocket from '../utils/socket';
import {Text, Modal} from 'react-native-paper';
import {Button} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {TextInput} from 'react-native-paper';
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

const STUN_SERVER_CONFIG = {
  iceServers: [
    // {
    //   urls: 'stun:stun.l.google.com:19302',
    // },
    // {
    //   urls: 'stun:stun1.l.google.com:19302',
    // },
    // {
    //   urls: 'stun:stun2.l.google.com:19302',
    // },
    {
      urls: 'stun:openrelay.metered.ca:80',
    },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

const CallScreenTwo = ({navigation, ...props}) => {
  const [localSocketId, setLocalSocketId] = useState(null);
  const [peerSocketId, setPeerSocketId] = useState(null);
  const [socketActive, setSocketActive] = useState(false);
  const [callInProgress, setCallInProgress] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(false);

  //   Use Refs
  const SocketConnection = useRef();
  const LocalConnection = useRef();
  const IncomingCallOffer = useRef();

  /*
    App Header Customization
    */
  useEffect(() => {
    navigation.setOptions({
      title: 'Video Call App',
      headerRight: () => (
        <Button mode="text" onPress={() => {}} style={{paddingRight: 10}}>
          Logout
        </Button>
      ),
    });
  }, []);

  /*
    Socket Configuration
*/
  useEffect(() => {
    SocketConnection.current = WebSocket();
    SocketConnection.current.on('connect', () => {
      console.log('Connected to the signaling server: ');
    });

    SocketConnection.current.on('me', id => {
      console.log('Got my socket id from server: ', id);
      setLocalSocketId(id);
      setSocketActive(true);
    });

    SocketConnection.current.on('data', msg => {
      //   console.log('Data --------------------->', msg);
      const data = JSON.parse(msg);
      //   console.log('parsed Data --------------------->', data);
      switch (data.type) {
        case 'login':
          console.log('Login');
          break;
        //when somebody wants to call us
        case 'offer':
          console.log('Offer received ');
          handleOffer(data.offer, data.from);
          break;
        case 'answer':
          console.log('Answer received ');
          handleAnswer(data.answer, data.from);
          break;
        //when a remote peer sends an ice candidate to us
        case 'candidate':
          console.log('Candidate received ');
          handleCandidate(data.candidate, data.from);
          break;
        case 'leave':
          endCall();
          console.log('Leave');
          break;
        default:
          break;
      }
    });

    SocketConnection.current.on('connect_error', err => {
      console.log('Connect Error from socket server: ', err); // undefined
    });
    SocketConnection.current.on('error', err => {
      console.log('On Error from socket server: ', err); // undefined
    });
    SocketConnection.current.on('disconnect', () => {
      console.log('Disconnected from socket server: '); // undefined
    });

    return () => {
      // close the socket if the view is unmounted
      if (SocketConnection.current.connected) {
        SocketConnection.current.close();
        SocketConnection.current = null;
      }
    };
  }, []);

  /*
RTC Use Effects
*/
  useEffect(() => {
    // Init Local Video and register peer events
    console.log('socket active: ', socketActive);
    if (socketActive) {
      startLocalVideo();
      registerPeerEvents();
    }
  }, [socketActive]);

  const startLocalVideo = () => {
    LocalConnection.current = new RTCPeerConnection(STUN_SERVER_CONFIG);
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
      .then(stream => {
        LocalConnection.current.addStream(stream);
        setLocalStream(stream);

        const remote = new MediaStream();
        setRemoteStream(remote);

        // Push tracks from local stream to peer connection
        stream.getTracks().forEach(track => {
          LocalConnection.current.getLocalStreams()[0].addTrack(track);
        });
      })
      .catch(error => {
        // Log error
        console.log('Could not access camera: ', error);
      });
  };

  const registerPeerEvents = () => {
    // Pull tracks from peer connection, add to remote video stream
    LocalConnection.current.ontrack = event => {
      event.streams[0].getTracks().forEach(track => {
        remote.addTrack(track);
      });
    };

    LocalConnection.current.onaddstream = event => {
      setRemoteStream(event.stream);
    };

    // Setup ice handling
    LocalConnection.current.onicecandidate = event => {
      if (event.candidate) {
        send({
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };
  };

  /*
    Calling methods
    */
  const doCall = () => {
    console.log('Calling user ', peerSocketId);
    setCallInProgress(true);
    // const otherUser = receiverId;
    // connectedUser.current = otherUser;
    // console.log('Caling to', otherUser);

    // create an offer
    LocalConnection.current.createOffer().then(offerDescription => {
      LocalConnection.current.setLocalDescription(offerDescription).then(() => {
        // console.log(offer);
        send({
          type: 'offer',
          offer: {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
          },
        });
        console.log('Sent Offer to signaling server. . .');
        // Send pc.localDescription to peer
      });
    });
  };

  const endCall = () => {
    // Dispose the offer
    if (IncomingCallOffer.current) IncomingCallOffer.current = null;
    setCallInProgress(false);
    setIncomingCall(false);
    if (localStream) {
      localStream.getAudioTracks()[0].stop();
      localStream.getVideoTracks()[0].stop();
      setLocalStream(null);
    }
    setRemoteStream(null);
    LocalConnection.current.onicecandidate = null;
    LocalConnection.current.ontrack = null;
    send({
      type: 'leave',
    });
    console.log('Ended Call. . .');

    resetPeer();
  };

  const resetPeer = () => {
    startLocalVideo();
    registerPeerEvents();
  };

  const handleOffer = (offerDescription, fromSocketId) => {
    IncomingCallOffer.current = {offer: offerDescription};
    setPeerSocketId(fromSocketId);
    setIncomingCall(true); // This will show the popup to accept or reject call
    setCallInProgress(false);
    console.log(fromSocketId + ' is calling you.');
    // if (!callInProgress) acceptIncomingCall();
  };

  const acceptIncomingCall = () => {
    console.log('Accepting incoming Call from ', peerSocketId);
    setIncomingCall(false);

    const {offer} = IncomingCallOffer.current;
    LocalConnection.current
      .setRemoteDescription(new RTCSessionDescription(offer))
      .then(function () {
        console.log('accept call done setting offer ', offer);
        return LocalConnection.current.createAnswer();
      })
      .then(function (answer) {
        console.log('accept call created answer ', answer);
        LocalConnection.current.setLocalDescription(answer);
        // Send the answer to the remote peer using the signaling server
        send({
          type: 'answer',
          answer: answer,
        });
        setCallInProgress(true);
      })
      .catch(err => {
        // Dispose the offer
        if (IncomingCallOffer.current) IncomingCallOffer.current = null;
        console.log('Error acessing camera', err);
      });
  };

  const rejectIncomingCall = () => {
    console.log('Reject incoming Call. . .');
    send({
      type: 'leave',
    });
    setIncomingCall(false);
    setCallInProgress(false);
  };

  const handleAnswer = (answer, fromSocketId) => {
    setCallInProgress(true);
    LocalConnection.current
      .setRemoteDescription(new RTCSessionDescription(answer))
      .then(() => {})
      .catch(err => {
        console.log('Could not set remote description on answer ', err);
        setCallInProgress(false);
      });
  };

  const handleCandidate = (candidate, fromSocketId) => {
    // console.log('Candidate ----------------->', candidate);
    LocalConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
  };

  // Socket Send Data Function
  const send = params => {
    const body = {
      ...params,
      from: localSocketId,
      to: peerSocketId,
    };
    SocketConnection.current.emit('data', JSON.stringify(body));
  };

  return (
    <View style={styles.root}>
      <Text selectable>Your Caller Id: {localSocketId || 'N.A'}</Text>
      <View style={styles.inputField}>
        <TextInput
          label="Enter Friends Id"
          mode="outlined"
          style={{marginBottom: 7}}
          onChangeText={text => setPeerSocketId(text)}
        />
        <Text>SOCKET ACTIVE:{socketActive ? 'TRUE' : 'FASLE'}</Text>
        <Button
          mode="contained"
          onPress={doCall}
          loading={callInProgress}
          //   style={styles.btn}
          contentStyle={styles.btnContent}
          disabled={!socketActive || !peerSocketId || callInProgress}>
          Call
        </Button>
        <Button
          mode="contained"
          onPress={endCall}
          contentStyle={styles.btnContent}
          disabled={!callInProgress}>
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

      <Modal
        visible={incomingCall && !callInProgress}
        onDismiss={rejectIncomingCall}>
        <View
          style={{
            backgroundColor: 'white',
            padding: 22,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 4,
            borderColor: 'rgba(0, 0, 0, 0.1)',
          }}>
          <Text>{peerSocketId || 'Unknown' + ' is calling you'}</Text>

          <Button title="Accept" onPress={acceptIncomingCall}>
            Accept Call
          </Button>
          <Button title="Reject" onPress={rejectIncomingCall}>
            Reject Call
          </Button>
        </View>
      </Modal>
    </View>
  );
};

export default CallScreenTwo;

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
